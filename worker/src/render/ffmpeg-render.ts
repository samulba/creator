/**
 * FFmpeg render building blocks (Phase 9). Each function is a thin, explicit
 * wrapper over one FFmpeg invocation (argument arrays only, never a shell
 * string). The render handler composes them; keeping them separate makes the
 * pipeline inspectable and lets the raw FFmpeg operations be smoke-tested on
 * generated media without any live R2/provider data.
 *
 * v1 scope: cut selected moments from the source, concatenate them, overlay
 * narration positioned on the output timeline, duck the gameplay audio under
 * narration, and encode the final MP4. Basic zooms and burned-in captions are
 * intentionally deferred (documented in worker/README.md).
 */

import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import { run } from "../ffmpeg.js";

const SEGMENT_TIMEOUT_MS = 20 * 60_000;

function msToSeconds(ms: number): string {
  return (ms / 1000).toFixed(3);
}

/**
 * Extracts one clip from the source and normalizes it to uniform parameters
 * (resolution, fps, pixel format, stereo 48k audio) so the clips can be
 * concatenated without re-encoding. Input seeking (`-ss` before `-i`) is used
 * for speed; the clip is re-encoded so timestamps reset cleanly.
 */
export async function extractSegment(
  sourceUrl: string,
  startMs: number,
  endMs: number,
  outputPath: string,
  options: { height: number; fps: number; onProgress?: (line: string) => void },
): Promise<void> {
  const durationMs = Math.max(1, endMs - startMs);
  await run(
    "ffmpeg",
    [
      "-y",
      "-ss",
      msToSeconds(startMs),
      "-i",
      sourceUrl,
      "-t",
      msToSeconds(durationMs),
      "-vf",
      `scale=-2:${options.height},fps=${options.fps},format=yuv420p`,
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "22",
      "-c:a",
      "aac",
      "-ar",
      "48000",
      "-ac",
      "2",
      "-video_track_timescale",
      "90000",
      outputPath,
    ],
    { timeoutMs: SEGMENT_TIMEOUT_MS, onStderr: options.onProgress },
  );
}

/**
 * Concatenates uniform segments with the concat demuxer (stream copy — fast,
 * lossless). Produces the gameplay track (video + gameplay audio) on the
 * output timeline.
 */
export async function concatSegments(
  segmentPaths: string[],
  outputPath: string,
  workDir: string,
): Promise<void> {
  const listPath = join(workDir, "concat.txt");
  const list = segmentPaths
    .map((p) => `file '${p.replace(/'/g, "'\\''")}'`)
    .join("\n");
  await writeFile(listPath, list, "utf8");

  await run(
    "ffmpeg",
    ["-y", "-f", "concat", "-safe", "0", "-i", listPath, "-c", "copy", outputPath],
    { timeoutMs: SEGMENT_TIMEOUT_MS },
  );
}

/**
 * Builds a single narration track on the output timeline: each clip is delayed
 * to its output position, the clips are mixed, and the result is padded/trimmed
 * to the exact timeline length. Clip URLs may be presigned HTTP URLs (FFmpeg
 * reads them directly).
 */
export async function buildNarrationTrack(
  clips: Array<{ url: string; delayMs: number }>,
  timelineMs: number,
  outputPath: string,
): Promise<void> {
  const inputs: string[] = [];
  for (const clip of clips) {
    inputs.push("-i", clip.url);
  }

  const parts = clips.map((clip, i) => {
    const delay = Math.max(0, Math.round(clip.delayMs));
    // Resample to a common format, force stereo, then delay to position.
    return `[${i}:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,adelay=${delay}|${delay}[a${i}]`;
  });
  const mixInputs = clips.map((_, i) => `[a${i}]`).join("");
  const timelineSeconds = msToSeconds(timelineMs);
  const filter =
    parts.join(";") +
    `;${mixInputs}amix=inputs=${clips.length}:normalize=0[mixed]` +
    `;[mixed]apad,atrim=0:${timelineSeconds},aresample=48000[narr]`;

  await run(
    "ffmpeg",
    [
      "-y",
      ...inputs,
      "-filter_complex",
      filter,
      "-map",
      "[narr]",
      "-ac",
      "2",
      "-ar",
      "48000",
      "-c:a",
      "pcm_s16le",
      outputPath,
    ],
    { timeoutMs: SEGMENT_TIMEOUT_MS },
  );
}

/**
 * Final mix. With narration: duck the gameplay audio under the narration
 * (sidechain compression) and mix them. Without narration: re-encode the
 * gameplay track as the final. Produces a faststart MP4.
 */
export async function mixFinal(
  gameplayPath: string,
  narrationPath: string | null,
  outputPath: string,
  options: { audioBitrate?: string; onProgress?: (line: string) => void } = {},
): Promise<void> {
  const audioBitrate = options.audioBitrate ?? "192k";

  if (!narrationPath) {
    await run(
      "ffmpeg",
      [
        "-y",
        "-i",
        gameplayPath,
        "-c:v",
        "libx264",
        "-preset",
        "medium",
        "-crf",
        "20",
        "-c:a",
        "aac",
        "-b:a",
        audioBitrate,
        "-movflags",
        "+faststart",
        outputPath,
      ],
      { timeoutMs: SEGMENT_TIMEOUT_MS, onStderr: options.onProgress },
    );
    return;
  }

  // [0:a] gameplay, [1:a] narration. The narration feeds two filters (the
  // sidechain key and the final mix), so it must be asplit into two copies —
  // a filter output label can only be consumed once. Duck the gameplay under
  // narration, then mix both without volume normalization (keeps levels stable).
  const filter =
    "[0:a]aresample=48000[ga];" +
    "[1:a]aresample=48000,asplit=2[na1][na2];" +
    "[ga][na1]sidechaincompress=threshold=0.03:ratio=8:attack=5:release=300[duck];" +
    "[duck][na2]amix=inputs=2:normalize=0:duration=first[aout]";

  await run(
    "ffmpeg",
    [
      "-y",
      "-i",
      gameplayPath,
      "-i",
      narrationPath,
      "-filter_complex",
      filter,
      "-map",
      "0:v",
      "-map",
      "[aout]",
      "-c:v",
      "libx264",
      "-preset",
      "medium",
      "-crf",
      "20",
      "-c:a",
      "aac",
      "-b:a",
      audioBitrate,
      "-movflags",
      "+faststart",
      "-shortest",
      outputPath,
    ],
    { timeoutMs: SEGMENT_TIMEOUT_MS, onStderr: options.onProgress },
  );
}

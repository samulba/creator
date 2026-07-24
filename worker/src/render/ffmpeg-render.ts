/**
 * FFmpeg render building blocks (Phase 9). Each function is a thin, explicit
 * wrapper over one FFmpeg invocation (argument arrays only, never a shell
 * string). The render handler composes them; keeping them separate makes the
 * pipeline inspectable and lets the raw FFmpeg operations be smoke-tested on
 * generated media without any live R2/provider data.
 *
 * Scope: cut the coverage segments from the source (dip-to-black fades at
 * time-skips), concatenate them, overlay narration positioned on the output
 * timeline, duck the gameplay audio under narration, burn in animated ASS
 * captions (captions.ts), and encode the final MP4. Zooms are still deferred.
 */

import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import { run } from "../ffmpeg.js";

const SEGMENT_TIMEOUT_MS = 20 * 60_000;

/**
 * Timeout that scales with the media being processed: a fixed buffer plus a
 * generous multiple of the clip/timeline duration, never below the legacy
 * 20-minute floor. A fixed timeout broke long videos — encoding a 20-minute
 * clip on a small shared vCPU legitimately takes longer than 20 minutes,
 * and the old cap turned that into an endless timeout→retry loop.
 */
export function scaledTimeoutMs(durationMs: number, factor = 3): number {
  const scaled = 5 * 60_000 + Math.round(Math.max(0, durationMs) * factor);
  return Math.max(SEGMENT_TIMEOUT_MS, scaled);
}

/**
 * Parses the `time=HH:MM:SS.cc` field from an ffmpeg stderr progress line
 * into milliseconds of processed output — the basis for honest within-step
 * progress. Returns null for lines without a usable time (e.g. `time=N/A`).
 */
export function parseFfmpegTimeMs(line: string): number | null {
  const match = /time=(\d+):(\d{2}):(\d{2})(?:\.(\d+))?/.exec(line);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  const fraction = match[4] ? Number(`0.${match[4]}`) : 0;
  return Math.round(((hours * 60 + minutes) * 60 + seconds + fraction) * 1000);
}

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
  options: {
    height: number;
    fps: number;
    /** Dip-to-black fade at the clip head (used at time-skips). */
    fadeInMs?: number;
    /** Dip-to-black fade at the clip tail (used at time-skips). */
    fadeOutMs?: number;
    timeoutMs?: number;
    stallTimeoutMs?: number;
    onProgress?: (line: string) => void;
  },
): Promise<void> {
  const durationMs = Math.max(1, endMs - startMs);

  let videoFilter = `scale=-2:${options.height},fps=${options.fps},format=yuv420p`;
  const audioFilters: string[] = [];
  if (options.fadeInMs && options.fadeInMs > 0) {
    videoFilter += `,fade=t=in:st=0:d=${msToSeconds(options.fadeInMs)}`;
    audioFilters.push(`afade=t=in:st=0:d=${msToSeconds(options.fadeInMs)}`);
  }
  if (options.fadeOutMs && options.fadeOutMs > 0) {
    const fadeStart = Math.max(0, durationMs - options.fadeOutMs);
    videoFilter += `,fade=t=out:st=${msToSeconds(fadeStart)}:d=${msToSeconds(options.fadeOutMs)}`;
    audioFilters.push(
      `afade=t=out:st=${msToSeconds(fadeStart)}:d=${msToSeconds(options.fadeOutMs)}`,
    );
  }

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
      videoFilter,
      ...(audioFilters.length ? ["-af", audioFilters.join(",")] : []),
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
    {
      timeoutMs: options.timeoutMs ?? SEGMENT_TIMEOUT_MS,
      stallTimeoutMs: options.stallTimeoutMs,
      onStderr: options.onProgress,
    },
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
  clips: Array<{ url: string; delayMs: number; maxDurationMs?: number }>,
  timelineMs: number,
  outputPath: string,
): Promise<void> {
  const inputs: string[] = [];
  for (const clip of clips) {
    inputs.push("-i", clip.url);
  }

  const parts = clips.map((clip, i) => {
    const delay = Math.max(0, Math.round(clip.delayMs));
    // Never let one narration bleed into the next: atrim caps the clip to
    // its slot (a no-op when the audio is already shorter). Two voices
    // speaking over each other is worse than a slightly clipped line.
    const trim =
      clip.maxDurationMs && clip.maxDurationMs > 0
        ? `,atrim=0:${msToSeconds(clip.maxDurationMs)}`
        : "";
    // Resample to a common format, force stereo, then delay to position.
    return `[${i}:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo${trim},adelay=${delay}|${delay}[a${i}]`;
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
  options: {
    audioBitrate?: string;
    /** ASS subtitle file to burn in (see captions.ts). */
    subtitlesPath?: string | null;
    timeoutMs?: number;
    stallTimeoutMs?: number;
    onProgress?: (line: string) => void;
  } = {},
): Promise<void> {
  const audioBitrate = options.audioBitrate ?? "192k";
  const timeoutMs = options.timeoutMs ?? SEGMENT_TIMEOUT_MS;
  const stallTimeoutMs = options.stallTimeoutMs;
  const subtitles = options.subtitlesPath ?? null;

  if (!narrationPath) {
    await run(
      "ffmpeg",
      [
        "-y",
        "-i",
        gameplayPath,
        ...(subtitles ? ["-vf", `ass=filename=${subtitles}`] : []),
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
      { timeoutMs, stallTimeoutMs, onStderr: options.onProgress },
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
    "[duck][na2]amix=inputs=2:normalize=0:duration=first[aout]" +
    (subtitles ? `;[0:v]ass=filename=${subtitles}[vout]` : "");

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
      subtitles ? "[vout]" : "0:v",
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
    { timeoutMs, stallTimeoutMs, onStderr: options.onProgress },
  );
}

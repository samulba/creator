import { spawn } from "node:child_process";

/**
 * Runs a process with an explicit argument array (never a shell string), so
 * untrusted values such as URLs and object keys cannot be interpreted as
 * shell syntax (see docs/SECURITY.md). Returns stdout on success.
 */
export function run(
  command: string,
  args: string[],
  options: { timeoutMs?: number; onStderr?: (line: string) => void } = {},
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });

    let stdout = "";
    let stderr = "";

    const timeout = options.timeoutMs
      ? setTimeout(() => {
          child.kill("SIGKILL");
          reject(new Error(`${command} timed out after ${options.timeoutMs}ms`));
        }, options.timeoutMs)
      : null;

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      stderr += text;
      if (options.onStderr) {
        for (const line of text.split("\n")) {
          if (line.trim()) options.onStderr(line.trim());
        }
      }
    });

    child.on("error", (error) => {
      if (timeout) clearTimeout(timeout);
      reject(error);
    });

    child.on("close", (code) => {
      if (timeout) clearTimeout(timeout);
      if (code === 0) {
        resolve(stdout);
      } else {
        // Keep only the tail of stderr; never surface full URLs upstream.
        const tail = stderr.split("\n").slice(-6).join("\n");
        reject(new Error(`${command} exited ${code}: ${tail}`));
      }
    });
  });
}

export type ProbeResult = {
  durationMs: number | null;
  width: number | null;
  height: number | null;
  frameRate: number | null;
  videoCodec: string | null;
  audioCodec: string | null;
  formatName: string | null;
};

type FfprobeStream = {
  codec_type?: string;
  codec_name?: string;
  width?: number;
  height?: number;
  r_frame_rate?: string;
};

type FfprobeOutput = {
  format?: { duration?: string; format_name?: string };
  streams?: FfprobeStream[];
};

function parseFrameRate(value: string | undefined): number | null {
  if (!value) return null;
  const [num, den] = value.split("/");
  const numerator = Number(num);
  const denominator = den === undefined ? 1 : Number(den);
  if (!Number.isFinite(numerator) || !denominator) return null;
  const fps = numerator / denominator;
  return Number.isFinite(fps) && fps > 0 ? Math.round(fps * 100) / 100 : null;
}

/**
 * Reads media metadata via ffprobe over a (presigned) input URL. FFprobe
 * fetches only the container header/index, not the whole file.
 */
export async function probe(
  inputUrl: string,
  timeoutMs = 60_000,
): Promise<ProbeResult> {
  const stdout = await run(
    "ffprobe",
    [
      "-v",
      "error",
      "-print_format",
      "json",
      "-show_format",
      "-show_streams",
      inputUrl,
    ],
    { timeoutMs },
  );

  const parsed = JSON.parse(stdout) as FfprobeOutput;
  const video = parsed.streams?.find((s) => s.codec_type === "video");
  const audio = parsed.streams?.find((s) => s.codec_type === "audio");

  const durationSeconds = Number(parsed.format?.duration);

  return {
    durationMs: Number.isFinite(durationSeconds)
      ? Math.round(durationSeconds * 1000)
      : null,
    width: video?.width ?? null,
    height: video?.height ?? null,
    frameRate: parseFrameRate(video?.r_frame_rate),
    videoCodec: video?.codec_name ?? null,
    audioCodec: audio?.codec_name ?? null,
    formatName: parsed.format?.format_name ?? null,
  };
}

/**
 * Generates a downscaled analysis proxy (H.264 + AAC) from the source URL
 * to a local file. Not the final render — just something small and uniform
 * for later AI analysis.
 */
export async function generateProxy(
  inputUrl: string,
  outputPath: string,
  targetHeight: number,
  options: { onProgress?: (line: string) => void; timeoutMs?: number } = {},
): Promise<void> {
  await run(
    "ffmpeg",
    [
      "-y",
      "-i",
      inputUrl,
      "-vf",
      // Scale to target height, keep aspect ratio, force even width.
      `scale=-2:${targetHeight}`,
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "28",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-movflags",
      "+faststart",
      outputPath,
    ],
    { timeoutMs: options.timeoutMs ?? 30 * 60_000, onStderr: options.onProgress },
  );
}

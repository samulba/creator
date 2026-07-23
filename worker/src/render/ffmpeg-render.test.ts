import assert from "node:assert/strict";
import { test } from "node:test";

import { parseFfmpegTimeMs, scaledTimeoutMs } from "./ffmpeg-render.js";

test("parseFfmpegTimeMs parses ffmpeg progress lines", () => {
  assert.equal(
    parseFfmpegTimeMs(
      "frame= 1550 fps= 25 q=28.0 size= 5120kB time=00:01:05.50 bitrate= 640kbits/s",
    ),
    65_500,
  );
  assert.equal(parseFfmpegTimeMs("time=01:00:00.00"), 3_600_000);
  assert.equal(parseFfmpegTimeMs("time=0:00:02"), 2_000); // no fraction
});

test("parseFfmpegTimeMs returns null for lines without a usable time", () => {
  assert.equal(parseFfmpegTimeMs("time=N/A"), null);
  assert.equal(parseFfmpegTimeMs("frame= 10 fps=0.0 q=0.0"), null);
  assert.equal(parseFfmpegTimeMs(""), null);
});

test("scaledTimeoutMs keeps the 20-minute floor for short media", () => {
  assert.equal(scaledTimeoutMs(0), 20 * 60_000);
  assert.equal(scaledTimeoutMs(60_000), 20 * 60_000); // 1-min clip → floor
});

test("scaledTimeoutMs scales with duration for long media", () => {
  // 20-minute clip at factor 3 → 5 min buffer + 60 min = 65 minutes.
  assert.equal(scaledTimeoutMs(20 * 60_000), 65 * 60_000);
  // 30-minute timeline at factor 4 (final encode) → 5 + 120 = 125 minutes.
  assert.equal(scaledTimeoutMs(30 * 60_000, 4), 125 * 60_000);
});

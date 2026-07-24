import assert from "node:assert/strict";
import { test } from "node:test";

import { run } from "./ffmpeg.js";

test("run kills a process that produces no output (stall watchdog)", async () => {
  // `sleep` writes nothing — the watchdog must kill it long before it exits.
  await assert.rejects(
    run("sleep", ["30"], { stallTimeoutMs: 300 }),
    /stalled: no output for 300ms/,
  );
});

test("run resolves normally when the process produces output", async () => {
  const stdout = await run("echo", ["ok"], { stallTimeoutMs: 5000 });
  assert.equal(stdout.trim(), "ok");
});

test("run without stallTimeoutMs does not arm the watchdog", async () => {
  // A silent-but-quick process must still succeed when no watchdog is set.
  const stdout = await run("sleep", ["0.2"]);
  assert.equal(stdout, "");
});

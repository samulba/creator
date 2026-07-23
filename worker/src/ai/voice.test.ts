import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildElevenLabsBody,
  outputFormatToFile,
  resolveVoiceConfig,
  resolveVoiceSettings,
} from "./voice.js";

const defaults = { model: "eleven_multilingual_v2", outputFormat: "mp3_44100_128" };

test("resolveVoiceConfig pins the character's model id", () => {
  const config = resolveVoiceConfig(
    {
      voice_provider: "elevenlabs",
      voice_key: "voice-123",
      voice_settings: { model_id: "eleven_turbo_v2_5", stability: 0.5 },
    },
    defaults,
  );
  assert.ok(config);
  assert.equal(config.voiceKey, "voice-123");
  assert.equal(config.modelId, "eleven_turbo_v2_5");
  assert.equal(config.settings.stability, 0.5);
  assert.equal(config.outputFormat, "mp3_44100_128");
});

test("resolveVoiceConfig falls back to the pinned default, never 'latest'", () => {
  const withLatest = resolveVoiceConfig(
    { voice_key: "v", voice_settings: { model_id: "latest" } },
    defaults,
  );
  assert.equal(withLatest?.modelId, "eleven_multilingual_v2");

  const withNone = resolveVoiceConfig({ voice_key: "v" }, defaults);
  assert.equal(withNone?.modelId, "eleven_multilingual_v2");
});

test("resolveVoiceConfig returns null when no voice is configured", () => {
  assert.equal(resolveVoiceConfig({}, defaults), null);
  assert.equal(resolveVoiceConfig({ voice_key: "   " }, defaults), null);
});

test("resolveVoiceSettings clamps to valid ranges and drops junk", () => {
  const settings = resolveVoiceSettings({
    stability: 2, // clamp to 1
    similarity_boost: -1, // clamp to 0
    style: 0.3,
    use_speaker_boost: true,
    speed: 5, // clamp to 1.2
    bogus: "ignore me",
  });
  assert.equal(settings.stability, 1);
  assert.equal(settings.similarity_boost, 0);
  assert.equal(settings.style, 0.3);
  assert.equal(settings.use_speaker_boost, true);
  assert.equal(settings.speed, 1.2);
  assert.equal("bogus" in settings, false);
});

test("buildElevenLabsBody omits empty voice_settings", () => {
  const body = buildElevenLabsBody({
    text: "Hello",
    modelId: "m",
    settings: {},
  });
  assert.deepEqual(body, { text: "Hello", model_id: "m" });

  const withSettings = buildElevenLabsBody({
    text: "Hi",
    modelId: "m",
    settings: { stability: 0.4 },
  });
  assert.deepEqual(withSettings.voice_settings, { stability: 0.4 });
});

test("outputFormatToFile maps formats to extension + content type", () => {
  assert.deepEqual(outputFormatToFile("mp3_44100_128"), {
    extension: "mp3",
    contentType: "audio/mpeg",
  });
  assert.equal(outputFormatToFile("opus_48000_64").extension, "opus");
  assert.equal(outputFormatToFile("pcm_16000").extension, "pcm");
});

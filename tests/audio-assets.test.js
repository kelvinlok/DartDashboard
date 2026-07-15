const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { AUDIO_MANIFEST } = require("../sound-manager.js");

const repositoryRoot = path.resolve(__dirname, "..");
const majorEvents = new Set(["bullseye", "bust", "checkout"]);

function readWav(filePath) {
  const contents = fs.readFileSync(filePath);
  assert.equal(contents.toString("ascii", 0, 4), "RIFF", `${filePath} must begin with RIFF`);
  assert.equal(contents.toString("ascii", 8, 12), "WAVE", `${filePath} must contain WAVE`);

  let offset = 12;
  let format = null;
  let samples = null;
  while (offset + 8 <= contents.length) {
    const chunkName = contents.toString("ascii", offset, offset + 4);
    const chunkSize = contents.readUInt32LE(offset + 4);
    const chunkStart = offset + 8;
    if (chunkName === "fmt ") {
      format = {
        audioFormat: contents.readUInt16LE(chunkStart),
        channels: contents.readUInt16LE(chunkStart + 2),
        sampleRate: contents.readUInt32LE(chunkStart + 4),
        bitsPerSample: contents.readUInt16LE(chunkStart + 14),
      };
    }
    if (chunkName === "data") {
      samples = contents.subarray(chunkStart, chunkStart + chunkSize);
    }
    offset = chunkStart + chunkSize + (chunkSize % 2);
  }

  assert.ok(format, `${filePath} must have a fmt chunk`);
  assert.ok(samples?.length, `${filePath} must have sample data`);
  return { format, samples };
}

for (const [eventName, relativePath] of Object.entries(AUDIO_MANIFEST)) {
  test(`${eventName} is a mastered mono PCM WAV asset`, () => {
    const filePath = path.join(repositoryRoot, relativePath);
    assert.equal(fs.existsSync(filePath), true, `${relativePath} must exist`);

    const { format, samples } = readWav(filePath);
    assert.deepEqual(format, {
      audioFormat: 1,
      channels: 1,
      sampleRate: 44_100,
      bitsPerSample: 16,
    });

    let peak = 0;
    for (let index = 0; index < samples.length; index += 2) {
      peak = Math.max(peak, Math.abs(samples.readInt16LE(index)));
    }
    assert.ok(peak > 100, `${relativePath} must contain a non-silent signal`);
    assert.ok(peak < 32_767, `${relativePath} must retain headroom below 0 dBFS`);

    const duration = samples.length / 2 / format.sampleRate;
    const [minimum, maximum] = majorEvents.has(eventName) ? [0.6, 3.5] : [0.12, 0.8];
    assert.ok(
      duration >= minimum && duration <= maximum,
      `${relativePath} duration ${duration.toFixed(3)}s must be ${minimum}-${maximum}s`,
    );
  });
}

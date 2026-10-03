// Protocol/decision test using a stub provider; no external API requests or real video inference.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const root = path.resolve(__dirname, "..");
const resolve = Module._resolveFilename;
Module._resolveFilename = function (name, ...args) {
  return resolve.call(
    this,
    name.startsWith("@/") ? path.join(root, "src", name.slice(2)) : name,
    ...args,
  );
};
Module._extensions[".ts"] = (module, file) =>
  module._compile(
    ts.transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    }).outputText,
    file,
  );
process.env.LIVEPREVENT_DATA_DIR = fs.mkdtempSync(
  path.join(os.tmpdir(), "lp-model-test-"),
);
process.env.KIMI_API_KEY = "test-only";
process.env.KIMI_BASE_URL = "https://provider.test/v1";
process.env.DEMO_KIMI_OFFLINE = "0";
const media = require("../src/server/v3/media.ts");
const assessments = require("../src/server/v3/assessments.ts");
const store = require("../src/server/store.ts");
const now = new Date().toISOString();
let invalidTimestamp = false,
  videoCalls = 0,
  textCalls = 0;
global.fetch = async (url, options) => {
  assert.equal(url, "https://provider.test/v1/chat/completions");
  const body = JSON.parse(options.body);
  const content = body.messages[1].content;
  let result;
  if (Array.isArray(content)) {
    videoCalls++;
    assert.match(content[0].video_url.url, /^data:video\/mp4;base64,/);
    assert(content[1].text.includes("last-observation"));
    result = {
      summary: "Possible fall posture in the clip.",
      uncertain: false,
      limitations: ["Sample clip only"],
      evidence: [
        {
          atSeconds: invalidTimestamp ? 121 : 1,
          description: "Person near the floor",
          kind: "fall_posture",
          confidence: "high",
        },
      ],
    };
  } else {
    textCalls++;
    const facts = JSON.parse(content);
    assert.equal(facts.observations.length, 12);
    result = {
      eventSummary: "The supplied observations need review.",
      baselineComparison: "No comparison available.",
      relatedChanges: "No history supplied.",
      suggestedNextStep: "Check in with the person.",
    };
  }
  return Response.json({
    choices: [{ message: { content: JSON.stringify(result) } }],
  });
};
function fixture(seconds) {
  // Minimal MP4 metadata fixture, not a decodable clip. Used only to verify the adapter protocol.
  const ftyp = Buffer.alloc(16);
  ftyp.writeUInt32BE(16);
  ftyp.write("ftyp", 4);
  ftyp.write("isom", 8);
  const mvhd = Buffer.alloc(28);
  mvhd.writeUInt32BE(28);
  mvhd.write("mvhd", 4);
  mvhd.writeUInt32BE(1000, 20);
  mvhd.writeUInt32BE(seconds * 1000, 24);
  const moov = Buffer.alloc(8);
  moov.writeUInt32BE(36);
  moov.write("moov", 4);
  return Buffer.concat([ftyp, moov, mvhd]);
}
(async () => {
  const person = store.listPeople()[0].id;
  const bytes = fixture(10);
  assert.throws(() => media.mp4Duration(fixture(121)));
  assert.throws(() => media.mp4Duration(Buffer.from("not an mp4")));
  const asset = media.createMedia(
    {
      personId: person,
      name: "sample.mp4",
      kind: "video",
      size: bytes.length,
      mime: "video/mp4",
    },
    "test-user",
  );
  await media.upload(
    new Request("http://local/upload", { method: "PUT", body: bytes }),
    asset.assetId,
    asset.uploadToken,
  );
  const observations = [
    { kind: "device_online", value: true, at: now, source: "sample_sensor" },
    ...Array.from({ length: 11 }, (_, i) => ({
      kind: "note",
      value: i === 10 ? "last-observation" : "Sample context",
      at: now,
      source: "sample_manual",
    })),
  ];
  const input = {
    personId: person,
    scenario: "possible_fall",
    observedAt: now,
    timeZone: "UTC",
    observations,
    sensorAssetIds: [],
    videoAssetId: asset.assetId,
    note: "",
    provenance: "sample_user_uploaded",
    consent: true,
    idempotencyKey: "model-test-success",
  };
  const a = assessments.createAssessment(input, "test-user");
  assessments.queueAssessment(a.assessmentId);
  await assessments.runAssessment(a.assessmentId);
  const done = assessments.getAssessment(a.assessmentId);
  assert.equal(done.status, "completed");
  assert.equal(done.finding.model.used, true);
  assert.equal(done.finding.level, "important");
  assert.equal(done.finding.video.evidence[0].atSeconds, 1);
  assert(done.finding.limitations.includes("Sample clip only"));
  invalidTimestamp = true;
  const b = assessments.createAssessment(
    { ...input, idempotencyKey: "model-test-invalid" },
    "test-user",
  );
  assessments.queueAssessment(b.assessmentId);
  await assessments.runAssessment(b.assessmentId);
  const partial = assessments.getAssessment(b.assessmentId);
  assert.equal(partial.status, "partial");
  assert.equal(partial.finding.video, null);
  assert.equal(partial.finding.level, null);
  assert.match(partial.error, /timestamps/);
  const unknown = assessments.evaluate(
    input,
    [
      { kind: "impact", value: true, at: now, source: "sample_sensor" },
      { kind: "impact", value: false, at: now, source: "sample_sensor" },
    ],
    null,
  );
  assert.equal(unknown.displayStatus, "unknown");
  const uncertain = assessments.evaluate(input, observations, {
    summary: "Unclear",
    uncertain: true,
    limitations: [],
    evidence: [
      {
        atSeconds: 1,
        description: "Unclear posture",
        kind: "fall_posture",
        confidence: "high",
      },
    ],
  });
  assert.equal(uncertain.displayStatus, "unknown");
  store.resetStore(person);
  assert(
    store.getStore(person).events.some((e) => e.id === done.finding.eventId),
  );
  media.deleteMedia(asset.assetId);
  assert.throws(() => media.readMedia(asset.assetId));
  assert.equal(videoCalls, 2);
  assert.equal(textCalls, 2);
  console.log(
    "PASS: full sensor input + video payload, model success, timestamp rejection/partial fallback, uncertainty/conflict handling, reset preserves uploaded events, file deletion. Provider was stubbed.",
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

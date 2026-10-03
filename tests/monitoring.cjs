const assert = require("node:assert/strict");
const fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path"),
  Module = require("node:module"),
  ts = require("typescript");
const root = path.resolve(__dirname, ".."),
  resolve = Module._resolveFilename;
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
  path.join(os.tmpdir(), "lp-monitoring-"),
);
process.env.DEMO_KIMI_OFFLINE = "1";
delete process.env.RESEND_API_KEY;
const stores = require("../src/server/store.ts"),
  monitoring = require("../src/server/monitoring.ts");
const { createRiskEvent } = require("../src/server/simulator.ts");
const { advance } = require("../src/server/engine.ts");
const { createPerson } = require("../src/server/v3/people.ts");
const { deliverNextEmail } = require("../src/server/notifications/email.ts");
const trend = require("../src/server/longitudinal.ts");
const contracts = require("../src/shared/contracts/monitoring.ts");
const { snapshotSchema } = require("../src/shared/contracts/snapshot.ts");
const { buildSnapshot } = require("../src/server/snapshot.ts");
const { settings } = require("../src/server/v3/views.ts");
(async () => {
  let s = stores.getStore("sub_margaret");
  const now = Date.now();
  s.monitoring.lastDataReceivedAt = new Date(now - 899999).toISOString();
  assert.equal(monitoring.monitoringStatus(s, now).status, "stable");
  assert.equal(monitoring.monitoringStatus(s, now + 1).status, "unknown");
  assert.equal(monitoring.heartbeat(s, now), true);
  assert.equal(monitoring.heartbeat(s, now + 1), false);
  assert.equal(monitoring.monitoringStatus(s, now).status, "stable");
  const version = settings(s).version;
  monitoring.heartbeat(s, now + 46000);
  assert.equal(
    settings(s).version,
    version,
    "heartbeat must not cause settings version conflicts",
  );
  s.monitoring.dataLoss = true;
  assert.equal(monitoring.heartbeat(s, now + 92000), false);
  s.monitoring.dataLoss = false;
  s.subject.monitoringPaused = true;
  assert.equal(monitoring.heartbeat(s, now + 92000), false);
  assert.deepEqual(advance(s, now + 92000), []);
  s.subject.monitoringPaused = false;
  const low = createRiskEvent(s, "watch", "simulator", undefined, now);
  assert.equal(low.level, "watch");
  advance(s, now);
  assert.equal(
    s.alerts.find((a) => a.id === low.alertId).notifications.length,
    0,
  );
  const moderate = createRiskEvent(s, "important", "simulator", undefined, now);
  assert.equal(moderate.level, "important");
  s.contacts.forEach((c) => {
    c.quietHours = null;
    c.subscriptions.moderate = false;
  });
  advance(s, now);
  assert.equal(
    s.alerts.find((a) => a.id === moderate.alertId).notifications.length,
    0,
  );
  s.contacts[0].subscriptions.moderate = true;
  advance(s, now);
  assert.equal(
    s.alerts.find((a) => a.id === moderate.alertId).notifications[0].simulated,
    true,
  );
  s.monitoring.emailEnabled = true;
  s.contacts[0].channels = [];
  const critical = createRiskEvent(s, "critical", "simulator", undefined, now);
  assert.equal(critical.level, "critical");
  const notification = s.alerts
    .find((a) => a.id === critical.alertId)
    .notifications.find((n) => n.channel === "email");
  assert(
    notification,
    "primary always gets critical email even with channels disabled",
  );
  assert.equal(notification.deliveryStatus, "pending");
  s.monitoring.lastDataReceivedAt = new Date(now - 17 * 60000).toISOString();
  assert.equal(
    monitoring.monitoringStatus(s, now).status,
    "critical",
    "data loss cannot hide a critical alert",
  );
  stores.saveStore(s);
  await deliverNextEmail();
  s = stores.getStore(s.subject.id);
  let n = s.alerts
    .find((a) => a.id === critical.alertId)
    .notifications.find((n) => n.channel === "email");
  assert.equal(n.deliveryStatus, "failed");
  assert.match(n.error, /not configured/);
  n.deliveryStatus = "pending";
  n.attempts = 0;
  stores.saveStore(s);
  process.env.RESEND_API_KEY = "test-key";
  process.env.LIVEPREVENT_EMAIL_FROM = "LivePrevent <alerts@example.test>";
  process.env.LIVEPREVENT_APP_URL = "https://workspace.example.test";
  const keys = [];
  let fail = true;
  global.fetch = async (url, options) => {
    assert.equal(url, "https://api.resend.com/emails");
    const body = JSON.parse(options.body);
    keys.push(options.headers["Idempotency-Key"]);
    assert.deepEqual(body.to, ["alex.chan@example.com"]);
    assert.match(body.subject, /CRITICAL/);
    assert.match(body.text, /https:\/\/workspace.example.test\/events\//);
    assert(!body.text.includes("tok_"));
    assert(!body.text.includes("Supporting signals"));
    assert(!body.text.includes("Heart rate elevated"));
    return fail
      ? new Response("{}", { status: 503 })
      : Response.json({ id: "email-test-1" });
  };
  await deliverNextEmail();
  s = stores.getStore(s.subject.id);
  n = s.alerts
    .find((a) => a.id === critical.alertId)
    .notifications.find((n) => n.channel === "email");
  assert.equal(n.deliveryStatus, "pending");
  assert.equal(n.attempts, 1);
  fail = false;
  await deliverNextEmail(Date.now() + 61000);
  s = stores.getStore(s.subject.id);
  n = s.alerts
    .find((a) => a.id === critical.alertId)
    .notifications.find((n) => n.channel === "email");
  assert.equal(n.deliveryStatus, "sent");
  assert.equal(n.providerMessageId, "email-test-1");
  assert.equal(keys[0], keys[1]);
  const before = keys.length;
  await deliverNextEmail(Date.now() + 62000);
  assert.equal(keys.length, before);
  fail = true;
  const exhausted = createRiskEvent(s, "critical", "simulator", undefined, now);
  stores.saveStore(s);
  for (let attempt = 0; attempt < 4; attempt++) {
    await deliverNextEmail(Date.now() + attempt * 300000);
  }
  s = stores.getStore(s.subject.id);
  const exhaustedEmail = s.alerts
    .find((a) => a.id === exhausted.alertId)
    .notifications.find((n) => n.channel === "email");
  assert.equal(exhaustedEmail.attempts, 4);
  assert.equal(exhaustedEmail.deliveryStatus, "failed");
  assert.equal(exhaustedEmail.retryable, false);
  const exhaustedCalls = keys.length;
  await deliverNextEmail(Date.now() + 1500000);
  assert.equal(keys.length, exhaustedCalls, "exhausted retries must stop");
  snapshotSchema.parse(buildSnapshot(s, Date.now()));
  assert.equal(trend.aiContext(s).profileWithheld, true);
  s.profile.shareWithAi = true;
  s.profile.knownConditions = ["Reported mobility issue"];
  s.profile.photo = "data:image/png;base64,AAAA";
  const context = trend.aiContext(s);
  assert.deepEqual(context.reportedHealthProfile.knownConditions, [
    "Reported mobility issue",
  ]);
  assert.equal(context.reportedHealthProfile.photo, undefined);
  assert.equal(context.reportedHealthProfile.name, undefined);
  const newInput = contracts.createPersonSchema.parse({
    name: "Test person",
    alias: "Test",
    age: 80,
    timeZone: "Asia/Hong_Kong",
    profile: {},
    primaryContact: { name: "Test family", email: "family@example.test" },
  });
  const added = createPerson(newInput, s.user.id);
  assert.equal(added.events.length, 0);
  assert.equal(added.trends.activity.length, 0);
  assert.equal(
    added.baselines.some((b) => b.learned),
    false,
  );
  assert.equal(stores.listPeople().length, 3);
  const inputId = added.subject.id;
  stores.setArchived(added, true);
  assert.equal(stores.getStore(inputId), null);
  assert.equal(stores.listPeople().length, 2);
  stores.setArchived(stores.archivedStore(inputId), false);
  assert.equal(stores.getStore(inputId).subject.monitoringPaused, true);
  assert.equal(stores.listPeople().length, 3);
  s = stores.resetStore("sub_margaret");
  s.monitoring.lastDataReceivedAt = new Date().toISOString();
  s.monitoring.dataLoss = false;
  s.devices.forEach((d) => (d.online = true));
  s.profile.shareWithAi = false;
  trend.initializeSampleHistory(s);
  assert.equal(
    trend.evolution(s, 365).metrics.find((m) => m.key === "activity")
      .coverageDays,
    365,
  );
  assert.equal(
    trend.evolution(s, 365).metrics.find((m) => m.key === "weight").current,
    null,
  );
  for (const key of ["activity", "mobility"]) {
    const b = s.baselines.find((b) => b.metric === key).median;
    s.trends[key] = s.trends[key].map((p, i, arr) =>
      arr.length - i <= 42 ? { ...p, value: b * 0.72 } : p,
    );
  }
  s.trendReviewedAt = undefined;
  trend.advanceLongitudinal(s);
  assert.equal(s.careTasks.length, 1);
  assert.equal(
    s.alerts.find((a) => a.eventId === s.careTasks[0].eventId).level,
    "important",
  );
  s.trendReviewedAt = undefined;
  trend.advanceLongitudinal(s);
  assert.equal(
    s.careTasks.length,
    1,
    "repeat review deduplicates the persistent concern",
  );
  contracts.evolutionSchema.parse(trend.evolution(s, 90));
  const empty = createPerson(newInput, s.user.id);
  empty.trends.activity = Array.from({ length: 14 }, (_, i) => ({
    date: new Date(now - i * 86400000).toISOString().slice(0, 10),
    value: 3000 + i,
    metric: "activity",
  }));
  trend.learnReportedBaselines(empty);
  assert.equal(
    empty.baselines.find((b) => b.metric === "activity").learned,
    true,
  );
  assert.equal(
    empty.baselines.find((b) => b.metric === "sleep").learned,
    false,
  );
  assert.equal(
    empty.baselines.find((b) => b.metric === "activity").lastIncludedSampleAt,
    new Date(new Date(now).toISOString().slice(0, 10)).toISOString(),
    "baseline sample dates are sorted before selecting the latest",
  );
  console.log(
    "Monitoring, notification retries, primary recipient policy, profile consent, people isolation and longitudinal tests passed.",
  );
})()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() =>
    fs.rmSync(process.env.LIVEPREVENT_DATA_DIR, {
      recursive: true,
      force: true,
    }),
  );

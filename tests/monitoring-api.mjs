import assert from "node:assert/strict";
const base = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3105";
let cookie = "";
async function request(path, method = "GET", body, expected = 200, extra = {}) {
  const response = await fetch(`${base}/api/v3/${path}`, {
    method,
    headers: {
      cookie,
      Origin: base,
      "Content-Type": "application/json",
      ...extra,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const result = await response.json();
  assert.equal(
    response.status,
    expected,
    `${method} ${path}: ${JSON.stringify(result)}`,
  );
  return { data: result.data ?? result, response };
}
const login = await request("session", "POST");
cookie = login.response.headers.get("set-cookie").split(";")[0];
const before = (await request("people")).data.length;
await request("people", "POST", { name: "" }, 422);
await request("people", "POST", { name: "Cross-site" }, 403, {
  Origin: "https://unrelated.example",
});
const created = (
  await request(
    "people",
    "POST",
    {
      name: "API check person",
      alias: "API check",
      age: 77,
      timeZone: "Asia/Hong_Kong",
      profile: { knownConditions: ["Reported knee issue"], shareWithAi: false },
      primaryContact: {
        name: "API check family",
        email: "api-test@example.test",
        relationship: "Family",
      },
      simulatorEnabled: true,
      emailEnabled: false,
    },
    201,
  )
).data;
const pid = created.personId;
assert.equal((await request("people")).data.length, before + 1);
assert(
  (await request("session")).data.personIds.includes(pid),
  "same session can access newly created people",
);
let overview = (await request(`people/${pid}/overview`)).data;
assert.equal(overview.displayStatus, "stable");
let snap = (await request(`people/${pid}/snapshot`)).data;
assert.equal(snap.trends.activity.length, 0);
assert.equal(
  snap.baselines.some((b) => b.learned),
  false,
);
const config = (await request(`people/${pid}/settings`)).data;
assert.deepEqual(config.profile.knownConditions, ["Reported knee issue"]);
const invalidPrimary = {
  ...config,
  contacts: config.contacts.map((c, i) =>
    i === 0
      ? { ...c, subscriptions: { ...c.subscriptions, critical: false } }
      : c,
  ),
};
await request(`people/${pid}/settings`, "PATCH", invalidPrimary, 422);
config.contacts.push({
  ...config.contacts[0],
  id: "api-contact-secondary",
  userId: null,
  name: "Neighbour",
  email: "neighbour@example.test",
  escalationOrder: 2,
  role: "caregiver",
});
await request(`people/${pid}/settings`, "PATCH", config);
await request(`people/${pid}/settings`, "PATCH", config, 409);
await request(`people/${pid}/simulate`, "POST", { scenario: "low" }, 201);
snap = (await request(`people/${pid}/snapshot`)).data;
assert.equal(snap.overallLevel, "watch");
assert.equal(snap.notifications.length, 0);
await request(`people/${pid}/simulate`, "POST", { scenario: "data_loss" });
assert.equal(
  (await request(`people/${pid}/overview`)).data.displayStatus,
  "unknown",
);
assert.equal(
  (await request("people")).data.find((p) => p.id === pid).displayStatus,
  "unknown",
);
await request(`people/${pid}/simulate`, "POST", { scenario: "recover" });
assert.equal(
  (await request(`people/${pid}/overview`)).data.displayStatus,
  "watch",
);
let settings = (await request(`people/${pid}/settings`)).data;
settings.monitoring.emailEnabled = true;
await request(`people/${pid}/settings`, "PATCH", settings);
await request(`people/${pid}/simulate`, "POST", { scenario: "critical" }, 201);
let failed;
for (let i = 0; i < 10; i++) {
  snap = (await request(`people/${pid}/snapshot`)).data;
  failed = snap.notifications.find(
    (n) => !n.simulated && n.deliveryStatus === "failed",
  );
  if (failed) break;
  await new Promise((r) => setTimeout(r, 500));
}
assert(failed);
assert.match(failed.error, /provider is not configured/);
await request(`people/${pid}/simulate`, "POST", { scenario: "data_loss" });
assert.equal(
  (await request(`people/${pid}/overview`)).data.displayStatus,
  "critical",
);
await request(`notifications/${failed.id}/retry`, "POST", undefined, 202);
let evo = (await request(`people/${pid}/evolution?window=365`)).data;
assert.equal(evo.metrics.find((m) => m.key === "weight").current, null);
await request(
  `people/${pid}/evolution/observations`,
  "POST",
  [{ key: "weight", date: "2026-99-01", value: 70 }],
  422,
);
await request(`people/${pid}/evolution/observations`, "POST", [
  { key: "weight", date: new Date().toISOString().slice(0, 10), value: 70 },
]);
evo = (await request(`people/${pid}/evolution`)).data;
assert.equal(evo.metrics.find((m) => m.key === "weight").current, 70);
evo = (await request(`people/${pid}/evolution/summary?window=90`, "POST")).data;
assert.equal(evo.summary.source, "rules");
await request(`people/${pid}`, "DELETE");
assert.equal((await request("people")).data.length, before);
await request(`people/${pid}/settings`, "GET", undefined, 403);
await request(`notifications/${failed.id}/retry`, "POST", undefined, 404);
await request(`people/${pid}/restore`, "POST");
assert.equal(
  (await request(`people/${pid}/overview`)).data.displayStatus,
  "critical",
);
assert.equal(
  (await request(`people/${pid}/settings`)).data.subject.monitoringPaused,
  true,
);
await request(`people/${pid}`, "DELETE");
const seed = "sub_margaret";
await request(`people/${seed}/simulate`, "POST", { scenario: "reset" });
settings = (await request(`people/${seed}/settings`)).data;
settings.subject.monitoringPaused = false;
settings.monitoring.emailEnabled = false;
await request(`people/${seed}/settings`, "PATCH", settings);
await request(`people/${seed}/simulate`, "POST", { scenario: "recover" });
await request(`people/${seed}/simulate`, "POST", { scenario: "longitudinal" });
evo = (await request(`people/${seed}/evolution?window=365`)).data;
assert.equal(evo.metrics.find((m) => m.key === "activity").coverageDays, 365);
const task = evo.tasks.find((t) => t.status === "open");
assert(task);
await request(`people/${seed}/care-tasks/${task.id}`, "POST", {
  outcome: "Family checked in; follow-up arranged.",
});
await request(
  `people/${seed}/care-tasks/${task.id}`,
  "POST",
  { outcome: "Replay" },
  409,
);
evo = (await request(`people/${seed}/evolution`)).data;
assert.equal(evo.tasks.find((t) => t.id === task.id).status, "completed");
console.log(
  "PASS: people CRUD/session binding, settings/profile, primary Critical protection, heartbeat/data loss, risk propagation, email failure/retry, dated history, longitudinal care outcomes. External providers disabled.",
);

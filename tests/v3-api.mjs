import assert from "node:assert/strict";
const base = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3105";
let cookie = "";
async function request(
  path,
  {
    method = "GET",
    body,
    status = 200,
    raw = false,
    anonymous = false,
    origin = base,
  } = {},
) {
  const res = await fetch(base + path, {
    method,
    headers: {
      Origin: origin,
      ...(anonymous ? {} : { cookie }),
      ...(!raw ? { "content-type": "application/json" } : {}),
    },
    body: body === undefined ? undefined : raw ? body : JSON.stringify(body),
  });
  const data = await res.json();
  assert.equal(
    res.status,
    status,
    `${method} ${path}: ${JSON.stringify(data)}`,
  );
  return { data: data.data ?? data, res };
}
await request("/api/v3/people", { status: 401, anonymous: true });
await request("/api/v3/session", {
  method: "POST",
  origin: "http://evil.invalid",
  status: 403,
});
const login = await request("/api/v3/session", { method: "POST" });
cookie = login.res.headers.get("set-cookie").split(";")[0];
const people = (await request("/api/v3/people")).data;
assert.equal(people.length, 2);
const personId = people[0].id;
const snapshot = (await request(`/api/v3/people/${personId}/snapshot`)).data;
assert.equal(snapshot.subject.id, personId);
await request("/api/v3/people/unknown/overview", { status: 403 });
const config = (await request(`/api/v3/people/${personId}/settings`)).data;
await request(`/api/v3/people/${personId}/settings`, {
  method: "PATCH",
  body: { ...config, subject: { ...config.subject, monitoringPaused: true } },
});
assert.equal(
  (await request(`/api/v3/people/${personId}/overview`)).data.displayStatus,
  "paused",
);
await request(`/api/v3/people/${personId}/settings`, {
  method: "PATCH",
  body: config,
  status: 409,
});
const nextConfig = (await request(`/api/v3/people/${personId}/settings`)).data;
await request(`/api/v3/people/${personId}/settings`, {
  method: "PATCH",
  body: {
    ...nextConfig,
    subject: { ...nextConfig.subject, monitoringPaused: false },
  },
});
await request("/api/v3/assessments", { method: "POST", raw: true, body: "{broken", status: 400 });
const now = new Date().toISOString();
const input = {
  personId,
  scenario: "general_check",
  observedAt: now,
  timeZone: "Asia/Hong_Kong",
  observations: [
    { kind: "worn", value: true, at: now, source: "sample_manual" },
    { kind: "device_online", value: true, at: now, source: "sample_manual" },
  ],
  sensorAssetIds: [],
  note: "",
  provenance: "sample_user_uploaded",
  consent: true,
  idempotencyKey: crypto.randomUUID(),
};
await request("/api/v3/assessments", {
  method: "POST",
  body: { ...input, observations: [] },
  status: 422,
});
const created = (
  await request("/api/v3/assessments", {
    method: "POST",
    body: input,
    status: 201,
  })
).data;
const repeated = (
  await request("/api/v3/assessments", {
    method: "POST",
    body: input,
    status: 201,
  })
).data;
assert.equal(created.assessmentId, repeated.assessmentId);
await request("/api/v3/assessments", {
  method: "POST",
  body: { ...input, note: "changed" },
  status: 409,
});
await request(`/api/v3/assessments/${created.assessmentId}/analyze`, {
  method: "POST",
  status: 202,
});
async function finish(id) {
  for (let i = 0; i < 30; i++) {
    const a = (await request(`/api/v3/assessments/${id}`)).data;
    if (!["queued", "analyzing"].includes(a.status)) return a;
    await new Promise((r) => setTimeout(r, 300));
  }
  throw Error("Task did not finish");
}
const result = await finish(created.assessmentId);
assert.equal(result.status, "partial");
assert.equal(result.finding.level, "stable");
assert.equal(result.finding.model.used, false);
assert.equal(result.finding.alertId, null);
const event = (
  await request(`/api/v3/people/${personId}/events/${result.finding.eventId}`)
).data;
assert(event.event);
assert.equal(event.event.type, "general_check");
assert.equal(event.alert, null);
assert.equal(
  (await request(`/api/v3/people/${people[1].id}/assessments`)).data.some(
    (a) => a.assessmentId === created.assessmentId,
  ),
  false,
);
const fallInput = {
  ...input,
  scenario: "possible_fall",
  observations: [
    { kind: "impact", value: true, at: now, source: "sample_sensor" },
  ],
  idempotencyKey: crypto.randomUUID(),
};
const fall = (
  await request("/api/v3/assessments", {
    method: "POST",
    body: fallInput,
    status: 201,
  })
).data;
await request(`/api/v3/assessments/${fall.assessmentId}/analyze`, {
  method: "POST",
  status: 202,
});
const fallResult = await finish(fall.assessmentId);
assert.equal(fallResult.finding.level, "important");
const fallEvent = (
  await request(
    `/api/v3/people/${personId}/events/${fallResult.finding.eventId}`,
  )
).data;
assert.equal(fallEvent.event.recoveryWindowEndsAt, null);
const aid = fallResult.finding.alertId;
await request(`/api/v3/alerts/${aid}/ack`, {
  method: "POST",
  body: { personId, contactId: "spoofed-contact" },
});
const snap = (await request(`/api/v3/people/${personId}/snapshot`)).data;
assert.notEqual(
  snap.alerts.find((a) => a.id === aid).acknowledgedBy,
  "spoofed-contact",
);
await request(`/api/v3/alerts/${aid}/resolve`, {
  method: "POST",
  body: { personId, reason: "other", note: "Test follow-up" },
});
await request(`/api/v3/assessments/${fall.assessmentId}/retry`, { method: "POST", status: 202 });
const retried = await finish(fall.assessmentId);
assert.equal(retried.finding.eventId, fallResult.finding.eventId);
assert.equal(retried.finding.alertId, aid);
const afterRetry = (await request(`/api/v3/people/${personId}/snapshot`)).data;
assert.equal(afterRetry.alerts.find(a => a.id === aid).status, "resolved");
const csv = `kind,value,at,source\nimpact,true,${now},sample_sensor\n`;
const upload = (
  await request("/api/v3/media/uploads", {
    method: "POST",
    status: 201,
    body: {
      personId,
      name: "observations.csv",
      kind: "sensor",
      size: Buffer.byteLength(csv),
      mime: "text/csv",
    },
  })
).data;
const uploaded = (
  await request(upload.uploadUrl, { method: "PUT", body: csv, raw: true })
).data;
assert.equal(uploaded.observations.length, 1);
await request(`/api/v3/media/${uploaded.assetId}`, { method: "DELETE" });
await request(`/api/v3/media/${uploaded.assetId}`, { status: 404 });
const bad = "kind,value,at,source\nheart_rate,invalid,no-date,sample_sensor";
const badUpload = (
  await request("/api/v3/media/uploads", {
    method: "POST",
    status: 201,
    body: {
      personId,
      name: "bad.csv",
      kind: "sensor",
      size: bad.length,
      mime: "text/csv",
    },
  })
).data;
await request(badUpload.uploadUrl, {
  method: "PUT",
  raw: true,
  body: bad,
  status: 422,
});
await request("/api/v3/media/uploads", {
  method: "POST",
  status: 413,
  body: {
    personId,
    name: "long.mp4",
    kind: "video",
    size: 60 * 1024 * 1024,
    mime: "video/mp4",
  },
});
const cancelled = (
  await request("/api/v3/assessments", {
    method: "POST",
    body: { ...input, idempotencyKey: crypto.randomUUID() },
    status: 201,
  })
).data;
assert.equal(
  (
    await request(`/api/v3/assessments/${cancelled.assessmentId}/cancel`, {
      method: "POST",
    })
  ).data.status,
  "cancelled",
);
console.log(
  "PASS: session, person isolation, snapshot schema, settings persistence/conflict, pause, input validation, idempotency, async analysis, fallback provenance, no-alert event, fall review, actor binding, resolution, CSV upload, errors, deletion, size limit, cancellation.",
);

import { randomUUID, randomBytes, timingSafeEqual } from "node:crypto";
import {
  mkdirSync,
  writeFileSync,
  readFileSync,
  unlinkSync,
  existsSync,
} from "node:fs";
import path from "node:path";
import { observationSchema, type Media } from "@/shared/contracts/assessment";
import { get, put, all, dataRoot } from "./repository";
import { ApiError } from "./auth";
export const limits = {
  sensorBytes: 1024 * 1024,
  videoBytes: 50 * 1024 * 1024,
  videoSeconds: 120,
  retentionHours: 24,
};
export type StoredMedia = Media & { ownerId: string; uploadToken: string };
const mediaPath = (id: string) => path.join(dataRoot, "uploads", id);
export function createMedia(
  input: {
    personId: string;
    name: string;
    kind: "sensor" | "video";
    size: number;
    mime: string;
  },
  ownerId: string,
) {
  if (
    input.size >
    (input.kind === "video" ? limits.videoBytes : limits.sensorBytes)
  )
    throw new ApiError(413, "file_too_large", "File exceeds the upload limit.");
  if (
    input.kind === "video"
      ? !/\.mp4$/i.test(input.name)
      : !/\.(csv|json)$/i.test(input.name)
  )
    throw new ApiError(
      415,
      "unsupported_file",
      "Choose an MP4 video or CSV/JSON observations.",
    );
  const media: StoredMedia = {
    ...input,
    assetId: randomUUID(),
    ownerId,
    uploadToken: randomBytes(24).toString("hex"),
    durationSeconds: null,
    status: "awaiting_upload",
    createdAt: new Date().toISOString(),
    expiresAt: new Date(
      Date.now() + limits.retentionHours * 3600000,
    ).toISOString(),
    error: null,
    observations: [],
  };
  put("media", media.assetId, media);
  return media;
}
export function publicMedia(m: StoredMedia): Media {
  const { ownerId, uploadToken, ...rest } = m;
  void ownerId;
  void uploadToken;
  return rest;
}
export function mediaFor(id: string, personId?: string) {
  const m = get<StoredMedia>("media", id);
  if (!m || m.status === "deleted" || (personId && m.personId !== personId))
    throw new ApiError(404, "media_not_found", "File is unavailable.");
  if (Date.parse(m.expiresAt) < Date.now()) {
    deleteMedia(id);
    throw new ApiError(
      410,
      "media_expired",
      "File has expired. Please upload it again.",
    );
  }
  return m;
}
export function deleteMedia(id: string) {
  const m = get<StoredMedia>("media", id);
  if (!m) return;
  if (existsSync(mediaPath(id))) unlinkSync(mediaPath(id));
  put("media", id, {
    ...m,
    status: "deleted",
    observations: [],
    uploadToken: "",
  });
}
export function expireMedia() {
  for (const m of all<StoredMedia>("media"))
    if (m.status !== "deleted" && Date.parse(m.expiresAt) < Date.now())
      deleteMedia(m.assetId);
}
export function readMedia(id: string) {
  mediaFor(id);
  return readFileSync(mediaPath(id));
}
// CSV supports quoted commas, newlines and escaped quotes; malformed rows are rejected.
export function parseSensor(text: string, name: string) {
  let raw: unknown;
  if (/\.json$/i.test(name)) {
    raw = JSON.parse(text);
    if (!Array.isArray(raw) && raw && typeof raw === "object")
      raw = (raw as { observations?: unknown }).observations;
  } else {
    const rows: string[][] = [];
    let row: string[] = [],
      cell = "",
      quoted = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (c === '"') {
        if (quoted && text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = !quoted;
      } else if (c === "," && !quoted) {
        row.push(cell);
        cell = "";
      } else if (c === "\n" && !quoted) {
        row.push(cell.replace(/\r$/, ""));
        if (row.some(Boolean)) rows.push(row);
        row = [];
        cell = "";
      } else cell += c;
    }
    if (quoted) throw new Error("Unclosed CSV quote");
    row.push(cell.replace(/\r$/, ""));
    if (row.some(Boolean)) rows.push(row);
    const header = rows.shift()?.map((v) => v.trim()) ?? [];
    if (!["kind", "value", "at", "source"].every((k) => header.includes(k)))
      throw new Error("CSV requires kind,value,at,source columns");
    raw = rows.map((cells, i) => {
      if (cells.length !== header.length)
        throw new Error(`Row ${i + 2}: incorrect column count`);
      const r = Object.fromEntries(header.map((h, j) => [h, cells[j]]));
      const value = r.value.trim();
      if (
        r.withinCoverage !== undefined &&
        !["", "true", "false"].includes(r.withinCoverage)
      )
        throw new Error(`Row ${i + 2}: withinCoverage must be true or false`);
      return {
        ...r,
        value:
          value === "true"
            ? true
            : value === "false"
              ? false
              : value !== "" && Number.isFinite(Number(value))
                ? Number(value)
                : value,
        ...(r.withinCoverage !== undefined
          ? {
              withinCoverage:
                r.withinCoverage === "true"
                  ? true
                  : r.withinCoverage === "false"
                    ? false
                    : undefined,
            }
          : {}),
      };
    });
  }
  const result = observationSchema.array().min(1).max(1000).safeParse(raw);
  if (!result.success)
    throw new Error(
      result.error.issues
        .map(
          (i) =>
            `Row ${Number(i.path[0]) + 1}: ${i.path.slice(1).join(".")} ${i.message}`,
        )
        .slice(0, 5)
        .join("; "),
    );
  return result.data;
}
// Read MP4 mvhd timescale/duration, including extended atom sizes. Client metadata is not trusted.
export function mp4Duration(bytes: Buffer): number {
  if (bytes.length < 16 || bytes.toString("ascii", 4, 8) !== "ftyp")
    throw new Error("This is not an MP4 file");
  const walk = (start: number, end: number): number | null => {
    for (let at = start; at + 8 <= end;) {
      let size = bytes.readUInt32BE(at),
        head = 8;
      const type = bytes.toString("ascii", at + 4, at + 8);
      if (size === 1) {
        if (at + 16 > end) break;
        size = Number(bytes.readBigUInt64BE(at + 8));
        head = 16;
      }
      if (size === 0) size = end - at;
      if (size < head || at + size > end)
        throw new Error("Invalid MP4 structure");
      const payload = at + head;
      if (type === "moov") {
        const value = walk(payload, at + size);
        if (value !== null) return value;
      }
      if (type === "mvhd") {
        const v = bytes[payload];
        const offset = v === 1 ? 20 : 12;
        if (payload + offset + (v === 1 ? 12 : 8) > at + size)
          throw new Error("Invalid video duration");
        const scale = bytes.readUInt32BE(payload + offset);
        const duration =
          v === 1
            ? Number(bytes.readBigUInt64BE(payload + offset + 4))
            : bytes.readUInt32BE(payload + offset + 4);
        return duration / scale;
      }
      at += size;
    }
    return null;
  };
  const seconds = walk(0, bytes.length);
  if (
    seconds === null ||
    !Number.isFinite(seconds) ||
    seconds <= 0 ||
    seconds > limits.videoSeconds
  )
    throw new Error(
      `Choose an MP4 clip of at most ${limits.videoSeconds} seconds`,
    );
  return seconds;
}
export async function upload(req: Request, id: string, token: string) {
  const m = mediaFor(id);
  const a = Buffer.from(token),
    b = Buffer.from(m.uploadToken);
  if (a.length !== b.length || !timingSafeEqual(a, b))
    throw new ApiError(403, "invalid_upload_token", "Upload link is invalid.");
  if (m.status !== "awaiting_upload")
    throw new ApiError(
      409,
      "upload_finished",
      "Create a new upload to replace this file.",
    );
  const reader = req.body?.getReader();
  if (!reader) throw new ApiError(400, "empty_upload", "Choose a file.");
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const r = await reader.read();
      if (r.done) break;
      size += r.value.length;
      if (
        size > m.size ||
        size > (m.kind === "video" ? limits.videoBytes : limits.sensorBytes)
      ) {
        await reader.cancel();
        throw new Error("File exceeds the declared size");
      }
      chunks.push(r.value);
    }
    if (size !== m.size)
      throw new Error("Upload incomplete. Please select the file again.");
    const bytes = Buffer.concat(chunks);
    if (m.kind === "sensor")
      m.observations = parseSensor(bytes.toString("utf8"), m.name);
    else m.durationSeconds = mp4Duration(bytes);
    mkdirSync(path.join(dataRoot, "uploads"), { recursive: true });
    writeFileSync(mediaPath(id), bytes, { mode: 0o600 });
    m.status = "ready";
    m.uploadToken = "";
    put("media", id, m);
    return publicMedia(m);
  } catch (e) {
    m.status = "failed";
    m.error = e instanceof Error ? e.message : "Upload failed";
    put("media", id, m);
    throw new ApiError(422, "invalid_file", m.error);
  }
}

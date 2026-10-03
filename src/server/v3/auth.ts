import { randomBytes } from "node:crypto";
import { get, put } from "./repository";
import { getStore, listPeople } from "@/server/store";
export type Session = {
  userId: string;
  personIds: string[];
  expiresAt: number;
};
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export function newSession() {
  const token = randomBytes(32).toString("hex");
  const people = listPeople();
  const store = getStore(people[0].id)!;
  const session: Session = {
    userId: store.user.id,
    personIds: people
      .filter((p) => getStore(p.id)?.user.rolesBySubject[p.id])
      .map((p) => p.id),
    expiresAt: Date.now() + 86400_000,
  };
  put("session", token, session);
  return token;
}
export function session(req: Request, personId?: string) {
  const token = req.headers
    .get("cookie")
    ?.split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("lp_session="))
    ?.slice(11);
  const value = token ? get<Session>("session", token) : null;
  if (!value || value.expiresAt < Date.now())
    throw new ApiError(
      401,
      "sign_in_required",
      "Please open the workspace to continue.",
    );
  if (personId && !value.personIds.includes(personId))
    throw new ApiError(
      403,
      "person_not_bound",
      "You do not have access to this person.",
    );
  return value;
}
export function sameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  // Next may reconstruct req.url with localhost even when the browser uses 127.0.0.1.
  // Compare the browser origin with the actual Host; do not trust forwarded hosts.
  const expectedHost = req.headers.get("host") ?? new URL(req.url).host;
  let allowed = !origin;
  if (origin) {
    try {
      const parsed = new URL(origin);
      allowed =
        ["http:", "https:"].includes(parsed.protocol) &&
        parsed.host === expectedHost;
    } catch {
      allowed = false;
    }
  }
  if (!allowed || req.headers.get("sec-fetch-site") === "cross-site")
    throw new ApiError(
      403,
      "origin_mismatch",
      "Request origin is not allowed.",
    );
}

/** Compatibility routes share the same account and person authorization as v3. */
export async function legacyAccess(req: Request) {
  try {
    if (req.method !== "GET") sameOrigin(req);
    const url = new URL(req.url);
    const body =
      req.method !== "GET"
        ? await req
            .clone()
            .json()
            .catch(() => ({}))
        : {};
    const personId = url.searchParams.get("personId") ?? body.personId;
    session(req, typeof personId === "string" ? personId : undefined);
    return null;
  } catch (e) {
    const error =
      e instanceof ApiError
        ? e
        : new ApiError(400, "invalid_request", "Invalid request.");
    return Response.json(
      { error: error.message, code: error.code },
      { status: error.status },
    );
  }
}

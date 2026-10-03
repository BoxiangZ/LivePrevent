import { z } from "zod";
import { envelope } from "@/shared/contracts/assessment";
export async function api<T extends z.ZodTypeAny>(
  path: string,
  schema: T,
  init?: RequestInit,
): Promise<z.infer<T>> {
  const response = await fetch(`/api/v3/${path}`, {
    ...init,
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const body = await response.json();
  if (!response.ok)
    throw new Error(body.message ?? "Request failed. Please try again.");
  return envelope(schema).parse(body).data;
}

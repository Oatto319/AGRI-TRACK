import { NextRequest } from "next/server";
import { hashPassword } from "@/lib/password";
import type { FakeDb } from "./fakeMongo";

export const PW = "Passw0rdOk1";
export async function seedUser(db: FakeDb, username: string, role: "province" | "district", district?: string, extra: Record<string, unknown> = {}) {
  await db.collection("app_users").insertOne({ username, role, ...(district ? { district } : {}), hash: await hashPassword(PW), active: true, mustChange: false, ...extra });
}

export function makeReq(url: string, o: { method?: string; body?: unknown; cookie?: string; headers?: Record<string, string> } = {}) {
  const headers: Record<string, string> = { ...(o.headers ?? {}) };
  if (o.cookie) headers.cookie = o.cookie;
  if (o.body !== undefined) headers["content-type"] = "application/json";
  return new NextRequest(`http://localhost${url}`, { method: o.method ?? "GET", headers, ...(o.body !== undefined ? { body: JSON.stringify(o.body) } : {}) });
}
export const cookieOf = (res: Response) => (res.headers.get("set-cookie") ?? "").split(";")[0];

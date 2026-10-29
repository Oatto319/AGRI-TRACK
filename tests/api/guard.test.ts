import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeDb } from "../helpers/fakeMongo";
import { PW, cookieOf, makeReq, seedUser } from "../helpers/api";

const fake = vi.hoisted(() => ({ db: null as unknown as ReturnType<typeof import("../helpers/fakeMongo").createFakeDb> }));
vi.mock("@/lib/mongo", () => ({ db: async () => fake.db }));
fake.db = createFakeDb();

import { POST as login } from "@/app/api/login/route";
import { GET as exportXlsx } from "@/app/api/export/route";
import { GET as exportPdf } from "@/app/api/export-pdf/route";

// ทุก API ที่ไม่ใช่สาธารณะต้องเรียก requireSession "พร้อม await" — ถ้าลืม await เงื่อนไข "res" in auth จะเป็นเท็จเสมอและข้ามการตรวจสิทธิ์
const PUBLIC = new Set(["login", "logout", "health", path.join("public", "summary")]);
const routes = (dir: string): string[] => readdirSync(dir).flatMap(f => { const p = path.join(dir, f); return statSync(p).isDirectory() ? routes(p) : f === "route.ts" ? [p] : []; });
const API = path.join(process.cwd(), "app", "api");

describe("ทุก API ต้องตรวจสิทธิ์", () => {
  for (const file of routes(API)) {
    const name = path.relative(API, path.dirname(file));
    if (PUBLIC.has(name)) continue;
    it(`/api/${name} เรียก requireSession พร้อม await`, () => {
      const src = readFileSync(file, "utf8");
      expect(src).toMatch(/requireSession\(/);
      expect(src.match(/requireSession\(/g)!.length).toBe(src.match(/await requireSession\(/g)?.length ?? 0);
    });
  }
});

describe("export ต้องล็อกอิน", () => {
  beforeEach(async () => { fake.db.reset(); await seedUser(fake.db, "province", "province"); });
  it("ไม่ล็อกอิน = 401 ทั้ง Excel และ PDF", async () => {
    expect((await exportXlsx(makeReq("/api/export?from=2026-11&to=2027-06"))).status).toBe(401);
    expect((await exportPdf(makeReq("/api/export-pdf?fy=2570"))).status).toBe(401);
  });
  it("ล็อกอินแล้วดาวน์โหลด Excel ได้", async () => {
    const c = cookieOf(await login(makeReq("/api/login", { method: "POST", body: { username: "province", password: PW } })));
    const res = await exportXlsx(makeReq("/api/export?from=2026-11&to=2027-06", { cookie: c }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("spreadsheetml");
  });
});

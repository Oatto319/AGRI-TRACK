import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeDb } from "../helpers/fakeMongo";
import { PW, cookieOf, makeReq, seedUser } from "../helpers/api";

const fake = vi.hoisted(() => ({ db: null as unknown as ReturnType<typeof import("../helpers/fakeMongo").createFakeDb> }));
vi.mock("@/lib/mongo", () => ({ db: async () => fake.db }));
fake.db = createFakeDb();

import { POST as login } from "@/app/api/login/route";
import { GET as me } from "@/app/api/me/route";
import { GET as listU, PATCH as patchU, POST as postU } from "@/app/api/users/route";

const signIn = async (u: string, pw = PW) => login(makeReq("/api/login", { method: "POST", body: { username: u, password: pw } }));
let prov: string, kh: string;
const call = (fn: (req: NextRequest) => Promise<Response>, method: string, cookie: string, body?: unknown) => fn(makeReq("/api/users", { method, cookie, body }));

beforeEach(async () => {
  fake.db.reset();
  await fake.db.collection("app_users").createIndex({ username: 1 }, { unique: true }); // เหมือน lib/mongo.ts
  await seedUser(fake.db, "province", "province");
  await seedUser(fake.db, "khunhan", "district", "ขุนหาญ");
  [prov, kh] = [cookieOf(await signIn("province")), cookieOf(await signIn("khunhan"))];
});

describe("จัดการผู้ใช้ (จังหวัดเท่านั้น)", () => {
  it("อำเภอและคนไม่ล็อกอินเข้าไม่ได้", async () => {
    expect((await call(listU, "GET", kh)).status).toBe(403);
    expect((await call(postU, "POST", kh, { username: "abc", role: "province" })).status).toBe(403);
    expect((await call(listU, "GET", "")).status).toBe(401);
  });
  it("รายชื่อไม่มี hash", async () => {
    const list = await (await call(listU, "GET", prov)).json();
    expect(list).toHaveLength(2);
    expect(JSON.stringify(list)).not.toMatch(/hash|scrypt/);
  });
  it("สร้างบัญชีอำเภอ: ได้รหัสผ่านครั้งเดียว, ต้องเปลี่ยนรหัสตอนเข้าครั้งแรก, ล็อกอินได้", async () => {
    const res = await call(postU, "POST", prov, { username: "Phayuha", role: "district", district: "พยุห์" });
    expect(res.status).toBe(201);
    const { user, password } = await res.json();
    expect(user).toMatchObject({ username: "phayuha", role: "district", district: "พยุห์", active: true, mustChange: true });
    expect(password).toMatch(/^[A-Za-z0-9]{12}$/);
    const lr = await signIn("phayuha", password);
    expect(await lr.json()).toMatchObject({ mustChange: true });
    expect(await (await call(listU, "GET", prov)).text()).not.toContain(password); // ไม่เก็บ/ไม่ส่งซ้ำ
  });
  it("ตรวจข้อมูลสร้างบัญชี: ชื่อซ้ำ=409, อำเภอไม่มีจริง, ชื่อผู้ใช้ผิดรูปแบบ, รหัสผ่านอ่อน", async () => {
    expect((await call(postU, "POST", prov, { username: "khunhan", role: "district", district: "ขุนหาญ" })).status).toBe(409);
    expect((await call(postU, "POST", prov, { username: "abc", role: "district", district: "ปลอม" })).status).toBe(400);
    expect((await call(postU, "POST", prov, { username: "1ab", role: "province" })).status).toBe(400);
    expect((await call(postU, "POST", prov, { username: "abc", role: "province", password: "weak" })).status).toBe(400);
  });
  it("ปิดบัญชี: ผู้ใช้ที่ล็อกอินค้างอยู่ถูกตัดออกทันที และเปิดกลับมาได้", async () => {
    expect((await call(patchU, "PATCH", prov, { username: "khunhan", active: false })).status).toBe(200);
    expect((await me(makeReq("/api/me", { cookie: kh }))).status).toBe(401);
    expect((await signIn("khunhan")).status).toBe(401);
    await call(patchU, "PATCH", prov, { username: "khunhan", active: true });
    expect((await signIn("khunhan")).status).toBe(200);
  });
  it("รีเซ็ตรหัสผ่าน: ได้รหัสใหม่ รหัสเก่าใช้ไม่ได้ ปลดล็อกการเดารหัส และบังคับเปลี่ยน", async () => {
    for (let i = 0; i < 5; i++) await signIn("khunhan", "ผิด1234"); // ถูกล็อก
    expect((await signIn("khunhan")).status).toBe(429);
    const { password } = await (await call(patchU, "PATCH", prov, { username: "khunhan", resetPassword: true })).json();
    expect((await signIn("khunhan")).status).toBe(401);
    const ok = await signIn("khunhan", password);
    expect(ok.status).toBe(200);
    expect((await ok.json()).mustChange).toBe(true);
  });
  it("ปิดบัญชีตัวเอง / บัญชีจังหวัดสุดท้ายไม่ได้ ไม่พบผู้ใช้ = 404", async () => {
    expect((await call(patchU, "PATCH", prov, { username: "province", active: false })).status).toBe(400);
    expect((await call(patchU, "PATCH", prov, { username: "ghost", active: false })).status).toBe(404);
    await call(postU, "POST", prov, { username: "province2", role: "province" });
    const p2 = await (await call(listU, "GET", prov)).json();
    expect(p2.filter((u: { role: string }) => u.role === "province")).toHaveLength(2);
    expect((await call(patchU, "PATCH", prov, { username: "province2", active: false })).status).toBe(200);        // ยังเหลือ province
    expect((await call(patchU, "PATCH", prov, { username: "province", active: false })).status).toBe(400);        // ปิดตัวเองไม่ได้
  });
});

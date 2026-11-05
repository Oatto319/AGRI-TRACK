import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeDb } from "../helpers/fakeMongo";
import { PW, cookieOf, makeReq, seedUser } from "../helpers/api";
import { hashPassword } from "@/lib/password";

const fake = vi.hoisted(() => ({ db: null as unknown as ReturnType<typeof import("../helpers/fakeMongo").createFakeDb> }));
vi.mock("@/lib/mongo", () => ({ db: async () => fake.db }));
fake.db = createFakeDb();

import { POST as login } from "@/app/api/login/route";
import { POST as logout } from "@/app/api/logout/route";
import { GET as me } from "@/app/api/me/route";
import { POST as changePw } from "@/app/api/password/route";
import { GET as settingsGet } from "@/app/api/settings/route";

const PROVINCE_PW = "ProvincePass9";
const DISTRICT_PW = PW;
const doLogin = (account: string, password: string, headers: Record<string, string> = {}) => login(makeReq("/api/login", { method: "POST", body: { account, password }, headers }));
const signIn = async (username: string) => cookieOf(await doLogin(username === "province" ? "province" : "ขุนหาญ", username === "province" ? PROVINCE_PW : DISTRICT_PW));

beforeEach(async () => {
  fake.db.reset();
  await seedUser(fake.db, "province", "province", undefined, { hash: await hashPassword(PROVINCE_PW) });
  await seedUser(fake.db, "khunhan", "district", "ขุนหาญ", { hash: await hashPassword(DISTRICT_PW) });
});

describe("เข้าสู่ระบบ", () => {
  it("เลือกอำเภอและใช้รหัสผ่านแล้วได้ cookie ที่ httpOnly และ role จากฐานข้อมูล", async () => {
    const res = await doLogin("ขุนหาญ", DISTRICT_PW);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ role: "district", district: "ขุนหาญ", mustChange: false });
    expect(res.headers.get("set-cookie")).toMatch(/HttpOnly/i);
  });
  it("รหัสผ่านของจังหวัดเข้าสู่บัญชีจังหวัด และรหัสผิดได้ 401", async () => {
    expect(await (await doLogin("province", PROVINCE_PW)).json()).toEqual({ role: "province", mustChange: false });
    expect((await doLogin("ขุนหาญ", "ผิด1234")).status).toBe(401);
  });
  it("ต้องเลือกหน่วยงาน และตัวเลือกที่ไม่อยู่ในรายการเข้าสู่ระบบไม่ได้", async () => {
    expect((await login(makeReq("/api/login", { method: "POST", body: { password: DISTRICT_PW } }))).status).toBe(400);
    expect((await doLogin("อำเภอปลอม", DISTRICT_PW)).status).toBe(401);
  });
  it("รหัสผ่านเดียวกันใช้เข้าคนละบัญชีได้ตามหน่วยงานที่เลือก", async () => {
    const district = await fake.db.collection("app_users").findOne({ username: "khunhan" });
    await fake.db.collection("app_users").updateOne({ username: "province" }, { $set: { hash: district!.hash } });
    expect(await (await doLogin("province", DISTRICT_PW)).json()).toMatchObject({ role: "province" });
    expect(await (await doLogin("ขุนหาญ", DISTRICT_PW)).json()).toMatchObject({ role: "district", district: "ขุนหาญ" });
  });
  it("บัญชีที่ถูกปิดใช้งานเข้าไม่ได้", async () => {
    await fake.db.collection("app_users").updateOne({ username: "khunhan" }, { $set: { active: false } });
    expect((await doLogin("ขุนหาญ", DISTRICT_PW)).status).toBe(401);
  });
  it("ผิดครบจำนวนครั้งที่กำหนดถูกล็อก (429 + Retry-After) แม้รหัสจะถูก", async () => {
    for (let i = 0; i < 30; i++) expect((await doLogin("ขุนหาญ", "ผิด1234")).status).toBe(401);
    const locked = await doLogin("ขุนหาญ", DISTRICT_PW);
    expect(locked.status).toBe(429);
    expect(Number(locked.headers.get("retry-after"))).toBeGreaterThan(0);
  });
  it("ล็อกอินสำเร็จล้างตัวนับความผิดพลาด", async () => {
    for (let i = 0; i < 29; i++) await doLogin("ขุนหาญ", "ผิด1234");
    expect((await doLogin("ขุนหาญ", DISTRICT_PW)).status).toBe(200);
    for (let i = 0; i < 29; i++) expect((await doLogin("ขุนหาญ", "ผิด1234")).status).toBe(401);
  });
  it("ไม่ส่งข้อความ error ภายในของฐานข้อมูลให้ผู้ใช้", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(fake.db, "collection").mockImplementation(() => { throw new Error("mongodb://secret-host:27017 refused"); });
    const res = await doLogin("ขุนหาญ", DISTRICT_PW);
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("secret-host");
  });
  it("ปฏิเสธคำขอข้ามเว็บ (Origin ไม่ตรง Host)", async () => {
    const res = await doLogin("ขุนหาญ", DISTRICT_PW, { origin: "https://evil.example", host: "localhost" });
    expect(res.status).toBe(403);
  });
});

describe("session ฝั่งเซิร์ฟเวอร์", () => {
  it("/api/me บอกสิทธิ์จากฐานข้อมูล และไม่มี cookie = 401", async () => {
    const c = await signIn("khunhan");
    expect(await (await me(makeReq("/api/me", { cookie: c }))).json()).toMatchObject({ role: "district", district: "ขุนหาญ", username: "khunhan" });
    expect((await me(makeReq("/api/me"))).status).toBe(401);
  });
  it("ออกจากระบบแล้ว token เดิมใช้ไม่ได้อีก", async () => {
    const c = await signIn("khunhan");
    await logout(makeReq("/api/logout", { method: "POST", cookie: c }));
    expect((await me(makeReq("/api/me", { cookie: c }))).status).toBe(401);
  });
  it("ปิดบัญชีระหว่างล็อกอินอยู่ = ใช้งานต่อไม่ได้ทันที", async () => {
    const c = await signIn("khunhan");
    await fake.db.collection("app_users").updateOne({ username: "khunhan" }, { $set: { active: false } });
    expect((await me(makeReq("/api/me", { cookie: c }))).status).toBe(401);
  });
  it("ไม่ใช้ role ใน token แต่ใช้ค่าจากฐานข้อมูล (ลดสิทธิ์แล้วมีผลทันที)", async () => {
    const c = await signIn("province");
    await fake.db.collection("app_users").updateOne({ username: "province" }, { $set: { role: "district", district: "ขุนหาญ" } });
    expect((await (await me(makeReq("/api/me", { cookie: c }))).json()).role).toBe("district");
  });
});

describe("บังคับเปลี่ยนรหัสผ่านครั้งแรก", () => {
  beforeEach(async () => { await fake.db.collection("app_users").updateOne({ username: "khunhan" }, { $set: { mustChange: true } }); });
  it("API อื่นถูกบล็อก (403) แต่ /api/me ใช้ได้", async () => {
    const c = await signIn("khunhan");
    expect((await settingsGet(makeReq("/api/settings", { cookie: c }))).status).toBe(403);
    expect((await (await me(makeReq("/api/me", { cookie: c }))).json()).mustChange).toBe(true);
  });
  it("เปลี่ยนรหัสสำเร็จแล้วปลดล็อก และ session อื่นถูกเพิกถอน", async () => {
    const c1 = await signIn("khunhan"), c2 = await signIn("khunhan");
    const res = await changePw(makeReq("/api/password", { method: "POST", cookie: c1, body: { current: PW, next: "NewPassw0rd9" } }));
    expect(res.status).toBe(200);
    expect((await settingsGet(makeReq("/api/settings", { cookie: c1 }))).status).toBe(200);
    expect((await me(makeReq("/api/me", { cookie: c2 }))).status).toBe(401);
    expect((await doLogin("ขุนหาญ", "NewPassw0rd9")).status).toBe(200);
  });
  it("ปฏิเสธรหัสเดิมผิด / รหัสใหม่อ่อน / รหัสใหม่ซ้ำเดิม", async () => {
    const c = await signIn("khunhan");
    const post = (body: unknown) => changePw(makeReq("/api/password", { method: "POST", cookie: c, body }));
    expect((await post({ current: "ผิด1234", next: "NewPassw0rd9" })).status).toBe(403);
    expect((await post({ current: PW, next: "short" })).status).toBe(400);
    expect((await post({ current: PW, next: PW })).status).toBe(400);
    expect((await post({ current: PW, next: PROVINCE_PW })).status).toBe(200);
  });
});

describe("ตั้งค่า", () => {
  it("ต้องล็อกอินก่อนอ่านการตั้งค่า", async () => {
    expect((await settingsGet(makeReq("/api/settings"))).status).toBe(401);
    expect((await settingsGet(makeReq("/api/settings", { cookie: await signIn("khunhan") }))).status).toBe(200);
  });
});

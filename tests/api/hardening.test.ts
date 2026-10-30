import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeDb } from "../helpers/fakeMongo";
import { PW, cookieOf, makeReq, seedUser } from "../helpers/api";

const fake = vi.hoisted(() => ({ db: null as unknown as ReturnType<typeof import("../helpers/fakeMongo").createFakeDb> }));
vi.mock("@/lib/mongo", () => ({ db: async () => fake.db }));
fake.db = createFakeDb();

import { POST as login } from "@/app/api/login/route";
import { POST as logout } from "@/app/api/logout/route";
import { POST as changePw } from "@/app/api/password/route";
import { GET as getReports, PUT as putReport } from "@/app/api/reports/route";
import { PUT as putArea } from "@/app/api/area/route";
import { PUT as putBurn } from "@/app/api/burn/route";
import { parseAmount } from "@/lib/data/validate";
import * as store from "@/lib/store";

const signIn = async () => cookieOf(await login(makeReq("/api/login", { method: "POST", body: { username: "khunhan", password: PW } })));
const fert = { manure: "10", compost: "5", crotalaria: "0", cowpea: "0", jackbean: "0", mungbean: "0", othergm: "0", biomass: "0" };
const repBody = (o: Record<string, unknown> = {}) => ({ district: "ขุนหาญ", month: "2026-11", round: 1, status: "submitted", reporter: { name: "สมชาย" }, values: fert, ...o });
let kh: string;

beforeEach(async () => {
  fake.db.reset(); vi.restoreAllMocks();
  await seedUser(fake.db, "khunhan", "district", "ขุนหาญ");
  kh = await signIn();
});

describe("parseAmount", () => {
  it("รับเลขฐานสิบธรรมดา", () => { expect(parseAmount("12")).toBe(12); expect(parseAmount(" 3.5 ")).toBe(3.5); expect(parseAmount(".5")).toBe(0.5); expect(parseAmount(0)).toBe(0); expect(parseAmount(7)).toBe(7); });
  it("ปฏิเสธ hex / เลขยกกำลัง / Infinity / ช่องว่าง / ติดลบ / เกินเพดาน / ไม่ใช่เลข", () => {
    for (const v of ["0x10", "1e308", "1e3", "Infinity", "NaN", "  ", "", "-1", "1,000", "12abc", "5.", 1e12, -1, NaN, Infinity, null, undefined, {}, [], "1".repeat(13)]) expect(parseAmount(v), String(v)).toBeNull();
  });
  it("integer=true ปฏิเสธทศนิยม", () => { expect(parseAmount("2.5", true)).toBeNull(); expect(parseAmount("2", true)).toBe(2); });
});

describe("ตรวจข้อมูลที่อำเภอกรอก", () => {
  it("ปุ๋ย: ค่ารูปแบบแปลก/ใหญ่เกิน/ช่องว่างล้วน ถูกปฏิเสธ (400)", async () => {
    for (const manure of ["0x10", "1e308", "   ", 1e12]) {
      const res = await putReport(makeReq("/api/reports", { method: "PUT", cookie: kh, body: repBody({ values: { ...fert, manure } }) }));
      expect(res.status, String(manure)).toBe(400);
    }
  });
  it("พื้นที่และหยุดเผา: ค่า 1e308 / 0x10 ถูกปฏิเสธ", async () => {
    const area = await putArea(makeReq("/api/area", { method: "PUT", cookie: kh, body: { district: "ขุนหาญ", month: "2026-11", status: "submitted", reporter: { name: "ก" }, values: { area: "1e308" } } }));
    expect(area.status).toBe(400);
    const burn = await putBurn(makeReq("/api/burn", { method: "PUT", cookie: kh, body: { district: "ขุนหาญ", month: "2026-11", status: "submitted", reporter: { name: "ก" }, values: { activities: "0x10" } } }));
    expect(burn.status).toBe(400);
  });
  it("ชื่อ/ตำแหน่ง/เบอร์ยาวเกินกำหนดถูกปฏิเสธ", async () => {
    for (const reporter of [{ name: "ก".repeat(121) }, { name: "ก", position: "ข".repeat(121) }, { name: "ก", phone: "1".repeat(21) }]) {
      const res = await putReport(makeReq("/api/reports", { method: "PUT", cookie: kh, body: repBody({ reporter, status: "draft" }) }));
      expect(res.status, JSON.stringify(reporter).slice(0, 30)).toBe(400);
    }
  });
  it("ข้อผิดพลาดภายใน (ฐานข้อมูล) ตอบ 500 ข้อความทั่วไป ไม่รั่วรายละเอียด", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(fake.db.collection("reports"), "findOne").mockRejectedValue(new Error("connect ECONNREFUSED 10.0.0.5:27017 user=admin"));
    const res = await putReport(makeReq("/api/reports", { method: "PUT", cookie: kh, body: repBody() }));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toMatch(/ECONNREFUSED|10\.0\.0\.5|admin/);
  });
  it("กฎของระบบ (ส่งแล้วบันทึกเป็นร่างไม่ได้) ยังตอบ 400 พร้อมข้อความเดิม", async () => {
    await putReport(makeReq("/api/reports", { method: "PUT", cookie: kh, body: repBody() }));
    const res = await putReport(makeReq("/api/reports", { method: "PUT", cookie: kh, body: repBody({ status: "draft" }) }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("บันทึกเป็นร่างไม่ได้");
    expect(store.RejectError).toBeDefined();
  });
  it("GET รายงานไม่ถูกแคช (no-store)", async () => {
    const res = await getReports(makeReq("/api/reports", { cookie: kh }));
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
});

describe("ออกจากระบบ + เปลี่ยนรหัสผ่าน", () => {
  it("logout จากต่างเว็บ (Origin ไม่ตรง) ถูกปฏิเสธและ session ยังอยู่", async () => {
    const res = await logout(makeReq("/api/logout", { method: "POST", cookie: kh, headers: { origin: "https://evil.example", host: "localhost" } }));
    expect(res.status).toBe(403);
    expect((await getReports(makeReq("/api/reports", { cookie: kh }))).status).toBe(200);
  });
  it("logout จากเว็บเดียวกันยังใช้ได้ตามปกติ", async () => {
    expect((await logout(makeReq("/api/logout", { method: "POST", cookie: kh, headers: { origin: "http://localhost", host: "localhost" } }))).status).toBe(200);
    expect((await getReports(makeReq("/api/reports", { cookie: kh }))).status).toBe(401);
  });
  it("เดารหัสผ่านเดิมผิดซ้ำ ๆ ถูกล็อกชั่วคราว (429) แม้ใส่รหัสถูกภายหลัง", async () => {
    const tryPw = (current: string) => changePw(makeReq("/api/password", { method: "POST", cookie: kh, body: { current, next: "NewPassw0rd9" } }));
    for (let i = 0; i < 5; i++) expect((await tryPw("wrong-pass-1")).status).toBe(403);
    expect((await tryPw(PW)).status).toBe(429);
  });
  it("เปลี่ยนรหัสผ่านสำเร็จตามปกติเมื่อกรอกถูก", async () => {
    const res = await changePw(makeReq("/api/password", { method: "POST", cookie: kh, body: { current: PW, next: "NewPassw0rd9" } }));
    expect(res.status).toBe(200);
  });
});

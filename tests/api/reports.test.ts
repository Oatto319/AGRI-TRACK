import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeDb } from "../helpers/fakeMongo";
import { cookieOf, makeReq, seedUser, PW } from "../helpers/api";

const fake = vi.hoisted(() => ({ db: null as unknown as ReturnType<typeof import("../helpers/fakeMongo").createFakeDb> }));
vi.mock("@/lib/mongo", () => ({ db: async () => fake.db }));
fake.db = createFakeDb();

import { POST as login } from "@/app/api/login/route";
import { GET as getReports, PUT as putReport } from "@/app/api/reports/route";
import { GET as getArea } from "@/app/api/area/route";
import { PUT as putSettings } from "@/app/api/settings/route";
import { ConflictError, update } from "@/lib/store";

const signIn = async (u: string) => cookieOf(await login(makeReq("/api/login", { method: "POST", body: { username: u, password: PW } })));
let kh: string, ph: string, prov: string;
const body = (o: Record<string, unknown> = {}) => ({ district: "ขุนหาญ", month: "2026-11", round: 1, values: { manure: "10", compost: "5", crotalaria: "0", cowpea: "0", jackbean: "0", mungbean: "0", othergm: "0", biomass: "0" }, reporter: { name: "สมชาย" }, status: "submitted", ...o });
const put = (cookie: string, b: unknown) => putReport(makeReq("/api/reports", { method: "PUT", cookie, body: b }));

beforeEach(async () => {
  fake.db.reset(); vi.useRealTimers();
  await seedUser(fake.db, "province", "province");
  await seedUser(fake.db, "khunhan", "district", "ขุนหาญ");
  await seedUser(fake.db, "phayuha", "district", "พยุห์");
  [prov, kh, ph] = [await signIn("province"), await signIn("khunhan"), await signIn("phayuha")];
});

describe("PUT /api/reports", () => {
  it("อำเภอส่งรายงานของตัวเองได้ และเซิร์ฟเวอร์ตัดสินส่งช้า/ตรงเวลาเอง", async () => {
    vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-11-20T03:00:00Z"));
    kh = await signIn("khunhan"); // token มีอายุ 12 ชม. จึงต้องล็อกอินหลังตั้งเวลาจำลอง
    const res = await put(kh, body());
    expect(res.status).toBe(200);
    const r = await res.json();
    expect(r).toMatchObject({ status: "submitted", district: "ขุนหาญ", late: false, dueDate: "2026-11-30" });
    vi.setSystemTime(new Date("2026-12-05T03:00:00Z")); kh = await signIn("khunhan");
    const late = await (await put(kh, body({ month: "2026-11", round: 1, values: { ...body().values, manure: "99" } }))).json();
    expect(late.late).toBe(false); // ส่งซ้ำไม่เปลี่ยนสถานะส่งช้า/ตรงเวลาของครั้งแรก
    const r2 = await (await put(kh, body({ month: "2026-12", round: 1 }))).json();
    expect(r2.late).toBe(false);
  });
  it("ส่งหลังกำหนดถูกบันทึกว่าส่งช้า", async () => {
    vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2027-01-10T03:00:00Z")); kh = await signIn("khunhan");
    expect((await (await put(kh, body({ month: "2026-11" }))).json()).late).toBe(true);
  });
  it("จังหวัดกรอกรายงานไม่ได้ (403) และอำเภอกรอกแทนอำเภออื่นไม่ได้ (403)", async () => {
    expect((await put(prov, body())).status).toBe(403);
    expect((await put(ph, body())).status).toBe(403);
  });
  it("ไม่ล็อกอิน = 401", async () => { expect((await put("", body())).status).toBe(401); });
  it("ตรวจรูปแบบข้อมูล: เดือน สถานะ ค่าติดลบ ช่องไม่ครบเมื่อส่ง ไม่มีชื่อผู้รายงาน", async () => {
    expect((await put(kh, body({ month: "2026-13" }))).status).toBe(400);
    expect((await put(kh, body({ status: "x" }))).status).toBe(400);
    expect((await put(kh, body({ values: { ...body().values, manure: "-1" } }))).status).toBe(400);
    expect((await put(kh, body({ values: { manure: "1" } }))).status).toBe(400);
    expect((await put(kh, body({ reporter: { name: "" } }))).status).toBe(400);
  });
  it("บันทึกร่างได้แม้กรอกไม่ครบ", async () => {
    expect((await put(kh, body({ status: "draft", values: { manure: "3" } }))).status).toBe(200);
  });
  it("เขียนทับกัน: ถ้ามีคนแก้ตัดหน้าระหว่างอ่านกับเขียน ได้ ConflictError (ไม่เขียนทับเงียบ ๆ)", async () => {
    await put(kh, body());
    const col = fake.db.collection("reports");
    await expect(update("ขุนหาญ", "2026-11", 1, old => {
      void col.updateOne({ district: "ขุนหาญ", month: "2026-11", round: 1 }, { $set: { version: 99 } }); // คนอื่นบันทึกตัดหน้า
      return old!;
    })).rejects.toBeInstanceOf(ConflictError);
  });
  it("แถวใหม่สองคำขอพร้อมกันไม่ซ้ำกัน (unique index) — ตัวที่ช้ากว่าได้ 409", async () => {
    // ฐานข้อมูลจริงมี unique index (district,month,round) — จำลองด้วยการสร้างดัชนีเดียวกัน
    await fake.db.collection("reports").createIndex({ district: 1, month: 1, round: 1 }, { unique: true });
    const [a, b] = await Promise.all([put(kh, body({ month: "2026-12" })), put(kh, body({ month: "2026-12" }))]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
  });
});

describe("GET แยกสิทธิ์ตามอำเภอ", () => {
  beforeEach(async () => { await put(kh, body()); await fake.db.collection("area_reports").insertOne({ district: "พยุห์", month: "2026-11", round: 1, amounts: { area: 5 }, reporter: { name: "x", position: "", phone: "" }, status: "submitted", updated_at: "2026-12-01T00:00:00Z" }); });
  it("อำเภออ่านได้เฉพาะของตัวเอง (ไม่ระบุ = ของตัวเอง, ระบุอำเภออื่น = 403)", async () => {
    const mine = await (await getReports(makeReq("/api/reports", { cookie: kh }))).json();
    expect(mine.map((r: { district: string }) => r.district)).toEqual(["ขุนหาญ"]);
    expect((await getReports(makeReq("/api/reports?district=" + encodeURIComponent("พยุห์"), { cookie: kh }))).status).toBe(403);
    expect((await getArea(makeReq("/api/area", { cookie: kh }))).status).toBe(200);
    expect(await (await getArea(makeReq("/api/area", { cookie: kh }))).json()).toEqual([]); // ข้อมูลไถกลบของพยุห์ไม่รั่ว
  });
  it("จังหวัดอ่านได้ทุกอำเภอ และกรองตามอำเภอ/เดือนได้", async () => {
    expect((await (await getArea(makeReq("/api/area", { cookie: prov }))).json())).toHaveLength(1);
    expect((await (await getReports(makeReq("/api/reports?month=2026-12", { cookie: prov }))).json())).toHaveLength(0);
  });
});

describe("PUT /api/settings", () => {
  it("เฉพาะจังหวัดแก้ได้ และตรวจรูปแบบข้อมูล", async () => {
    const put = (cookie: string, b: unknown) => putSettings(makeReq("/api/settings", { method: "PUT", cookie, body: b }));
    expect((await put(kh, { dueDays: [10] })).status).toBe(403);
    expect((await put(prov, { dueDays: [10, 25] })).status).toBe(200);
    expect((await put(prov, { dueDays: [25, 10] })).status).toBe(400);
  });
});

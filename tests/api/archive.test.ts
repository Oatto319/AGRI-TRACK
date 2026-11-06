import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeDb } from "../helpers/fakeMongo";
import { cookieOf, makeReq, seedUser, PW } from "../helpers/api";
import { hashPassword } from "@/lib/password";

const fake = vi.hoisted(() => ({ db: null as unknown as ReturnType<typeof import("../helpers/fakeMongo").createFakeDb> }));
vi.mock("@/lib/mongo", () => ({ db: async () => fake.db }));
fake.db = createFakeDb();

import { POST as login } from "@/app/api/login/route";
import { PUT as putReport } from "@/app/api/reports/route";
import { PUT as putSettings } from "@/app/api/settings/route";
import { GET as getArchive, POST as postArchive } from "@/app/api/archive/route";
import { GET as exportArchive } from "@/app/api/archive/export/route";

const row = (month: string) => ({ district: "ขุนหาญ", month, round: 1, status: "submitted", reporter: { name: "สมชาย", position: "", phone: "" }, amounts: { manure: 10 }, updated_at: "2022-01-05T00:00:00.000Z", submitted_at: "2022-01-05T00:00:00.000Z", due_date: "2022-01-31", late: false, version: 1 });
const rep = { district: "ขุนหาญ", month: "2026-11", round: 1, status: "submitted", reporter: { name: "สมชาย" }, values: { manure: "10", compost: "0", crotalaria: "0", cowpea: "0", jackbean: "0", mungbean: "0", othergm: "0", biomass: "0" } };
let prov: string, kh: string;
const signIn = async (account: string, password: string) => cookieOf(await login(makeReq("/api/login", { method: "POST", body: { account, password } })));

beforeEach(async () => {
  fake.db.reset();
  vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-11-05T03:00:00Z")); // ปีงบประมาณ 2570 → กรอบเก็บ 2566–2570
  await seedUser(fake.db, "province", "province", undefined, { hash: await hashPassword("ProvincePass9") });
  await seedUser(fake.db, "khunhan", "district", "ขุนหาญ");
  [prov, kh] = [await signIn("province", "ProvincePass9"), await signIn("ขุนหาญ", PW)];
  await fake.db.collection("reports").insertOne(row("2021-12")); // ปีงบประมาณ 2565 = หลุดกรอบ
  await fake.db.collection("reports").insertOne(row("2022-01"));
});

afterEach(() => { vi.useRealTimers(); });

describe("เก็บข้อมูล 5 ปี + บังคับ export", () => {
  it("มีข้อมูลหลุดกรอบ: ล็อกการบันทึกของอำเภอและจังหวัด (423) แต่ยังอ่านสถานะ/export ได้", async () => {
    const st = await (await getArchive(makeReq("/api/archive", { cookie: prov }))).json();
    expect(st).toMatchObject({ level: "locked", blocking: [2565], currentFy: 2570 });
    const r = await putReport(makeReq("/api/reports", { method: "PUT", cookie: kh, body: rep }));
    expect(r.status).toBe(423);
    expect((await r.json()).error).toContain("2565");
    expect((await putSettings(makeReq("/api/settings", { method: "PUT", cookie: prov, body: { dueDays: [30] } }))).status).toBe(423);
    const d = await (await getArchive(makeReq("/api/archive", { cookie: kh }))).json(); // อำเภอเห็นเฉพาะระดับ+ข้อความ ไม่เห็นรายละเอียด
    expect(d.level).toBe("locked"); expect(d.items).toBeUndefined();
  });
  it("export Excel สำเร็จแล้วปลดล็อก · อำเภอ export ไม่ได้", async () => {
    expect((await exportArchive(makeReq("/api/archive/export?fy=2565&format=xlsx", { cookie: kh }))).status).toBe(403);
    const x = await exportArchive(makeReq("/api/archive/export?fy=2565&format=xlsx", { cookie: prov }));
    expect(x.status).toBe(200);
    expect(x.headers.get("content-disposition")).toContain("fy2565.xlsx");
    expect((await (await getArchive(makeReq("/api/archive", { cookie: prov }))).json()).level).toBe("ok");
    expect((await putReport(makeReq("/api/reports", { method: "PUT", cookie: kh, body: rep }))).status).toBe(200);
  });
  it("ลบข้อมูลเก่าต้องมีทั้ง Excel+JSON, พิมพ์ปียืนยัน และห้ามลบปีที่ยังอยู่ในกรอบ", async () => {
    const purge = (b: unknown) => postArchive(makeReq("/api/archive", { method: "POST", cookie: prov, body: b }));
    await exportArchive(makeReq("/api/archive/export?fy=2565&format=xlsx", { cookie: prov }));
    expect((await purge({ action: "purge", fy: 2565, confirm: "2565" })).status).toBe(400); // ยังไม่มี JSON
    const j = await exportArchive(makeReq("/api/archive/export?fy=2565&format=json", { cookie: prov }));
    const data = JSON.parse(await j.text());
    expect(data).toMatchObject({ fy: 2565, counts: { reports: 2, area: 0, burn: 0 } });
    expect(data.reports).toHaveLength(2);
    expect((await purge({ action: "purge", fy: 2565, confirm: "x" })).status).toBe(400);
    const ok = await purge({ action: "purge", fy: 2565, confirm: "2565" });
    expect(ok.status).toBe(200);
    expect(await fake.db.collection("reports").countDocuments({})).toBe(0);
    await fake.db.collection("reports").insertOne(row("2026-11")); // ปี 2570 อยู่ในกรอบ
    await exportArchive(makeReq("/api/archive/export?fy=2570&format=xlsx", { cookie: prov }));
    await exportArchive(makeReq("/api/archive/export?fy=2570&format=json", { cookie: prov }));
    expect((await purge({ action: "purge", fy: 2570, confirm: "2570" })).status).toBe(400);
  });
  it("ไม่มีข้อมูลหลุดกรอบ = ไม่ล็อก", async () => {
    fake.db.collection("reports").docs = [];
    await fake.db.collection("reports").insertOne(row("2022-11")); // ปี 2566 อยู่ในกรอบ
    expect((await putReport(makeReq("/api/reports", { method: "PUT", cookie: kh, body: rep }))).status).toBe(200);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeDb } from "../helpers/fakeMongo";
import { makeReq } from "../helpers/api";

const fake = vi.hoisted(() => ({ db: null as unknown as ReturnType<typeof import("../helpers/fakeMongo").createFakeDb> }));
vi.mock("@/lib/mongo", () => ({ db: async () => fake.db }));
fake.db = createFakeDb();

import { GET as health } from "@/app/api/health/route";
import { GET as pub } from "@/app/api/public/summary/route";

const who = { name: "ลับ สมชาย", position: "นวส.", phone: "0812345678" };
beforeEach(async () => {
  fake.db.reset(); delete process.env.PUBLIC_DASHBOARD;
  const base = { round: 1, reporter: who, status: "submitted", updated_at: "2026-12-01T00:00:00Z", late: true, submitted_at: "2026-12-01T00:00:00Z", due_date: "2026-11-30" };
  await fake.db.collection("reports").insertOne({ ...base, district: "ขุนหาญ", month: "2026-11", amounts: { manure: 40, compost: 10 } });
  await fake.db.collection("area_reports").insertOne({ ...base, district: "ขุนหาญ", month: "2026-11", amounts: { area: 200 } });
});

describe("/api/health", () => {
  it("200 เมื่อฐานข้อมูลพร้อม", async () => {
    const res = await health();
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: "ok", db: "up" });
  });
  it("503 เมื่อฐานข้อมูลล่ม และไม่เปิดเผยรายละเอียดภายใน", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    fake.db.state.failPing = true;
    const res = await health();
    expect(res.status).toBe(503);
    expect(JSON.stringify(await res.json())).not.toContain("db down");
  });
});

describe("/api/public/summary", () => {
  it("เข้าได้โดยไม่ต้องล็อกอิน และมีเฉพาะยอดรวม ไม่มีข้อมูลบุคคลหรือสถานะส่งช้า", async () => {
    const res = await pub(makeReq("/api/public/summary?fy=2570"));
    expect(res.status).toBe(200);
    const text = JSON.stringify(await res.json());
    expect(text).not.toMatch(/สมชาย|0812345678|นวส|reporter|phone|late|submittedAt/);
  });
  it("ยอดรวมถูกต้อง", async () => {
    const d = await (await pub(makeReq("/api/public/summary?fy=2570"))).json();
    expect(d.fert.total).toBe(50);
    expect(d.fert.byDistrict.find((x: { name: string }) => x.name === "ขุนหาญ").total).toBe(50);
    expect(d.area.accum).toBe(200);
    expect(d.area.straw).toBe(100);
    expect(d.fert.byDistrict).toHaveLength(22);
  });
  it("ไม่ระบุปี = ปีงบประมาณของข้อมูลล่าสุด", async () => { expect((await (await pub(makeReq("/api/public/summary"))).json()).fy).toBe(2570); });
  it("ปีไม่ถูกต้อง = 400 และปิดหน้าสาธารณะได้ด้วย PUBLIC_DASHBOARD=off", async () => {
    expect((await pub(makeReq("/api/public/summary?fy=abc"))).status).toBe(400);
    process.env.PUBLIC_DASHBOARD = "off";
    expect((await pub(makeReq("/api/public/summary?fy=2570"))).status).toBe(404);
  });
});

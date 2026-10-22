import { NextRequest, NextResponse } from "next/server";
import { AREA_FIELDS, DISTRICTS, bkkDate, dueDateOf, dueDaysFor, isAreaMonth, type AreaReport } from "@/lib/data";
import { readAreaAll, readSettings, updateArea } from "@/lib/store";

const bad = (m: string) => NextResponse.json({ error: m }, { status: 400 });
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams, d = q.get("district"), m = q.get("month");
  let all = await readAreaAll();
  if (d) all = all.filter(r => r.district === d);
  if (m) all = all.filter(r => r.month === m);
  return NextResponse.json(all);
}

// หมายเหตุ: ยังไม่มีการตรวจสิทธิ์ผู้เรียก API (เหมือน /api/reports) — ควรเพิ่ม session ก่อนใช้งานจริง
export async function PUT(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); } catch { return bad("ข้อมูลไม่ถูกต้อง"); }
  if (!isRecord(body)) return bad("ข้อมูลไม่ถูกต้อง");
  if (typeof body.district !== "string" || !DISTRICTS.some(x => x.name === body.district)) return bad("ไม่พบอำเภอ");
  if (typeof body.month !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(body.month)) return bad("เดือนไม่ถูกต้อง");
  const settings = await readSettings(); // อ่านก่อนตรวจเดือน เพื่อใช้ช่วงเดือนของปีงบประมาณที่จังหวัดตั้งไว้
  if (!isAreaMonth(body.month)) return bad("รายงานพื้นที่ทำได้เฉพาะเดือนพฤศจิกายนถึงมิถุนายน");
  if (body.status !== "draft" && body.status !== "submitted") return bad("สถานะไม่ถูกต้อง");
  const round = body.round === undefined ? 1 : body.round;
  if (typeof round !== "number" || !Number.isInteger(round) || round < 1 || round > dueDaysFor(settings, "area", body.month).length) return bad(`รอบต้องอยู่ระหว่าง 1–${dueDaysFor(settings, "area", body.month).length}`);

  const inputValues = body.values === undefined ? {} : isRecord(body.values) ? body.values : null;
  if (!inputValues) return bad("ข้อมูลตัวเลขไม่ถูกต้อง");
  const inputReporter = body.reporter === undefined ? {} : isRecord(body.reporter) ? body.reporter : null;
  if (!inputReporter) return bad("ข้อมูลผู้รายงานไม่ถูกต้อง");
  const values: AreaReport["values"] = {};
  for (const f of AREA_FIELDS) {
    const v = inputValues[f.key];
    if (v === undefined || v === null || v === "") { if (body.status === "submitted") return bad(`กรอก${f.label} (ถ้าไม่มีให้ใส่ 0)`); continue; }
    if (typeof v !== "number" && typeof v !== "string") return bad(`${f.label}ต้องเป็นตัวเลข`);
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) return bad(`${f.label}ต้องเป็นตัวเลขที่ไม่ติดลบ`);
    values[f.key] = n;
  }
  if (["name", "position", "phone"].some(key => inputReporter[key] !== undefined && typeof inputReporter[key] !== "string")) return bad("ข้อมูลผู้รายงานไม่ถูกต้อง");
  const rp = {
    name: typeof inputReporter.name === "string" ? inputReporter.name.trim() : "",
    position: typeof inputReporter.position === "string" ? inputReporter.position.trim() : "",
    phone: typeof inputReporter.phone === "string" ? inputReporter.phone.trim() : "",
  };
  if (body.status === "submitted") {
    if (!rp.name) return bad("กรอกชื่อผู้รายงาน");
  }
  const { district, month, status } = body;
  try {
    const saved = await updateArea(district, month, round, old => {
      if (old?.status === "submitted" && status === "draft") throw new Error("ส่งข้อมูลแล้ว บันทึกเป็นร่างไม่ได้ (แก้ไขแล้วกดส่งซ้ำ)");
      const now = new Date();
      let meta: Partial<AreaReport> = {};
      if (status === "submitted") {
        if (old?.submittedAt) meta = { submittedAt: old.submittedAt, dueDate: old.dueDate, late: old.late }; // นับจากวันที่ส่งครั้งแรก
        else { const due = dueDateOf(month, dueDaysFor(settings, "area", month)[round - 1]); meta = { submittedAt: now.toISOString(), dueDate: due, late: bkkDate(now) > due }; }
      }
      return { district, month, round, values, reporter: rp, status, updatedAt: now.toISOString(), ...meta };
    });
    return NextResponse.json(saved);
  } catch (e) { return bad(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ"); }
}

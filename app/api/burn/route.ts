import { NextRequest, NextResponse } from "next/server";
import { DISTRICTS, bkkDate, cfgOfMonth, dueDateOf, dueDaysFor, type BurnReport } from "@/lib/data";
import { REPORTER_MAX, parseAmount } from "@/lib/data/validate"; // import ตรงจากไฟล์ เพื่อไม่ขึ้นกับการ resolve ของ "@/lib/data"
import { forbidden, requireSession } from "@/lib/auth";
import { ConflictError, RejectError, readBurnAll, readSettings, updateBurn } from "@/lib/store";

const bad = (m: string) => NextResponse.json({ error: m }, { status: 400 });
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export async function GET(req: NextRequest) {
  const auth = await requireSession(req);
  if ("res" in auth) return auth.res;
  const q = req.nextUrl.searchParams, m = q.get("month");
  let d = q.get("district");
  // อำเภออ่านได้เฉพาะข้อมูลของอำเภอตัวเอง (จังหวัดอ่านได้ทุกอำเภอ)
  if (auth.session.role === "district") {
    if (d && d !== auth.session.district) return forbidden("ดูข้อมูลได้เฉพาะอำเภอของบัญชีที่เข้าสู่ระบบ");
    d = auth.session.district ?? null;
  }
  return NextResponse.json(await readBurnAll({ ...(d ? { district: d } : {}), ...(m ? { month: m } : {}) }), { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(req: NextRequest) {
  const auth = await requireSession(req);
  if ("res" in auth) return auth.res;
  if (auth.session.role !== "district") return NextResponse.json({ error: "เฉพาะเจ้าหน้าที่อำเภอเท่านั้นที่กรอกรายงานได้" }, { status: 403 });
  let body: unknown;
  try { body = await req.json(); } catch { return bad("ข้อมูลไม่ถูกต้อง"); }
  if (!isRecord(body)) return bad("ข้อมูลไม่ถูกต้อง");
  if (typeof body.district !== "string" || !DISTRICTS.some(x => x.name === body.district)) return bad("ไม่พบอำเภอ");
  if (body.district !== auth.session.district) return NextResponse.json({ error: "กรอกรายงานได้เฉพาะอำเภอของบัญชีที่เข้าสู่ระบบ" }, { status: 403 });
  if (typeof body.month !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(body.month)) return bad("เดือนไม่ถูกต้อง");
  if (body.status !== "draft" && body.status !== "submitted") return bad("สถานะไม่ถูกต้อง");
  const settings = await readSettings(), round = body.round === undefined ? 1 : body.round;
  const maxRound = dueDaysFor(settings, "burn", body.month).length;
  if (typeof round !== "number" || !Number.isInteger(round) || round < 1 || round > maxRound) return bad(`รอบต้องอยู่ระหว่าง 1–${maxRound}`);

  const inputValues = body.values === undefined ? {} : isRecord(body.values) ? body.values : null;
  if (!inputValues) return bad("ข้อมูลตัวเลขไม่ถูกต้อง");
  const inputReporter = body.reporter === undefined ? {} : isRecord(body.reporter) ? body.reporter : null;
  if (!inputReporter) return bad("ข้อมูลผู้รายงานไม่ถูกต้อง");
  const values: BurnReport["values"] = {};
  for (const f of cfgOfMonth(settings, body.month).burnFields) {
    const v = inputValues[f.key];
    if (v === undefined || v === null || v === "") { if (body.status === "submitted") return bad(`กรอก${f.label} (ถ้าไม่มีให้ใส่ 0)`); continue; }
    if (typeof v !== "number" && typeof v !== "string") return bad(`${f.label}ต้องเป็นตัวเลข`);
    const n = parseAmount(v);
    if (n === null) return bad(`${f.label}ต้องเป็นตัวเลขที่ไม่ติดลบ (ไม่เกิน 1,000,000,000)`);
    if (!Number.isInteger(n)) return bad(`${f.label}ต้องเป็นจำนวนเต็ม`);
    values[f.key] = n;
  }
  if (["name", "position", "phone"].some(key => inputReporter[key] !== undefined && typeof inputReporter[key] !== "string")) return bad("ข้อมูลผู้รายงานไม่ถูกต้อง");
  const rp = {
    name: typeof inputReporter.name === "string" ? inputReporter.name.trim() : "",
    position: typeof inputReporter.position === "string" ? inputReporter.position.trim() : "",
    phone: typeof inputReporter.phone === "string" ? inputReporter.phone.trim() : "",
  };
  if (rp.name.length > REPORTER_MAX.name || rp.position.length > REPORTER_MAX.position || rp.phone.length > REPORTER_MAX.phone) return bad("ข้อมูลผู้รายงานยาวเกินไป");
  if (body.status === "submitted" && !rp.name) return bad("กรอกชื่อผู้รายงาน");
  const { district, month, status } = body;
  try {
    const saved = await updateBurn(district, month, round, old => {
      if (old?.status === "submitted" && status === "draft") throw new RejectError("ส่งข้อมูลแล้ว บันทึกเป็นร่างไม่ได้ (แก้ไขแล้วกดส่งซ้ำ)");
      const now = new Date();
      let meta: Partial<BurnReport> = {};
      if (status === "submitted") {
        if (old?.submittedAt) meta = { submittedAt: old.submittedAt, dueDate: old.dueDate, late: old.late }; // นับจากวันที่ส่งครั้งแรก
        else { const due = dueDateOf(month, dueDaysFor(settings, "burn", month)[round - 1]); meta = { submittedAt: now.toISOString(), dueDate: due, late: bkkDate(now) > due }; }
      }
      return { district, month, round, values, reporter: rp, status, updatedAt: now.toISOString(), ...meta };
    });
    return NextResponse.json(saved);
  } catch (e) {
    if (e instanceof ConflictError) return NextResponse.json({ error: e.message }, { status: 409 });
    if (e instanceof RejectError) return bad(e.message);
    console.error("[burn]", e); // ข้อผิดพลาดภายใน (เช่น ฐานข้อมูล) ดูได้ใน log เท่านั้น ไม่ส่งรายละเอียดให้ผู้ใช้
    return NextResponse.json({ error: "บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" }, { status: 500 });
  }
}

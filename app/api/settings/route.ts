import { NextRequest, NextResponse, connection } from "next/server";
import { validateAreaSets, validateAreaTotals, validateConfig, validateDueDays, validateSchedules, validateTambonSets } from "@/lib/data";
import { forbidden, requireSession } from "@/lib/auth";
import { readSettings, writeSettings } from "@/lib/store";

const bad = (m: string) => NextResponse.json({ error: m }, { status: 400 });

// ต้องล็อกอินก่อนจึงอ่านการตั้งค่าได้ · connection(): บังคับให้อ่านฐานข้อมูลทุกครั้งที่เรียก ไม่ถูก prerender ตอน build
export async function GET(req: NextRequest) {
  await connection();
  const auth = await requireSession(req);
  if ("res" in auth) return auth.res;
  return NextResponse.json(await readSettings(), { headers: { "Cache-Control": "no-store" } });
}

// ส่งมาเฉพาะ schedules (รายการที่ต้องรายงานรายปีงบประมาณ) หรือ dueDays (ค่าเริ่มต้น) หรือเฉพาะ areaTotals (พื้นที่ปลูกพืชทั้งหมดรายอำเภอ) หรือ tambonSets (จำนวนเกษตรตำบลรายอำเภอ + เป้าหมายการผลิตต่อเกษตรตำบล) หรือหลายอย่างพร้อมกันก็ได้ — ค่าที่ไม่ได้ส่งมาคงเดิม
export async function PUT(req: NextRequest) {
  // เฉพาะเจ้าหน้าที่จังหวัดที่ล็อกอินแล้วเท่านั้นที่แก้การตั้งค่า/หัวข้อ/ปีงบประมาณ/ช่องปุ๋ยได้ (ตรวจจาก cookie ที่เซิร์ฟเวอร์เซ็นไว้)
  const auth = await requireSession(req);
  if ("res" in auth) return auth.res;
  if (auth.session.role !== "province") return forbidden("เฉพาะเจ้าหน้าที่จังหวัดเท่านั้นที่แก้ไขการตั้งค่าได้");
  let body: unknown;
  try { body = await req.json(); } catch { return bad("ข้อมูลไม่ถูกต้อง"); }
  if (typeof body !== "object" || body === null || Array.isArray(body)) return bad("ข้อมูลไม่ถูกต้อง");
  const cur = await readSettings();
  let { dueDays, areaTotals, schedules, areaSets, tambonSets, config } = cur;
  if ("dueDays" in body) {
    const error = validateDueDays(body.dueDays);
    if (error) return bad(error);
    dueDays = body.dueDays as number[];
  }
  if ("areaTotals" in body) {
    const error = validateAreaTotals(body.areaTotals);
    if (error) return bad(error);
    areaTotals = body.areaTotals as Record<string, number>;
  }
  if ("schedules" in body) {
    const error = validateSchedules(body.schedules);
    if (error) return bad(error);
    schedules = body.schedules as typeof schedules;
  }
  if ("areaSets" in body) {
    const error = validateAreaSets(body.areaSets);
    if (error) return bad(error);
    areaSets = body.areaSets as typeof areaSets;
  }
  if ("tambonSets" in body) {
    const error = validateTambonSets(body.tambonSets);
    if (error) return bad(error);
    tambonSets = body.tambonSets as typeof tambonSets;
  }
  if ("config" in body) {
    const error = validateConfig(body.config);
    if (error) return bad(error);
    config = body.config as typeof config;
  }
  if (!("dueDays" in body) && !("areaTotals" in body) && !("schedules" in body) && !("areaSets" in body) && !("tambonSets" in body) && !("config" in body)) return bad("ไม่พบข้อมูลที่ต้องการบันทึก");
  const next = { dueDays, areaTotals, schedules, areaSets, tambonSets, config };
  await writeSettings(next);
  return NextResponse.json(next);
}

import { NextRequest, NextResponse, connection } from "next/server";
import { currentMonth } from "@/lib/data";
import { latestFiscalYear, buildPublicSummary, type PublicSummary } from "@/lib/public";
import { readAll, readAreaAll, readBurnAll, readSettings } from "@/lib/store";

// สรุปสาธารณะ (ไม่ต้องล็อกอิน) — เฉพาะยอดรวม ไม่มีข้อมูลผู้รายงานหรือสถานะการส่ง · ปิดได้ด้วย PUBLIC_DASHBOARD=off
// แคชผลในหน่วยความจำ 60 วินาที + Cache-Control ให้ CDN เก็บ 5 นาที เพื่อไม่ให้ผู้เข้าชมทั่วไปทำให้ฐานข้อมูลทำงานหนัก
const TTL = 60_000;
const cache = new Map<string, { at: number; data: PublicSummary }>();

export async function GET(req: NextRequest) {
  await connection();
  if (process.env.PUBLIC_DASHBOARD === "off") return NextResponse.json({ error: "ไม่เปิดให้ดูข้อมูลสาธารณะ" }, { status: 404 });
  const q = req.nextUrl.searchParams.get("fy"), fyIn = q === null ? null : Number(q);
  if (fyIn !== null && (!Number.isInteger(fyIn) || fyIn < 2500 || fyIn > 2700)) return NextResponse.json({ error: "ปีงบประมาณไม่ถูกต้อง" }, { status: 400 });
  const key = String(fyIn ?? "latest"), hit = cache.get(key);
  const headers = { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" };
  if (hit && Date.now() - hit.at < TTL) return NextResponse.json(hit.data, { headers });
  try {
    const [reports, area, burn, settings] = await Promise.all([readAll(), readAreaAll(), readBurnAll(), readSettings()]);
    const data = buildPublicSummary(reports, area, burn, settings, fyIn ?? latestFiscalYear(reports, currentMonth()));
    if (cache.size > 20) cache.clear();
    cache.set(key, { at: Date.now(), data });
    return NextResponse.json(data, { headers });
  } catch (e) {
    console.error("[public]", e);
    return NextResponse.json({ error: "โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่ภายหลัง" }, { status: 500 });
  }
}

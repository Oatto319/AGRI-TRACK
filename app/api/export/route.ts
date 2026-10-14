import { NextRequest } from "next/server";
import { readAll, readAreaAll, readSettings } from "@/lib/store";
import { buildWorkbook } from "@/lib/export";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams, from = q.get("from") ?? "", to = q.get("to") ?? "";
  const ok = /^\d{4}-(0[1-9]|1[0-2])$/;
  if (!ok.test(from) || !ok.test(to) || from > to) return new Response("ช่วงเดือนไม่ถูกต้อง", { status: 400 });
  const settings = await readSettings();
  const buf = await buildWorkbook(await readAll(), from, to, settings.dueDays.length, await readAreaAll(), settings.areaTotals);
  return new Response(new Uint8Array(buf), { headers: {
    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "Content-Disposition": `attachment; filename="organic-fertilizer-${from}_${to}.xlsx"`,
  } });
}

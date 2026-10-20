import { NextRequest } from "next/server";
import { readAll, readAreaAll, readBurnAll, readSettings } from "@/lib/store";
import { buildWorkbook } from "@/lib/export";
import { areaTotalsFor, cfgOf, dueDaysFor } from "@/lib/data";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams, from = q.get("from") ?? "", to = q.get("to") ?? "";
  const ok = /^\d{4}-(0[1-9]|1[0-2])$/;
  if (!ok.test(from) || !ok.test(to) || from > to) return new Response("ช่วงเดือนไม่ถูกต้อง", { status: 400 });
  const settings = await readSettings();
  const buf = await buildWorkbook(await readAll(), from, to, dueDaysFor(settings, "fert", to).length, await readAreaAll(), areaTotalsFor(settings, to), await readBurnAll(), dueDaysFor(settings, "burn", to).length, cfgOf(settings));
  return new Response(new Uint8Array(buf), { headers: {
    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "Content-Disposition": `attachment; filename="organic-fertilizer-${from}_${to}.xlsx"`,
  } });
}

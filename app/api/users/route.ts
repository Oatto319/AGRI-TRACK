import { NextRequest, NextResponse } from "next/server";
import { forbidden, requireSession, type AuthSession } from "@/lib/auth";
import { UserError, createUser, listUsers, updateUser } from "@/lib/users";

// จัดการบัญชีผู้ใช้ — เฉพาะเจ้าหน้าที่จังหวัด · รหัสผ่านที่ระบบสร้างให้จะส่งกลับ "ครั้งเดียว" ในคำตอบนี้เท่านั้น (ในฐานข้อมูลเก็บเป็น hash)
const noStore = { "Cache-Control": "no-store" };
async function guard(req: NextRequest): Promise<{ res: NextResponse } | { session: AuthSession }> {
  const a = await requireSession(req);
  if ("res" in a) return { res: a.res };
  if (a.session.role !== "province") return { res: forbidden("เฉพาะเจ้าหน้าที่จังหวัดเท่านั้นที่จัดการบัญชีผู้ใช้ได้") };
  return { session: a.session };
}
const fail = (e: unknown) => {
  if (e instanceof UserError) return NextResponse.json({ error: e.message }, { status: e.status });
  console.error("[users]", e);
  return NextResponse.json({ error: "ทำรายการไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" }, { status: 500 });
};
const readBody = async (req: NextRequest) => { try { const b: unknown = await req.json(); return typeof b === "object" && b !== null && !Array.isArray(b) ? (b as Record<string, unknown>) : null; } catch { return null; } };

export async function GET(req: NextRequest) {
  const g = await guard(req); if ("res" in g) return g.res;
  try { return NextResponse.json(await listUsers(), { headers: noStore }); } catch (e) { return fail(e); }
}

export async function POST(req: NextRequest) {
  const g = await guard(req); if ("res" in g) return g.res;
  const b = await readBody(req); if (!b) return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  try { return NextResponse.json(await createUser(b), { status: 201, headers: noStore }); } catch (e) { return fail(e); }
}

export async function PATCH(req: NextRequest) {
  const g = await guard(req); if ("res" in g) return g.res;
  const b = await readBody(req);
  if (!b || typeof b.username !== "string") return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  if (b.active !== undefined && typeof b.active !== "boolean") return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  try { return NextResponse.json(await updateUser(g.session.username, { username: b.username, active: b.active as boolean | undefined, resetPassword: b.resetPassword === true }), { headers: noStore }); }
  catch (e) { return fail(e); }
}

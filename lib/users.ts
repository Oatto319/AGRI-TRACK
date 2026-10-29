import { randomBytes } from "crypto";
import { DISTRICTS } from "./data";
import { db } from "./mongo";
import { DUMMY_HASH, checkPassword, generatePassword, hashPassword, validatePassword } from "./password";

// บัญชีผู้ใช้เก็บในคอลเลกชัน app_users บน MongoDB (สร้างด้วย `npm run seed:users` หรือหน้า /province/users)
export type Role = "province" | "district";
/** ข้อมูลที่ส่งให้หน้าเว็บ (ไม่มี hash) */
export interface Session { role: Role; district?: string }
export interface PublicUser { username: string; role: Role; district?: string; active: boolean; mustChange: boolean; createdAt?: string; lastLoginAt?: string }
interface UserDoc { username: string; role: Role; district?: string | null; hash: string; active?: boolean; mustChange?: boolean; createdAt?: string; lastLoginAt?: string }

const USERNAME_RE = /^[a-z][a-z0-9_.-]{2,31}$/;
const users = async () => (await db()).collection<UserDoc>("app_users");
const NO_ID = { projection: { _id: 0 } } as const;

function toPublic(u: UserDoc): PublicUser {
  return { username: u.username, role: u.role, ...(u.district ? { district: u.district } : {}), active: u.active !== false, mustChange: u.mustChange === true,
    ...(u.createdAt ? { createdAt: u.createdAt } : {}), ...(u.lastLoginAt ? { lastLoginAt: u.lastLoginAt } : {}) };
}
function checkRow(u: UserDoc) {
  const ok = typeof u.hash === "string" && (u.role === "province" || (u.role === "district" && DISTRICTS.some(d => d.name === u.district)));
  if (!ok) throw new Error(`Invalid user row in app_users (${u.username})`);
}
async function findUser(username: string): Promise<UserDoc | null> {
  const u = await (await users()).findOne({ username }, NO_ID);
  if (!u) return null;
  checkRow(u);
  return u;
}

/** ตรวจชื่อผู้ใช้/รหัสผ่าน — บัญชีที่ถูกปิดใช้งานเข้าไม่ได้ (ตอบเหมือนรหัสผ่านผิด) */
export async function verifyLogin(username: string, password: string): Promise<PublicUser | null> {
  const u = await findUser(username.trim().toLowerCase());
  const ok = await checkPassword(password, u?.hash ?? DUMMY_HASH);
  if (!u || !ok || u.active === false) return null;
  const now = new Date().toISOString();
  await (await users()).updateOne({ username: u.username }, { $set: { lastLoginAt: now } });
  return toPublic({ ...u, lastLoginAt: now });
}

export async function getUser(username: string): Promise<PublicUser | null> {
  const u = await findUser(username);
  return u ? toPublic(u) : null;
}
export async function listUsers(): Promise<PublicUser[]> {
  const rows = await (await users()).find({}, NO_ID).sort({ role: -1, username: 1 }).toArray();
  return rows.map(toPublic).sort((a, b) => (a.role === b.role ? a.username.localeCompare(b.username) : a.role === "province" ? -1 : 1));
}

export class UserError extends Error { constructor(message: string, readonly status = 400) { super(message); } }

export async function createUser(input: Record<string, unknown>): Promise<{ user: PublicUser; password: string }> {
  const username = typeof input.username === "string" ? input.username.trim().toLowerCase() : "";
  if (!USERNAME_RE.test(username)) throw new UserError("ชื่อผู้ใช้ต้องเป็นตัวอักษรอังกฤษพิมพ์เล็ก/ตัวเลข 3–32 ตัว ขึ้นต้นด้วยตัวอักษร");
  if (input.role !== "province" && input.role !== "district") throw new UserError("สิทธิ์ไม่ถูกต้อง");
  if (input.role === "district" && !DISTRICTS.some(d => d.name === input.district)) throw new UserError("เลือกอำเภอให้ถูกต้อง");
  const password = input.password === undefined || input.password === "" ? generatePassword() : input.password;
  const pwErr = validatePassword(password, username);
  if (pwErr) throw new UserError(pwErr);
  const doc: UserDoc = { username, role: input.role, ...(input.role === "district" ? { district: input.district as string } : {}), hash: await hashPassword(password as string),
    active: true, mustChange: true, createdAt: new Date().toISOString() };
  try { await (await users()).insertOne(doc); }
  catch (e) { if ((e as { code?: number }).code === 11000) throw new UserError("มีชื่อผู้ใช้นี้อยู่แล้ว", 409); throw e; }
  return { user: toPublic(doc), password: password as string };
}

/** ปิด/เปิดบัญชี หรือรีเซ็ตรหัสผ่าน (สร้างรหัสใหม่ให้และบังคับเปลี่ยนตอนเข้าครั้งหน้า) — กันไม่ให้ปิด/ลดสิทธิ์บัญชีจังหวัดสุดท้าย */
export async function updateUser(actor: string, input: { username: string; active?: boolean; resetPassword?: boolean }): Promise<{ user: PublicUser; password?: string }> {
  const u = await findUser(input.username);
  if (!u) throw new UserError("ไม่พบบัญชีผู้ใช้", 404);
  const set: Partial<UserDoc> = {}; let password: string | undefined;
  if (input.active !== undefined) {
    if (input.active === false && u.role === "province") {
      if (u.username === actor) throw new UserError("ปิดบัญชีของตัวเองไม่ได้");
      const left = (await listUsers()).filter(x => x.role === "province" && x.active && x.username !== u.username).length;
      if (left < 1) throw new UserError("ต้องเหลือบัญชีจังหวัดที่ใช้งานได้อย่างน้อย 1 บัญชี");
    }
    set.active = input.active;
  }
  if (input.resetPassword) { password = generatePassword(); set.hash = await hashPassword(password); set.mustChange = true; }
  if (Object.keys(set).length === 0) throw new UserError("ไม่มีข้อมูลที่ต้องแก้ไข");
  await (await users()).updateOne({ username: u.username }, { $set: set });
  if (input.active === false || input.resetPassword) await revokeSessions(u.username); // ออกจากระบบทุกเครื่องทันที
  if (input.resetPassword) await (await db()).collection("login_attempts").deleteOne({ _id: `user:${u.username}` } as never); // ปลดล็อกการเดารหัสผ่านด้วย
  return { user: toPublic({ ...u, ...set }), ...(password ? { password } : {}) };
}

/** ผู้ใช้เปลี่ยนรหัสผ่านของตัวเอง (ต้องใส่รหัสเดิม) — เครื่องอื่นที่ล็อกอินค้างอยู่จะถูกออกจากระบบ */
export async function changePassword(username: string, current: unknown, next: unknown, keepSid?: string): Promise<void> {
  const u = await findUser(username);
  if (!u || typeof current !== "string" || !(await checkPassword(current, u.hash))) throw new UserError("รหัสผ่านปัจจุบันไม่ถูกต้อง", 403);
  const err = validatePassword(next, username);
  if (err) throw new UserError(err);
  if (next === current) throw new UserError("รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านเดิม");
  await (await users()).updateOne({ username }, { $set: { hash: await hashPassword(next as string), mustChange: false } });
  await revokeSessions(username, keepSid);
}

// ---------- session ฝั่งเซิร์ฟเวอร์ (คอลเลกชัน sessions) ทำให้ออกจากระบบ/ปิดบัญชีแล้ว token เดิมใช้ไม่ได้ทันที ----------
export const newSid = () => randomBytes(18).toString("base64url");
export async function createSession(sid: string, username: string, expiresAt: Date) {
  await (await db()).collection("sessions").insertOne({ _id: sid, username, exp: expiresAt } as never);
}
export async function sessionExists(sid: string, username: string): Promise<boolean> {
  return !!(await (await db()).collection("sessions").findOne({ _id: sid, username } as never));
}
export async function deleteSession(sid: string) { await (await db()).collection("sessions").deleteOne({ _id: sid } as never); }
export async function revokeSessions(username: string, keepSid?: string) {
  await (await db()).collection("sessions").deleteMany(keepSid ? { username, _id: { $ne: keepSid } } as never : { username } as never);
}

import { scrypt, timingSafeEqual } from "crypto";
import { DISTRICTS } from "./data";
import { db } from "./mongo";

// บัญชีผู้ใช้เก็บในคอลเลกชัน app_users บน MongoDB (สร้างด้วย `npm run seed:users`) — รหัสผ่านเป็น hash แบบ scrypt$salt$hash
export type Role = "province" | "district";
export interface User { username: string; role: Role; district?: string; hash: string }
export interface Session { role: Role; district?: string }

const kdf = (pw: string, salt: Buffer) => new Promise<Buffer>((res, rej) => scrypt(pw, salt, 64, (e, k) => e ? rej(e) : res(k)));

async function findUser(username: string): Promise<User | undefined> {
  const data = await (await db()).collection("app_users").findOne({ username }, { projection: { _id: 0, username: 1, role: 1, district: 1, hash: 1 } });
  if (!data) return undefined;
  const u = data as unknown as { username: string; role: string; district: string | null; hash: string };
  const ok = typeof u.hash === "string" && (u.role === "province" || (u.role === "district" && DISTRICTS.some(d => d.name === u.district)));
  if (!ok) throw new Error(`Invalid user row in app_users (${u.username})`);
  return { username: u.username, role: u.role as Role, ...(u.district ? { district: u.district } : {}), hash: u.hash };
}

async function check(pw: string, stored: string) {
  const [alg, salt, hex] = stored.split("$");
  if (alg !== "scrypt" || !salt || !hex) return false;
  const want = Buffer.from(hex, "hex"), got = await kdf(pw, Buffer.from(salt, "hex"));
  return want.length === got.length && timingSafeEqual(want, got);
}
// ไม่พบผู้ใช้ก็ยังคำนวณ hash หนึ่งครั้ง เพื่อไม่ให้เวลาตอบบอกได้ว่าชื่อผู้ใช้มีอยู่จริงหรือไม่
const DUMMY = `scrypt$${"00".repeat(16)}$${"00".repeat(64)}`;

export async function verifyLogin(username: string, password: string): Promise<Session | null> {
  const u = await findUser(username.trim().toLowerCase());
  const ok = await check(password, u?.hash ?? DUMMY);
  return u && ok ? { role: u.role, ...(u.district ? { district: u.district } : {}) } : null;
}

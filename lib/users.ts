import { promises as fs } from "fs";
import path from "path";
import { scrypt, timingSafeEqual } from "crypto";
import { DISTRICTS } from "./data";

// บัญชีผู้ใช้เก็บใน data/users.json (สร้างด้วย `node scripts/seed-users.mjs`) — รหัสผ่านเป็น hash แบบ scrypt$salt$hash
export type Role = "province" | "district";
export interface User { username: string; role: Role; district?: string; hash: string }
export interface Session { role: Role; district?: string }

const FILE = path.join(process.cwd(), "data", "users.json");
const kdf = (pw: string, salt: Buffer) => new Promise<Buffer>((res, rej) => scrypt(pw, salt, 64, (e, k) => e ? rej(e) : res(k)));

async function readUsers(): Promise<User[]> {
  let content: string;
  try { content = await fs.readFile(FILE, "utf8"); }
  catch (e) { if (typeof e === "object" && e && "code" in e && e.code === "ENOENT") return []; throw e; }
  const users: unknown = JSON.parse(content);
  const ok = Array.isArray(users) && users.every(u => typeof u?.username === "string" && typeof u?.hash === "string" &&
    (u.role === "province" || (u.role === "district" && DISTRICTS.some(d => d.name === u.district))));
  if (!ok) throw new Error("Invalid data/users.json");
  return users as User[];
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
  const u = (await readUsers()).find(x => x.username === username.trim().toLowerCase());
  const ok = await check(password, u?.hash ?? DUMMY);
  return u && ok ? { role: u.role, ...(u.district ? { district: u.district } : {}) } : null;
}

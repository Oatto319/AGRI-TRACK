import { randomBytes, randomInt, scrypt, timingSafeEqual } from "crypto";

// รหัสผ่านเก็บเป็น scrypt$<salt hex>$<hash hex> — รูปแบบเดียวกับ scripts/seed-users.mjs
const kdf = (pw: string, salt: Buffer) => new Promise<Buffer>((res, rej) => scrypt(pw, salt, 64, (e, k) => (e ? rej(e) : res(k))));

export async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(16);
  return `scrypt$${salt.toString("hex")}$${(await kdf(pw, salt)).toString("hex")}`;
}

export async function checkPassword(pw: string, stored: string): Promise<boolean> {
  const [alg, salt, hex] = stored.split("$");
  if (alg !== "scrypt" || !salt || !hex) return false;
  const want = Buffer.from(hex, "hex"), got = await kdf(pw, Buffer.from(salt, "hex"));
  return want.length === got.length && timingSafeEqual(want, got);
}
// ไม่พบผู้ใช้ก็ยังคำนวณ hash หนึ่งครั้ง เพื่อไม่ให้เวลาตอบบอกได้ว่าชื่อผู้ใช้มีอยู่จริงหรือไม่
export const DUMMY_HASH = `scrypt$${"00".repeat(16)}$${"00".repeat(64)}`;

/** ตรวจความแข็งแรงของรหัสผ่านใหม่ — คืนข้อความผิดพลาด หรือ null ถ้าใช้ได้ */
export function validatePassword(pw: unknown, username = ""): string | null {
  if (typeof pw !== "string") return "รหัสผ่านไม่ถูกต้อง";
  if (pw.length < 8) return "รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร";
  if (pw.length > 128) return "รหัสผ่านยาวเกินไป (ไม่เกิน 128 ตัวอักษร)";
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) return "รหัสผ่านต้องมีทั้งตัวอักษรภาษาอังกฤษและตัวเลข";
  if (username && pw.toLowerCase().includes(username.toLowerCase())) return "รหัสผ่านต้องไม่มีชื่อผู้ใช้อยู่ในนั้น";
  return null;
}

// ตัดตัวที่สับสนง่าย (0/O, 1/l/I) ออก — ต้องมีทั้งตัวอักษรและตัวเลขเสมอ
const ALPHA = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ", DIGIT = "23456789";
export function generatePassword(n = 12): string {
  const all = ALPHA + DIGIT;
  const chars = [ALPHA[randomInt(ALPHA.length)], DIGIT[randomInt(DIGIT.length)], ...Array.from({ length: n - 2 }, () => all[randomInt(all.length)])];
  for (let i = chars.length - 1; i > 0; i--) { const j = randomInt(i + 1); [chars[i], chars[j]] = [chars[j], chars[i]]; }
  return chars.join("");
}

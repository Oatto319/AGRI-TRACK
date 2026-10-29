import { describe, expect, it } from "vitest";
import { checkPassword, generatePassword, hashPassword, validatePassword } from "@/lib/password";
import { makeToken, parseToken } from "@/lib/session";

describe("password", () => {
  it("hash แล้วตรวจได้ และรหัสผิดไม่ผ่าน", async () => {
    const h = await hashPassword("Abcdefg1");
    expect(h.startsWith("scrypt$")).toBe(true);
    expect(await checkPassword("Abcdefg1", h)).toBe(true);
    expect(await checkPassword("Abcdefg2", h)).toBe(false);
    expect(await checkPassword("x", "รูปแบบเสีย")).toBe(false);
  });
  it("นโยบายรหัสผ่าน", () => {
    expect(validatePassword("Abcdefg1")).toBeNull();
    expect(validatePassword("short1")).not.toBeNull();
    expect(validatePassword("abcdefghij")).not.toBeNull();   // ไม่มีตัวเลข
    expect(validatePassword("12345678")).not.toBeNull();     // ไม่มีตัวอักษร
    expect(validatePassword("Province123", "province")).not.toBeNull();
    expect(validatePassword(undefined)).not.toBeNull();
  });
  it("รหัสที่ระบบสร้างผ่านนโยบายเสมอและไม่ซ้ำกัน", () => {
    const set = new Set<string>();
    for (let i = 0; i < 200; i++) { const p = generatePassword(); expect(validatePassword(p)).toBeNull(); set.add(p); }
    expect(set.size).toBe(200);
  });
});

describe("session token", () => {
  const d = { sid: "s1", username: "u1", role: "district" as const, district: "ขุนหาญ" };
  it("ถอดได้ตรงกับที่เซ็น", () => { expect(parseToken(makeToken(d))).toMatchObject(d); });
  it("แก้ payload แล้วลายเซ็นไม่ตรง", () => {
    const [, sig] = makeToken(d).split(".");
    const forged = Buffer.from(JSON.stringify({ ...d, role: "province", exp: 9e9 })).toString("base64url");
    expect(parseToken(`${forged}.${sig}`)).toBeNull();
  });
  it("หมดอายุแล้วใช้ไม่ได้ และ token ขยะถูกปฏิเสธ", () => {
    const old = makeToken(d, Date.now() - 13 * 3600e3);
    expect(parseToken(old)).toBeNull();
    for (const bad of [undefined, "", "abc", "a.b", "."]) expect(parseToken(bad)).toBeNull();
  });
});

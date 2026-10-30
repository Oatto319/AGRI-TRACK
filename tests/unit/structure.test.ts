import fs from "node:fs";
import { describe, expect, it } from "vitest";

describe("โครงสร้างโมดูล", () => {
  it("ห้ามมี lib/data.ts คู่กับโฟลเดอร์ lib/data/ — Next.js จะเลือกไฟล์เดี่ยวก่อนและมองไม่เห็นโค้ดในโฟลเดอร์", () => {
    expect(fs.existsSync("lib/data/index.ts")).toBe(true);
    expect(fs.existsSync("lib/data.ts")).toBe(false);
  });
});

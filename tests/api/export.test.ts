import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  role: "district" as "district" | "province",
  readAll: vi.fn(async () => []),
  readAreaAll: vi.fn(async () => []),
  readBurnAll: vi.fn(async () => []),
  readSettings: vi.fn(async () => ({})),
  buildWorkbook: vi.fn(async () => Buffer.from("xlsx")),
  buildPdf: vi.fn(async () => Buffer.from("pdf")),
}));

vi.mock("@/lib/auth", () => ({
  requireSession: async () => ({ session: { username: "test", role: mocks.role } }),
  forbidden: (message: string) => new Response(message, { status: 403 }),
}));
vi.mock("@/lib/store", () => ({
  readAll: mocks.readAll,
  readAreaAll: mocks.readAreaAll,
  readBurnAll: mocks.readBurnAll,
  readSettings: mocks.readSettings,
}));
vi.mock("@/lib/export", () => ({ buildWorkbook: mocks.buildWorkbook }));
vi.mock("@/lib/pdf", () => ({ buildPdf: mocks.buildPdf }));
vi.mock("@/lib/data", () => ({
  areaTotalsFor: () => ({}),
  cfgOfMonth: () => ({}),
  dueDaysFor: () => [],
}));

import { GET as getExcel } from "@/app/api/export/route";
import { GET as getPdf } from "@/app/api/export-pdf/route";
import { NextRequest } from "next/server";

const request = (url: string) => new NextRequest(new URL(url, "http://localhost"));

beforeEach(() => {
  mocks.role = "district";
  vi.clearAllMocks();
});

describe("การส่งออกข้อมูลจังหวัด", () => {
  it("ปฏิเสธผู้ใช้อำเภอทั้ง Excel และ PDF โดยไม่อ่านข้อมูล", async () => {
    const [excel, pdf] = await Promise.all([
      getExcel(request("/api/export?from=2026-01&to=2026-12")),
      getPdf(request("/api/export-pdf?fy=2569")),
    ]);

    expect(excel.status).toBe(403);
    expect(pdf.status).toBe(403);
    expect(mocks.readAll).not.toHaveBeenCalled();
    expect(mocks.buildWorkbook).not.toHaveBeenCalled();
    expect(mocks.buildPdf).not.toHaveBeenCalled();
  });

  it("อนุญาตเจ้าหน้าที่จังหวัดให้ส่งออก Excel และ PDF ได้", async () => {
    mocks.role = "province";
    const [excel, pdf] = await Promise.all([
      getExcel(request("/api/export?from=2026-01&to=2026-12")),
      getPdf(request("/api/export-pdf?fy=2569")),
    ]);

    expect(excel.status).toBe(200);
    expect(excel.headers.get("content-type")).toContain("spreadsheetml");
    expect(pdf.status).toBe(200);
    expect(pdf.headers.get("content-type")).toBe("application/pdf");
    expect(mocks.buildWorkbook).toHaveBeenCalledOnce();
    expect(mocks.buildPdf).toHaveBeenCalledOnce();
  });
});

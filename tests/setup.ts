import { vi } from "vitest";

process.env.AUTH_SECRET = "test-secret-test-secret-test-secret-123";
delete process.env.PUBLIC_DASHBOARD;

// connection() ใช้ได้เฉพาะในคำขอจริงของ Next.js — ในเทสต์ให้ข้ามไป
vi.mock("next/server", async importOriginal => ({ ...(await importOriginal<typeof import("next/server")>()), connection: async () => {} }));

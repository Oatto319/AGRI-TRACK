import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "@/lib/monitoring";

export function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") Sentry.init(sentryOptions(process.env.SENTRY_DSN));
}
// ข้อผิดพลาดที่เกิดตอนเซิร์ฟเวอร์ประมวลผลคำขอ (หน้า/API) ส่งเข้า Sentry อัตโนมัติ
export const onRequestError = Sentry.captureRequestError;

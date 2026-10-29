import type { ErrorEvent } from "@sentry/nextjs";

// ตั้งค่าเฝ้าระวังข้อผิดพลาดด้วย Sentry — ไม่ตั้ง DSN = ปิดทั้งหมด (ไม่ส่งอะไรออกนอกระบบ)
//   SENTRY_DSN              ฝั่งเซิร์ฟเวอร์ (API/การเรนเดอร์)
//   NEXT_PUBLIC_SENTRY_DSN  ฝั่งเบราว์เซอร์ (ค่าเดียวกันก็ได้)
// ไม่ส่งข้อมูลส่วนบุคคล: ตัด cookie / header / body ของคำขอออกก่อนส่งทุกครั้ง
export const sentryOptions = (dsn: string | undefined) => ({
  dsn, enabled: !!dsn, sendDefaultPii: false, tracesSampleRate: 0,
  environment: process.env.NODE_ENV,
  beforeSend(event: ErrorEvent): ErrorEvent {
    if (event.request) { delete event.request.cookies; delete event.request.headers; delete event.request.data; delete event.request.query_string; }
    return event;
  },
});

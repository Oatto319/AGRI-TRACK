# ระบบรายงานปุ๋ยอินทรีย์และวัสดุอินทรีย์ รายเดือน (Next.js 14)
npm install && npm run dev  → http://localhost:3000
- `/` เข้าสู่ระบบ | `/district` อำเภอกรอก/ส่งรายงานรายเดือน | `/province` จังหวัดดูสรุปและดาวน์โหลด Excel
- ฟิลด์ที่กรอกและรายชื่ออำเภอ/จำนวนเกษตรตำบล: `lib/data.ts`
- ข้อมูลเก็บที่ `data/reports.json` (สร้างอัตโนมัติ, ต้องรันบนเซิร์ฟเวอร์ที่เขียนไฟล์ได้ ไม่ใช่ serverless) — เปลี่ยนที่ `lib/store.ts`
- ไฟล์ Excel สร้างใน `lib/export.ts` ผ่าน `/api/export?from=YYYY-MM&to=YYYY-MM`
"# AGRI-TRACK" 

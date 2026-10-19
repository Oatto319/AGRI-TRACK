// นำเข้าพื้นที่ไถกลบฟางข้าวรายเดือนจากไฟล์ JSON ขึ้น MongoDB (เฉพาะคอลเลกชัน area_reports — ไม่แตะ settings / reports / ผู้ใช้)
//   ดูตัวอย่างก่อนไม่เขียนจริง:  node scripts/import-area-reports.mjs --dry
//   นำเข้าจริง:                   npm run import:area
// ไฟล์ที่ใช้: data/area-import-2569.json (หรือระบุ path เป็นอาร์กิวเมนต์) · รอบที่ 1 · สถานะ "ส่งแล้ว" · ไม่มีบันทึกวันที่ส่ง
// ถ้าอำเภอ+เดือน+รอบที่ 1 มีข้อมูลอยู่แล้วจะถูกเขียนทับ (ใช้ upsert) — สคริปต์จะรายงานจำนวนที่ถูกเขียนทับก่อนบันทึก
import { promises as fs } from "fs";
import dns from "node:dns";
import { MongoClient } from "mongodb";

const args = process.argv.slice(2), dry = args.includes("--dry");
const file = args.find(a => !a.startsWith("--")) ?? "data/area-import-2569.json";
const REPORTER = "จังหวัดกรอกแทนอำเภอ";
const DISTRICTS = ["กันทรลักษ์", "กันทรารมย์", "ขุขันธ์", "ขุนหาญ", "น้ำเกลี้ยง", "โนนคูณ", "บึงบูรพ์", "เบญจลักษ์", "ปรางค์กู่", "พยุห์", "โพธิ์ศรีสุวรรณ", "ไพรบึง", "ภูสิงห์", "เมืองจันทร์", "เมืองศรีสะเกษ", "ยางชุมน้อย", "ราษีไศล", "วังหิน", "ศรีรัตนะ", "ศิลาลาด", "ห้วยทับทัน", "อุทุมพรพิสัย"];

const src = JSON.parse(await fs.readFile(file, "utf8"));
const months = src.months, rows = Object.entries(src.rows).map(([k, v]) => [k.trim(), v]);
for (const m of months) if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(m)) throw new Error(`เดือนไม่ถูกต้อง: ${m}`);
for (const [name, vals] of rows) {
  if (!DISTRICTS.includes(name)) throw new Error(`ไม่พบอำเภอ: ${name}`);
  if (vals.length !== months.length) throw new Error(`${name}: มี ${vals.length} ค่า แต่ต้องมี ${months.length} เดือน`);
  if (!vals.every(v => typeof v === "number" && Number.isFinite(v) && v >= 0)) throw new Error(`${name}: ค่าต้องเป็นตัวเลขที่ไม่ติดลบ`);
}
const now = new Date().toISOString();
const docs = rows.flatMap(([district, vals]) => months.map((month, i) => ({
  district, month, round: 1, status: "submitted", reporter: { name: REPORTER, position: "", phone: "" },
  amounts: { area: vals[i] }, updated_at: now, submitted_at: null, due_date: null, late: null,
})));
const total = docs.reduce((a, d) => a + d.amounts.area, 0);
console.log(`${rows.length} อำเภอ × ${months.length} เดือน = ${docs.length} รายการ · รวม ${total.toLocaleString("th-TH", { maximumFractionDigits: 2 })} ไร่`);
for (const [name, vals] of rows) console.log(`  ${name.padEnd(14)} ${vals.reduce((a, b) => a + b, 0).toLocaleString("th-TH", { maximumFractionDigits: 2 })} ไร่`);

if (!process.env.MONGODB_URI) { if (dry) { console.log("(โหมดดูตัวอย่าง — ไม่ได้เชื่อมต่อฐานข้อมูล)"); process.exit(0); } console.error("ยังไม่ได้ตั้งค่า MONGODB_URI ใน .env.local"); process.exit(1); }
if (process.env.MONGODB_DNS_SERVERS) dns.setServers(process.env.MONGODB_DNS_SERVERS.split(",").map(x => x.trim()).filter(Boolean));
const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
try {
  await client.connect();
  const col = client.db(process.env.MONGODB_DB || "agri_track").collection("area_reports");
  await col.createIndex({ district: 1, month: 1, round: 1 }, { unique: true });
  const keys = docs.map(d => ({ district: d.district, month: d.month, round: d.round }));
  const existing = await col.find({ $or: keys }, { projection: { _id: 0, district: 1, month: 1, "amounts.area": 1 } }).toArray();
  console.log(existing.length ? `พบข้อมูลเดิม ${existing.length} รายการ ที่จะถูกเขียนทับ:` : "ไม่มีข้อมูลเดิมซ้ำ");
  existing.forEach(e => console.log(`  ${e.district} ${e.month} (เดิม ${e.amounts?.area ?? "-"} ไร่)`));
  if (dry) { console.log("โหมดดูตัวอย่าง — ยังไม่ได้บันทึก"); }
  else {
    await col.bulkWrite(docs.map(d => ({ replaceOne: { filter: { district: d.district, month: d.month, round: d.round }, replacement: d, upsert: true } })));
    console.log("นำเข้าเรียบร้อย");
  }
} catch (e) { console.error("นำเข้าไม่สำเร็จ:", e.message); process.exitCode = 1; }
finally { await client.close(); }

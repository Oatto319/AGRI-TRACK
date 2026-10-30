// สร้างบัญชีผู้ใช้ 22 อำเภอ + 1 จังหวัด โดยไม่ต้องผ่านหน้าเว็บ
//   npm run seed:users                   สร้างใหม่ (ถ้ามีบัญชีในตาราง app_users อยู่แล้วจะไม่ทับ)
//   npm run seed:users -- --force        สร้างใหม่ทั้งหมด (รหัสผ่านทุกบัญชีจะถูกเปลี่ยน)
//   (คำสั่งอ่าน MONGODB_URI และ MONGODB_DB จาก .env.local)
// ผลลัพธ์:
//   คอลเลกชัน app_users บน MongoDB   รหัสผ่านเก็บเป็น hash (scrypt) — ระบบใช้คอลเลกชันนี้
//   data/initial-credentials.csv  ชื่อผู้ใช้ + รหัสผ่านตัวจริง ไว้แจกให้แต่ละอำเภอ (แจกแล้วควรลบทิ้ง)
import { promises as fs } from "fs";
import path from "path";
import { randomBytes, randomInt, scryptSync } from "crypto";
import dns from "node:dns";
import { MongoClient } from "mongodb";

// ชื่ออำเภอต้องตรงกับ DISTRICTS ใน lib/data.ts ทุกตัวอักษร
const DISTRICT_USERS = [
  ["กันทรลักษ์", "kantharalak"], ["กันทรารมย์", "kantararom"], ["ขุขันธ์", "khukhan"],
  ["ขุนหาญ", "khunhan"], ["น้ำเกลี้ยง", "namkliang"], ["โนนคูณ", "nonkhun"],
  ["บึงบูรพ์", "buengbun"], ["เบญจลักษ์", "benchalak"], ["ปรางค์กู่", "prangku"],
  ["พยุห์", "phayuha"], ["โพธิ์ศรีสุวรรณ", "phosrisuwan"], ["ไพรบึง", "phraibueng"],
  ["ภูสิงห์", "phusing"], ["เมืองจันทร์", "mueangchan"], ["เมืองศรีสะเกษ", "mueangsisaket"],
  ["ยางชุมน้อย", "yangchumnoi"], ["ราษีไศล", "rasisalai"], ["วังหิน", "wanghin"],
  ["ศรีรัตนะ", "sirattana"], ["ศิลาลาด", "silalat"], ["ห้วยทับทัน", "huaythapthan"],
  ["อุทุมพรพิสัย", "uthumphonphisai"],
];
const PROVINCE_USER = "province";

const DIR = path.join(process.cwd(), "data");
const CSV = path.join(DIR, "initial-credentials.csv");
if (process.env.MONGODB_DNS_SERVERS) dns.setServers(process.env.MONGODB_DNS_SERVERS.split(",").map(x => x.trim()).filter(Boolean)); // แก้ querySrv ECONNREFUSED
if (!process.env.MONGODB_URI) { console.error("ยังไม่ได้ตั้งค่า MONGODB_URI ใน .env.local"); process.exit(1); }
const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
try { await client.connect(); } catch (e) { console.error("เชื่อมต่อ MongoDB ไม่ได้:", e.message); process.exit(1); }
const col = client.db(process.env.MONGODB_DB || "agri_track").collection("app_users");
await col.createIndex({ username: 1 }, { unique: true });

// ตัดตัวที่สับสนง่าย (0/O, 1/l/I) ออก
const ALPHABET = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const makePassword = (n = 12) => Array.from({ length: n }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
// รูปแบบ hash: scrypt$<salt hex>$<hash hex> — ต้องตรงกับ lib/users.ts
const hash = pw => { const salt = randomBytes(16); return `scrypt$${salt.toString("hex")}$${scryptSync(pw, salt, 64).toString("hex")}`; };

const force = process.argv.includes("--force");
if (!force) {
  const count = await col.countDocuments();
  if (count) { console.error(`พบบัญชีใน app_users อยู่แล้ว ${count} บัญชี — ไม่ทับ (ใช้ --force หากต้องการสร้างใหม่และเปลี่ยนรหัสผ่านทุกบัญชี)`); await client.close(); process.exit(1); }
}

const rows = [
  { username: PROVINCE_USER, role: "province", label: "จังหวัดศรีสะเกษ" },
  ...DISTRICT_USERS.map(([district, username]) => ({ username, role: "district", district, label: `อำเภอ${district}` })),
];
const users = [], lines = ["\uFEFFชื่อผู้ใช้,รหัสผ่าน,หน่วยงาน"];
for (const r of rows) {
  const pw = makePassword();
  users.push({ username: r.username, role: r.role, ...(r.district ? { district: r.district } : {}), hash: hash(pw) });
  lines.push(`${r.username},${pw},${r.label}`);
}
try {
  if (force) { await col.deleteMany({}); await client.db(process.env.MONGODB_DB || "agri_track").collection("sessions").deleteMany({}); } // ล้าง session เดิมด้วย ไม่งั้น token เก่าของชื่อผู้ใช้เดียวกันยังใช้ได้กับบัญชีที่สร้างใหม่
  await col.bulkWrite(users.map(u => ({ replaceOne: { filter: { username: u.username }, replacement: { username: u.username, role: u.role, district: u.district ?? null, hash: u.hash, active: true, mustChange: true, createdAt: new Date().toISOString() }, upsert: true } })));
} catch (e) { console.error("บันทึกบัญชีลง MongoDB ไม่ได้:", e.message); await client.close(); process.exit(1); }
await fs.mkdir(DIR, { recursive: true });
await fs.writeFile(CSV, lines.join("\r\n") + "\r\n", { mode: 0o600 });
console.log(`สร้างบัญชีแล้ว ${users.length} บัญชี (อำเภอ ${DISTRICT_USERS.length} + จังหวัด 1) ในตาราง app_users\n  ${CSV}  <- แจกรหัสผ่านจากไฟล์นี้ แล้วลบทิ้ง`);
await client.close();

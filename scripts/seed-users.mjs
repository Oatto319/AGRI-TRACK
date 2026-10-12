// สร้างบัญชีผู้ใช้ 22 อำเภอ + 1 จังหวัด โดยไม่ต้องผ่านหน้าเว็บ
//   node scripts/seed-users.mjs          สร้างใหม่ (ถ้ามี data/users.json อยู่แล้วจะไม่ทับ)
//   node scripts/seed-users.mjs --force  สร้างใหม่ทั้งหมด (รหัสผ่านทุกบัญชีจะถูกเปลี่ยน)
// ผลลัพธ์:
//   data/users.json               รหัสผ่านเก็บเป็น hash (scrypt) — ระบบใช้ไฟล์นี้
//   data/initial-credentials.csv  ชื่อผู้ใช้ + รหัสผ่านตัวจริง ไว้แจกให้แต่ละอำเภอ (แจกแล้วควรลบทิ้ง)
import { promises as fs } from "fs";
import path from "path";
import { randomBytes, randomInt, scryptSync } from "crypto";

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
const USERS = path.join(DIR, "users.json"), CSV = path.join(DIR, "initial-credentials.csv");

// ตัดตัวที่สับสนง่าย (0/O, 1/l/I) ออก
const ALPHABET = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const makePassword = (n = 12) => Array.from({ length: n }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
// รูปแบบ hash: scrypt$<salt hex>$<hash hex> — ต้องตรงกับ lib/users.ts
const hash = pw => { const salt = randomBytes(16); return `scrypt$${salt.toString("hex")}$${scryptSync(pw, salt, 64).toString("hex")}`; };

const force = process.argv.includes("--force");
if (!force) {
  try { await fs.access(USERS); console.error("พบ data/users.json อยู่แล้ว — ไม่ทับ (ใช้ --force หากต้องการสร้างใหม่และเปลี่ยนรหัสผ่านทุกบัญชี)"); process.exit(1); } catch {}
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
await fs.mkdir(DIR, { recursive: true });
await fs.writeFile(USERS, JSON.stringify(users, null, 1));
await fs.writeFile(CSV, lines.join("\r\n") + "\r\n", { mode: 0o600 });
console.log(`สร้างบัญชีแล้ว ${users.length} บัญชี (อำเภอ ${DISTRICT_USERS.length} + จังหวัด 1)\n  ${USERS}\n  ${CSV}  <- แจกรหัสผ่านจากไฟล์นี้ แล้วลบทิ้ง`);

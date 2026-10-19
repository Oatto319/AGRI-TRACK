// ย้ายข้อมูลเดิมจากไฟล์ JSON ในโฟลเดอร์ data/ ขึ้น MongoDB (รันซ้ำได้ — ใช้ upsert ไม่สร้างซ้ำ)
//   1) ใส่ MONGODB_URI (และ MONGODB_DB ถ้าต้องการ) ใน .env.local
//   2) npm run migrate:json
// ไฟล์ที่ย้าย (ถ้ามี): data/reports.json, data/area-reports.json, data/settings.json, data/users.json
import { promises as fs } from "fs";
import path from "path";
import dns from "node:dns";
import { MongoClient } from "mongodb";

if (process.env.MONGODB_DNS_SERVERS) dns.setServers(process.env.MONGODB_DNS_SERVERS.split(",").map(x => x.trim()).filter(Boolean)); // แก้ querySrv ECONNREFUSED
if (!process.env.MONGODB_URI) { console.error("ยังไม่ได้ตั้งค่า MONGODB_URI ใน .env.local"); process.exit(1); }
const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
try { await client.connect(); } catch (e) { console.error("เชื่อมต่อ MongoDB ไม่ได้:", e.message); process.exit(1); }
const mdb = client.db(process.env.MONGODB_DB || "agri_track");
const DIR = path.join(process.cwd(), "data");

async function readJson(name) {
  try { return JSON.parse(await fs.readFile(path.join(DIR, name), "utf8")); }
  catch (e) { if (e && e.code === "ENOENT") return null; throw e; }
}
async function upsertAll(collection, docs, keyOf) {
  const col = mdb.collection(collection);
  for (let i = 0; i < docs.length; i += 500) {
    await col.bulkWrite(docs.slice(i, i + 500).map(d => ({ replaceOne: { filter: keyOf(d), replacement: d, upsert: true } })));
  }
}
const toRow = r => ({
  district: r.district, month: r.month, round: r.round ?? 1, status: r.status, reporter: r.reporter, amounts: r.values ?? {}, updated_at: r.updatedAt,
  submitted_at: r.submittedAt ?? null, due_date: r.dueDate ?? null, late: r.late ?? null,
});
const reportKey = d => ({ district: d.district, month: d.month, round: d.round });

try {
  await mdb.collection("reports").createIndex({ district: 1, month: 1, round: 1 }, { unique: true });
  await mdb.collection("area_reports").createIndex({ district: 1, month: 1, round: 1 }, { unique: true });
  await mdb.collection("burn_reports").createIndex({ district: 1, month: 1, round: 1 }, { unique: true });
  await mdb.collection("app_users").createIndex({ username: 1 }, { unique: true });

  for (const [file, collection] of [["reports.json", "reports"], ["area-reports.json", "area_reports"], ["burn-reports.json", "burn_reports"]]) {
    const list = await readJson(file);
    if (!list) { console.log(`ข้าม ${file} (ไม่พบไฟล์)`); continue; }
    await upsertAll(collection, list.map(toRow), reportKey);
    console.log(`ย้าย ${file} -> ${collection}: ${list.length} รายการ`);
  }
  const settings = await readJson("settings.json");
  if (settings) {
    await mdb.collection("settings").replaceOne({ _id: "main" }, { data: settings, updated_at: new Date().toISOString() }, { upsert: true });
    console.log("ย้าย settings.json -> settings: เรียบร้อย");
  } else console.log("ข้าม settings.json (ไม่พบไฟล์)");
  const users = await readJson("users.json");
  if (users) {
    await upsertAll("app_users", users.map(u => ({ username: u.username, role: u.role, district: u.district ?? null, hash: u.hash })), d => ({ username: d.username }));
    console.log(`ย้าย users.json -> app_users: ${users.length} บัญชี (รหัสผ่านเดิมยังใช้ได้)`);
  } else console.log("ข้าม users.json (ไม่พบไฟล์) — สร้างบัญชีใหม่ด้วย npm run seed:users");
  console.log("เสร็จสิ้น");
} catch (e) {
  console.error("ย้ายข้อมูลไม่สำเร็จ:", e.message);
  process.exitCode = 1;
} finally {
  await client.close();
}

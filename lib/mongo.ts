import dns from "node:dns";
import { MongoClient, type Db } from "mongodb";

// ใช้ฝั่งเซิร์ฟเวอร์เท่านั้น (API routes) — ห้าม import จาก Client Component
// ตั้งค่าใน .env.local:
//   MONGODB_URI  เช่น mongodb://127.0.0.1:27017  หรือ mongodb+srv://user:pass@cluster.mongodb.net  (Atlas)
//   MONGODB_DB   ชื่อฐานข้อมูล (ไม่ใส่ = agri_track)
//   MONGODB_DNS_SERVERS  (ไม่บังคับ) เช่น 8.8.8.8,1.1.1.1 — ใช้เมื่อ mongodb+srv ขึ้น querySrv ECONNREFUSED (DNS ของเครือข่ายไม่รองรับ SRV)
interface Cache { client?: Promise<MongoClient>; ready?: Promise<void> }
// เก็บไว้ใน globalThis เพื่อไม่ให้สร้าง connection ใหม่ทุกครั้งที่ dev server โหลดโค้ดใหม่
const g = globalThis as typeof globalThis & { __agriMongo?: Cache };
const cache: Cache = (g.__agriMongo ??= {});

async function resolveAtlasUri(uri: string): Promise<string> {
  if (!uri.startsWith("mongodb+srv://")) return uri;

  const parsed = new URL(uri);
  const resolver = new dns.Resolver();
  const dnsServers = process.env.MONGODB_DNS_SERVERS?.split(",").map(x => x.trim()).filter(Boolean);
  resolver.setServers(dnsServers?.length ? dnsServers : ["8.8.8.8"]);
  const [records, txtRecords] = await Promise.all([
    new Promise<dns.SrvRecord[]>((resolve, reject) => {
      resolver.resolveSrv(`_mongodb._tcp.${parsed.hostname}`, (error, result) => error ? reject(error) : resolve(result));
    }),
    new Promise<string[][]>((resolve, reject) => {
      resolver.resolveTxt(parsed.hostname, (error, result) => error ? reject(error) : resolve(result));
    }),
  ]);
  if (records.length === 0) throw new Error("MongoDB Atlas returned no SRV records");

  const domainSuffix = parsed.hostname.split(".").slice(1).join(".");
  if (!domainSuffix) throw new Error("MongoDB Atlas URI has an invalid hostname");
  const hosts = records.map(({ name, port }) => {
    const hostname = name.replace(/\.$/, "");
    if (!hostname.endsWith(`.${domainSuffix}`)) throw new Error("MongoDB Atlas returned an invalid SRV hostname");
    return `${hostname}:${port}`;
  });
  const options = new URLSearchParams(parsed.searchParams);
  const txtOptions = new URLSearchParams(txtRecords.flat().join(""));
  for (const key of ["authSource", "replicaSet", "loadBalanced"]) {
    if (!options.has(key) && txtOptions.has(key)) options.set(key, txtOptions.get(key)!);
  }
  if (!options.has("tls") && !options.has("ssl")) options.set("tls", "true");

  const authority = uri.slice(uri.indexOf("//") + 2).split(/[/?#]/, 1)[0];
  const at = authority.lastIndexOf("@");
  const userInfo = at < 0 ? "" : authority.slice(0, at + 1);
  const query = options.toString();
  return `mongodb://${userInfo}${hosts.join(",")}${parsed.pathname}${query ? `?${query}` : ""}`;
}

export async function db(): Promise<Db> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("ยังไม่ได้ตั้งค่า MONGODB_URI (ดู .env.example)");
  if (!cache.client) {
    cache.client = resolveAtlasUri(uri).then(resolvedUri =>
      new MongoClient(resolvedUri, { serverSelectionTimeoutMS: 8000 }).connect()
    );
    cache.client.catch(() => { cache.client = undefined; cache.ready = undefined; }); // เชื่อมไม่สำเร็จ -> ลองใหม่ได้ครั้งหน้า
  }
  const database = (await cache.client).db(process.env.MONGODB_DB || "agri_track");
  // สร้าง unique index ครั้งแรกครั้งเดียว (ซ้ำได้ ไม่เป็นไร) — ใช้เป็นคีย์ อำเภอ+เดือน+รอบ และชื่อผู้ใช้
  cache.ready ??= Promise.all([
    database.collection("reports").createIndex({ district: 1, month: 1, round: 1 }, { unique: true }),
    database.collection("area_reports").createIndex({ district: 1, month: 1, round: 1 }, { unique: true }),
    database.collection("burn_reports").createIndex({ district: 1, month: 1, round: 1 }, { unique: true }),
    database.collection("app_users").createIndex({ username: 1 }, { unique: true }),
    database.collection("sessions").createIndex({ exp: 1 }, { expireAfterSeconds: 0 }), // session หมดอายุแล้วลบเอง
    database.collection("login_attempts").createIndex({ expireAt: 1 }, { expireAfterSeconds: 0 }),
  ]).then(() => undefined);
  try { await cache.ready; } catch (e) { cache.ready = undefined; throw e; }
  return database;
}

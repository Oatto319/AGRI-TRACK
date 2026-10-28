"use client";
import { createContext, startTransition, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Shell from "./Shell";
import PdfButton from "./PdfButton";
import { DEFAULT_SETTINGS, cfgOf, cfgOfMonth, currentMonth, fiscalYearOptions, dueDaysFor, fiscalRange, fiscalYearOf, isFiscalRange, thaiMonth, type AreaReport, type BurnReport, type Report, type Settings } from "@/lib/data";
import { aggregate } from "@/lib/summary";

interface Ctx { settings: Settings; setSettings: (s: Settings) => void; reports: Report[] | null; area: AreaReport[] | null; burn: BurnReport[] | null; error: string | null; from: string; to: string; setFrom: (v: string) => void; setTo: (v: string) => void; valid: boolean; agg: ReturnType<typeof aggregate> | null }
const C = createContext<Ctx | null>(null);
const load = async <T,>(url: string) => { const r = await fetch(url); if (!r.ok) throw new Error("โหลดไม่สำเร็จ"); return (await r.json()) as T; };
export const useProvince = () => { const v = useContext(C); if (!v) throw new Error("ProvinceFrame missing"); return v; };

// layout คงที่ระหว่างเปลี่ยนหน้า จึงใช้ช่วงเดือนที่เลือกร่วมกันทั้ง 2 หน้า
export function ProvinceFrame({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  // ต้องเป็นบัญชีจังหวัดตาม session ฝั่งเซิร์ฟเวอร์ ไม่เช่นนั้นกลับหน้าเข้าสู่ระบบ
  useEffect(() => {
    fetch("/api/me").then(r => (r.ok ? r.json() : null)).then((me: { role?: string } | null) => {
      if (me?.role === "province") startTransition(() => setAuthed(true));
      else router.replace(me?.role === "district" ? "/district" : "/");
    }).catch(() => router.replace("/"));
  }, [router]);
  const [reports, setReports] = useState<Report[] | null>(null);
  const [area, setArea] = useState<AreaReport[] | null>(null);
  const [burn, setBurn] = useState<BurnReport[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  useEffect(() => {
    Promise.all([load<Report[]>("/api/reports"), load<Settings>("/api/settings"), load<AreaReport[]>("/api/area"), load<BurnReport[]>("/api/burn")]).then(([all, st, ar, bn]) => {
      setSettings(st); setArea(ar); setBurn(bn);
      setReports(all);  
      const ms = all.filter(r => r.status === "submitted").map(r => r.month).sort(), cur = currentMonth();
      // ค่าเริ่มต้น = ปีงบประมาณของเดือนล่าสุดที่มีรายงานส่งแล้ว (ถ้ายังไม่มีข้อมูล ใช้ปีงบประมาณปัจจุบัน)
      const fr = fiscalRange(fiscalYearOf(ms[ms.length - 1] ?? cur));
      setFrom(fr.from); setTo(fr.to);
    }).catch(() => setError("ไม่สามารถโหลดรายงานได้ กรุณาลองใหม่อีกครั้ง"));
  }, []);
  const valid = !!from && !!to && from <= to;
  const agg = useMemo(() => (reports && valid ? aggregate(reports, from, to, dueDaysFor(settings, "fert", to).length, cfgOfMonth(settings, to)) : null), [reports, from, to, valid, settings]);
  return (
    <div style={{ display: authed ? "contents" : "none" }}>{/* ยังไม่ยืนยันสิทธิ์ = ซ่อนไว้ (แต่ยังเรนเดอร์หน้าลูกตามปกติ เพื่อให้ Next.js ตรวจ instant navigation ได้) */}
    <C.Provider value={{ settings, setSettings, reports, area, burn, error, from, to, setFrom, setTo, valid, agg }}>
      <Shell org="สำนักงานเกษตรจังหวัดศรีสะเกษ" role="เจ้าหน้าที่จังหวัด" links={[
        { href: "/province", label: "1. ภาพรวม (Dashboard)", hint: "กราฟและตัวเลขสำคัญ", icon: "home" },
        { href: "/province/table", label: "2. ตารางข้อมูลรายอำเภอ", hint: "ดูรายละเอียด + ดาวน์โหลด Excel", icon: "table" },
        { href: "/province/settings", label: "3. ตั้งค่า", hint: "รอบ กำหนดส่ง พื้นที่ปลูก ปีงบประมาณ ช่องข้อมูล หัวตาราง", icon: "gear" }]}>
        {children}
      </Shell>
    </C.Provider>
    </div>
  );
}

// ตัวเลือกปีงบประมาณ (ต.ค. – ก.ย.) — ใช้ร่วมกันทั้งแดชบอร์ดและหน้าตาราง
export function FiscalSelect() {
  const { from, to, setFrom, setTo, valid, reports, area, settings } = useProvince();
  // ห้ามเรียก currentMonth() ตอน render (Next.js prerender ไม่ยอมให้อ่านเวลาปัจจุบันใน Client Component) — อ่านหลัง mount
  const [cur, setCur] = useState("");
  useEffect(() => { startTransition(() => setCur(currentMonth())); }, []);
  const curFy = cur ? fiscalYearOf(cur) : 0;
  const fy = to ? fiscalYearOf(to) : curFy;
  const custom = !!from && !!to && !isFiscalRange(from, to); // ช่วงเดือนที่ตั้งไว้ ไม่ตรงปีงบประมาณ
  const years = useMemo(() => {
    const ms = [...(reports ?? []).map(r => r.month), ...(area ?? []).map(r => r.month)];
    const all = [...(curFy ? [curFy - 2, curFy + 1] : []), ...(fy ? [fy] : []), ...ms.map(fiscalYearOf)];
    if (!all.length) return [];
    const lo = Math.min(...all), hi = Math.max(...all);
    const span = Array.from({ length: hi - lo + 1 }, (_, i) => hi - i);
    return fiscalYearOptions(cfgOf(settings), span); // รวมปีงบประมาณที่จังหวัดเพิ่มเองในหน้า "ตั้งค่า" · ปีล่าสุดอยู่บนสุด
  }, [reports, area, curFy, fy, settings]);
  const choose = (v: number) => { const r = fiscalRange(v); setFrom(r.from); setTo(r.to); };
  return (
    <div className="field">
      <label htmlFor="fy">ปีงบประมาณ</label>
      <div className="fy-sel">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M8 3v4M16 3v4M3 10h18" /></svg>
        <select id="fy" value={custom ? "custom" : fy || ""} disabled={!fy} onChange={e => e.target.value !== "custom" && choose(Number(e.target.value))}>
          {custom && <option value="custom">กำหนดเอง ({thaiMonth(from)} – {thaiMonth(to)})</option>}
          {years.map(y => <option key={y} value={y}>ปีงบประมาณ {y}{y === curFy ? " (ปัจจุบัน)" : ""}</option>)}
        </select>
      </div>
      {valid && !custom && <small className="fy-note">{thaiMonth(from)} – {thaiMonth(to)}</small>}
    </div>);
}

// ตัวกรองแดชบอร์ด: เลือกเป็น "ปีงบประมาณ" (ต.ค. – ก.ย.) แทนการเลือกช่วงเดือน
export function FilterBar({ download, pdf }: { download?: boolean; pdf?: boolean }) {
  const { from, to, valid } = useProvince();
  return (
    <div className="db-filter">
      <FiscalSelect />
      {download && valid && <a className="btn go" href={`/api/export?from=${from}&to=${to}`} download>📥 ดาวน์โหลด Excel</a>}
      {pdf && valid && <PdfButton fy={fiscalYearOf(to)} className="btn go" />}
    </div>);
}

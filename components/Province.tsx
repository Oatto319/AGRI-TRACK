"use client";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import Shell from "./Shell";
import MonthPicker from "@/components/MonthPicker";
import { DEFAULT_SETTINGS, currentMonth, type AreaReport, type Report, type Settings } from "@/lib/data";
import { aggregate } from "@/lib/summary";

interface Ctx { settings: Settings; setSettings: (s: Settings) => void; reports: Report[] | null; area: AreaReport[] | null; error: string | null; from: string; to: string; setFrom: (v: string) => void; setTo: (v: string) => void; valid: boolean; agg: ReturnType<typeof aggregate> | null }
const C = createContext<Ctx | null>(null);
const load = async <T,>(url: string) => { const r = await fetch(url); if (!r.ok) throw new Error("โหลดไม่สำเร็จ"); return (await r.json()) as T; };
export const useProvince = () => { const v = useContext(C); if (!v) throw new Error("ProvinceFrame missing"); return v; };

// layout คงที่ระหว่างเปลี่ยนหน้า จึงใช้ช่วงเดือนที่เลือกร่วมกันทั้ง 2 หน้า
export function ProvinceFrame({ children }: { children: ReactNode }) {
  const [reports, setReports] = useState<Report[] | null>(null);
  const [area, setArea] = useState<AreaReport[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  useEffect(() => {
    Promise.all([load<Report[]>("/api/reports"), load<Settings>("/api/settings"), load<AreaReport[]>("/api/area")]).then(([all, st, ar]) => {
      setSettings(st); setArea(ar);
      setReports(all);
      const ms = all.filter(r => r.status === "submitted").map(r => r.month).sort(), cur = currentMonth();
      setFrom(ms[0] ?? cur); setTo(ms[ms.length - 1] ?? cur);
    }).catch(() => setError("ไม่สามารถโหลดรายงานได้ กรุณาลองใหม่อีกครั้ง"));
  }, []);
  const valid = !!from && !!to && from <= to;
  const agg = useMemo(() => (reports && valid ? aggregate(reports, from, to, settings.dueDays.length) : null), [reports, from, to, valid, settings]);
  return (
    <C.Provider value={{ settings, setSettings, reports, area, error, from, to, setFrom, setTo, valid, agg }}>
      <Shell org="สำนักงานเกษตรจังหวัดศรีสะเกษ" role="เจ้าหน้าที่จังหวัด" links={[
        { href: "/province", label: "1. ภาพรวม (Dashboard)", hint: "กราฟและตัวเลขสำคัญ", icon: "home" },
        { href: "/province/table", label: "2. ตารางข้อมูลรายอำเภอ", hint: "ดูรายละเอียด + ดาวน์โหลด Excel", icon: "table" },
        { href: "/province/settings", label: "3. ตั้งค่าการรายงาน", hint: "รอบ วันกำหนดส่ง พื้นที่ปลูก", icon: "gear" }]}>
        {children}
      </Shell>
    </C.Provider>
  );
}

export function FilterBar({ download }: { download?: boolean }) {
  const { from, to, setFrom, setTo, valid } = useProvince();
  return (
    <div className="db-filter">
      <div className="field"><label htmlFor="f">เริ่มต้นเดือน</label><MonthPicker id="f" value={from} onChange={setFrom} /></div>
      <div className="field"><label htmlFor="t">ถึงเดือน</label><MonthPicker id="t" value={to} onChange={setTo} /></div>
      {download && valid && <a className="btn go" href={`/api/export?from=${from}&to=${to}`} download>📥 ดาวน์โหลด Excel</a>}
    </div>);
}

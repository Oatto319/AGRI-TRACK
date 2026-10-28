"use client";
import { useState } from "react";

// การ์ดเดียวสรุปความคืบหน้าเทียบเป้าหมายรายอำเภอ (สลับ ปุ๋ย / ไถกลบ ได้) — ให้เห็นว่าต้องตามอำเภอไหนก่อน โดยไม่รกหน้าจอ
// ระดับ: ถึงเป้า (≥100%) · ใกล้ถึงเป้า (80–99%) · ต่ำกว่าเป้า (50–79%) · ต้องตาม (<50%) · ยังไม่ตั้งเป้า
export interface ProgressRow { name: string; value: number; target: number; hasTarget: boolean }
export interface ProgressSet { key: string; label: string; unit: string; note: string; rows: ProgressRow[] }
type Level = "urgent" | "low" | "near" | "done" | "unset";
const LV: Record<Level, { label: string; color: string }> = {
  urgent: { label: "ต้องตาม (<50%)", color: "#b04a4a" },
  low: { label: "ต่ำกว่าเป้า (50–79%)", color: "#c9a13e" },
  near: { label: "ใกล้ถึงเป้า (80–99%)", color: "#7aa648" },
  done: { label: "ถึงเป้าแล้ว", color: "#266f42" },
  unset: { label: "ยังไม่ตั้งเป้า", color: "#b3bbb0" },
};
const ORDER: Level[] = ["urgent", "low", "near", "done", "unset"];
const levelOf = (r: ProgressRow): Level => {
  if (!r.hasTarget || r.target <= 0) return "unset";
  const p = (r.value / r.target) * 100;
  return p >= 100 ? "done" : p >= 80 ? "near" : p >= 50 ? "low" : "urgent";
};
const nf = (v: number, d = 0) => v.toLocaleString("th-TH", { maximumFractionDigits: d });
const SHOW = 6; // แสดงเฉพาะอำเภอที่ต้องตามก่อน กี่แถวแรก

export default function ProgressCards({ sets }: { sets: ProgressSet[] }) {
  const [key, setKey] = useState(sets[0]?.key ?? "");
  const [pick, setPick] = useState<Level | null>(null);
  const [all, setAll] = useState(false);
  const [copied, setCopied] = useState(false);
  const set = sets.find(s => s.key === key) ?? sets[0];
  if (!set) return null;

  const items = set.rows.map(r => ({ ...r, lv: levelOf(r), pct: r.target > 0 ? (r.value / r.target) * 100 : 0 }));
  const count = (l: Level) => items.filter(i => i.lv === l).length;
  const hasAny = items.some(i => i.value > 0);
  const follow = items.filter(i => i.lv === "urgent" || i.lv === "low").sort((a, b) => a.pct - b.pct);
  const filtered = items.filter(i => !pick || i.lv === pick).sort((a, b) => ORDER.indexOf(a.lv) - ORDER.indexOf(b.lv) || a.pct - b.pct);
  const shown = all || pick ? filtered : filtered.slice(0, SHOW);

  async function copyFollow() {
    const t = `อำเภอที่ต้องเร่งติดตาม — ${set.label}\n` + follow.map((i, n) => `${n + 1}. ${i.name} ${nf(i.pct)}% (ขาดอีก ${nf(Math.max(0, i.target - i.value))} ${set.unit})`).join("\n");
    try { await navigator.clipboard.writeText(t); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { setCopied(false); }
  }

  return (
    <section className="pv-card pg" aria-label="ความคืบหน้าเทียบเป้ารายอำเภอ">
      <div className="pg-top">
        <h2>ความคืบหน้าเทียบเป้ารายอำเภอ</h2>
        {sets.length > 1 && (
          <div className="pg-tabs" role="group" aria-label="เลือกหัวข้อ">
            {sets.map(s => <button key={s.key} type="button" aria-pressed={s.key === set.key} onClick={() => { setKey(s.key); setPick(null); setAll(false); }}>{s.label}</button>)}
          </div>)}
      </div>
      <p className="pv-note">{set.note}</p>

      {!hasAny ? <p className="pv-empty">ยังไม่มีรายงานที่ส่งในช่วงนี้ — เมื่ออำเภอส่งรายงาน ความคืบหน้าจะแสดงที่นี่</p> : (
        <>
          <div className="pg-bar" role="img" aria-label="สัดส่วนอำเภอตามระดับความคืบหน้า">
            {ORDER.filter(l => count(l) > 0).map(l => <i key={l} style={{ flex: count(l), background: LV[l].color }} title={`${LV[l].label}: ${count(l)} อำเภอ`} />)}
          </div>
          <div className="pg-legend">
            {ORDER.filter(l => count(l) > 0).map(l => (
              <button key={l} type="button" aria-pressed={pick === l} onClick={() => { setPick(pick === l ? null : l); setAll(false); }}>
                <i style={{ background: LV[l].color }} />{LV[l].label} <b>{count(l)}</b>
              </button>))}
          </div>

          <ul className="pg-rows">{shown.map(i => (
            <li key={i.name}>
              <span className="nm">{i.name}</span>
              <span className="tk" role="img" aria-label={`${i.name} ${nf(i.pct)} เปอร์เซ็นต์`}><i style={{ width: `${Math.min(100, i.pct)}%`, background: LV[i.lv].color }} /></span>
              <span className="pc">{i.lv === "unset" ? "–" : `${nf(i.pct)}%`}</span>
              <small>{i.lv === "unset" ? "ยังไม่ตั้งเป้า" : i.lv === "done" ? `+${nf(i.value - i.target)}` : `ขาด ${nf(i.target - i.value)}`}</small>
            </li>))}
          </ul>

          <div className="pg-foot">
            {!pick && filtered.length > SHOW && <button type="button" onClick={() => setAll(!all)}>{all ? "แสดงเฉพาะที่ต้องตามก่อน" : `ดูทั้งหมด ${filtered.length} อำเภอ`}</button>}
            {follow.length > 0 && <button type="button" onClick={copyFollow}>{copied ? "คัดลอกแล้ว ✓" : `คัดลอกรายชื่อที่ต้องตาม (${follow.length})`}</button>}
            <span>หน่วย: {set.unit}</span>
          </div>
        </>)}
    </section>);
}

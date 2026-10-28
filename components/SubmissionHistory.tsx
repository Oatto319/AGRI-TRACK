"use client";

import { memo, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  bkkDate, cfgOfMonth, dueDaysFor, isAreaMonth, topicOff, thaiDate, thaiDateTime, thaiMonth, thaiMonthShort, topicLabelOf,
  type AreaReport, type BurnReport, type Report, type Settings, type Topic,
} from "@/lib/data";
import { monthsBetween, submissionByMonth, type RoundCell, type SubState } from "@/lib/summary";

// เดือนที่หัวข้อนี้ไม่ต้องรายงาน (ไถกลบ = นอกฤดูกาล · หัวข้ออื่น = นอกช่วงที่จังหวัดกำหนดแยกไว้)
const notDue = (t: Topic, m: string) => (t === "area" ? !isAreaMonth(m) : topicOff(t, m));

// หน้าต่างประวัติการส่งรายงานรายเดือน · ใช้คลาสและสีธีมเดียวกับทั้งระบบ (ux-pill / ux-seg / ux-btn / ตัวแปร --brand --ok --warn --bad)
const STATE: Record<SubState, { label: string; pill: string }> = {
  ontime: { label: "ตรงเวลา", pill: "ok" },
  late: { label: "ส่งช้า", pill: "warn" },
  missing: { label: "ยังไม่ส่ง", pill: "bad" },
  waiting: { label: "ยังไม่ถึงกำหนด", pill: "mute" },
};
const ORDER: SubState[] = ["ontime", "late", "missing", "waiting"];
type Filter = "all" | SubState;
type AnyReport = Report | AreaReport | BurnReport;

// แถวของตาราง แยกเป็นคอมโพเนนต์ memo — พิมพ์ค้นหา/สลับตัวกรองแล้วแถวที่ข้อมูลเดิมไม่ต้องเรนเดอร์ใหม่
const Row = memo(function Row({ name, cells, state }: { name: string; cells: RoundCell[]; state: SubState }) {
  return (
    <tr>
      <td className="sticky">{name}</td>
      {cells.map(c => (
        <td key={c.round}>
          <span className={`ux-pill ${STATE[c.state].pill}`}>{STATE[c.state].label}</span>
          <small className="sh-d">
            {c.submittedAt ? `ส่ง ${thaiDateTime(c.submittedAt)}` : c.state === "missing" ? `เลยกำหนด ${thaiDate(c.due)}` : `กำหนดส่ง ${thaiDate(c.due)}`}
            {c.draft ? " · มีฉบับร่าง" : ""}
          </small>
        </td>
      ))}
      <td><span className={`ux-pill ${STATE[state].pill}`}>{STATE[state].label}</span></td>
    </tr>
  );
});

export default function SubmissionHistory({ reports, area, burn, settings, from, to, initialTopic, onClose }: {
  reports: Report[]; area: AreaReport[]; burn: BurnReport[]; settings: Settings; from: string; to: string; initialTopic: Topic; onClose: () => void;
}) {
  const [today] = useState(() => bkkDate());
  const months = useMemo(() => monthsBetween(from, to), [from, to]);
  const [topic, setTopic] = useState<Topic>(initialTopic);
  const [month, setMonth] = useState(() => { const cur = today.slice(0, 7); return months.includes(cur) ? cur : cur < from ? from : to; });
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search); // ช่องพิมพ์ตอบสนองทันที ส่วนตารางค่อยกรองตามหลัง
  const [copied, setCopied] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });

  // ผูกครั้งเดียวตอนเปิด: ไม่ผูกซ้ำทุกครั้งที่ parent เรนเดอร์ (เดิมทำให้ focus เด้งกลับไปปุ่มปิดระหว่างพิมพ์ค้นหา)
  useEffect(() => {
    closeRef.current?.focus();
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onCloseRef.current(); };
    document.addEventListener("keydown", key);
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", key); document.body.style.overflow = prev; };
  }, []);

  // จัดกลุ่มรายงานตามเดือนครั้งเดียวต่อหัวข้อ — การคำนวณรายเดือน/ปุ่มเดือนทั้งหมดอ่านจากกลุ่มนี้ ไม่ต้องไล่รายงานทั้งหมดซ้ำ
  const byMonth = useMemo(() => {
    const src: AnyReport[] = topic === "fert" ? reports : topic === "area" ? area : burn;
    const m = new Map<string, AnyReport[]>();
    for (const r of src) { const l = m.get(r.month); if (l) l.push(r); else m.set(r.month, [r]); }
    return m;
  }, [topic, reports, area, burn]);

  const cfg = useMemo(() => cfgOfMonth(settings, month), [settings, month]);
  const applicable = !notDue(topic, month);
  const sum = useMemo(() => submissionByMonth(byMonth.get(month) ?? [], month, dueDaysFor(settings, topic, month), today), [byMonth, month, topic, settings, today]);
  const chips = useMemo(() => months.map(m => (notDue(topic, m) ? { m, c: null } : { m, c: submissionByMonth(byMonth.get(m) ?? [], m, dueDaysFor(settings, topic, m), today).counts })), [months, topic, byMonth, settings, today]);

  const rows = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    return sum.rows.filter(r => (filter === "all" || r.state === filter) && (!q || r.name.toLowerCase().includes(q)));
  }, [sum.rows, filter, deferredSearch]);

  const idx = months.indexOf(month);
  const pending = useMemo(() => sum.rows.filter(r => r.state === "missing").map(r => r.name), [sum.rows]);

  async function copyPending() {
    try {
      await navigator.clipboard.writeText(`อำเภอที่ยังไม่ส่ง${topicLabelOf(cfg, topic)} ${thaiMonth(month)} (เลยกำหนด):\n${pending.map((n, i) => `${i + 1}. ${n}`).join("\n")}`);
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    } catch { setCopied(false); }
  }
  const chipPill = (c: (typeof chips)[number]["c"]) =>
    !c ? { cls: "mute", t: "ไม่ต้องส่ง" } : c.missing ? { cls: "bad", t: `ขาด ${c.missing}` } : c.late ? { cls: "warn", t: `ช้า ${c.late}` }
      : c.waiting && !c.ontime ? { cls: "mute", t: "รอกำหนด" } : { cls: "ok", t: "ครบถ้วน" };

  return (
    <div className="sh-back" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sh-dlg" role="dialog" aria-modal="true" aria-labelledby="sh-t">
        <header className="sh-head">
          <div>
            <h2 id="sh-t">ประวัติการส่งรายงานรายเดือน</h2>
            <p>ติดตามสถานะการส่งรายงานของแต่ละอำเภอ แยกตามเดือนและรอบ</p>
          </div>
          <button ref={closeRef} type="button" className="ux-btn line sm" onClick={onClose} aria-label="ปิดหน้าต่าง">✕ ปิด</button>
        </header>

        <div className="sh-body">
          <div className="ux-seg" role="group" aria-label="เลือกหัวข้อรายงาน" style={{ marginBottom: ".8rem" }}>
            {(["fert", "area", "burn"] as const).map(t => (
              <button key={t} type="button" aria-pressed={topic === t} onClick={() => { setTopic(t); setFilter("all"); }}>{topicLabelOf(cfg, t)}</button>))}
          </div>

          <span className="sh-lbl" id="sh-ml">เลือกเดือนที่ต้องการดู</span>
          <div className="sh-months" role="group" aria-labelledby="sh-ml">
            {chips.map(({ m, c }) => {
              const p = chipPill(c);
              return (
                <button key={m} type="button" className="sh-m" aria-pressed={m === month} onClick={() => { setMonth(m); setFilter("all"); }}>
                  <b>{thaiMonthShort(m)}</b><span className={`ux-pill ${p.cls}`}>{p.t}</span>
                </button>);
            })}
          </div>

          <div className="sh-nav">
            <button type="button" className="ux-btn line sm" disabled={idx <= 0} onClick={() => setMonth(months[idx - 1])}>‹ เดือนก่อนหน้า</button>
            <b>{thaiMonth(month)} · {topicLabelOf(cfg, topic)}</b>
            <button type="button" className="ux-btn line sm" disabled={idx < 0 || idx >= months.length - 1} onClick={() => setMonth(months[idx + 1])}>เดือนถัดไป ›</button>
          </div>

          {!applicable ? <p className="sh-empty">เดือนนี้อยู่นอกช่วงรายงานไถกลบฟางข้าว จึงไม่ต้องส่งรายงาน</p> : <>
            <p className="ux-note" style={{ margin: "0 0 .7rem" }}>ต้องรายงาน <b>{sum.rounds} ครั้ง</b>ในเดือนนี้ · ส่งภายในวันกำหนดนับว่าตรงเวลา · วันนี้ {thaiDate(today)}</p>
            <div className="sh-sum" role="group" aria-label="กรองตามสถานะ">
              <button type="button" aria-pressed={filter === "all"} onClick={() => setFilter("all")}><b>{sum.rows.length}</b><span>ทั้งหมด</span></button>
              {ORDER.map(st => (
                <button key={st} type="button" className={STATE[st].pill} aria-pressed={filter === st} onClick={() => setFilter(filter === st ? "all" : st)}><b>{sum.counts[st]}</b><span>{STATE[st].label}</span></button>))}
            </div>

            {pending.length > 0 && (
              <div className="sh-warn" role="status">
                <span><b>ยังไม่ส่ง (เลยกำหนด) {pending.length} อำเภอ:</b> {pending.join(" · ")}</span>
                <button type="button" className="ux-btn line sm" onClick={copyPending}>{copied ? "คัดลอกแล้ว ✓" : "คัดลอกรายชื่อ"}</button>
              </div>)}

            <div className="sh-tool"><input className="ux-search" type="search" placeholder="ค้นหาชื่ออำเภอ" aria-label="ค้นหาอำเภอ" value={search} onChange={e => setSearch(e.target.value)} /></div>

            <div className="sh-tw">
              <table className="ux-table">
                <thead><tr><th className="sticky">อำเภอ</th>{Array.from({ length: sum.rounds }, (_, i) => <th key={i}>รอบที่ {i + 1}</th>)}<th>สถานะรวม</th></tr></thead>
                <tbody>
                  {rows.map(r => <Row key={r.name} name={r.name} cells={r.cells} state={r.state} />)}
                  {!rows.length && <tr><td colSpan={sum.rounds + 2} className="ux-empty">ไม่พบอำเภอตามเงื่อนไขที่เลือก</td></tr>}
                </tbody>
              </table>
            </div>
          </>}
        </div>
      </div>
    </div>
  );
}

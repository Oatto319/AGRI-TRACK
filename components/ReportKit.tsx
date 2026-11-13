"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { dueDaysFor, isAreaMonth, thaiDate, thaiDateTime, thaiMonth, type Settings } from "@/lib/data";
import { I } from "@/components/Entry";

// ชิ้นส่วนที่ใช้ร่วมกันของฟอร์มรายงานทั้ง 3 หัวข้อ (ปุ๋ย · ไถกลบ · หยุดเผา) เพื่อให้หน้าตาและขั้นตอนเหมือนกัน เรียนรู้ครั้งเดียว

export type TopicKey = "fert" | "area" | "burn";
export const REPORT_TOPICS: { key: TopicKey; label: string; noun: string; api: string }[] = [
  { key: "fert", label: "ปุ๋ยอินทรีย์", noun: "ปุ๋ยอินทรีย์", api: "/api/reports" },
  { key: "area", label: "ไถกลบฟางข้าว", noun: "พื้นที่ไถกลบฟางข้าว", api: "/api/area" },
  { key: "burn", label: "หยุดเผา", noun: "การหยุดเผา", api: "/api/burn" },
];

/** props ที่ฟอร์มแต่ละหัวข้อรับจากหน้ารวม */
export interface FormProps {
  /** สลับไปหัวข้ออื่น (ระบุเดือน/รอบได้ ถ้าไม่ระบุใช้เดือนและรอบที่เลือกอยู่) */
  onSwitch: (topic: TopicKey, month?: string, round?: number) => void;
  /** แจ้งหน้ารวมว่ากำลังกรอกเดือน/รอบไหน เพื่อพาไปหัวข้ออื่นในเดือนเดียวกัน */
  onPeriod: (month: string, round: number) => void;
}

export async function putReport<T>(url: string, body: unknown): Promise<{ ok: true; saved: T } | { ok: false; error: string }> {
  try {
    const res = await fetch(url, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data: unknown = await res.json();
    if (!res.ok) return { ok: false, error: typeof data === "object" && data !== null && "error" in data && typeof data.error === "string" ? data.error : "บันทึกไม่สำเร็จ" };
    return { ok: true, saved: data as T };
  } catch {
    return { ok: false, error: "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่อีกครั้ง" };
  }
}

/** ลายเซ็นของข้อมูลที่กรอก (ตัวเลขเทียบเป็นค่าตัวเลข "1.50" = 1.5) ใช้ดูว่ามีอะไรยังไม่ได้บันทึก */
export const sigOf = (values: (string | number | undefined)[], name: string) =>
  JSON.stringify([values.map(v => (v === undefined || v === "" ? "" : String(Number(v)))), name.trim()]);

export interface AutoState { kind: "idle" | "saving" | "saved" | "error"; at?: string }

/** บันทึกร่างอัตโนมัติ: เมื่อมีข้อมูลที่ยังไม่ได้บันทึก รอ 1.5 วินาทีหลังหยุดพิมพ์แล้วบันทึกเป็นร่าง */
export function useAutosave({ enabled, dirty, sig, save }: { enabled: boolean; dirty: boolean; sig: string; save: () => Promise<boolean> }): AutoState {
  const [st, setSt] = useState<AutoState>({ kind: "idle" });
  const saveRef = useRef(save);
  useEffect(() => { saveRef.current = save; });
  useEffect(() => {
    if (!enabled || !dirty) return;
    const t = setTimeout(async () => {
      setSt({ kind: "saving" });
      const ok = await saveRef.current();
      setSt(ok ? { kind: "saved", at: new Date().toISOString() } : { kind: "error" });
    }, 1500);
    return () => clearTimeout(t);
  }, [enabled, dirty, sig]);
  return st;
}

function AutoNote({ st, dirty }: { st: AutoState; dirty: boolean }) {
  const time = st.at ? new Date(st.at).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" }) : "";
  const text = st.kind === "saving" ? "กำลังบันทึกร่าง…"
    : st.kind === "error" ? "บันทึกร่างอัตโนมัติไม่สำเร็จ · ข้อมูลที่กรอกยังอยู่ในหน้านี้ ลองกด “ส่งรายงาน” เมื่อกรอกครบ"
    : dirty ? "มีการแก้ไข · ระบบจะบันทึกร่างให้อัตโนมัติ"
    : st.kind === "saved" ? `บันทึกร่างอัตโนมัติแล้ว เวลา ${time} น.`
    : "ที่กรอกไว้ระบบบันทึกร่างให้เอง ปิดหน้าแล้วกลับมากรอกต่อได้";
  return <p className={`rk-auto${st.kind === "error" ? " bad" : ""}`} role="status" aria-live="polite">{text}</p>;
}

/** แท็บสลับหัวข้อ — หน้าเดียว 3 หัวข้อ โครงเหมือนกัน */
export function TopicTabs({ topic, onPick }: { topic: TopicKey; onPick: (t: TopicKey) => void }) {
  return (
    <div className="rk-tabs" role="tablist" aria-label="หัวข้อที่จะรายงาน">
      {REPORT_TOPICS.map(t => (
        <button key={t.key} type="button" role="tab" id={`tab-${t.key}`} aria-selected={t.key === topic} className="rk-tab" onClick={() => { if (t.key !== topic) onPick(t.key); }}>{t.label}</button>))}
    </div>);
}

/** แถบ "เดือนที่รายงาน" — ค่าเริ่มต้นเป็นเดือนปัจจุบัน ซ่อนตัวเลือกไว้หลังลิงก์ "เปลี่ยนเดือน" */
export function PeriodBar({ label, note, forceOpen, extra, children }: { label: string; note?: ReactNode; forceOpen?: boolean; extra?: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const show = open || !!forceOpen;
  return (
    <section className="rk-period" aria-label="เดือนที่รายงาน">
      <div className="rk-period-h">
        <span className="rk-cal" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M8 3v4M16 3v4M3 10h18" /></svg></span>
        <div><small>รายงานของ</small><b>{label}</b>{note && <small className="n">{note}</small>}</div>
        {!forceOpen && <button type="button" className="rk-link" aria-expanded={show} onClick={() => setOpen(!open)}>{show ? "ซ่อน" : "เปลี่ยนเดือน"}</button>}
      </div>
      {show && <div className="rk-period-b">{children}</div>}
      {extra}
    </section>);
}

/** กล่องด้านข้าง: เช็กลิสต์ + ปุ๋ม "ส่งรายงาน" ปุ่มเดียว (ร่างบันทึกอัตโนมัติ) */
export function SubmitCard({ checks, ready, busy, disabled, submitted, msg, auto, dirty, onSubmit }: {
  checks: { ok: boolean; t: string }[]; ready: boolean; busy: boolean; disabled?: boolean; submitted: boolean;
  msg: { t: string; bad?: boolean } | null; auto: AutoState; dirty: boolean; onSubmit: () => void;
}) {
  return (
    <div className="ux-card">
      <h2>ก่อนส่งต้องมีครบ</h2>
      <ul className="ux-todo">{checks.map(c => <li key={c.t} className={c.ok ? "ok" : ""}><i>{c.ok ? "✓" : "!"}</i>{c.t}</li>)}</ul>
      {msg && <p className={`ux-toast${msg.bad ? " bad" : ""}`} style={{ marginTop: ".9rem" }} role="alert">{msg.t}</p>}
      <div className="ux-actions" style={{ marginTop: ".9rem" }}>
        <button type="button" className="ux-btn gold" disabled={busy || disabled || !ready} onClick={onSubmit}>{I.send}{submitted ? "ส่งซ้ำ (แก้ไข)" : "ส่งรายงาน"}</button>
      </div>
      {!ready && <p className="ux-hint">ยังกรอกไม่ครบจึงส่งไม่ได้ · ที่กรอกไว้ไม่หาย กลับมากรอกต่อได้</p>}
      {!submitted && <AutoNote st={auto} dirty={dirty} />}
    </div>);
}

type Next = { topic: TopicKey; round: number } | null;

/** หาหัวข้อถัดไปของเดือนนี้ที่ยังไม่ได้ส่ง (เรียงต่อจากหัวข้อที่เพิ่งส่ง ตามด้วยรอบอื่นของหัวข้อเดิม) */
async function findNext(district: string, settings: Settings, topic: TopicKey, month: string): Promise<Next> {
  const i = REPORT_TOPICS.findIndex(t => t.key === topic);
  const order = [1, 2, 0].map(k => REPORT_TOPICS[(i + k) % REPORT_TOPICS.length]);
  const data = await Promise.all(order.map(async t => {
    if (t.key === "area" && !isAreaMonth(month)) return null; // เดือนนี้ไม่ต้องรายงานพื้นที่
    try {
      const r = await fetch(`${t.api}?district=${encodeURIComponent(district)}`);
      return r.ok ? ((await r.json()) as { month: string; round: number; status: string }[]) : null;
    } catch { return null; }
  }));
  for (let k = 0; k < order.length; k++) {
    const recs = data[k];
    if (!recs) continue;
    const n = dueDaysFor(settings, order[k].key, month).length;
    for (let r = 1; r <= n; r++) if (!recs.some(x => x.month === month && x.round === r && x.status === "submitted")) return { topic: order[k].key, round: r };
  }
  return null;
}

/** หน้ายืนยันหลังส่งรายงาน — บอกชัดว่าส่งสำเร็จ และพาไปหัวข้อถัดไปที่ยังไม่ได้ส่ง */
export function SuccessCard({ district, settings, topic, month, round, rounds, saved, onNext, onReview }: {
  district: string; settings: Settings; topic: TopicKey; month: string; round: number; rounds: number;
  saved: { submittedAt?: string; dueDate?: string; late?: boolean };
  onNext: (t: TopicKey, month: string, round: number) => void; onReview: () => void;
}) {
  const [next, setNext] = useState<Next | undefined>(undefined); // undefined = กำลังตรวจ
  useEffect(() => {
    let live = true;
    void findNext(district, settings, topic, month).then(n => { if (live) setNext(n); });
    return () => { live = false; };
  }, [district, settings, topic, month]);
  const noun = REPORT_TOPICS.find(t => t.key === topic)?.noun ?? "";
  const nextLabel = next ? `${REPORT_TOPICS.find(t => t.key === next.topic)?.label ?? ""}${next.round > 1 ? ` (รอบที่ ${next.round})` : ""}` : "";
  return (
    <section className="rk-done" role="status" aria-live="polite">
      <span className={`rk-done-ic${saved.late ? " warn" : ""}`}>{I.check}</span>
      <h2>ส่งรายงาน{noun}เรียบร้อยแล้ว</h2>
      <p>เดือน{thaiMonth(month)}{rounds > 1 ? ` · รอบที่ ${round}` : ""}{saved.submittedAt ? ` · ส่งเมื่อ ${thaiDateTime(saved.submittedAt)}` : ""}</p>
      <p className={`rk-done-st${saved.late ? " late" : ""}`}>{saved.late ? `ส่งช้า (กำหนดส่ง ${saved.dueDate ? thaiDate(saved.dueDate) : "–"})` : "ส่งตรงเวลา"}</p>
      <div className="rk-done-act">
        {next === undefined && <p className="ux-hint">กำลังตรวจหัวข้อที่เหลือของเดือนนี้…</p>}
        {next && <button type="button" className="ux-btn gold" onClick={() => onNext(next.topic, month, next.round)}>ไปกรอกหัวข้อถัดไป: {nextLabel} →</button>}
        {next === null && <>
          <p className="ux-toast">เดือน{thaiMonth(month)}ส่งครบทุกหัวข้อแล้ว ไม่มีงานค้าง</p>
          <Link className="ux-btn gold" href="/district">กลับหน้าหลัก</Link></>}
        <button type="button" className="ux-btn line" onClick={onReview}>ดูหรือแก้ไขรายงานนี้</button>
        {next && <Link className="rk-link" href="/district">กลับหน้าหลัก</Link>}
      </div>
    </section>);
}

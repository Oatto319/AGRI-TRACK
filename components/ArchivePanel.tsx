"use client";
import { useCallback, useEffect, useState } from "react";
import { thaiDateTime } from "@/lib/data";
import { PageHead } from "@/components/Entry";
import { RETENTION_REFRESH } from "@/components/RetentionBanner";
import type { ExportRecord, RetentionStatus } from "@/lib/retention";

type Full = RetentionStatus & { retentionYears: number; warnDays: number; history: ExportRecord[] };
const errOf = (d: unknown, fallback: string) => (typeof d === "object" && d !== null && "error" in d && typeof (d as { error: unknown }).error === "string" ? (d as { error: string }).error : fallback);
const n = (v: number) => v.toLocaleString("th-TH");

// หน้า "สำรองข้อมูล" ของจังหวัด: เก็บข้อมูลย้อนหลัง 5 ปีงบประมาณ · ปีที่หลุดกรอบต้อง export (Excel) ก่อนใช้งานต่อ · ลบข้อมูลเก่าได้เมื่อมีทั้ง Excel และ JSON
export default function ArchivePanel() {
  const [st, setSt] = useState<Full | null>(null);
  const [err, setErr] = useState(""); const [ok, setOk] = useState(""); const [busy, setBusy] = useState(false);
  const [pend, setPend] = useState<number | null>(null); const [typed, setTyped] = useState("");

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/archive"), d: unknown = await r.json();
      if (!r.ok) throw new Error(errOf(d, "โหลดสถานะไม่สำเร็จ"));
      setSt(d as Full); window.dispatchEvent(new Event(RETENTION_REFRESH));
    } catch (e) { setErr(e instanceof Error ? e.message : "โหลดสถานะไม่สำเร็จ"); }
  }, []);
  useEffect(() => { void load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect -- โหลดข้อมูลตอนเปิดหน้า
  // ดาวน์โหลดเป็นการนำทางของเบราว์เซอร์ จึงโหลดสถานะซ้ำหลังคลิกและเมื่อกลับมาที่หน้านี้
  useEffect(() => { const f = () => { void load(); }; window.addEventListener("focus", f); return () => window.removeEventListener("focus", f); }, [load]);
  const afterDownload = () => { setTimeout(() => { void load(); }, 2500); };

  const purge = async (fy: number) => {
    setErr(""); setOk(""); setBusy(true);
    try {
      const r = await fetch("/api/archive", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "purge", fy, confirm: typed.trim() }) }), d: unknown = await r.json();
      if (!r.ok) throw new Error(errOf(d, "ลบไม่สำเร็จ"));
      setOk(`ลบข้อมูลปีงบประมาณ ${fy} เรียบร้อย`); setPend(null); setTyped(""); await load();
    } catch (e) { setErr(e instanceof Error ? e.message : "ลบไม่สำเร็จ"); } finally { setBusy(false); }
  };

  const chip = (it: Full["items"][number]) =>
    it.expired ? (it.exported ? <span className="ux-pill ok">export แล้ว · รอลบ</span> : <span className="ux-pill bad">หลุดกรอบ · ต้อง export</span>)
      : st && it.fy === st.oldestKeptFy ? (it.exported ? <span className="ux-pill ok">export แล้ว</span> : <span className="ux-pill warn">ปีเก่าสุดในกรอบ</span>)
        : <span className="ux-pill mute">อยู่ในกรอบ</span>;

  return (
    <div>
      <PageHead title="สำรองข้อมูล" sub={st ? `ระบบเก็บข้อมูลย้อนหลัง ${st.retentionYears} ปีงบประมาณ (ปี ${st.oldestKeptFy}–${st.currentFy}) · ข้อมูลที่เก่ากว่านั้นต้อง export ก่อนจึงจะใช้งานต่อได้` : "ระบบเก็บข้อมูลย้อนหลัง 5 ปีงบประมาณ"} />
      {err && <p className="ux-toast bad" role="alert">{err}</p>}
      {ok && <p className="ux-toast" role="status">{ok}</p>}
      {!st && !err && <p className="ux-empty">กำลังโหลด…</p>}
      {st && <>
        <section className="ux-card">
          <h2>ข้อมูลตามปีงบประมาณ</h2>
          <p className="ux-note">ปีงบประมาณนับ ต.ค.–ก.ย. · ปีงบประมาณใหม่ขึ้นวันที่ {st.rolloverDate} (อีก {n(st.daysToRollover)} วัน) · ระบบเตือนล่วงหน้า {st.warnDays} วันก่อนข้อมูลปีเก่าสุดหลุดกรอบ</p>
          <div className="sh-tw" style={{ overflowX: "auto" }}>
            <table className="ux-table">
              <thead><tr><th className="l">ปีงบประมาณ</th><th>สถานะ</th><th>ปุ๋ย</th><th>ไถกลบ</th><th>หยุดเผา</th><th className="l">ไฟล์สำรอง</th><th /></tr></thead>
              <tbody>
                {st.items.length === 0 && <tr><td colSpan={7} className="l">ยังไม่มีข้อมูลในระบบ</td></tr>}
                {st.items.map(it => (
                  <tr key={it.fy}>
                    <td className="l"><b>{it.fy}</b></td>
                    <td>{chip(it)}</td>
                    <td>{n(it.counts.reports)}</td><td>{n(it.counts.area)}</td><td>{n(it.counts.burn)}</td>
                    <td className="l">
                      <a className="ux-btn sm line" href={`/api/archive/export?fy=${it.fy}&format=xlsx`} download onClick={afterDownload}>📥 Excel</a>{" "}
                      <a className="ux-btn sm line" href={`/api/archive/export?fy=${it.fy}&format=json`} download onClick={afterDownload}>📦 JSON</a>
                      <small style={{ display: "block", marginTop: ".25rem", color: "var(--muted)" }}>
                        Excel: {it.xlsxAt ? thaiDateTime(it.xlsxAt) : "ยังไม่ได้ export"} · JSON: {it.jsonAt ? thaiDateTime(it.jsonAt) : "ยังไม่ได้ export"}
                      </small>
                    </td>
                    <td>{it.expired && <button type="button" className="ux-btn sm line" disabled={busy || !it.purgeReady} title={it.purgeReady ? "ลบข้อมูลปีนี้ออกจากฐานข้อมูล" : "ต้อง export ทั้ง Excel และ JSON ก่อน"} onClick={() => { setPend(it.fy); setTyped(""); setErr(""); setOk(""); }}>🗑 ลบข้อมูลเก่า</button>}</td>
                  </tr>))}
              </tbody>
            </table>
          </div>
          <p className="ux-note">• <b>Excel</b> = ไฟล์อ่านง่ายตามช่วงเดือนรายงานของปีนั้น (ใช้ปลดล็อกระบบ) · <b>JSON</b> = ข้อมูลดิบครบทุกเดือน เก็บไว้กู้คืน · ลบข้อมูลเก่าได้ต่อเมื่อมีทั้งสองไฟล์และข้อมูลไม่เปลี่ยนหลัง export</p>
          <p className="ux-note">• ระบบบันทึกว่าสร้างไฟล์สำเร็จ ไม่ได้ตรวจว่าเครื่องบันทึกไฟล์ได้ — เปิดไฟล์ดูก่อนลบทุกครั้ง และเก็บสำเนาไว้ที่ที่ปลอดภัย</p>
        </section>
        {pend !== null && (
          <section className="ux-card" role="alertdialog" aria-labelledby="purge-t">
            <h2 id="purge-t">ลบข้อมูลปีงบประมาณ {pend} ถาวร</h2>
            <p className="ux-toast bad">ข้อมูลปีงบประมาณ {pend} จะถูกลบออกจากฐานข้อมูลและกู้คืนไม่ได้ กรุณาเปิดไฟล์ Excel ตรวจสอบ และเก็บไฟล์ JSON ไว้ในที่ปลอดภัยก่อน</p>
            <label>พิมพ์ <b>{pend}</b> เพื่อยืนยัน <input value={typed} inputMode="numeric" onChange={e => setTyped(e.target.value)} aria-label={`พิมพ์ ${pend} เพื่อยืนยันการลบ`} /></label>{" "}
            <button type="button" className="ux-btn sm" disabled={busy || typed.trim() !== String(pend)} onClick={() => { void purge(pend); }}>ลบถาวร</button>{" "}
            <button type="button" className="ux-btn sm line" disabled={busy} onClick={() => { setPend(null); setTyped(""); }}>ยกเลิก</button>
          </section>)}
        <section className="ux-card">
          <h2>ประวัติการ export ล่าสุด</h2>
          <div className="sh-tw" style={{ overflowX: "auto" }}>
            <table className="ux-table">
              <thead><tr><th className="l">เวลา</th><th className="l">ผู้ดำเนินการ</th><th>ปีงบประมาณ</th><th>ไฟล์</th><th>รายการ</th></tr></thead>
              <tbody>
                {st.history.length === 0 && <tr><td colSpan={5} className="l">ยังไม่เคย export</td></tr>}
                {st.history.map((h, i) => <tr key={i}><td className="l">{thaiDateTime(h.at)}</td><td className="l">{h.by}</td><td>{h.fy}</td><td>{h.format === "xlsx" ? "Excel" : "JSON"}</td><td>{n(h.counts.reports + h.counts.area + h.counts.burn)}</td></tr>)}
              </tbody>
            </table>
          </div>
        </section>
      </>}
    </div>
  );
}

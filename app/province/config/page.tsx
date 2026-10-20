"use client";
import { useState } from "react";
import { DEFAULT_LABELS, LABEL_DEFS, TOPICS, cfgOf, fiscalRange, thaiMonth, type AppConfig, type Settings } from "@/lib/data";
import { useProvince } from "@/components/Province";
import { I, PageHead, Step } from "@/components/Entry";

const newKey = (p: string) => `${p}${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
const clone = (c: AppConfig): AppConfig => JSON.parse(JSON.stringify(c));
const move = <T,>(a: T[], i: number, d: number) => { const j = i + d; if (j < 0 || j >= a.length) return a; const b = [...a]; [b[i], b[j]] = [b[j], b[i]]; return b; };

// หน้านี้ให้เจ้าหน้าที่จังหวัดเพิ่ม/ลดปีงบประมาณ ช่องปุ๋ย ช่องหยุดเผา ตัวคูณไถกลบฟางข้าว และแก้ชื่อหัวข้อตารางทั้งหมด โดยไม่ต้องแตะโค้ด
// การบันทึกผ่าน PUT /api/settings ซึ่งเซิร์ฟเวอร์อนุญาตเฉพาะบัญชีจังหวัด
export default function ProvinceConfig() {
  const { settings, setSettings } = useProvince();
  const [draft, setDraft] = useState<AppConfig>(() => clone(cfgOf(settings)));
  const [loadedFrom, setLoadedFrom] = useState(settings);
  const [fyIn, setFyIn] = useState("");
  const [msg, setMsg] = useState<{ t: string; bad?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  // ข้อมูลตั้งค่าโหลดเสร็จหลังเปิดหน้า: ถ้ายังไม่ได้แก้อะไร ให้ซิงก์ฟอร์มกับค่าที่เพิ่งโหลดมา
  if (settings !== loadedFrom && !dirty) { setLoadedFrom(settings); setDraft(clone(cfgOf(settings))); }
  const set = (f: (d: AppConfig) => void) => { const d = clone(draft); f(d); setDraft(d); setDirty(true); setMsg(null); };
  const groups = Array.from(new Set(draft.fertFields.map(f => f.group)));

  async function save() {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ config: draft }) });
      const data: unknown = await res.json();
      if (!res.ok) {
        const e = typeof data === "object" && data !== null && "error" in data && typeof data.error === "string" ? data.error : "บันทึกไม่สำเร็จ";
        setMsg({ t: res.status === 401 || res.status === 403 ? `${e} (ต้องเข้าสู่ระบบด้วยบัญชีจังหวัด)` : e, bad: true });
        return;
      }
      setSettings(data as Settings); setLoadedFrom(data as Settings); setDirty(false);
      setMsg({ t: "บันทึกแล้ว แบบฟอร์มของอำเภอ ตาราง Dashboard Excel และ PDF จะใช้ค่าใหม่ทันที" });
    } catch { setMsg({ t: "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่อีกครั้ง", bad: true }); }
    finally { setBusy(false); }
  }

  function addYear() {
    const y = Number(fyIn);
    if (!Number.isInteger(y) || y < 2500 || y > 2700) return setMsg({ t: "กรอกปีงบประมาณเป็น พ.ศ. 4 หลัก เช่น 2570", bad: true });
    if (draft.fiscalYears.includes(y)) return setMsg({ t: `มีปีงบประมาณ ${y} อยู่แล้ว`, bad: true });
    set(d => { d.fiscalYears = [...d.fiscalYears, y].sort((a, b) => b - a); }); setFyIn("");
  }
  const numIn = (k: keyof AppConfig["area"], label: string, unit: string) => (
    <div key={k}><label className="ux-lbl" htmlFor={`k-${k}`}>{label}</label>
      <div className="ux-num-in filled"><input id={`k-${k}`} type="number" min={0} step="any" value={draft.area[k]} onChange={e => set(d => { d.area[k] = Number(e.target.value); })} /><span>{unit}</span></div></div>);

  return (
    <div style={{ maxWidth: 980 }}>
      <PageHead title="ตั้งค่าหัวข้อและรายการ" sub="เพิ่ม/ลดปีงบประมาณ ช่องปุ๋ย ช่องรายงานการหยุดเผา ปรับตัวคูณไถกลบฟางข้าว และแก้ชื่อหัวข้อตารางได้เองทั้งหมด · เฉพาะเจ้าหน้าที่จังหวัด · กดบันทึกครั้งเดียวที่ด้านล่าง" />
      <div className="ux-stack">
        <Step n={1} title="ปีงบประมาณ" hint="เพิ่มปีงบประมาณ (พ.ศ.) ให้ปรากฏในตัวเลือกทุกหน้า · ปีที่มีข้อมูลหรือปีปัจจุบันแสดงอยู่แล้วโดยอัตโนมัติ">
          <div className="ux-due" style={{ marginBottom: ".8rem" }}>
            <label htmlFor="fy-add">เพิ่มปีงบประมาณ</label>
            <input id="fy-add" type="number" inputMode="numeric" placeholder="เช่น 2571" value={fyIn} onChange={e => setFyIn(e.target.value)} onKeyDown={e => e.key === "Enter" && addYear()} />
            <button type="button" className="ux-btn line sm" onClick={addYear}>{I.plus}เพิ่ม</button>
            {fyIn && Number(fyIn) >= 2500 && Number(fyIn) <= 2700 && <span className="ux-hint" style={{ margin: 0 }}>{thaiMonth(fiscalRange(Number(fyIn)).from)} – {thaiMonth(fiscalRange(Number(fyIn)).to)}</span>}
          </div>
          {draft.fiscalYears.length === 0 ? <p className="ux-empty">ยังไม่ได้เพิ่มปีงบประมาณเอง</p> : (
            <div className="ux-tabs">{draft.fiscalYears.map(y => (
              <span key={y} className="ux-chip">ปีงบประมาณ {y} <button type="button" aria-label={`ลบปีงบประมาณ ${y}`} onClick={() => set(d => { d.fiscalYears = d.fiscalYears.filter(x => x !== y); })}>✕</button></span>))}</div>)}
        </Step>

        <Step n={2} title="ช่องปุ๋ยอินทรีย์ / ปุ๋ยพืชสด / วัสดุอินทรีย์" hint="เพิ่ม ลบ เปลี่ยนชื่อ หรือย้ายกลุ่มได้ · ช่องที่ลบจะหายจากแบบฟอร์ม ตาราง Excel และ PDF แต่ข้อมูลที่อำเภอเคยกรอกยังอยู่ในฐานข้อมูล">
          <datalist id="grp">{groups.map(g => <option key={g} value={g} />)}</datalist>
          <div style={{ display: "grid", gap: ".6rem" }}>
            {draft.fertFields.map((f, i) => (
              <div key={f.key} className="ux-due" style={{ flexWrap: "wrap" }}>
                <b>{i + 1}</b>
                <input aria-label="ชื่อช่อง" placeholder="ชื่อช่อง เช่น ปุ๋ยคอก" value={f.label} maxLength={80} onChange={e => set(d => { d.fertFields[i].label = e.target.value; })} />
                <input aria-label="กลุ่ม" list="grp" placeholder="กลุ่ม" value={f.group} maxLength={60} onChange={e => set(d => { d.fertFields[i].group = e.target.value; })} />
                <button type="button" className="ux-btn line sm" disabled={i === 0} aria-label="เลื่อนขึ้น" onClick={() => set(d => { d.fertFields = move(d.fertFields, i, -1); })}>↑</button>
                <button type="button" className="ux-btn line sm" disabled={i === draft.fertFields.length - 1} aria-label="เลื่อนลง" onClick={() => set(d => { d.fertFields = move(d.fertFields, i, 1); })}>↓</button>
                <button type="button" className="ux-btn line sm danger" disabled={draft.fertFields.length <= 1} onClick={() => { if (window.confirm(`ลบช่อง “${f.label || "ไม่มีชื่อ"}” ออกจากแบบฟอร์มและตาราง?\nข้อมูลที่อำเภอเคยกรอกยังอยู่ในฐานข้อมูล`)) set(d => { d.fertFields = d.fertFields.filter(x => x.key !== f.key); }); }}>ลบ</button>
              </div>))}
          </div>
          <div style={{ marginTop: ".8rem", display: "flex", gap: ".6rem", flexWrap: "wrap", alignItems: "end" }}>
            <button type="button" className="ux-btn line" disabled={draft.fertFields.length >= 30} onClick={() => set(d => { d.fertFields.push({ key: newKey("f"), label: "", group: groups[groups.length - 1] ?? "ปุ๋ยอินทรีย์" }); })}>{I.plus}เพิ่มช่องปุ๋ย</button>
            <div><label className="ux-lbl" htmlFor="tpt">เป้าหมายต่อเกษตรตำบล 1 ราย</label>
              <div className="ux-num-in filled"><input id="tpt" type="number" min={0} step="any" value={draft.targetPerTambon} onChange={e => set(d => { d.targetPerTambon = Number(e.target.value); })} /><span>ตัน</span></div></div>
          </div>
        </Step>

        <Step n={3} title="ช่องรายงานการหยุดเผา" hint="จำนวนเต็ม · ตั้งชื่อช่องและหน่วยเอง">
          <div style={{ display: "grid", gap: ".6rem" }}>
            {draft.burnFields.map((f, i) => (
              <div key={f.key} className="ux-due" style={{ flexWrap: "wrap" }}>
                <b>{i + 1}</b>
                <input aria-label="ชื่อช่อง" placeholder="ชื่อช่อง" value={f.label} maxLength={120} onChange={e => set(d => { d.burnFields[i].label = e.target.value; })} />
                <input aria-label="หน่วย" placeholder="หน่วย เช่น ครั้ง" style={{ maxWidth: 120 }} value={f.unit} maxLength={30} onChange={e => set(d => { d.burnFields[i].unit = e.target.value; })} />
                <button type="button" className="ux-btn line sm" disabled={i === 0} aria-label="เลื่อนขึ้น" onClick={() => set(d => { d.burnFields = move(d.burnFields, i, -1); })}>↑</button>
                <button type="button" className="ux-btn line sm" disabled={i === draft.burnFields.length - 1} aria-label="เลื่อนลง" onClick={() => set(d => { d.burnFields = move(d.burnFields, i, 1); })}>↓</button>
                <button type="button" className="ux-btn line sm danger" disabled={draft.burnFields.length <= 1} onClick={() => { if (window.confirm(`ลบช่อง “${f.label || "ไม่มีชื่อ"}”?\nข้อมูลที่อำเภอเคยกรอกยังอยู่ในฐานข้อมูล`)) set(d => { d.burnFields = d.burnFields.filter(x => x.key !== f.key); }); }}>ลบ</button>
              </div>))}
          </div>
          <button type="button" className="ux-btn line" style={{ marginTop: ".8rem" }} disabled={draft.burnFields.length >= 20} onClick={() => set(d => { d.burnFields.push({ key: newKey("b"), label: "", unit: "ครั้ง" }); })}>{I.plus}เพิ่มช่อง</button>
        </Step>

        <Step n={4} title="ไถกลบฟางข้าวและฟางก้อน" hint="ตัวคูณที่ระบบใช้คำนวณเป้าหมาย ฟางข้าว มูลค่า และราคาฟางก้อน · มีผลกับตัวเลขที่แสดงทั้งหมดทันที (รวมข้อมูลเก่า)">
          <div className="ux-two">
            {numIn("targetPct", "เป้าหมายร้อยละของพื้นที่ปลูกพืชทั้งหมด", "%")}
            {numIn("strawKgPerRai", "ฟางข้าวต่อไร่", "กก./ไร่")}
            {numIn("strawValuePerRai", "มูลค่าไถกลบฟางข้าวต่อไร่", "บาท/ไร่")}
            {numIn("balesPerRai", "ฟางก้อนต่อไร่", "ก้อน/ไร่")}
            {numIn("balePrice", "ราคาฟางก้อน", "บาท/ก้อน")}
          </div>
        </Step>

        <Step n={5} title="ชื่อหัวข้อและหัวตาราง" hint="แก้ข้อความได้ทุกช่อง · เว้นว่าง = ใช้ข้อความเดิม · {pct} = ร้อยละเป้าหมาย, {m} = ชื่อเดือน">
          <div style={{ display: "grid", gap: ".5rem", marginBottom: "1.2rem" }}>
            <b>ชื่อหัวข้อที่ต้องรายงาน</b>
            {TOPICS.map(t => (
              <div key={t.key} className="ux-due"><label htmlFor={`tp-${t.key}`}>{t.label}</label>
                <input id={`tp-${t.key}`} placeholder={t.label} value={draft.topics[t.key] ?? ""} maxLength={100} onChange={e => set(d => { if (e.target.value) d.topics[t.key] = e.target.value; else delete d.topics[t.key]; })} /></div>))}
          </div>
          {Array.from(new Set(LABEL_DEFS.map(l => l.group))).map(g => (
            <div key={g} style={{ display: "grid", gap: ".5rem", marginBottom: "1.2rem" }}>
              <b>{g}</b>
              {LABEL_DEFS.filter(l => l.group === g).map(l => (
                <div key={l.key} className="ux-due"><label htmlFor={`lb-${l.key}`}>{l.text}</label>
                  <input id={`lb-${l.key}`} placeholder={DEFAULT_LABELS[l.key]} value={draft.labels[l.key] ?? ""} maxLength={150} onChange={e => set(d => { if (e.target.value) d.labels[l.key] = e.target.value; else delete d.labels[l.key]; })} /></div>))}
            </div>))}
          <button type="button" className="ux-btn line sm" onClick={() => { if (window.confirm("ล้างข้อความที่แก้ไว้ทั้งหมด กลับไปใช้ข้อความเดิม?")) set(d => { d.labels = {}; d.topics = {}; }); }}>คืนค่าข้อความเดิมทั้งหมด</button>
        </Step>
      </div>

      <div className="ux-sticky-save">
        <span>{msg ? <span className={`ux-toast${msg.bad ? " bad" : ""}`} role="status">{msg.t}</span> : <span className="ux-note">{dirty ? "มีการแก้ไขที่ยังไม่บันทึก" : "แก้ไขแล้วกดบันทึก"}</span>}</span>
        <div style={{ display: "flex", gap: ".6rem", flexWrap: "wrap" }}>
          {dirty && <button className="ux-btn line" disabled={busy} onClick={() => { setDraft(clone(cfgOf(settings))); setDirty(false); setMsg(null); }}>ยกเลิกการแก้ไข</button>}
          <button className="ux-btn" disabled={busy || !dirty} onClick={save}>{I.save}บันทึกการตั้งค่า</button>
        </div>
      </div>
    </div>
  );
}

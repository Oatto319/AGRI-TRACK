"use client";
import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_LABELS, LABEL_DEFS, TOPICS, cfgOf, strawBales, baleValue, strawTons, strawValue, areaTarget, thaiMonth, topicLabelOf, currentMonth, fiscalYearOf, fiscalYearOptions, fiscalRangeFor, periodMonths, FY_START_MONTH, FY_END_MONTH, type AppConfig, type FieldDef, type Settings, type TopicPeriods, type Topic, type YearConfig } from "@/lib/data";
import { useProvince } from "@/components/Province";
import { I, f2 } from "@/components/Entry";

// หน้าตั้งค่าที่จังหวัดแก้เองได้ทั้งหมดโดยไม่ต้องแตะโค้ด — แบ่งเป็น 5 แท็บ มีคำอธิบายและตัวอย่างที่อำเภอจะเห็นทุกแท็บ
// บันทึกผ่าน PUT /api/settings (เซิร์ฟเวอร์อนุญาตเฉพาะบัญชีจังหวัด)
type TabKey = "fy" | "fert" | "burn" | "area" | "text";
const TABS: { key: TabKey; label: string; icon: keyof typeof I }[] = [
  { key: "fy", label: "ปีงบประมาณ", icon: "check" }, { key: "fert", label: "ช่องปุ๋ย", icon: "leaf" }, { key: "burn", label: "ช่องหยุดเผา", icon: "alert" },
  { key: "area", label: "ไถกลบฟางข้าว", icon: "sprout" }, { key: "text", label: "ชื่อหัวข้อตาราง", icon: "info" },
];
const SLICES: Record<TabKey, (c: AppConfig) => unknown> = {
  fy: c => c.fiscalYears, fert: c => [c.fertFields, c.targetPerTambon], burn: c => c.burnFields, area: c => c.area, text: c => [c.labels, c.topics],
};
const newKey = (p: string) => `${p}${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
const clone = (c: AppConfig): AppConfig => JSON.parse(JSON.stringify(c));
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
// ค่าที่ใช้จริงของ scope: "base" = ค่าตั้งต้น · ตัวเลข = ปีงบประมาณนั้น (ถ้าไม่ได้ตั้งเอง ใช้ค่าตั้งต้น)
const effOf = (c: AppConfig, scope: string): AppConfig => (scope === "base" ? c : { ...c, ...(c.byYear?.[scope] ?? {}) });
const yearPart = (c: YearConfig): YearConfig => ({ targetPerTambon: c.targetPerTambon, fertFields: c.fertFields, burnFields: c.burnFields, area: c.area, topics: c.topics, labels: c.labels });
const MONTH_NAMES = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
const UNITS = ["ครั้ง", "หมู่บ้าน", "คน", "ราย", "ชิ้น", "แห่ง", "ตำบล", "ไร่", "ตัน"];

function Tip({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="cf-tip"><span className="cf-tip-i">{I.info}</span><div><b>{title}</b><div>{children}</div></div></div>;
}

export default function ConfigSettings() {
  const { settings, setSettings } = useProvince();
  const saved = useMemo(() => cfgOf(settings), [settings]);
  const [draft, setDraft] = useState<AppConfig>(() => clone(saved));
  const [loadedFrom, setLoadedFrom] = useState<Settings>(settings);
  const [tab, setTab] = useState<TabKey>("fy");
  const [msg, setMsg] = useState<{ t: string; bad?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [fyIn, setFyIn] = useState("");
  const [q, setQ] = useState("");
  const [ex, setEx] = useState({ rai: "1000", total: "10000" });
  // เดือนปัจจุบันอ่านหลัง mount เท่านั้น (ห้ามเรียก new Date() ตอน render เพราะ Next.js prerender หน้านี้)
  const [cur, setCur] = useState("");
  const curFy = cur ? fiscalYearOf(cur) : 0;
  const [scope, setScope] = useState<string>("base"); // ปีงบประมาณที่กำลังแก้ ("base" = ค่าตั้งต้น) · พอรู้ปีปัจจุบันจะสลับเป็นปีนั้นให้อัตโนมัติหนึ่งครั้ง
  const autoScoped = useRef(false);
  useEffect(() => { startTransition(() => { setCur(currentMonth()); }); }, []);
  useEffect(() => {
    if (cur && !autoScoped.current) { autoScoped.current = true; startTransition(() => { setScope(String(fiscalYearOf(cur))); }); }
  }, [cur]);
  const [copyFrom, setCopyFrom] = useState("base");
  const [newS, setNewS] = useState(FY_START_MONTH), [newE, setNewE] = useState(FY_END_MONTH); // เดือนเริ่ม/สิ้นสุดของปีที่จะเพิ่ม
  const [newT, setNewT] = useState<TopicPeriods>({}); // ช่วงเดือนเฉพาะหัวข้อของปีที่จะเพิ่ม (ไม่ระบุ = ใช้ช่วงรวมของปี)
  const [edit, setEdit] = useState<{ old: number; fy: string; s: number; e: number; t: TopicPeriods } | null>(null);
  // ช่วงเดือนของปีงบประมาณ y ตามที่กำลังแก้ (รวมที่ยังไม่บันทึก)
  const rg = (y: number) => { const d = draft.fiscalYears.find(x => x.fy === y); return fiscalRangeFor(y, d?.startMonth ?? FY_START_MONTH, d?.endMonth ?? FY_END_MONTH); };

  const view = effOf(draft, scope); // ค่าของปีที่กำลังแก้ (ใช้แสดงในฟอร์ม)
  const hasOwn = scope !== "base" && !!draft.byYear?.[scope];
  const changed = (k: TabKey) => k === "fy" ? !same(draft.fiscalYears, saved.fiscalYears) : !same(SLICES[k](effOf(draft, scope)), SLICES[k](effOf(saved, scope)));
  const dirty = !same({ ...draft, byYear: draft.byYear ?? {} }, { ...saved, byYear: saved.byYear ?? {} });
  const changedScopes = ["base", ...Array.from(new Set([...Object.keys(draft.byYear ?? {}), ...Object.keys(saved.byYear ?? {})]))].filter(sc => !same(effOf(draft, sc), effOf(saved, sc)));
  // ข้อมูลตั้งค่าโหลดเสร็จหลังเปิดหน้า: ถ้ายังไม่ได้แก้อะไร ให้ซิงก์ฟอร์มกับค่าที่เพิ่งโหลดมา
  if (settings !== loadedFrom && !dirty) { setLoadedFrom(settings); setDraft(clone(saved)); }
  useEffect(() => { // กันปิดหน้าโดยลืมบันทึก
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", h); return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  // set = แก้ค่าของปีงบประมาณที่เลือก (ปีที่ยังไม่มีค่าเฉพาะ จะสร้างจากค่าตั้งต้นตอนแก้ครั้งแรก) · setG = แก้ค่าที่ใช้ร่วมทุกปี (รายการปีงบประมาณ)
  const set = (f: (c: YearConfig) => void) => {
    const d = clone(draft);
    if (scope === "base") f(d);
    else { d.byYear = d.byYear ?? {}; d.byYear[scope] = d.byYear[scope] ?? clone(yearPart(d) as AppConfig); f(d.byYear[scope]); }
    setDraft(d); setMsg(null);
  };
  const setG = (f: (d: AppConfig) => void) => { const d = clone(draft); f(d); setDraft(d); setMsg(null); };

  // ---- ตรวจก่อนบันทึก (ข้อความอ่านง่าย บอกว่าต้องแก้ตรงไหน)
  const problems: { tab: TabKey; text: string; sc?: string }[] = [];
  const scopesAll: (string | "base")[] = ["base", ...Object.keys(draft.byYear ?? {})];
  for (const sc of scopesAll) {
    const e = effOf(draft, sc), who = sc === "base" ? "ค่าตั้งต้น" : `ปีงบประมาณ ${sc}`;
    e.fertFields.forEach((f, i) => { if (!f.label.trim()) problems.push({ tab: "fert", text: `${who}: ช่องปุ๋ยลำดับที่ ${i + 1} ยังไม่ได้ตั้งชื่อ`, sc }); if (!f.group.trim()) problems.push({ tab: "fert", text: `${who}: ช่องปุ๋ยลำดับที่ ${i + 1} ยังไม่ได้ระบุกลุ่ม`, sc }); });
    e.burnFields.forEach((f, i) => { if (!f.label.trim()) problems.push({ tab: "burn", text: `${who}: ช่องหยุดเผาลำดับที่ ${i + 1} ยังไม่ได้ตั้งชื่อ`, sc }); if (!f.unit.trim()) problems.push({ tab: "burn", text: `${who}: ช่องหยุดเผาลำดับที่ ${i + 1} ยังไม่ได้ระบุหน่วย`, sc }); });
  }

  async function save() {
    if (problems.length) { setTab(problems[0].tab); if (problems[0].sc) setScope(problems[0].sc); return setMsg({ t: problems[0].text + " — กรุณากรอกให้ครบก่อนบันทึก", bad: true }); }
    setBusy(true); setMsg(null);
    try {
      const res = await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ config: draft }) });
      const data: unknown = await res.json();
      if (!res.ok) {
        const e = typeof data === "object" && data !== null && "error" in data && typeof data.error === "string" ? data.error : "บันทึกไม่สำเร็จ";
        return setMsg({ t: res.status === 401 || res.status === 403 ? `${e} (ต้องเข้าสู่ระบบด้วยบัญชีจังหวัด)` : e, bad: true });
      }
      setSettings(data as Settings); setLoadedFrom(data as Settings);
      setMsg({ t: "บันทึกเรียบร้อย — แบบฟอร์มของอำเภอ ตาราง Dashboard Excel และ PDF ใช้ค่าใหม่แล้ว" });
    } catch { setMsg({ t: "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่อีกครั้ง", bad: true }); }
    finally { setBusy(false); }
  }

  // ================= แท็บ 1: ปีงบประมาณ =================
  const knownYears = [...draft.fiscalYears].sort((a, b) => b.fy - a.fy);
  const nextYear = (knownYears.length ? knownYears[0].fy : curFy) + 1; // curFy = 0 ตอนยังไม่รู้เดือนปัจจุบัน
  const monthSel = (id: string, label: string, v: number, on: (n: number) => void) => (
    <div><label className="ux-lbl" htmlFor={id}>{label}</label>
      <select id={id} className="ux-select" value={v} onChange={e => on(Number(e.target.value))}>{MONTH_NAMES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select></div>);
  const rangeText = (y: number, sm: number, em: number) => { const r = fiscalRangeFor(y, sm, em); return `${thaiMonth(r.from)} – ${thaiMonth(r.to)} · ${periodMonths(sm, em)} เดือน`; };
  // ช่วงเดือนแยกตามหัวข้อ: เปิดใช้เฉพาะหัวข้อที่ช่วงเดือนไม่ตรงกับช่วงรวมของปี (เช่น ไถกลบถึง มิ.ย. แต่ปุ๋ยรายงานถึง พ.ค.)
  const topicRanges = (v: TopicPeriods, base: { s: number; e: number }, on: (n: TopicPeriods) => void, id: string) => (
    <div className="cf-box" style={{ display: "grid", gap: ".6rem" }}>
      <b>ช่วงเดือนแยกตามหัวข้อ (ไม่บังคับ)</b>
      <p className="ux-note" style={{ margin: 0 }}>หัวข้อที่ไม่ติ๊ก = ใช้ช่วงรวมของปีด้านบน · ติ๊กเฉพาะหัวข้อที่รายงานไม่ตรงกับช่วงรวม เช่น ปุ๋ยรายงานถึงพฤษภาคม แต่ไถกลบถึงมิถุนายน</p>
      {TOPICS.map(t => { const o = v[t.key as Topic], k = `${id}-${t.key}`; return (
        <div key={t.key} style={{ display: "grid", gap: ".4rem" }}>
          <label style={{ display: "flex", gap: ".5rem", alignItems: "center", fontWeight: 600 }}>
            <input type="checkbox" checked={!!o} onChange={e => { const n = { ...v }; if (e.target.checked) n[t.key as Topic] = { startMonth: base.s, endMonth: base.e }; else delete n[t.key as Topic]; on(n); }} />
            {topicLabelOf(draft, t.key as Topic)}
            <span className="ux-note" style={{ margin: 0, fontWeight: 400 }}>{o ? "" : "ใช้ช่วงรวมของปี"}</span>
          </label>
          {o && <div className="cf-row">
            {monthSel(`${k}-s`, "เดือนเริ่ม", o.startMonth, n => on({ ...v, [t.key]: { ...o, startMonth: n } }))}<span style={{ alignSelf: "end", paddingBottom: ".6rem" }}>ถึง</span>{monthSel(`${k}-e`, "เดือนสิ้นสุด", o.endMonth, n => on({ ...v, [t.key]: { ...o, endMonth: n } }))}
          </div>}
        </div>); })}
    </div>);
  const topicText = (d: { topics?: TopicPeriods }) => TOPICS.filter(t => d.topics?.[t.key as Topic]).map(t => { const o = d.topics![t.key as Topic]!; return `${topicLabelOf(draft, t.key as Topic)}: ${MONTH_NAMES[o.startMonth - 1]} – ${MONTH_NAMES[o.endMonth - 1]}`; });
  function addYear(y: number) {
    if (!Number.isInteger(y) || y < 2500 || y > 2700) return setMsg({ t: "กรอกปีงบประมาณเป็น พ.ศ. 4 หลัก เช่น 2571", bad: true });
    if (knownYears.some(d => d.fy === y)) return setMsg({ t: `มีปีงบประมาณ ${y} อยู่แล้ว (กด “แก้ไข” ที่ปีนั้นเพื่อเปลี่ยนช่วงเดือน)`, bad: true });
    setG(d => { d.fiscalYears = [...d.fiscalYears, { fy: y, startMonth: newS, endMonth: newE, ...(Object.keys(newT).length ? { topics: newT } : {}) }].sort((a, b) => b.fy - a.fy); }); setFyIn(""); setNewT({});
  }
  function applyEdit() {
    if (!edit) return;
    const y = Number(edit.fy);
    if (!Number.isInteger(y) || y < 2500 || y > 2700) return setMsg({ t: "ปีงบประมาณต้องเป็น พ.ศ. 4 หลัก เช่น 2571", bad: true });
    if (y !== edit.old && knownYears.some(d => d.fy === y)) return setMsg({ t: `มีปีงบประมาณ ${y} อยู่แล้ว`, bad: true });
    setG(d => {
      d.fiscalYears = d.fiscalYears.map(x => x.fy === edit.old ? { fy: y, startMonth: edit.s, endMonth: edit.e, ...(Object.keys(edit.t).length ? { topics: edit.t } : {}) } : x).sort((a, b) => b.fy - a.fy);
      if (y !== edit.old && d.byYear?.[String(edit.old)]) { d.byYear[String(y)] = d.byYear[String(edit.old)]; delete d.byYear[String(edit.old)]; } // ย้ายการตั้งค่ารายปีตามปีที่เปลี่ยน
    });
    if (scope === String(edit.old)) setScope(String(y));
    setEdit(null);
  }
  const tabFy = (
    <>
      <Tip title="ใช้ทำอะไร">กำหนดปีงบประมาณและ <b>ช่วงเดือนที่ดำเนินการ</b> (เดือนเริ่ม – เดือนสิ้นสุด) ของแต่ละปี เช่น พฤศจิกายน – มิถุนายน · แต่ละหัวข้อ (ปุ๋ยอินทรีย์ ไถกลบฟางข้าว หยุดเผา) กำหนดช่วงเดือนแยกกันได้ · ปีงบประมาณที่เพิ่มไว้แก้ไขหรือลบได้ภายหลัง · ปีที่ไม่ได้เพิ่มเองจะใช้ช่วงเริ่มต้น พ.ย. – มิ.ย. · กดบันทึกที่แถบด้านล่างเมื่อเสร็จ</Tip>
      <section className="cf-group" style={{ marginTop: "1rem" }}>
        <header><b>เพิ่มปีงบประมาณใหม่</b></header>
        <p className="ux-note" style={{ margin: 0 }}>ขั้นที่ 1 · เลือกช่วงเดือนที่ดำเนินการ</p>
        <div className="cf-row">
          {monthSel("fy-s", "เดือนเริ่ม", newS, setNewS)}<span style={{ alignSelf: "end", paddingBottom: ".6rem" }}>ถึง</span>{monthSel("fy-e", "เดือนสิ้นสุด", newE, setNewE)}
        </div>
        <p className="ux-note" style={{ margin: 0 }}>ช่วงรวมนี้ใช้กับทุกหัวข้อ · ถ้าหัวข้อใดรายงานไม่ตรงกัน ให้กำหนดช่วงเฉพาะหัวข้อด้านล่าง</p>
        {topicRanges(newT, { s: newS, e: newE }, setNewT, "nt")}
        <p className="ux-note" style={{ margin: 0 }}>ขั้นที่ 2 · ใส่ปีงบประมาณ (พ.ศ.)</p>
        <div className="cf-row">
          <div className="ux-num-in" style={{ width: 200 }}><input aria-label="ปีงบประมาณที่ต้องการเพิ่ม" type="number" inputMode="numeric" placeholder="เช่น 2571" value={fyIn} onChange={e => setFyIn(e.target.value)} onKeyDown={e => e.key === "Enter" && addYear(Number(fyIn))} /></div>
          <button type="button" className="ux-btn" onClick={() => addYear(Number(fyIn))}>{I.plus}เพิ่มปีนี้</button>
          {(knownYears.length > 0 || curFy > 0) && <button type="button" className="ux-btn line" onClick={() => addYear(nextYear)}>{I.plus}เพิ่มปีถัดไป ({nextYear})</button>}
        </div>
        {fyIn && Number(fyIn) >= 2500 && Number(fyIn) <= 2700 && <p className="ux-note" style={{ margin: 0 }}>ปีงบประมาณ {fyIn} = {rangeText(Number(fyIn), newS, newE)}</p>}
      </section>
      <h3 className="cf-h3">ปีงบประมาณที่เพิ่มไว้</h3>
      {knownYears.length === 0 ? <p className="ux-empty">ยังไม่ได้เพิ่มปีงบประมาณเอง</p> : (
        <div className="cf-chips">{knownYears.map(d => edit?.old === d.fy ? (
          <div key={d.fy} className="cf-year editing">
            <label className="ux-lbl" htmlFor="fy-ed">ปีงบประมาณ (พ.ศ.)</label>
            <div className="ux-num-in"><input id="fy-ed" type="number" inputMode="numeric" value={edit.fy} onChange={e => setEdit({ ...edit, fy: e.target.value })} /></div>
            {monthSel("fy-eds", "เดือนเริ่ม", edit.s, n => setEdit({ ...edit, s: n }))}
            {monthSel("fy-ede", "เดือนสิ้นสุด", edit.e, n => setEdit({ ...edit, e: n }))}
            {topicRanges(edit.t, { s: edit.s, e: edit.e }, t => setEdit({ ...edit, t }), "et")}
            {Number(edit.fy) >= 2500 && <span>{rangeText(Number(edit.fy), edit.s, edit.e)}</span>}
            <div className="cf-row"><button type="button" className="ux-btn sm" onClick={applyEdit}>ตกลง</button><button type="button" className="ux-btn line sm" onClick={() => setEdit(null)}>ยกเลิก</button></div>
          </div>
        ) : (
          <div key={d.fy} className="cf-year"><b>ปีงบประมาณ {d.fy}</b><span>{rangeText(d.fy, d.startMonth, d.endMonth)}</span>
            {topicText(d).map(x => <span key={x} className="ux-note" style={{ margin: 0 }}>{x}</span>)}
            <div className="cf-row">
              <button type="button" className="ux-btn line sm" onClick={() => setEdit({ old: d.fy, fy: String(d.fy), s: d.startMonth, e: d.endMonth, t: d.topics ?? {} })}>แก้ไข</button>
              <button type="button" className="cf-x" aria-label={`ลบปีงบประมาณ ${d.fy}`} onClick={() => { if (window.confirm(`ลบปีงบประมาณ ${d.fy} ออกจากรายการ?\n(ข้อมูลที่รายงานไว้ยังอยู่ในฐานข้อมูล · ช่วงเดือนของปีนี้จะกลับเป็นค่าเริ่มต้น พ.ย. – มิ.ย.)`)) setG(x => { x.fiscalYears = x.fiscalYears.filter(y => y.fy !== d.fy); }); }}>✕ ลบ</button>
            </div></div>))}</div>)}
    </>
  );

  // ================= แท็บ 2: ช่องปุ๋ย =================
  const groups = Array.from(new Set(view.fertFields.map(f => f.group)));
  const moveGroup = (g: string, d: number) => set(c => {
    const order = Array.from(new Set(c.fertFields.map(f => f.group))); const i = order.indexOf(g), j = i + d;
    if (j < 0 || j >= order.length) return; [order[i], order[j]] = [order[j], order[i]];
    c.fertFields = order.flatMap(n => c.fertFields.filter(f => f.group === n));
  });
  const moveField = (key: string, d: number) => set(c => {
    const i = c.fertFields.findIndex(f => f.key === key); const g = c.fertFields[i].group;
    let j = i + d; while (j >= 0 && j < c.fertFields.length && c.fertFields[j].group !== g) j += d;
    if (j < 0 || j >= c.fertFields.length) return; [c.fertFields[i], c.fertFields[j]] = [c.fertFields[j], c.fertFields[i]];
  });
  const renameGroup = (g: string, to: string) => set(c => { c.fertFields.forEach(f => { if (f.group === g) f.group = to; }); });
  const addToGroup = (g: string) => set(c => {
    let last = -1; c.fertFields.forEach((f, i) => { if (f.group === g) last = i; });
    c.fertFields.splice(last + 1, 0, { key: newKey("f"), label: "", group: g });
  });
  const delField = (f: FieldDef) => { if (window.confirm(`ลบช่อง “${f.label || "ยังไม่มีชื่อ"}” ออกจากแบบฟอร์มและตาราง?\n\n(ข้อมูลที่อำเภอเคยกรอกไว้ยังอยู่ในฐานข้อมูล ไม่หาย)`)) set(c => { c.fertFields = c.fertFields.filter(x => x.key !== f.key); }); };
  const tabFert = (
    <>
      <Tip title="ใช้ทำอะไร">กำหนดว่าอำเภอต้องกรอกปุ๋ย/วัสดุอะไรบ้างในแต่ละเดือน แบ่งเป็นกลุ่ม (เช่น ปุ๋ยอินทรีย์ ปุ๋ยพืชสด วัสดุอินทรีย์) · พิมพ์ชื่อแก้ได้เลย · ลบช่องคือซ่อนจากหน้าจอ ข้อมูลเก่ายังอยู่</Tip>
      <div className="cf-cols">
        <div>
          {groups.map((g, gi) => (
            <section key={gi} className="cf-group">
              <header>
                <input aria-label="ชื่อกลุ่ม" className="cf-gname" value={g} maxLength={60} placeholder="ชื่อกลุ่ม" onChange={e => renameGroup(g, e.target.value)} />
                <span className="cf-count">{view.fertFields.filter(f => f.group === g).length} ช่อง</span>
                <button type="button" className="cf-ic" disabled={gi === 0} aria-label="เลื่อนกลุ่มขึ้น" onClick={() => moveGroup(g, -1)}>↑</button>
                <button type="button" className="cf-ic" disabled={gi === groups.length - 1} aria-label="เลื่อนกลุ่มลง" onClick={() => moveGroup(g, 1)}>↓</button>
              </header>
              {view.fertFields.filter(f => f.group === g).map((f, i) => (
                <div key={f.key} className="cf-item">
                  <span className="cf-no">{i + 1}</span>
                  <input aria-label="ชื่อช่อง" className={f.label.trim() ? "" : "bad"} placeholder="พิมพ์ชื่อช่อง เช่น ปุ๋ยคอก" value={f.label} maxLength={80} onChange={e => set(c => { const t = c.fertFields.find(x => x.key === f.key); if (t) t.label = e.target.value; })} />
                  <button type="button" className="cf-ic" aria-label="เลื่อนขึ้น" onClick={() => moveField(f.key, -1)}>↑</button>
                  <button type="button" className="cf-ic" aria-label="เลื่อนลง" onClick={() => moveField(f.key, 1)}>↓</button>
                  <button type="button" className="cf-ic del" aria-label="ลบช่อง" disabled={view.fertFields.length <= 1} onClick={() => delField(f)}>ลบ</button>
                </div>))}
              <button type="button" className="ux-btn line sm" disabled={view.fertFields.length >= 30} onClick={() => addToGroup(g)}>{I.plus}เพิ่มช่องในกลุ่มนี้</button>
            </section>))}
          <button type="button" className="ux-btn" disabled={view.fertFields.length >= 30} onClick={() => set(c => { c.fertFields.push({ key: newKey("f"), label: "", group: `กลุ่มใหม่ ${groups.length + 1}` }); })}>{I.plus}เพิ่มกลุ่มใหม่</button>
          <div className="cf-box" style={{ marginTop: "1.2rem" }}>
            <label className="ux-lbl" htmlFor="tpt">เป้าหมายปุ๋ยต่อเกษตรตำบล 1 ราย</label>
            <div className="ux-num-in filled" style={{ maxWidth: 260 }}><input id="tpt" type="number" min={0} step="any" value={view.targetPerTambon} onChange={e => set(c => { c.targetPerTambon = Number(e.target.value); })} /><span>ตัน</span></div>
            <p className="ux-note">เป้าหมายของอำเภอ = จำนวนเกษตรตำบล × ค่านี้ · ค่าตั้งต้นของปีที่ยังไม่มีรายการ · ถ้าตั้งจำนวนเกษตรตำบลและตัวคูณรายปีไว้ที่แท็บ “การรายงาน” ข้อ 3 ระบบจะใช้ค่านั้นแทน</p>
          </div>
        </div>
        <aside className="cf-prev" aria-label="ตัวอย่างแบบฟอร์ม">
          <div className="cf-prev-t">ตัวอย่างที่อำเภอจะเห็น</div>
          {groups.map((g, gi) => (<div key={gi}><div className="cf-prev-g">{g || "(ยังไม่มีชื่อกลุ่ม)"}</div>
            {view.fertFields.filter(f => f.group === g).map(f => <div key={f.key} className="cf-prev-f"><span>{f.label || "(ยังไม่มีชื่อ)"}</span><span className="cf-prev-box">0 <em>ตัน</em></span></div>)}</div>))}
        </aside>
      </div>
    </>
  );

  // ================= แท็บ 3: ช่องหยุดเผา =================
  const tabBurn = (
    <>
      <Tip title="ใช้ทำอะไร">กำหนดช่องตัวเลขที่อำเภอรายงานเรื่องการสร้างการเรียนรู้/ประชาสัมพันธ์การหยุดเผา เช่น จำนวนกิจกรรม จำนวนหมู่บ้าน · ตั้งชื่อและหน่วยเองได้ (ตัวเลขเป็นจำนวนเต็ม)</Tip>
      <datalist id="units">{UNITS.map(u => <option key={u} value={u} />)}</datalist>
      <div className="cf-cols">
        <div>
          <section className="cf-group">
            {view.burnFields.map((f, i) => (
              <div key={f.key} className="cf-item">
                <span className="cf-no">{i + 1}</span>
                <input aria-label="ชื่อช่อง" className={f.label.trim() ? "" : "bad"} placeholder="พิมพ์ชื่อช่อง" value={f.label} maxLength={120} onChange={e => set(c => { c.burnFields[i].label = e.target.value; })} />
                <input aria-label="หน่วย" list="units" className={`cf-unit${f.unit.trim() ? "" : " bad"}`} placeholder="หน่วย" value={f.unit} maxLength={30} onChange={e => set(c => { c.burnFields[i].unit = e.target.value; })} />
                <button type="button" className="cf-ic" disabled={i === 0} aria-label="เลื่อนขึ้น" onClick={() => set(c => { [c.burnFields[i - 1], c.burnFields[i]] = [c.burnFields[i], c.burnFields[i - 1]]; })}>↑</button>
                <button type="button" className="cf-ic" disabled={i === view.burnFields.length - 1} aria-label="เลื่อนลง" onClick={() => set(c => { [c.burnFields[i + 1], c.burnFields[i]] = [c.burnFields[i], c.burnFields[i + 1]]; })}>↓</button>
                <button type="button" className="cf-ic del" disabled={view.burnFields.length <= 1} aria-label="ลบช่อง" onClick={() => { if (window.confirm(`ลบช่อง “${f.label || "ยังไม่มีชื่อ"}”?\n\n(ข้อมูลที่อำเภอเคยกรอกไว้ยังอยู่ในฐานข้อมูล ไม่หาย)`)) set(c => { c.burnFields = c.burnFields.filter(x => x.key !== f.key); }); }}>ลบ</button>
              </div>))}
            <button type="button" className="ux-btn line sm" disabled={view.burnFields.length >= 20} onClick={() => set(c => { c.burnFields.push({ key: newKey("b"), label: "", unit: "ครั้ง" }); })}>{I.plus}เพิ่มช่อง</button>
          </section>
        </div>
        <aside className="cf-prev" aria-label="ตัวอย่างแบบฟอร์ม">
          <div className="cf-prev-t">ตัวอย่างที่อำเภอจะเห็น</div>
          {view.burnFields.map(f => <div key={f.key} className="cf-prev-f"><span>{f.label || "(ยังไม่มีชื่อ)"}</span><span className="cf-prev-box">0 <em>{f.unit || "?"}</em></span></div>)}
        </aside>
      </div>
    </>
  );

  // ================= แท็บ 4: ไถกลบฟางข้าว =================
  const K = view.area;
  const rai = Number(ex.rai) || 0, tot = Number(ex.total) || 0;
  const numIn = (k: keyof AppConfig["area"], label: string, unit: string, help: string) => (
    <div className="cf-box" key={k}><label className="ux-lbl" htmlFor={`k-${k}`}>{label}</label>
      <div className="ux-num-in filled"><input id={`k-${k}`} type="number" min={0} step="any" value={K[k]} onChange={e => set(c => { c.area[k] = Number(e.target.value); })} /><span>{unit}</span></div>
      <p className="ux-note">{help}</p></div>);
  const tabArea = (
    <>
      <Tip title="ใช้ทำอะไร">ตัวเลขที่ระบบใช้คำนวณเป้าหมายพื้นที่ ปริมาณฟางข้าว มูลค่า และฟางก้อน จากไร่ที่อำเภอรายงาน · เปลี่ยนแล้วตัวเลขทุกหน้าคำนวณใหม่ทันที (รวมข้อมูลเก่า)</Tip>
      <div className="cf-cols">
        <div className="ux-two" style={{ alignContent: "start" }}>
          {numIn("targetPct", "เป้าหมายพื้นที่ไถกลบ", "%", "ร้อยละของพื้นที่ปลูกพืชทั้งหมดของอำเภอ")}
          {numIn("strawKgPerRai", "ฟางข้าวต่อไร่", "กก./ไร่", "ใช้คำนวณปริมาณฟางข้าว (ตัน)")}
          {numIn("strawValuePerRai", "มูลค่าไถกลบฟางข้าวต่อไร่", "บาท/ไร่", "ใช้คำนวณมูลค่า (บาท)")}
          {numIn("balesPerRai", "ฟางก้อนต่อไร่", "ก้อน/ไร่", "ใช้คำนวณจำนวนฟางก้อน")}
          {numIn("balePrice", "ราคาฟางก้อน", "บาท/ก้อน", "ใช้คำนวณราคาฟางก้อน (บาท)")}
        </div>
        <aside className="cf-prev" aria-label="ลองคำนวณ">
          <div className="cf-prev-t">ลองคำนวณดู</div>
          <label className="ux-lbl" htmlFor="ex-rai">ถ้าไถกลบสะสม (ไร่)</label>
          <div className="ux-num-in filled"><input id="ex-rai" type="number" min={0} value={ex.rai} onChange={e => setEx({ ...ex, rai: e.target.value })} /><span>ไร่</span></div>
          <div className="cf-prev-f"><span>ฟางข้าว</span><b>{f2(strawTons(rai, K))} ตัน</b></div>
          <div className="cf-prev-f"><span>มูลค่า</span><b>{f2(strawValue(rai, K))} บาท</b></div>
          <div className="cf-prev-f"><span>ฟางก้อน</span><b>{f2(strawBales(rai, K))} ก้อน</b></div>
          <div className="cf-prev-f"><span>ราคาฟางก้อน</span><b>{f2(baleValue(rai, K))} บาท</b></div>
          <label className="ux-lbl" htmlFor="ex-tot" style={{ marginTop: ".8rem" }}>ถ้าพื้นที่ปลูกพืชทั้งหมด (ไร่)</label>
          <div className="ux-num-in filled"><input id="ex-tot" type="number" min={0} value={ex.total} onChange={e => setEx({ ...ex, total: e.target.value })} /><span>ไร่</span></div>
          <div className="cf-prev-f"><span>เป้าหมาย {K.targetPct}%</span><b>{f2(areaTarget(tot, K))} ไร่</b></div>
        </aside>
      </div>
    </>
  );

  // ================= แท็บ 5: ชื่อหัวข้อและหัวตาราง =================
  const labelVal = (k: string) => view.labels[k] ?? DEFAULT_LABELS[k];
  const setLabel = (k: string, v: string) => set(c => { if (v.trim() && v !== DEFAULT_LABELS[k]) c.labels[k] = v; else delete c.labels[k]; });
  const matches = (t: string) => !q.trim() || t.toLowerCase().includes(q.trim().toLowerCase());
  const labelGroups = Array.from(new Set(LABEL_DEFS.map(l => l.group)));
  const edited = (k: string) => k in view.labels;
  const tabText = (
    <>
      <Tip title="ใช้ทำอะไร">แก้ข้อความหัวตารางและชื่อแท็บที่แสดงในหน้าตารางจังหวัดและไฟล์ Excel · พิมพ์ทับข้อความได้เลย · ข้อความที่แก้แล้วจะมีป้าย “แก้แล้ว” กด “คืนค่าเดิม” เพื่อย้อนกลับ · {"{pct}"} = ร้อยละเป้าหมาย, {"{m}"} = ชื่อเดือน (ไม่ต้องลบ)</Tip>
      <div className="ux-text-in" style={{ margin: "1rem 0" }}><input aria-label="ค้นหาหัวข้อ" placeholder="ค้นหาหัวข้อ เช่น เป้าหมาย" value={q} onChange={e => setQ(e.target.value)} /></div>
      {TOPICS.some(t => matches(t.label) || matches(view.topics[t.key] ?? "")) && (
        <section className="cf-group"><header><b>ชื่อหัวข้อที่ต้องรายงาน</b></header>
          {TOPICS.filter(t => matches(t.label) || matches(view.topics[t.key] ?? "")).map(t => (
            <div key={t.key} className="cf-item cf-lab">
              <input aria-label={`ชื่อหัวข้อ ${t.label}`} value={view.topics[t.key] ?? t.label} maxLength={100} onChange={e => set(c => { if (e.target.value.trim() && e.target.value !== t.label) c.topics[t.key] = e.target.value; else delete c.topics[t.key]; })} />
              {t.key in view.topics && <><span className="cf-badge">แก้แล้ว</span><button type="button" className="cf-ic" onClick={() => set(c => { delete c.topics[t.key]; })}>คืนค่าเดิม</button></>}
            </div>))}
        </section>)}
      {labelGroups.map(g => {
        const items = LABEL_DEFS.filter(l => l.group === g && (matches(l.text) || matches(labelVal(l.key))));
        if (!items.length) return null;
        return (
          <section key={g} className="cf-group"><header><b>{g}</b></header>
            <div className="cf-strip" aria-label="ตัวอย่างหัวตาราง">{LABEL_DEFS.filter(l => l.group === g).map(l => <span key={l.key}>{labelVal(l.key).replace("{pct}", String(view.area.targetPct)).replace("{m}", "ต.ค.")}</span>)}</div>
            {items.map(l => (
              <div key={l.key} className="cf-item cf-lab">
                <input aria-label={`หัวข้อ ${l.text}`} value={labelVal(l.key)} maxLength={150} onChange={e => setLabel(l.key, e.target.value)} />
                {edited(l.key) && <><span className="cf-badge">แก้แล้ว</span><button type="button" className="cf-ic" onClick={() => setLabel(l.key, DEFAULT_LABELS[l.key])}>คืนค่าเดิม</button></>}
              </div>))}
          </section>);
      })}
      {Object.keys(view.labels).length + Object.keys(view.topics).length > 0 && <button type="button" className="ux-btn line sm" onClick={() => { if (window.confirm("ล้างข้อความที่แก้ไว้ทั้งหมดในแท็บนี้ กลับไปใช้ข้อความเดิม?")) set(c => { c.labels = {}; c.topics = {}; }); }}>คืนค่าข้อความเดิมทั้งหมด</button>}
    </>
  );

  const body: Record<TabKey, React.ReactNode> = { fy: tabFy, fert: tabFert, burn: tabBurn, area: tabArea, text: tabText };
  return (
    <div style={{ maxWidth: 1040 }}>
      <div className="cf-scope">
        <label htmlFor="cf-year"><b>ปีงบประมาณที่จะแก้ไข</b></label>
        <select id="cf-year" className="ux-select" value={scope} onChange={e => setScope(e.target.value)}>
          <option value="base">ค่าตั้งต้น — ใช้กับทุกปีที่ยังไม่ได้ตั้งเอง</option>
          {fiscalYearOptions(draft, [...(curFy ? [curFy - 1, curFy, curFy + 1, curFy + 2] : []), ...Object.keys(draft.byYear ?? {}).map(Number)]).map(y => (
            <option key={y} value={String(y)}>ปีงบประมาณ {y} ({thaiMonth(rg(y).from)} – {thaiMonth(rg(y).to)}){draft.byYear?.[String(y)] ? " ✓ ตั้งเอง" : " · ใช้ค่าตั้งต้น"}</option>))}
        </select>
        <span className="cf-scope-hint">เลือกปีก่อน แล้วแก้ในแท็บ 2–5 · แต่ละปีตั้งค่าไม่เหมือนกันได้ · ปีที่ไม่ได้ตั้งเองจะใช้ “ค่าตั้งต้น”</span>
      </div>
      <div className="cf-tabs" role="tablist">
        {TABS.map((t, i) => (
          <button key={t.key} role="tab" aria-selected={tab === t.key} type="button" className={`cf-tab${tab === t.key ? " on" : ""}`} onClick={() => setTab(t.key)}>
            <span className="cf-n">{i + 1}</span>{t.label}{changed(t.key) && <span className="cf-dot" title="มีการแก้ไขที่ยังไม่บันทึก" />}
          </button>))}
      </div>
      <div className="cf-panel" role="tabpanel">
        {tab !== "fy" && (
          <div className={`cf-banner${scope === "base" ? " base" : hasOwn ? " own" : ""}`}>
            <div><b>{scope === "base" ? "กำลังแก้: ค่าตั้งต้น (ใช้กับทุกปีที่ยังไม่ได้ตั้งเอง)" : `กำลังแก้: ปีงบประมาณ ${scope}`}</b>
              <span>{scope === "base" ? "ปีที่ตั้งค่าเฉพาะไว้แล้วจะไม่ได้รับผลจากการแก้ตรงนี้" : hasOwn ? "ปีนี้มีค่าที่ตั้งเอง แก้ได้โดยไม่กระทบปีอื่น" : "ปีนี้ยังใช้ค่าตั้งต้นอยู่ — พอแก้อะไรก็ตาม ระบบจะสร้างค่าเฉพาะของปีนี้ให้ (ไม่กระทบปีอื่น)"}</span></div>
            {scope !== "base" && (
              <div className="cf-banner-act">
                <select aria-label="คัดลอกการตั้งค่าจาก" className="ux-select" value={copyFrom} onChange={e => setCopyFrom(e.target.value)}>
                  <option value="base">ค่าตั้งต้น</option>
                  {Array.from(new Set([...Object.keys(draft.byYear ?? {}), ...draft.fiscalYears.map(d => String(d.fy))])).filter(y => y !== scope).sort().reverse().map(y => <option key={y} value={y}>ปีงบประมาณ {y}</option>)}
                </select>
                <button type="button" className="ux-btn line sm" onClick={() => { if (window.confirm(`คัดลอกการตั้งค่า (ช่องปุ๋ย ช่องหยุดเผา ตัวคูณ ชื่อหัวข้อ) จาก “${copyFrom === "base" ? "ค่าตั้งต้น" : "ปีงบประมาณ " + copyFrom}” มาใส่ปีงบประมาณ ${scope}?\nค่าเดิมของปีนี้จะถูกแทนที่ (ยังไม่บันทึกจนกว่าจะกดบันทึก)`)) { const src = clone(yearPart(effOf(draft, copyFrom)) as AppConfig); set(c => { Object.assign(c, src); }); } }}>คัดลอกมาใช้</button>
                {hasOwn && <button type="button" className="ux-btn line sm danger" onClick={() => { if (window.confirm(`ล้างค่าที่ตั้งเองของปีงบประมาณ ${scope} แล้วกลับไปใช้ค่าตั้งต้น?`)) setG(d => { if (d.byYear) delete d.byYear[scope]; }); }}>ใช้ค่าตั้งต้นแทน</button>}
              </div>)}
          </div>)}
        {tab === "fy" && <p className="ux-note" style={{ marginTop: 0 }}>แท็บนี้ใช้ร่วมกันทุกปี ไม่ขึ้นกับปีที่เลือกด้านบน</p>}
        {body[tab]}
      </div>

      <div className="ux-sticky-save">
        <span>{msg ? <span className={`ux-toast${msg.bad ? " bad" : ""}`} role="status">{msg.t}</span> : <span className="ux-note">{dirty ? `มีการแก้ไขที่ยังไม่บันทึก (${changedScopes.map(sc => sc === "base" ? "ค่าตั้งต้น" : "ปีงบประมาณ " + sc).join(", ")}${changed("fy") ? ", รายการปีงบประมาณ" : ""})` : "ยังไม่มีการแก้ไข"}</span>}</span>
        <div style={{ display: "flex", gap: ".6rem", flexWrap: "wrap" }}>
          {dirty && <button className="ux-btn line" disabled={busy} onClick={() => { if (window.confirm("ยกเลิกการแก้ไขทั้งหมดที่ยังไม่บันทึก?")) { setDraft(clone(saved)); setMsg(null); } }}>ยกเลิกการแก้ไข</button>}
          <button className="ux-btn" disabled={busy || !dirty} onClick={save}>{I.save}{busy ? "กำลังบันทึก..." : "บันทึกการตั้งค่า"}</button>
        </div>
      </div>
    </div>
  );
}

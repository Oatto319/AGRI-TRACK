"use client";
import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import { cfgOf, thaiMonth, currentMonth, fiscalYearOf, fiscalYearOptions, fiscalRangeFor, FY_START_MONTH, FY_END_MONTH, type AppConfig, type Settings, type YearConfig } from "@/lib/data";
import { useProvince } from "@/components/Province";
import { useConfirm } from "@/components/ConfirmDialog";
import { I } from "@/components/Entry";
import { TABS, SLICES, clone, effOf, same, yearPart, type Msg, type TabKey, type TabProps } from "./settings/shared";
import FiscalYearsTab from "./settings/FiscalYearsTab";
import FertFieldsTab from "./settings/FertFieldsTab";
import BurnFieldsTab from "./settings/BurnFieldsTab";
import AreaConstTab from "./settings/AreaConstTab";
import LabelsTab from "./settings/LabelsTab";

// หน้าตั้งค่าที่จังหวัดแก้เองได้ทั้งหมดโดยไม่ต้องแตะโค้ด — แบ่งเป็น 5 แท็บ (แต่ละแท็บอยู่ในไฟล์ของตัวเองที่ components/settings/)
// ไฟล์นี้ดูแลเฉพาะสถานะร่าง การเลือกปีงบประมาณ การตรวจก่อนบันทึก และการบันทึกผ่าน PUT /api/settings (เซิร์ฟเวอร์อนุญาตเฉพาะบัญชีจังหวัด)
export default function ConfigSettings() {
  const confirm = useConfirm();
  const { settings, setSettings } = useProvince();
  const saved = useMemo(() => cfgOf(settings), [settings]);
  const [draft, setDraft] = useState<AppConfig>(() => clone(saved));
  const [loadedFrom, setLoadedFrom] = useState<Settings>(settings);
  const [tab, setTab] = useState<TabKey>("fy");
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);
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
  const tp: TabProps = { draft, view, scope, curFy, set, setG, setScope, setMsg };
  const body: Record<TabKey, React.ReactNode> = {
    fy: <FiscalYearsTab {...tp} />, fert: <FertFieldsTab {...tp} />, burn: <BurnFieldsTab {...tp} />, area: <AreaConstTab {...tp} />, text: <LabelsTab {...tp} />,
  };
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
                <button type="button" className="ux-btn line sm" onClick={async () => { if (await confirm(`คัดลอกการตั้งค่า (ช่องปุ๋ย ช่องหยุดเผา ตัวคูณ ชื่อหัวข้อ) จาก “${copyFrom === "base" ? "ค่าตั้งต้น" : "ปีงบประมาณ " + copyFrom}” มาใส่ปีงบประมาณ ${scope}?\nค่าเดิมของปีนี้จะถูกแทนที่ (ยังไม่บันทึกจนกว่าจะกดบันทึก)`)) { const src = clone(yearPart(effOf(draft, copyFrom)) as AppConfig); set(c => { Object.assign(c, src); }); } }}>คัดลอกมาใช้</button>
                {hasOwn && <button type="button" className="ux-btn line sm danger" onClick={async () => { if (await confirm(`ล้างค่าที่ตั้งเองของปีงบประมาณ ${scope} แล้วกลับไปใช้ค่าตั้งต้น?`)) setG(d => { if (d.byYear) delete d.byYear[scope]; }); }}>ใช้ค่าตั้งต้นแทน</button>}
              </div>)}
          </div>)}
        {tab === "fy" && <p className="ux-note" style={{ marginTop: 0 }}>แท็บนี้ใช้ร่วมกันทุกปี ไม่ขึ้นกับปีที่เลือกด้านบน</p>}
        {body[tab]}
      </div>

      <div className="ux-sticky-save">
        <span>{msg ? <span className={`ux-toast${msg.bad ? " bad" : ""}`} role="status">{msg.t}</span> : <span className="ux-note">{dirty ? `มีการแก้ไขที่ยังไม่บันทึก (${changedScopes.map(sc => sc === "base" ? "ค่าตั้งต้น" : "ปีงบประมาณ " + sc).join(", ")}${changed("fy") ? ", รายการปีงบประมาณ" : ""})` : "ยังไม่มีการแก้ไข"}</span>}</span>
        <div style={{ display: "flex", gap: ".6rem", flexWrap: "wrap" }}>
          {dirty && <button className="ux-btn line" disabled={busy} onClick={async () => { if (await confirm("ยกเลิกการแก้ไขทั้งหมดที่ยังไม่บันทึก?")) { setDraft(clone(saved)); setMsg(null); } }}>ยกเลิกการแก้ไข</button>}
          <button className="ux-btn" disabled={busy || !dirty} onClick={save}>{I.save}{busy ? "กำลังบันทึก..." : "บันทึกการตั้งค่า"}</button>
        </div>
      </div>
    </div>
  );
}
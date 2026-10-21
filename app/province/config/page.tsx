"use client";
import { useEffect, useMemo, useState } from "react";
import { DEFAULT_LABELS, LABEL_DEFS, TOPICS, cfgOf, fiscalRange, strawBales, baleValue, strawTons, strawValue, areaTarget, thaiMonth, type AppConfig, type FieldDef, type Settings } from "@/lib/data";
import { useProvince } from "@/components/Province";
import { I, PageHead, f2 } from "@/components/Entry";

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
const UNITS = ["ครั้ง", "หมู่บ้าน", "คน", "ราย", "ชิ้น", "แห่ง", "ตำบล", "ไร่", "ตัน"];

function Tip({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="cf-tip"><span className="cf-tip-i">{I.info}</span><div><b>{title}</b><div>{children}</div></div></div>;
}

export default function ProvinceConfig() {
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

  const changed = (k: TabKey) => !same(SLICES[k](draft), SLICES[k](saved));
  const dirty = TABS.some(t => changed(t.key));
  // ข้อมูลตั้งค่าโหลดเสร็จหลังเปิดหน้า: ถ้ายังไม่ได้แก้อะไร ให้ซิงก์ฟอร์มกับค่าที่เพิ่งโหลดมา
  if (settings !== loadedFrom && !dirty) { setLoadedFrom(settings); setDraft(clone(saved)); }
  useEffect(() => { // กันปิดหน้าโดยลืมบันทึก
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", h); return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const set = (f: (d: AppConfig) => void) => { const d = clone(draft); f(d); setDraft(d); setMsg(null); };

  // ---- ตรวจก่อนบันทึก (ข้อความอ่านง่าย บอกว่าต้องแก้ตรงไหน)
  const problems: { tab: TabKey; text: string }[] = [];
  draft.fertFields.forEach((f, i) => { if (!f.label.trim()) problems.push({ tab: "fert", text: `ช่องปุ๋ยลำดับที่ ${i + 1} ยังไม่ได้ตั้งชื่อ` }); if (!f.group.trim()) problems.push({ tab: "fert", text: `ช่องปุ๋ยลำดับที่ ${i + 1} ยังไม่ได้ระบุกลุ่ม` }); });
  draft.burnFields.forEach((f, i) => { if (!f.label.trim()) problems.push({ tab: "burn", text: `ช่องหยุดเผาลำดับที่ ${i + 1} ยังไม่ได้ตั้งชื่อ` }); if (!f.unit.trim()) problems.push({ tab: "burn", text: `ช่องหยุดเผาลำดับที่ ${i + 1} ยังไม่ได้ระบุหน่วย` }); });

  async function save() {
    if (problems.length) { setTab(problems[0].tab); return setMsg({ t: problems[0].text + " — กรุณากรอกให้ครบก่อนบันทึก", bad: true }); }
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
  const knownYears = draft.fiscalYears;
  const nextYear = (knownYears.length ? Math.max(...knownYears) : saved.fiscalYears.length ? Math.max(...saved.fiscalYears) : 0) + 1;
  function addYear(y: number) {
    if (!Number.isInteger(y) || y < 2500 || y > 2700) return setMsg({ t: "กรอกปีงบประมาณเป็น พ.ศ. 4 หลัก เช่น 2571", bad: true });
    if (knownYears.includes(y)) return setMsg({ t: `มีปีงบประมาณ ${y} อยู่แล้ว`, bad: true });
    set(d => { d.fiscalYears = [...d.fiscalYears, y].sort((a, b) => b - a); }); setFyIn("");
  }
  const tabFy = (
    <>
      <Tip title="ใช้ทำอะไร">เพิ่มปีงบประมาณ (พ.ศ.) ล่วงหน้าให้เลือกได้ในทุกหน้า เช่น หน้าตั้งค่ารอบการรายงาน และตัวเลือกปีของหน้าตาราง · ปีที่มีข้อมูลและปีปัจจุบันแสดงให้อัตโนมัติอยู่แล้ว ไม่ต้องเพิ่ม · ปีงบประมาณนับช่วงรายงาน <b>พฤศจิกายน – มิถุนายน</b> (เช่น ปีงบประมาณ 2570 = พ.ย. 2569 – มิ.ย. 2570)</Tip>
      <div className="cf-row" style={{ marginTop: "1rem" }}>
        <div className="ux-num-in" style={{ width: 200 }}><input aria-label="ปีงบประมาณที่ต้องการเพิ่ม" type="number" inputMode="numeric" placeholder="เช่น 2571" value={fyIn} onChange={e => setFyIn(e.target.value)} onKeyDown={e => e.key === "Enter" && addYear(Number(fyIn))} /></div>
        <button type="button" className="ux-btn" onClick={() => addYear(Number(fyIn))}>{I.plus}เพิ่มปีนี้</button>
        {nextYear > 1 && <button type="button" className="ux-btn line" onClick={() => addYear(nextYear)}>{I.plus}เพิ่มปีถัดไป ({nextYear})</button>}
      </div>
      {fyIn && Number(fyIn) >= 2500 && Number(fyIn) <= 2700 && <p className="ux-note">ปีงบประมาณ {fyIn} = {thaiMonth(fiscalRange(Number(fyIn)).from)} ถึง {thaiMonth(fiscalRange(Number(fyIn)).to)}</p>}
      <h3 className="cf-h3">ปีงบประมาณที่เพิ่มไว้</h3>
      {knownYears.length === 0 ? <p className="ux-empty">ยังไม่ได้เพิ่มปีงบประมาณเอง</p> : (
        <div className="cf-chips">{knownYears.map(y => (
          <div key={y} className="cf-year"><b>ปีงบประมาณ {y}</b><span>{thaiMonth(fiscalRange(y).from)} – {thaiMonth(fiscalRange(y).to)}</span>
            <button type="button" className="cf-x" aria-label={`ลบปีงบประมาณ ${y}`} onClick={() => set(d => { d.fiscalYears = d.fiscalYears.filter(x => x !== y); })}>✕ ลบ</button></div>))}</div>)}
    </>
  );

  // ================= แท็บ 2: ช่องปุ๋ย =================
  const groups = Array.from(new Set(draft.fertFields.map(f => f.group)));
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
                <span className="cf-count">{draft.fertFields.filter(f => f.group === g).length} ช่อง</span>
                <button type="button" className="cf-ic" disabled={gi === 0} aria-label="เลื่อนกลุ่มขึ้น" onClick={() => moveGroup(g, -1)}>↑</button>
                <button type="button" className="cf-ic" disabled={gi === groups.length - 1} aria-label="เลื่อนกลุ่มลง" onClick={() => moveGroup(g, 1)}>↓</button>
              </header>
              {draft.fertFields.filter(f => f.group === g).map((f, i) => (
                <div key={f.key} className="cf-item">
                  <span className="cf-no">{i + 1}</span>
                  <input aria-label="ชื่อช่อง" className={f.label.trim() ? "" : "bad"} placeholder="พิมพ์ชื่อช่อง เช่น ปุ๋ยคอก" value={f.label} maxLength={80} onChange={e => set(c => { const t = c.fertFields.find(x => x.key === f.key); if (t) t.label = e.target.value; })} />
                  <button type="button" className="cf-ic" aria-label="เลื่อนขึ้น" onClick={() => moveField(f.key, -1)}>↑</button>
                  <button type="button" className="cf-ic" aria-label="เลื่อนลง" onClick={() => moveField(f.key, 1)}>↓</button>
                  <button type="button" className="cf-ic del" aria-label="ลบช่อง" disabled={draft.fertFields.length <= 1} onClick={() => delField(f)}>ลบ</button>
                </div>))}
              <button type="button" className="ux-btn line sm" disabled={draft.fertFields.length >= 30} onClick={() => addToGroup(g)}>{I.plus}เพิ่มช่องในกลุ่มนี้</button>
            </section>))}
          <button type="button" className="ux-btn" disabled={draft.fertFields.length >= 30} onClick={() => set(c => { c.fertFields.push({ key: newKey("f"), label: "", group: `กลุ่มใหม่ ${groups.length + 1}` }); })}>{I.plus}เพิ่มกลุ่มใหม่</button>
          <div className="cf-box" style={{ marginTop: "1.2rem" }}>
            <label className="ux-lbl" htmlFor="tpt">เป้าหมายปุ๋ยต่อเกษตรตำบล 1 ราย</label>
            <div className="ux-num-in filled" style={{ maxWidth: 260 }}><input id="tpt" type="number" min={0} step="any" value={draft.targetPerTambon} onChange={e => set(c => { c.targetPerTambon = Number(e.target.value); })} /><span>ตัน</span></div>
            <p className="ux-note">เป้าหมายของอำเภอ = จำนวนเกษตรตำบล × ค่านี้</p>
          </div>
        </div>
        <aside className="cf-prev" aria-label="ตัวอย่างแบบฟอร์ม">
          <div className="cf-prev-t">ตัวอย่างที่อำเภอจะเห็น</div>
          {groups.map((g, gi) => (<div key={gi}><div className="cf-prev-g">{g || "(ยังไม่มีชื่อกลุ่ม)"}</div>
            {draft.fertFields.filter(f => f.group === g).map(f => <div key={f.key} className="cf-prev-f"><span>{f.label || "(ยังไม่มีชื่อ)"}</span><span className="cf-prev-box">0 <em>ตัน</em></span></div>)}</div>))}
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
            {draft.burnFields.map((f, i) => (
              <div key={f.key} className="cf-item">
                <span className="cf-no">{i + 1}</span>
                <input aria-label="ชื่อช่อง" className={f.label.trim() ? "" : "bad"} placeholder="พิมพ์ชื่อช่อง" value={f.label} maxLength={120} onChange={e => set(c => { c.burnFields[i].label = e.target.value; })} />
                <input aria-label="หน่วย" list="units" className={`cf-unit${f.unit.trim() ? "" : " bad"}`} placeholder="หน่วย" value={f.unit} maxLength={30} onChange={e => set(c => { c.burnFields[i].unit = e.target.value; })} />
                <button type="button" className="cf-ic" disabled={i === 0} aria-label="เลื่อนขึ้น" onClick={() => set(c => { [c.burnFields[i - 1], c.burnFields[i]] = [c.burnFields[i], c.burnFields[i - 1]]; })}>↑</button>
                <button type="button" className="cf-ic" disabled={i === draft.burnFields.length - 1} aria-label="เลื่อนลง" onClick={() => set(c => { [c.burnFields[i + 1], c.burnFields[i]] = [c.burnFields[i], c.burnFields[i + 1]]; })}>↓</button>
                <button type="button" className="cf-ic del" disabled={draft.burnFields.length <= 1} aria-label="ลบช่อง" onClick={() => { if (window.confirm(`ลบช่อง “${f.label || "ยังไม่มีชื่อ"}”?\n\n(ข้อมูลที่อำเภอเคยกรอกไว้ยังอยู่ในฐานข้อมูล ไม่หาย)`)) set(c => { c.burnFields = c.burnFields.filter(x => x.key !== f.key); }); }}>ลบ</button>
              </div>))}
            <button type="button" className="ux-btn line sm" disabled={draft.burnFields.length >= 20} onClick={() => set(c => { c.burnFields.push({ key: newKey("b"), label: "", unit: "ครั้ง" }); })}>{I.plus}เพิ่มช่อง</button>
          </section>
        </div>
        <aside className="cf-prev" aria-label="ตัวอย่างแบบฟอร์ม">
          <div className="cf-prev-t">ตัวอย่างที่อำเภอจะเห็น</div>
          {draft.burnFields.map(f => <div key={f.key} className="cf-prev-f"><span>{f.label || "(ยังไม่มีชื่อ)"}</span><span className="cf-prev-box">0 <em>{f.unit || "?"}</em></span></div>)}
        </aside>
      </div>
    </>
  );

  // ================= แท็บ 4: ไถกลบฟางข้าว =================
  const K = draft.area;
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
  const labelVal = (k: string) => draft.labels[k] ?? DEFAULT_LABELS[k];
  const setLabel = (k: string, v: string) => set(c => { if (v.trim() && v !== DEFAULT_LABELS[k]) c.labels[k] = v; else delete c.labels[k]; });
  const matches = (t: string) => !q.trim() || t.toLowerCase().includes(q.trim().toLowerCase());
  const labelGroups = Array.from(new Set(LABEL_DEFS.map(l => l.group)));
  const edited = (k: string) => k in draft.labels;
  const tabText = (
    <>
      <Tip title="ใช้ทำอะไร">แก้ข้อความหัวตารางและชื่อแท็บที่แสดงในหน้าตารางจังหวัดและไฟล์ Excel · พิมพ์ทับข้อความได้เลย · ข้อความที่แก้แล้วจะมีป้าย “แก้แล้ว” กด “คืนค่าเดิม” เพื่อย้อนกลับ · {"{pct}"} = ร้อยละเป้าหมาย, {"{m}"} = ชื่อเดือน (ไม่ต้องลบ)</Tip>
      <div className="ux-text-in" style={{ margin: "1rem 0" }}><input aria-label="ค้นหาหัวข้อ" placeholder="ค้นหาหัวข้อ เช่น เป้าหมาย" value={q} onChange={e => setQ(e.target.value)} /></div>
      {TOPICS.some(t => matches(t.label) || matches(draft.topics[t.key] ?? "")) && (
        <section className="cf-group"><header><b>ชื่อหัวข้อที่ต้องรายงาน</b></header>
          {TOPICS.filter(t => matches(t.label) || matches(draft.topics[t.key] ?? "")).map(t => (
            <div key={t.key} className="cf-item cf-lab">
              <input aria-label={`ชื่อหัวข้อ ${t.label}`} value={draft.topics[t.key] ?? t.label} maxLength={100} onChange={e => set(c => { if (e.target.value.trim() && e.target.value !== t.label) c.topics[t.key] = e.target.value; else delete c.topics[t.key]; })} />
              {t.key in draft.topics && <><span className="cf-badge">แก้แล้ว</span><button type="button" className="cf-ic" onClick={() => set(c => { delete c.topics[t.key]; })}>คืนค่าเดิม</button></>}
            </div>))}
        </section>)}
      {labelGroups.map(g => {
        const items = LABEL_DEFS.filter(l => l.group === g && (matches(l.text) || matches(labelVal(l.key))));
        if (!items.length) return null;
        return (
          <section key={g} className="cf-group"><header><b>{g}</b></header>
            <div className="cf-strip" aria-label="ตัวอย่างหัวตาราง">{LABEL_DEFS.filter(l => l.group === g).map(l => <span key={l.key}>{labelVal(l.key).replace("{pct}", String(draft.area.targetPct)).replace("{m}", "ต.ค.")}</span>)}</div>
            {items.map(l => (
              <div key={l.key} className="cf-item cf-lab">
                <input aria-label={`หัวข้อ ${l.text}`} value={labelVal(l.key)} maxLength={150} onChange={e => setLabel(l.key, e.target.value)} />
                {edited(l.key) && <><span className="cf-badge">แก้แล้ว</span><button type="button" className="cf-ic" onClick={() => setLabel(l.key, DEFAULT_LABELS[l.key])}>คืนค่าเดิม</button></>}
              </div>))}
          </section>);
      })}
      {Object.keys(draft.labels).length + Object.keys(draft.topics).length > 0 && <button type="button" className="ux-btn line sm" onClick={() => { if (window.confirm("ล้างข้อความที่แก้ไว้ทั้งหมดในแท็บนี้ กลับไปใช้ข้อความเดิม?")) set(c => { c.labels = {}; c.topics = {}; }); }}>คืนค่าข้อความเดิมทั้งหมด</button>}
    </>
  );

  const body: Record<TabKey, React.ReactNode> = { fy: tabFy, fert: tabFert, burn: tabBurn, area: tabArea, text: tabText };
  return (
    <div style={{ maxWidth: 1040 }}>
      <PageHead title="ตั้งค่าหัวข้อและรายการ" sub="เลือกแท็บด้านล่างเพื่อแก้ไข แล้วกด “บันทึกการตั้งค่า” ที่แถบด้านล่างครั้งเดียว · เฉพาะเจ้าหน้าที่จังหวัด · ไม่ต้องแก้โค้ด" />
      <div className="cf-tabs" role="tablist">
        {TABS.map((t, i) => (
          <button key={t.key} role="tab" aria-selected={tab === t.key} type="button" className={`cf-tab${tab === t.key ? " on" : ""}`} onClick={() => setTab(t.key)}>
            <span className="cf-n">{i + 1}</span>{t.label}{changed(t.key) && <span className="cf-dot" title="มีการแก้ไขที่ยังไม่บันทึก" />}
          </button>))}
      </div>
      <div className="cf-panel" role="tabpanel">{body[tab]}</div>

      <div className="ux-sticky-save">
        <span>{msg ? <span className={`ux-toast${msg.bad ? " bad" : ""}`} role="status">{msg.t}</span> : <span className="ux-note">{dirty ? `มีการแก้ไขที่ยังไม่บันทึก (${TABS.filter(t => changed(t.key)).map(t => t.label).join(", ")})` : "ยังไม่มีการแก้ไข"}</span>}</span>
        <div style={{ display: "flex", gap: ".6rem", flexWrap: "wrap" }}>
          {dirty && <button className="ux-btn line" disabled={busy} onClick={() => { if (window.confirm("ยกเลิกการแก้ไขทั้งหมดที่ยังไม่บันทึก?")) { setDraft(clone(saved)); setMsg(null); } }}>ยกเลิกการแก้ไข</button>}
          <button className="ux-btn" disabled={busy || !dirty} onClick={save}>{I.save}{busy ? "กำลังบันทึก..." : "บันทึกการตั้งค่า"}</button>
        </div>
      </div>
    </div>
  );
}

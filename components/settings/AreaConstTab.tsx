"use client";
import { useState } from "react";
import { strawBales, baleValue, strawTons, strawValue, areaTarget, type AppConfig } from "@/lib/data";
import { f2 } from "@/components/Entry";
import { AREA_FIELDS, Tip, effOf, type TabProps } from "./shared";

// แท็บ 4: ตัวคูณไถกลบฟางข้าว/ฟางก้อน พร้อมช่องลองคำนวณ
export default function AreaConstTab({ draft, saved, view, scope, set, setScope }: TabProps) {
  const [ex, setEx] = useState({ rai: "1000", total: "10000" });
  const K = view.area;
  const rai = Number(ex.rai) || 0, tot = Number(ex.total) || 0;
  const numIn = (k: keyof AppConfig["area"], label: string, unit: string, help: string) => (
    <div className="cf-box" key={k}><label className="ux-lbl" htmlFor={`k-${k}`}>{label}</label>
      <div className="ux-num-in filled"><input id={`k-${k}`} type="number" min={0} step="any" value={K[k]} onChange={e => set(c => { c.area[k] = Number(e.target.value); })} /><span>{unit}</span></div>
      <p className="ux-note">{help}</p></div>);
  return (
    <>
      <Tip title="ใช้ทำอะไร">(“ไถกลบ” คือการไถฟางข้าวลงดินแทนการเผา) ตัวเลขที่ระบบใช้คำนวณเป้าหมายพื้นที่ ปริมาณฟางข้าว มูลค่า และฟางก้อน จากไร่ที่อำเภอรายงาน · เปลี่ยนแล้วตัวเลขทุกหน้าคำนวณใหม่ทันที (รวมข้อมูลเก่า)</Tip>
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
      <AreaCompare draft={draft} saved={saved} scope={scope} setScope={setScope} />
    </>
  );
}

// ตารางเปรียบเทียบค่าไถกลบฟางข้าวของทุกปีที่ตั้งเอง เทียบกับค่ามาตรฐาน: ช่องที่ต่างจากค่ามาตรฐานจะเน้นสี และเตือนถ้าเป้าหมายร้อยละไม่เท่ากันระหว่างปี
function AreaCompare({ draft, saved, scope, setScope }: { draft: TabProps["draft"]; saved: TabProps["saved"]; scope: string; setScope: (s: string) => void }) {
  const years = Object.keys(draft.byYear ?? {}).sort().reverse();
  const rows = [{ sc: "base", name: "ค่ามาตรฐาน" }, ...years.map(y => ({ sc: y, name: `ปีงบประมาณ ${y}` }))].map(r => ({ ...r, a: effOf(draft, r.sc).area, unsaved: JSON.stringify(effOf(draft, r.sc).area) !== JSON.stringify(effOf(saved, r.sc).area) }));
  const base = rows[0].a;
  const pcts = rows.filter(r => r.sc !== "base").map(r => ({ name: r.name, v: r.a.targetPct }));
  const pctDiffer = new Set(pcts.map(p => p.v)).size > 1 || pcts.some(p => p.v !== base.targetPct);
  return (
    <section className="cf-cmp" aria-label="เปรียบเทียบค่าไถกลบฟางข้าวรายปีงบประมาณ">
      <h3 className="cf-h3">เปรียบเทียบค่าที่ตั้งของแต่ละปีงบประมาณ</h3>
      {pctDiffer
        ? <p className="cf-cmp-warn" role="status">เป้าหมายร้อยละของพื้นที่ปลูกไม่เท่ากันทุกปี: {rows.map(r => `${r.name} = ${r.a.targetPct}%`).join(" · ")}</p>
        : <p className="ux-note">เป้าหมายร้อยละเท่ากันทุกปี ({base.targetPct}%)</p>}
      <div className="cf-cmp-wrap">
        <table>
          <thead><tr><th>ปีงบประมาณ</th>{AREA_FIELDS.map(f => <th key={f.key}>{f.label}<small>{f.unit}</small></th>)}</tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.sc} className={r.sc === scope ? "on" : ""}>
                <th scope="row"><button type="button" className="cf-cmp-go" onClick={() => setScope(r.sc)} title="เลือกปีนี้เพื่อแก้ไข">{r.name}</button>{r.unsaved && <span className="cf-cmp-un">ยังไม่บันทึก</span>}</th>
                {AREA_FIELDS.map(f => <td key={f.key} className={r.sc !== "base" && r.a[f.key] !== base[f.key] ? "diff" : ""}>{r.a[f.key].toLocaleString("th-TH")}</td>)}
              </tr>))}
          </tbody>
        </table>
      </div>
      <p className="ux-note">ช่องสีเหลืองคือค่าที่ต่างจากค่ามาตรฐาน · ปีที่ไม่อยู่ในตารางใช้ค่ามาตรฐาน · กดชื่อปีเพื่อไปแก้ไขปีนั้น · ป้าย “ยังไม่บันทึก” = แก้แล้วแต่ยังไม่กดบันทึก (Dashboard จะยังไม่เปลี่ยนจนกว่าจะบันทึก)</p>
    </section>
  );
}

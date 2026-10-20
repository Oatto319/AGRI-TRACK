"use client";
import { useMemo, useState } from "react";
import { areaTotalsFor, cfgOf, dueDaysFor, lb, fiscalYearOf, rangeLabel, thaiMonth } from "@/lib/data";
import { aggregateArea, aggregateBurn, fmt } from "@/lib/summary";
import { I, PageHead, f2 } from "@/components/Entry";
import { AreaTable, BurnTable, FertTable, KpiRow, SubmitLog } from "@/components/ProvinceTables";
import { FiscalSelect, useProvince } from "@/components/Province";
import PdfButton from "@/components/PdfButton";

type Tab = "fert" | "area" | "burn" | "log";

export default function ProvinceTable() {
  const { reports, area, burn, error, from, to, valid, agg, settings } = useProvince();
  const [tab, setTab] = useState<Tab>("fert");
  const cfg = useMemo(() => cfgOf(settings), [settings]), K = cfg.area;
  const a = useMemo(() => (area && valid ? aggregateArea(area, to, areaTotalsFor(settings, to), cfg.area) : null), [area, to, settings, valid, cfg]);
  const b = useMemo(() => (burn && valid ? aggregateBurn(burn, from, to, dueDaysFor(settings, "burn", to).length, cfg) : null), [burn, from, to, settings, valid, cfg]);
  const rows = agg?.rows ?? [];
  const sum = (f: (r: (typeof rows)[number]) => number) => rows.reduce((x, r) => x + f(r), 0);
  const total = sum(r => r.total), target = sum(r => r.target), sent = rows.filter(r => r.any).length;

  return (
    <div>
      <PageHead title="ตารางข้อมูลรายอำเภอ" sub="เลือกปีงบประมาณ แล้วเลือกแท็บที่ต้องการดู · ดาวน์โหลดเป็น Excel หรือ PDF สรุป 3 ปีได้จากปุ่มด้านขวา">
        <div className="ux-mfilter">
          <FiscalSelect />
          {valid && <a className="ux-btn gold" href={`/api/export?from=${from}&to=${to}`} download>ดาวน์โหลด Excel</a>}
          {valid && <PdfButton fy={fiscalYearOf(to)} className="ux-btn" />}
        </div>
      </PageHead>
      {error && <p className="ux-toast bad" role="alert">{error}</p>}
      {!reports && !error && <p className="ux-empty">กำลังโหลด…</p>}
      {reports && !valid && <p className="ux-toast bad">เลือกช่วงเดือนให้ถูกต้อง (เดือนเริ่มต้องไม่เกินเดือนสิ้นสุด)</p>}

      {agg && valid && <>
        <div className="ux-seg" role="group" aria-label="เลือกตาราง">
          <button aria-pressed={tab === "fert"} onClick={() => setTab("fert")}>{lb(cfg, "tab.fert")}</button>
          <button aria-pressed={tab === "area"} onClick={() => setTab("area")}>{lb(cfg, "tab.area")}</button>
          <button aria-pressed={tab === "burn"} onClick={() => setTab("burn")}>{lb(cfg, "tab.burn")}</button>
          <button aria-pressed={tab === "log"} onClick={() => setTab("log")}>{lb(cfg, "tab.log")}</button>
        </div>

        {tab === "fert" && <>
          <KpiRow items={[
            { icon: I.leaf, color: "#1d5f73", label: "ปุ๋ยอินทรีย์รวม", value: fmt(total), unit: "ตัน" },
            { icon: I.check, color: "#b08a2c", label: "เป้าหมายรวม", value: fmt(target), unit: "ตัน" },
            { icon: I.send, color: "#059669", label: "อำเภอที่ส่งแล้ว", value: `${sent} / ${rows.length}`, unit: "อำเภอ" },
            { icon: I.alert, color: "#e11d48", label: "ส่งช้า", value: String(sum(r => r.late)), unit: "ครั้ง" }]} />
          <section className="ux-card"><h2>{lb(cfg, "sec.fert")} · {rangeLabel(from, to)}</h2>
            <p className="ux-note">แถบความคืบหน้า: เขียว = ถึงเป้าหมายของอำเภอแล้ว · ทอง = ยังไม่ถึงเป้า · เลื่อนตารางไปทางขวาเพื่อดูทุกคอลัมน์</p>
            <div style={{ marginTop: ".9rem" }}><FertTable agg={agg} cfg={cfg} /></div></section>
        </>}

        {tab === "area" && (a ? <>
          <KpiRow items={[
            { icon: I.box, color: "#1d5f73", label: "พื้นที่ปลูกพืชทั้งหมด", value: f2(a.sums.total), unit: "ไร่" },
            { icon: I.check, color: "#b08a2c", label: `เป้าหมายร้อยละ ${K.targetPct}`, value: f2(a.sums.target), unit: "ไร่" },
            { icon: I.sprout, color: "#059669", label: "พื้นที่สะสมทั้งหมด", value: f2(a.sums.accum), unit: "ไร่" },
            { icon: I.leaf, color: "#2f8a5b", label: "ปริมาณฟางข้าว", value: f2(a.sums.straw), unit: "ตัน" },
            { icon: I.send, color: "#7a5ea8", label: "คิดเป็นมูลค่า", value: f2(a.sums.value), unit: "บาท" },
            { icon: I.box, color: "#b08a2c", label: "ฟางก้อน", value: f2(a.sums.bales), unit: "ก้อน" },
            { icon: I.send, color: "#c2410c", label: "ราคาฟางก้อน", value: f2(a.sums.baleValue), unit: "บาท" }]} />
          <section className="ux-card"><h2>{lb(cfg, "sec.area")} · {rangeLabel(from, to)} · ฤดูกาล {thaiMonth(a.season.start)} – {thaiMonth(a.season.end)} (ส่งแล้ว {a.rows.filter(r => r.any).length} จาก {a.rows.length} อำเภอ)</h2>
            <p className="ux-note">คอลัมน์รายเดือน = พื้นที่ไถกลบ (ไร่) ที่อำเภอรายงานในเดือนนั้น · พื้นที่สะสม = ผลรวมตั้งแต่ พ.ย. ถึง {thaiMonth(a.months[a.months.length - 1])} · ฟางข้าว = ไร่ × {K.strawKgPerRai} กก. ÷ 1,000 · มูลค่า = ไร่ × {K.strawValuePerRai} บาท · ฟางก้อน = ไร่ × {K.balesPerRai} ก้อน · ราคาฟางก้อน = ก้อน × {K.balePrice} บาท · แถบสี: เขียว = ครบพื้นที่ปลูกทั้งหมด ทอง = ยังไม่ครบ</p>
            <div style={{ marginTop: ".9rem" }}><AreaTable a={a} cfg={cfg} /></div></section>
        </> : <p className="ux-empty">กำลังโหลด…</p>)}

        {tab === "burn" && (b ? <>
          <KpiRow items={cfg.burnFields.slice(0, 6).map((f, i) => ({ icon: [I.alert, I.box, I.user, I.send, I.leaf, I.sprout][i % 6], color: ["#c2410c", "#1d5f73", "#059669", "#b08a2c", "#2f8a5b", "#7a5ea8"][i % 6], label: f.label, value: f2(b.sums[f.key] ?? 0), unit: f.unit }))} />
          <section className="ux-card"><h2>{lb(cfg, "sec.burn")} · {rangeLabel(from, to)} (ส่งแล้ว {b.rows.filter(r => r.any).length} จาก {b.rows.length} อำเภอ)</h2>
            <p className="ux-note">ตัวเลขคือผลรวมที่อำเภอรายงานตลอดช่วงที่เลือก (เฉพาะรายงานที่ส่งแล้ว) · เดือนที่ส่งครบ = ส่งครบทุกรอบที่จังหวัดกำหนด</p>
            <div style={{ marginTop: ".9rem" }}><BurnTable b={b} cfg={cfg} /></div></section>
        </> : <p className="ux-empty">กำลังโหลด…</p>)}

        {tab === "log" && reports && <section className="ux-card"><h2>บันทึกการส่งรายงานปุ๋ย · {rangeLabel(from, to)}</h2>
          <p className="ux-note">เรียงจากส่งล่าสุด · ใช้ตรวจว่าอำเภอไหนส่งเมื่อไรและส่งตรงเวลาหรือไม่</p>
          <div style={{ marginTop: ".9rem" }}><SubmitLog reports={reports} from={from} to={to} cfg={cfg} /></div></section>}
      </>}
    </div>
  );
}

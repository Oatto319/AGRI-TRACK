"use client";
import { useMemo, useState } from "react";
import { AREA_TARGET_PCT, areaTotalsFor, rangeLabel, thaiMonth } from "@/lib/data";
import { aggregateArea, fmt } from "@/lib/summary";
import { I, PageHead, f2 } from "@/components/Entry";
import { AreaTable, FertTable, KpiRow, SubmitLog } from "@/components/ProvinceTables";
import { FiscalSelect, useProvince } from "@/components/Province";

type Tab = "fert" | "area" | "log";

export default function ProvinceTable() {
  const { reports, area, error, from, to, valid, agg, settings } = useProvince();
  const [tab, setTab] = useState<Tab>("fert");
  const a = useMemo(() => (area && valid ? aggregateArea(area, to, areaTotalsFor(settings, to)) : null), [area, to, settings, valid]);
  const rows = agg?.rows ?? [];
  const sum = (f: (r: (typeof rows)[number]) => number) => rows.reduce((x, r) => x + f(r), 0);
  const total = sum(r => r.total), target = sum(r => r.target), sent = rows.filter(r => r.any).length;

  return (
    <div>
      <PageHead title="ตารางข้อมูลรายอำเภอ" sub="เลือกปีงบประมาณ แล้วเลือกแท็บที่ต้องการดู · ดาวน์โหลดเป็น Excel ได้จากปุ่มด้านขวา">
        <div className="ux-mfilter">
          <FiscalSelect />
          {valid && <a className="ux-btn gold" href={`/api/export?from=${from}&to=${to}`} download>ดาวน์โหลด Excel</a>}
        </div>
      </PageHead>
      {error && <p className="ux-toast bad" role="alert">{error}</p>}
      {!reports && !error && <p className="ux-empty">กำลังโหลด…</p>}
      {reports && !valid && <p className="ux-toast bad">เลือกช่วงเดือนให้ถูกต้อง (เดือนเริ่มต้องไม่เกินเดือนสิ้นสุด)</p>}

      {agg && valid && <>
        <div className="ux-seg" role="group" aria-label="เลือกตาราง">
          <button aria-pressed={tab === "fert"} onClick={() => setTab("fert")}>ปุ๋ยอินทรีย์</button>
          <button aria-pressed={tab === "area"} onClick={() => setTab("area")}>พื้นที่และฟางข้าว</button>
          <button aria-pressed={tab === "log"} onClick={() => setTab("log")}>บันทึกการส่งรายงาน</button>
        </div>

        {tab === "fert" && <>
          <KpiRow items={[
            { icon: I.leaf, color: "#1d5f73", label: "ปุ๋ยอินทรีย์รวม", value: fmt(total), unit: "ตัน" },
            { icon: I.check, color: "#b08a2c", label: "เป้าหมายรวม", value: fmt(target), unit: "ตัน" },
            { icon: I.send, color: "#059669", label: "อำเภอที่ส่งแล้ว", value: `${sent} / ${rows.length}`, unit: "อำเภอ" },
            { icon: I.alert, color: "#e11d48", label: "ส่งช้า", value: String(sum(r => r.late)), unit: "ครั้ง" }]} />
          <section className="ux-card"><h2>ปุ๋ยอินทรีย์และวัสดุอินทรีย์ · {rangeLabel(from, to)}</h2>
            <p className="ux-note">แถบความคืบหน้า: เขียว = ถึงเป้าหมายของอำเภอแล้ว · ทอง = ยังไม่ถึงเป้า · เลื่อนตารางไปทางขวาเพื่อดูทุกคอลัมน์</p>
            <div style={{ marginTop: ".9rem" }}><FertTable agg={agg} /></div></section>
        </>}

        {tab === "area" && (a ? <>
          <KpiRow items={[
            { icon: I.box, color: "#1d5f73", label: "พื้นที่ปลูกพืชทั้งหมด", value: f2(a.sums.total), unit: "ไร่" },
            { icon: I.check, color: "#b08a2c", label: `เป้าหมายร้อยละ ${AREA_TARGET_PCT}`, value: f2(a.sums.target), unit: "ไร่" },
            { icon: I.sprout, color: "#059669", label: "พื้นที่สะสมทั้งหมด", value: f2(a.sums.accum), unit: "ไร่" },
            { icon: I.leaf, color: "#2f8a5b", label: "ปริมาณฟางข้าว", value: f2(a.sums.straw), unit: "ตัน" },
            { icon: I.send, color: "#7a5ea8", label: "คิดเป็นมูลค่า", value: f2(a.sums.value), unit: "บาท" },
            { icon: I.box, color: "#b08a2c", label: "ฟางก้อน", value: f2(a.sums.bales), unit: "ก้อน" },
            { icon: I.send, color: "#c2410c", label: "ราคาฟางก้อน", value: f2(a.sums.baleValue), unit: "บาท" }]} />
          <section className="ux-card"><h2>พื้นที่และฟางข้าว · {rangeLabel(from, to)} · ฤดูกาล {thaiMonth(a.season.start)} – {thaiMonth(a.season.end)} (ส่งแล้ว {a.rows.filter(r => r.any).length} จาก {a.rows.length} อำเภอ)</h2>
            <p className="ux-note">คอลัมน์รายเดือน = พื้นที่ไถกลบ (ไร่) ที่อำเภอรายงานในเดือนนั้น · พื้นที่สะสม = ผลรวมตั้งแต่ พ.ย. ถึง {thaiMonth(a.months[a.months.length - 1])} · ฟางข้าว = ไร่ × 500 กก. ÷ 1,000 · มูลค่า = ไร่ × 725 บาท · ฟางก้อน = ไร่ × 25 ก้อน · ราคาฟางก้อน = ก้อน × 35 บาท · แถบสี: เขียว = ครบพื้นที่ปลูกทั้งหมด ทอง = ยังไม่ครบ</p>
            <div style={{ marginTop: ".9rem" }}><AreaTable a={a} /></div></section>
        </> : <p className="ux-empty">กำลังโหลด…</p>)}

        {tab === "log" && reports && <section className="ux-card"><h2>บันทึกการส่งรายงานปุ๋ย · {rangeLabel(from, to)}</h2>
          <p className="ux-note">เรียงจากส่งล่าสุด · ใช้ตรวจว่าอำเภอไหนส่งเมื่อไรและส่งตรงเวลาหรือไม่</p>
          <div style={{ marginTop: ".9rem" }}><SubmitLog reports={reports} from={from} to={to} /></div></section>}
      </>}
    </div>
  );
}

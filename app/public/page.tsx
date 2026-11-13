"use client";
import Link from "next/link";
import Skeleton from "@/components/Skeleton";
import { useEffect, useMemo, useState } from "react";
import { thaiMonth, thaiMonthShort } from "@/lib/data";
import type { PublicSummary } from "@/lib/public";
import { buildTrend } from "@/lib/trend";
import { fmt } from "@/lib/summary";
import DistrictMap, { type MapDatum } from "@/components/DistrictMap";
import FontSize from "@/components/FontSize";
import Hint from "@/components/Hint";
import TrendChart from "@/components/TrendChart";
import { PV_COLORS, RankBoard, TypeDonut } from "@/components/ProvinceCharts";

// หน้าสาธารณะ: ดูภาพรวมผลงานทั้งจังหวัดได้โดยไม่ต้องเข้าสู่ระบบ — แสดงเฉพาะยอดรวม ไม่มีข้อมูลผู้รายงานหรือสถานะการส่ง
export default function PublicDashboard() {
  const [fy, setFy] = useState<number | null>(null);
  const [data, setData] = useState<PublicSummary | null>(null);
  const [error, setError] = useState("");
  const [topic, setTopic] = useState<"fert" | "area">("fert");

  useEffect(() => {
    let live = true;
    fetch(`/api/public/summary${fy ? `?fy=${fy}` : ""}`)
      .then(async r => { if (!r.ok) throw new Error(r.status === 404 ? "ขณะนี้ไม่เปิดให้ดูข้อมูลสาธารณะ" : "โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่ภายหลัง"); return (await r.json()) as PublicSummary; })
      .then(d => { if (live) { setData(d); setError(""); } })
      .catch(e => { if (live) setError(e instanceof Error ? e.message : "โหลดข้อมูลไม่สำเร็จ"); });
    return () => { live = false; };
  }, [fy]);

  const fertTrend = useMemo(() => (data ? buildTrend(data.fert.months, data.fert.monthly, data.fert.target) : null), [data]);
  const areaTrend = useMemo(() => (data ? buildTrend(data.area.months, data.area.monthly, data.area.target) : null), [data]);
  const mapData: MapDatum[] = !data ? [] : topic === "fert"
    ? data.fert.byDistrict.map(d => ({ name: d.name, value: d.target > 0 ? d.pct : null, detail: d.target > 0 ? `ปุ๋ยอินทรีย์ ${fmt(d.total)} ตัน จากเป้า ${fmt(d.target)} ตัน (${Math.round(d.pct)}%)` : "ยังไม่ได้ตั้งเป้า" }))
    : data.area.byDistrict.map(d => ({ name: d.name, value: d.target > 0 ? d.ofTarget : null, detail: d.target > 0 ? `ไถกลบสะสม ${fmt(d.accum)} ไร่ จากเป้า ${fmt(d.target)} ไร่ (${Math.round(d.ofTarget)}%)` : "ยังไม่มีข้อมูลเป้าหมาย" }));
  const top10 = data ? [...data.fert.byDistrict].filter(d => d.total > 0).sort((a, b) => b.total - a.total).slice(0, 10) : [];
  const label = (m: string) => thaiMonthShort(m);

  return (
    <div className="pub">
      <header className="pub-top">
        <div><b>ผลการดำเนินงานปุ๋ยอินทรีย์และการไถกลบฟางข้าว</b><small>สำนักงานเกษตรจังหวัดศรีสะเกษ</small></div>
        <div className="pub-tools"><FontSize light /><Link className="pub-login" href="/">เจ้าหน้าที่เข้าสู่ระบบ</Link></div>
      </header>
      <main className="pub-main pv">
        <div className="pv-head">
          <h1>ภาพรวมผลงานทั้งจังหวัด</h1>
          {data && <div className="field"><label htmlFor="pfy">ปีงบประมาณ</label>
            <select id="pfy" value={data.fy} onChange={e => setFy(Number(e.target.value))}>{data.years.map(y => <option key={y} value={y}>ปีงบประมาณ {y}</option>)}</select></div>}
        </div>
        {error && <p className="msg bad" role="alert">{error}</p>}
        {!data && !error && <Skeleton />}

        {data && fertTrend && areaTrend && (<>
          <p className="pb-lead">สรุปผลงานของทุกอำเภอในจังหวัด ช่วง {thaiMonth(data.fert.from)} – {thaiMonth(data.fert.to)} · ตัวเลขรวมจากรายงานที่อำเภอส่งแล้ว</p>

          <section className="pb-kpis" aria-label="ตัวเลขสำคัญ">
            <div className="pb-kpi">
              <small>ปุ๋ยอินทรีย์ที่ผลิตได้<Hint term="ปุ๋ยอินทรีย์">ปุ๋ยที่ทำจากวัสดุธรรมชาติ เช่น ปุ๋ยคอก ปุ๋ยหมัก ปุ๋ยพืชสด</Hint></small>
              <b>{fmt(data.fert.total)}<span> ตัน</span></b>
              <div className="pb-bar" role="img" aria-label={`บรรลุเป้าหมาย ${Math.round(data.fert.pct)} เปอร์เซ็นต์`}><i style={{ width: `${Math.min(100, data.fert.pct)}%` }} /></div>
              <em>{Math.round(data.fert.pct)}% ของเป้าหมาย {fmt(data.fert.target)} ตัน</em>
            </div>
            <div className="pb-kpi">
              <small>พื้นที่ที่ไถกลบฟางข้าวแล้ว<Hint term="ไถกลบฟางข้าว">การไถฟางที่เหลือหลังเกี่ยวข้าวลงดินแทนการเผา ช่วยบำรุงดิน</Hint></small>
              <b>{fmt(data.area.accum)}<span> ไร่</span></b>
              <div className="pb-bar" role="img" aria-label={`ไถกลบแล้ว ${Math.round(data.area.pct)} เปอร์เซ็นต์ของพื้นที่ปลูก`}><i style={{ width: `${Math.min(100, data.area.pct)}%` }} /></div>
              <em>{Math.round(data.area.pct)}% ของพื้นที่ปลูกทั้งหมด {fmt(data.area.total)} ไร่</em>
            </div>
            <div className="pb-kpi">
              <small>ฟางข้าวที่ได้จากการไถกลบ</small>
              <b>{fmt(data.area.straw)}<span> ตัน</span></b>
              <em>คำนวณจากพื้นที่ที่ไถกลบ</em>
            </div>
            <div className="pb-kpi gold">
              <small>คิดเป็นมูลค่า</small>
              <b>{fmt(data.area.value)}<span> บาท</span></b>
              <em>คำนวณจากพื้นที่ที่ไถกลบ</em>
            </div>
          </section>

          <section className="pb-map" aria-label="แผนที่ผลงานรายอำเภอ">
            <div className="pb-map-head">
              <h2>ผลงานแต่ละอำเภอ</h2>
              <div className="pv-maptog" role="group" aria-label="เลือกหัวข้อที่แสดงบนแผนที่">
                <button type="button" aria-pressed={topic === "fert"} onClick={() => setTopic("fert")}>ปุ๋ยอินทรีย์</button>
                <button type="button" aria-pressed={topic === "area"} onClick={() => setTopic("area")}>ไถกลบฟางข้าว</button>
              </div>
            </div>
            <p className="pb-map-sub">สีเข้ม = ทำได้ใกล้เป้าหมายหรือถึงเป้าแล้ว · แตะที่อำเภอเพื่อดูตัวเลข</p>
            <DistrictMap data={mapData} caption="แผนที่จังหวัดศรีสะเกษ แสดงร้อยละเทียบเป้าหมายรายอำเภอ" />
          </section>

          <details className="pb-more">
            <summary>ดูรายละเอียดเพิ่มเติม <span>แนวโน้มรายเดือน · อันดับอำเภอ · สัดส่วนชนิดปุ๋ย{data.burn.items.some(b => b.value > 0) ? " · การรณรงค์หยุดเผา" : ""}</span></summary>
            <div className="pv-trend">
              <section className="pv-card"><h2>แนวโน้มปุ๋ยอินทรีย์สะสม</h2><TrendChart trend={fertTrend} unit="ตัน" title="แนวโน้มปุ๋ยอินทรีย์สะสม" labelOf={label} /></section>
              <section className="pv-card"><h2>แนวโน้มพื้นที่ไถกลบสะสม</h2><TrendChart trend={areaTrend} unit="ไร่" title="แนวโน้มพื้นที่ไถกลบสะสม" labelOf={label} /></section>
            </div>
            <div className="pv-main">
              <section className="pv-card pv-rank">
                <h2>10 อันดับอำเภอผลผลิตปุ๋ยสูงสุด</h2>
                {top10.length === 0 ? <p className="pv-empty">ยังไม่มีข้อมูลในช่วงนี้</p> : <RankBoard rows={top10.map(d => ({ name: d.name, value: d.total, pct: d.pct }))} />}
              </section>
              <div className="pv-col">
                <section className="pv-card"><h2>สัดส่วนตามชนิดปุ๋ย</h2><TypeDonut unit="ตัน" parts={data.fert.parts.map((p, i) => ({ ...p, color: PV_COLORS[i % PV_COLORS.length] }))} /></section>
                {data.burn.items.some(b => b.value > 0) && (
                  <section className="pv-card"><h2>การรณรงค์หยุดเผา</h2>
                    <ul className="pv-mini" style={{ listStyle: "none", padding: 0, display: "grid", gap: ".5rem" }}>{data.burn.items.map(b => <li key={b.label}><small>{b.label}</small><b style={{ display: "block" }}>{fmt(b.value)} {b.unit}</b></li>)}</ul></section>)}
              </div>
            </div>
          </details>
          <p className="pub-foot">ข้อมูลรวมจากรายงานที่อำเภอส่งแล้ว · อัปเดตล่าสุด {new Date(data.generatedAt).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" })} น.</p>
        </>)}
      </main>
    </div>);
}

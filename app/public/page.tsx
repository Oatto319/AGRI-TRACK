"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { thaiMonth, thaiMonthShort } from "@/lib/data";
import type { PublicSummary } from "@/lib/public";
import { buildTrend } from "@/lib/trend";
import { fmt } from "@/lib/summary";
import DistrictMap, { type MapDatum } from "@/components/DistrictMap";
import TrendChart from "@/components/TrendChart";
import { PV_COLORS, RankBoard, Ring, TypeDonut } from "@/components/ProvinceCharts";

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
        <Link className="pub-login" href="/">เจ้าหน้าที่เข้าสู่ระบบ</Link>
      </header>
      <main className="pub-main pv">
        <div className="pv-head">
          <h1>ภาพรวมผลงานทั้งจังหวัด</h1>
          {data && <div className="field"><label htmlFor="pfy">ปีงบประมาณ</label>
            <select id="pfy" value={data.fy} onChange={e => setFy(Number(e.target.value))}>{data.years.map(y => <option key={y} value={y}>ปีงบประมาณ {y}</option>)}</select></div>}
        </div>
        {error && <p className="msg bad" role="alert">{error}</p>}
        {!data && !error && <p className="pv-load">กำลังโหลดข้อมูล...</p>}

        {data && fertTrend && areaTrend && (<>
          <section className="pv-kpis pv-kpis3" aria-label="ตัวเลขสำคัญ">
            <div className="pv-hero">
              <div className="hd"><small>ปุ๋ยอินทรีย์และวัสดุอินทรีย์ทั้งจังหวัด</small></div>
              <b>{fmt(data.fert.total)} <span>ตัน</span></b>
              <div className="pg" role="img" aria-label={`บรรลุเป้าหมาย ${Math.round(data.fert.pct)} เปอร์เซ็นต์`}><i style={{ width: `${Math.min(100, data.fert.pct)}%` }} /></div>
              <div className="ft"><span>เป้าหมาย {fmt(data.fert.target)} ตัน</span><span>{Math.round(data.fert.pct)}%</span></div>
              <div className="tags"><em>ช่วง {thaiMonth(data.fert.from)} – {thaiMonth(data.fert.to)}</em></div>
            </div>
            <div className="pv-kpi teal">
              <div><small>พื้นที่ไถกลบฟางข้าวสะสม</small><b>{fmt(data.area.accum)} <span>ไร่</span></b><em>จากพื้นที่ปลูกทั้งหมด {fmt(data.area.total)} ไร่</em></div>
              <Ring pct={Math.round(data.area.pct)} label={`ไถกลบแล้ว ${Math.round(data.area.pct)} เปอร์เซ็นต์ของพื้นที่ปลูก`} />
            </div>
            <div className="pv-kpi gold">
              <div><small>ฟางข้าวที่ได้จากการไถกลบ</small><b>{fmt(data.area.straw)} <span>ตัน</span></b><em>คิดเป็นมูลค่า {fmt(data.area.value)} บาท</em></div>
            </div>
          </section>

          <div className="pv-trend">
            <section className="pv-card">
              <h2>แผนที่ผลงานรายอำเภอ</h2>
              <div className="pv-maptog" role="group" aria-label="เลือกหัวข้อที่แสดงบนแผนที่">
                <button type="button" aria-pressed={topic === "fert"} onClick={() => setTopic("fert")}>ปุ๋ยอินทรีย์ (% ของเป้า)</button>
                <button type="button" aria-pressed={topic === "area"} onClick={() => setTopic("area")}>ไถกลบฟางข้าว (% ของเป้า)</button>
              </div>
              <DistrictMap data={mapData} caption="แผนที่จังหวัดศรีสะเกษ แสดงร้อยละเทียบเป้าหมายรายอำเภอ" />
            </section>
            <div className="pv-col">
              <section className="pv-card"><h2>แนวโน้มปุ๋ยอินทรีย์สะสม</h2><TrendChart trend={fertTrend} unit="ตัน" title="แนวโน้มปุ๋ยอินทรีย์สะสม" labelOf={label} /></section>
              <section className="pv-card"><h2>แนวโน้มพื้นที่ไถกลบสะสม</h2><TrendChart trend={areaTrend} unit="ไร่" title="แนวโน้มพื้นที่ไถกลบสะสม" labelOf={label} /></section>
            </div>
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
          <p className="pub-foot">ข้อมูลรวมจากรายงานที่อำเภอส่งแล้ว · อัปเดตล่าสุด {new Date(data.generatedAt).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" })} น.</p>
        </>)}
      </main>
    </div>);
}

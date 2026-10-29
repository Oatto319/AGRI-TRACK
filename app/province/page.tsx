"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { areaTotalsFor, cfgOfMonth, dueDaysFor, fiscalYearOf, thaiMonth } from "@/lib/data";
import { aggregate, aggregateArea, fmt } from "@/lib/summary";
import { AreaCombo, AreaHBars, FertCompareBars, Icons, PV_COLORS, RankBoard, Ring, Sparkline, StatusBar, TypeDonut, cumulate } from "@/components/ProvinceCharts";
import { FilterBar, useProvince } from "@/components/Province";
import ProgressCards from "@/components/ProgressCards";
import DistrictMap, { type MapDatum } from "@/components/DistrictMap";
import TrendChart from "@/components/TrendChart";
import { buildTrend } from "@/lib/trend";
import { scanReports } from "@/lib/anomaly";

const f2 = (v: number) => v.toLocaleString("th-TH", { maximumFractionDigits: 2 });
const SHORT = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
// ป้ายเดือนบนกราฟ: ถ้าช่วงที่เลือกข้ามปี ให้ต่อท้ายด้วย พ.ศ. 2 หลัก
const monthLabel = (ym: string, multiYear: boolean) => {
  const [y, m] = ym.split("-").map(Number);
  return multiYear ? `${SHORT[m - 1]} ${(y + 543) % 100}` : SHORT[m - 1];
};

export default function ProvinceDashboard() {
  const { reports, area, error, from, to, valid, agg, settings } = useProvince();
  const shiftYear = (ym: string, n: number) => `${Number(ym.slice(0, 4)) + n}${ym.slice(4)}`;
  const cfg = useMemo(() => cfgOfMonth(settings, to), [settings, to]), FIELDS = cfg.fertFields, AREA_TARGET_PCT = cfg.area.targetPct;

  const rows = agg?.rows ?? [];
  const sum = (f: (r: (typeof rows)[number]) => number) => rows.reduce((a, r) => a + f(r), 0);
  const total = sum(r => r.total);
  const target = sum(r => r.target);
  const sent = rows.filter(r => r.any).length;
  const late = sum(r => r.late);
  const reachedF = rows.filter(r => r.target > 0 && r.total >= r.target).length; // อำเภอที่ผลิตปุ๋ยถึงเป้าของตัวเอง
  const reachedPct = rows.length ? Math.round((reachedF / rows.length) * 100) : 0;
  const pct = target ? Math.min(100, Math.round((total / target) * 100)) : 0;

  const ar = useMemo(() => (area && valid ? aggregateArea(area, to, areaTotalsFor(settings, to), cfg.area) : null), [area, to, settings, valid, cfg]);

  // กราฟข้อมูลไถกลบและต่อซังข้าว: พื้นที่รายเดือน + สะสม (ทั้งจังหวัด) และเทียบรายอำเภอ
  const areaSeries = cumulate(ar?.months ?? [], (ar?.months ?? []).map(m => (ar?.rows ?? []).reduce((a, r) => a + (r.byMonth[m] ?? 0), 0)));
  const areaRank = [...(ar?.rows ?? [])].filter(r => r.accum > 0).sort((a, b) => b.accum - a.accum).slice(0, 10);
  const reached = (ar?.rows ?? []).filter(r => r.target > 0 && r.accum >= r.target).length;
  const below = (ar?.rows ?? []).filter(r => r.accum > 0 && !(r.target > 0 && r.accum >= r.target)).length;
  const noData = (ar?.rows ?? []).filter(r => r.accum <= 0).length;

  const multiYear = valid && from.slice(0, 4) !== to.slice(0, 4);
  const monthly = (agg?.months ?? []).map(m => ({ label: monthLabel(m, multiYear), value: sum(r => r.byMonth[m] ?? 0) }));
  const cmpLabel = (back: number) => !valid ? (back ? "ปีก่อน" : "ปีนี้") : fiscalYearOf(from) === fiscalYearOf(to) ? `ปีงบฯ ${fiscalYearOf(to) + back}` : `${Number(from.slice(0, 4)) + 543 + back}–${Number(to.slice(0, 4)) + 543 + back}`;
  // เทียบกับช่วงเดียวกันของปีก่อนหน้า (เลื่อนย้อนหลัง 1 ปี)
  const prevAgg = useMemo(() => (reports && valid ? aggregate(reports, shiftYear(from, -1), shiftYear(to, -1), dueDaysFor(settings, "fert", shiftYear(to, -1)).length, cfgOfMonth(settings, shiftYear(to, -1))) : null), [reports, from, to, valid, settings]);
  const compare = (agg?.months ?? []).map(m => ({ label: monthLabel(m, multiYear), cur: sum(r => r.byMonth[m] ?? 0),
    prev: (prevAgg?.rows ?? []).reduce((a, r) => { const pm = prevAgg?.months.find(x => x.slice(5) === m.slice(5)); return a + (pm ? r.byMonth[pm] ?? 0 : 0); }, 0) })); // จับคู่เดือนเดียวกันของปีก่อน (จำนวนเดือนของแต่ละปีอาจไม่เท่ากัน)
  const top10 = [...rows].filter(r => r.total > 0).sort((a, b) => b.total - a.total).slice(0, 10);
  const yearTxt = valid ? (fiscalYearOf(from) === fiscalYearOf(to) ? `ปีงบประมาณ ${fiscalYearOf(to)}` : multiYear ? `${Number(from.slice(0, 4)) + 543}–${Number(to.slice(0, 4)) + 543}` : `${Number(to.slice(0, 4)) + 543}`) : "";
  const rounds = agg?.rounds ?? 1;

  // แผนที่รายอำเภอ + แนวโน้มสะสมเทียบเป้า + ค่าที่ควรตรวจสอบ
  const [mapTopic, setMapTopic] = useState<"fert" | "area">("fert");
  const fertMonthly = Object.fromEntries((agg?.months ?? []).map(m => [m, rows.some(r => r.byMonth[m] !== null) ? sum(r => r.byMonth[m] ?? 0) : null]));
  const fertTrend = buildTrend(agg?.months ?? [], fertMonthly, target);
  const areaTrend = buildTrend(ar?.months ?? [], Object.fromEntries((ar?.months ?? []).map(m => { const v = (ar?.rows ?? []).reduce((a, r) => a + (r.byMonth[m] ?? 0), 0); return [m, v > 0 ? v : null]; })), ar?.sums.target ?? 0);
  const mapData: MapDatum[] = mapTopic === "fert"
    ? rows.map(r => ({ name: r.name, value: r.target > 0 ? (r.total / r.target) * 100 : null, detail: r.target > 0 ? `ปุ๋ยสะสม ${f2(r.total)} จากเป้า ${f2(r.target)} ตัน (${Math.round((r.total / r.target) * 100)}%)` : "ยังไม่ได้ตั้งเป้า" }))
    : (ar?.rows ?? []).map(r => ({ name: r.name, value: r.target > 0 ? r.ofTarget : null, detail: r.target > 0 ? `ไถกลบสะสม ${f2(r.accum)} จากเป้า ${f2(r.target)} ไร่ (${Math.round(r.ofTarget)}%)` : "ยังไม่ได้ตั้งพื้นที่ปลูก/เป้า" }));
  const anomalies = useMemo(() => (reports && valid ? scanReports(reports, FIELDS, from, to, "ตัน") : []), [reports, valid, from, to, FIELDS]);

  const areaRows = ar ? [
    { icon: Icons.field, color: "#297b48", label: "พื้นที่ปลูกพืชทั้งหมด", value: `${f2(ar.sums.total)} ไร่`, bar: ar.sums.total > 0 ? 100 : 0, sub: ar.sums.assigned ? "จังหวัดเป็นผู้กำหนด" : "ยังไม่ได้กำหนดครบ · ใช้พื้นที่สะสมแทน (ตั้งค่าได้ที่หน้า 3)" },
    { icon: Icons.target, color: "#c09a3a", label: `เป้าหมายร้อยละ ${AREA_TARGET_PCT}`, value: `${f2(ar.sums.target)} ไร่`, bar: ar.sums.total > 0 ? AREA_TARGET_PCT : 0, sub: ar.sums.assigned ? undefined : "คิดจากพื้นที่สะสมทั้งหมด" },
    { icon: Icons.check, color: "#2f8f5b", label: "พื้นที่สะสมทั้งหมด", value: `${f2(ar.sums.accum)} ไร่`, bar: Math.min(100, ar.pct), sub: `คิดเป็น ${f2(ar.pct)}% ของพื้นที่ปลูกพืชทั้งหมด` },
    { icon: Icons.straw, color: "#b36a3c", label: "ปริมาณฟางข้าว", value: `${f2(ar.sums.straw)} ตัน`, sub: `คิดเป็นมูลค่า ${f2(ar.sums.value)} บาท` },
  ] : [];

  return (
    <div className="pv">
      <div className="pv-head">
        <h1>แดชบอร์ดข้อมูลจังหวัด</h1>
        <FilterBar pdf />
      </div>

      {error && <p className="msg bad" role="alert">{error}</p>}
      {!reports && !area && !error && <p className="pv-load">กำลังโหลดข้อมูล...</p>}
      {((reports && !valid) || (area && !valid)) && <p className="msg bad" role="alert">เลือกช่วงเดือนให้ถูกต้อง</p>}

      {agg && (
        <>
          {/* ปุ๋ยอินทรีย์: การ์ดหลัก + ตัวชี้วัด */}
          <h2 className="pv-sec" style={{ marginTop: 0 }}>ปุ๋ยอินทรีย์และวัสดุอินทรีย์ · {yearTxt}</h2>
          <section className="pv-kpis pv-kpis3" aria-label="ตัวเลขสำคัญ">
            <div className="pv-hero">
              <div className="hd"><span className="ic">{Icons.field}</span><small>ปุ๋ยอินทรีย์ทั้งหมด (สะสมในช่วงที่เลือก)</small></div>
              <b>{fmt(total)} <span>ตัน</span></b>
              <div className="pg" role="img" aria-label={`บรรลุเป้าหมาย ${pct} เปอร์เซ็นต์`}><i style={{ width: `${pct}%` }} /></div>
              <div className="ft"><span>เป้าหมาย {fmt(target)} ตัน</span><span>{pct}%</span></div>
              <div className="tags">
                <em>{target > total ? `ขาดอีก ${fmt(target - total)} ตัน` : "บรรลุเป้าหมายแล้ว"}</em>
                <em>{late ? `ส่งช้า ${late} ครั้ง` : "ไม่มีรายการส่งช้า"}</em>
              </div>
            </div>
            <div className="pv-kpi teal">
              <div><small>อำเภอที่ส่งรายงานแล้ว</small><b>{sent} <span>/ {rows.length} อำเภอ</span></b><em>{sent < rows.length ? `ยังไม่ส่ง ${rows.length - sent} อำเภอ` : "ส่งครบทุกอำเภอ"}</em></div>
              <Ring pct={rows.length ? Math.round((sent / rows.length) * 100) : 0} label="อำเภอที่ส่งรายงานแล้ว" />
            </div>
            <div className="pv-kpi gold">
              <div><small>อำเภอที่ถึงเป้าปุ๋ย</small><b>{reachedF} <span>/ {rows.length} อำเภอ</span></b><em>เทียบเป้าของแต่ละอำเภอ</em></div>
              <Ring pct={reachedPct} label={`อำเภอที่ถึงเป้าปุ๋ย ${reachedPct} เปอร์เซ็นต์`} />
            </div>
          </section>

          {/* ใกล้ถึงเป้า / ต่ำกว่าเป้า รายอำเภอ: การ์ดเดียว สลับหัวข้อได้ */}
          <ProgressCards sets={[
            { key: "fert", label: "ปุ๋ยอินทรีย์", unit: "ตัน", note: `ปริมาณสะสมเทียบเป้า (เกษตรตำบล × ${fmt(cfg.targetPerTambon)} ตัน)`, rows: rows.map(r => ({ name: r.name, value: r.total, target: r.target, hasTarget: r.target > 0 })) },
            ...(ar ? [{ key: "area", label: "ไถกลบฟางข้าว", unit: "ไร่", note: `พื้นที่สะสมเทียบเป้าร้อยละ ${AREA_TARGET_PCT} ของพื้นที่ปลูกพืชทั้งหมด · อำเภอที่ยังไม่ตั้งพื้นที่ปลูกจะแสดงว่ายังไม่ตั้งเป้า`, rows: ar.rows.map(r => ({ name: r.name, value: r.accum, target: r.target, hasTarget: r.assigned })) }] : []),
          ]} />

          {/* แผนที่รายอำเภอ + แนวโน้มสะสมเทียบเป้าหมาย */}
          <h2 className="pv-sec">แผนที่และแนวโน้มเทียบเป้าหมาย · {yearTxt}</h2>
          <div className="pv-trend">
            <section className="pv-card">
              <h2>แผนที่ผลงานรายอำเภอ</h2>
              <div className="pv-maptog" role="group" aria-label="เลือกหัวข้อที่แสดงบนแผนที่">
                <button type="button" aria-pressed={mapTopic === "fert"} onClick={() => setMapTopic("fert")}>ปุ๋ยอินทรีย์ (% ของเป้า)</button>
                <button type="button" aria-pressed={mapTopic === "area"} onClick={() => setMapTopic("area")} disabled={!ar}>ไถกลบฟางข้าว (% ของเป้า)</button>
              </div>
              <DistrictMap data={mapData} caption={`แผนที่จังหวัดศรีสะเกษ แสดงร้อยละเทียบเป้าหมาย${mapTopic === "fert" ? "ปุ๋ยอินทรีย์" : "ไถกลบฟางข้าว"}รายอำเภอ`} />
            </section>
            <div className="pv-col">
              <section className="pv-card"><h2>แนวโน้มปุ๋ยอินทรีย์สะสม</h2><p className="pv-note">ทั้งจังหวัด เทียบเป้าหมาย {fmt(target)} ตัน</p><TrendChart trend={fertTrend} unit="ตัน" title="แนวโน้มปุ๋ยอินทรีย์สะสม" labelOf={m => monthLabel(m, multiYear)} /></section>
              {ar && <section className="pv-card"><h2>แนวโน้มพื้นที่ไถกลบสะสม</h2><p className="pv-note">ทั้งจังหวัด เทียบเป้าหมายร้อยละ {AREA_TARGET_PCT} ของพื้นที่ปลูกพืชทั้งหมด</p><TrendChart trend={areaTrend} unit="ไร่" title="แนวโน้มพื้นที่ไถกลบสะสม" labelOf={m => monthLabel(m, ar.months[0].slice(0, 4) !== ar.months[ar.months.length - 1].slice(0, 4))} /></section>}
            </div>
          </div>

          {/* 10 อันดับ + โดนัท + กราฟแท่ง */}
          <div className="pv-main">
            <section className="pv-card pv-rank">
              <h2>10 อันดับอำเภอผลผลิตสูงสุด</h2>
              <p className="pv-note">ใช้ข้อมูลปุ๋ยอินทรีย์สะสมในช่วงที่เลือก</p>
              {top10.length === 0 ? <p className="pv-empty">ยังไม่มีข้อมูลในช่วงนี้</p> : <RankBoard rows={top10.map(r => ({ name: r.name, value: r.total, pct: r.target ? (r.total / r.target) * 100 : 0 }))} />}
              <div className="pv-spark-wrap">
                <Sparkline values={monthly.map(m => m.value)} />
                <small>แนวโน้มรายเดือน {yearTxt}</small>
              </div>
            </section>

            <div className="pv-col">
              <section className="pv-card">
                <h2>สัดส่วนตามชนิด</h2>
                <TypeDonut unit="ตัน" parts={FIELDS.map((f, i) => ({ label: f.label, value: sum(r => r.sums[f.key]), color: PV_COLORS[i % PV_COLORS.length] }))} />
              </section>
              <section className="pv-card">
                <h2>ผลผลิตรายเดือน</h2>
                <FertCompareBars data={compare} prevLabel={cmpLabel(-1)} curLabel={cmpLabel(0)} unit="ตัน" />
              </section>
            </div>
          </div>

          {/* กราฟข้อมูลไถกลบและต่อซังข้าว */}
          {ar && (
            <>
              <h2 className="pv-sec">ข้อมูลไถกลบและต่อซังข้าว · ฤดูกาล {thaiMonth(ar.season.start)} – {thaiMonth(ar.season.end)}</h2>
              <div className="pv-areamain">
                <section className="pv-card">
                  <h2>พื้นที่ไถกลบรายเดือนและพื้นที่สะสม</h2>
                  <p className="pv-note">แท่ง = พื้นที่ที่รายงานในเดือนนั้น (แกนซ้าย) · เส้น = พื้นที่สะสมตั้งแต่ พ.ย. (แกนขวา)</p>
                  <AreaCombo data={areaSeries} target={ar.sums.target} />
                  <p className="pv-lg"><span><i style={{ background: "#297b48" }} />พื้นที่รายเดือน (ไร่)</span><span><i className="ln" style={{ background: "#c09a3a" }} />พื้นที่สะสม (ไร่)</span><span><i className="ds" />เป้าหมายร้อยละ {AREA_TARGET_PCT}</span></p>
                </section>
                <section className="pv-card">
                  <h2>ความคืบหน้าเทียบเป้าหมายรายอำเภอ</h2>
                  <p className="pv-note">สถานะ {ar.rows.length} อำเภอ · เทียบพื้นที่สะสมกับเป้าหมายร้อยละ {AREA_TARGET_PCT}</p>
                  <StatusBar parts={[{ label: "ถึงเป้า", value: reached, color: "#297b48" }, { label: "ยังไม่ถึงเป้า", value: below, color: "#c09a3a" }, { label: "ยังไม่มีข้อมูล", value: noData, color: "#d5dcd0" }]} />
                  {areaRank.length === 0 ? <p className="pv-empty">ยังไม่มีข้อมูลในช่วงนี้</p> : <AreaHBars rows={areaRank} />}
                  {areaRank.length > 0 && <p className="pv-key"><i style={{ background: "#297b48" }} />ถึงเป้าแล้ว <i style={{ background: "#c09a3a" }} />ยังไม่ถึงเป้า <i style={{ background: "#b36a3c", width: 3 }} />เส้นเป้าหมาย · 10 อันดับพื้นที่สะสมสูงสุด (ไร่)</p>}
                  <div className="pv-mini">
                    <div><small>ฟางข้าว</small><b>{f2(ar.sums.straw)} ตัน</b></div>
                    <div><small>มูลค่า</small><b>{f2(ar.sums.value)} บาท</b></div>
                    <div><small>ฟางก้อน</small><b>{f2(ar.sums.bales)} ก้อน</b></div>
                    <div><small>ราคาฟางก้อน</small><b>{f2(ar.sums.baleValue)} บาท</b></div>
                  </div>
                </section>
              </div>
            </>
          )}

          {/* พื้นที่และฟางข้าว + สถานะการส่งข้อมูล */}
          <div className="pv-bottom">
            <section className="pv-card">
              <h2>พื้นที่และฟางข้าว</h2>
              {ar && <p className="pv-note">ฤดูกาล {thaiMonth(ar.season.start)} – {thaiMonth(ar.season.end)} · สะสมถึง {thaiMonth(ar.months[ar.months.length - 1])}</p>}
              <ul className="pv-area">{areaRows.map(a => (
                <li key={a.label}>
                  <span className="ic" style={{ background: a.color }}>{a.icon}</span>
                  <div className="tx">
                    <div className="ln"><span>{a.label}</span><b>{a.value}</b></div>
                    {a.bar !== undefined && <div className="tk" aria-hidden="true"><i style={{ width: `${a.bar}%`, background: a.color }} /></div>}
                    {a.sub && <small>{a.sub}</small>}
                  </div>
                </li>))}
              </ul>
            </section>

            <section className="pv-card">
              <h2>สถานะการส่งข้อมูล</h2>
              <ul className="pv-chips">{rows.map(r => {
                const g = r.got[to] ?? 0, st = g >= rounds ? "ok" : g > 0 ? "part" : "no";
                const txt = st === "ok" ? "ส่งครบ" : st === "part" ? `ส่งแล้ว ${g}/${rounds} รอบ` : "ยังไม่ส่ง";
                return <li key={r.name} className={st} title={`${r.name}: ${txt}`}>{r.name}{st === "part" ? ` (${g}/${rounds})` : ""}</li>;
              })}</ul>
              <p className="pv-key"><i className="ok" />ส่งครบ <i className="part" />ส่งบางรอบ <i className="no" />ยังไม่ส่ง</p>
            </section>
          </div>

          {anomalies.length > 0 && (
            <section className="pv-card" style={{ marginTop: "1rem" }}>
              <h2>ค่าที่ควรตรวจสอบ ({anomalies.length})</h2>
              <p className="pv-note">รายงานที่ส่งแล้วซึ่งสูง/ต่ำผิดปกติเมื่อเทียบกับประวัติของอำเภอนั้นเอง · เป็นข้อสังเกตให้ตรวจซ้ำ ไม่ได้แปลว่าผิดเสมอไป</p>
              <ul className="pv-warn" style={{ listStyle: "none", padding: 0, margin: ".5rem 0 0" }}>{anomalies.slice(0, 12).map(a => (
                <li key={`${a.district}-${a.month}-${a.round}-${a.key}`} className={a.level}><b>{a.district}</b> · {thaiMonth(a.month)}{rounds > 1 ? ` รอบ ${a.round}` : ""} — {a.message}</li>))}</ul>
              {anomalies.length > 12 && <p className="pv-note">และอีก {anomalies.length - 12} รายการ</p>}
            </section>)}

          <div className="pv-foot">
            <Link className="pv-go" href="/province/table">ดูตารางข้อมูลรายละเอียดทั้งหมด (หน้าที่ 2) {Icons.arrow}</Link>
          </div>
        </>
      )}
    </div>
  );
}
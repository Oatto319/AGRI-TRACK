"use client";
import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AREA_FIELDS, DEFAULT_SETTINGS, areaTotalsFor, cfgOf, cfgOfMonth, currentMonth, dueDateOf, dueDaysFor, fiscalRange, fiscalYearOf, fiscalYearOptions, isAreaMonth, baleValue, strawBales, strawTons, strawValue, thaiDate, thaiDateTime, thaiMonth, type AreaReport, type BurnReport, type Report, type Settings, type Topic } from "@/lib/data";
import { aggregate, aggregateArea, fmt, sumValues } from "@/lib/summary";
import { AreaCombo, AreaHBars, BarChart, FertCompareBars, PV_COLORS, TypeDonut, cumulate, monthShort } from "@/components/ProvinceCharts";
import { useDistrict } from "@/components/District";
import { I } from "@/components/Entry";

const f2 = (v: number) => v.toLocaleString("th-TH", { maximumFractionDigits: 2 });
type TabKey = "fert" | "area" | "burn";
interface Task {
  key: TabKey; title: string; icon: ReactNode; color: string; sub: string;
  status?: string; late?: boolean; submittedAt?: string; done: number; total: number;
  line: ReactNode; miss: ReactNode; href: string; cta: string; inactive?: boolean;
}

interface Row { key: string; topic: TabKey; topicLabel: string; month: string; round: number; due: string; submittedAt?: string; st: "submitted" | "late" | "draft" | "none" | "future"; href: string }
const TOPIC_LABEL: Record<TabKey, string> = { fert: "ปุ๋ยอินทรีย์", area: "ไถกลบฟางข้าว", burn: "หยุดเผา" };
const ST_LABEL: Record<Row["st"], string> = { submitted: "ส่งแล้ว", late: "ส่งช้า", draft: "ร่าง", none: "ยังไม่ส่ง", future: "ยังไม่ถึงกำหนด" };
const ST_CLASS: Record<Row["st"], string> = { submitted: "ok", late: "bad", draft: "warn", none: "bad", future: "mute" };
const PAGE = 8;

/** ป้ายเปลี่ยนแปลงเทียบปีงบประมาณก่อนหน้า (ขึ้น = ดีขึ้น) */
function Delta({ cur, prev }: { cur: number; prev: number }) {
  if (!(prev > 0)) return <span className="ad-delta mute">ไม่มีข้อมูลปีก่อน</span>;
  const p = ((cur - prev) / prev) * 100, up = p >= 0;
  return <span className={`ad-delta ${up ? "up" : "down"}`}>{up ? "▲" : "▼"} {Math.abs(p).toLocaleString("th-TH", { maximumFractionDigits: 1 })}%</span>;
}

export default function DistrictDashboard() {
  const { district } = useDistrict();
  const [reports, setReports] = useState<Report[] | null>(null);
  const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const [cur, setCur] = useState(""); // เดือนปัจจุบัน (อ่านหลัง mount)
  const [cm, setCm] = useState(""); // เดือนที่ใช้ตรวจรายการที่ต้องกรอก
  const [area, setArea] = useState<AreaReport[]>([]);
  const [burn, setBurn] = useState<BurnReport[]>([]);
  const [cr, setCr] = useState(1); // รอบที่ใช้ตรวจรายการที่ต้องกรอก
  const [mainTab, setMainTab] = useState<TabKey>("fert"); // หมวดของกราฟหลัก
  const [burnKey, setBurnKey] = useState(""); // ช่องหยุดเผาที่แสดงในกราฟ
  const [cmpTab, setCmpTab] = useState<"fert" | "area">("fert"); // กราฟเปรียบเทียบย้อนหลัง 2 ปี
  const [bannerOff, setBannerOff] = useState(false);
  const [q, setQ] = useState(""); const [stF, setStF] = useState("ALL"); const [topicF, setTopicF] = useState("ALL"); const [page, setPage] = useState(0);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const cfg = useMemo(() => cfgOfMonth(settings, to), [settings, to]), K = cfg.area, FIELDS = cfg.fertFields, BURN_FIELDS = cfg.burnFields;
  const [loadError, setLoadError] = useState("");
  useEffect(() => {
    const get = async <T,>(url: string) => { const r = await fetch(url); if (!r.ok) throw new Error("โหลดรายงานไม่สำเร็จ"); return (await r.json()) as T; };
    Promise.all([get<Report[]>(`/api/reports?district=${encodeURIComponent(district)}`), get<Settings>("/api/settings"), get<AreaReport[]>(`/api/area?district=${encodeURIComponent(district)}`), get<BurnReport[]>(`/api/burn?district=${encodeURIComponent(district)}`)])
      .then(([all, st, ar, bn]) => {
        setSettings(st); setArea(ar); setBurn(bn);
        cfgOf(st); // โหลดช่วงเดือนของปีงบประมาณที่จังหวัดตั้งไว้ ก่อนคำนวณปีงบประมาณ
        const current = currentMonth();
        setCur(current); setCm(current); setReports(all);
        const fr = fiscalRange(fiscalYearOf(current)); // ค่าเริ่มต้น = ปีงบประมาณของเดือนปัจจุบัน
        setFrom(fr.from); setTo(fr.to);
      })
      .catch(() => setLoadError("ไม่สามารถโหลดรายงานได้ กรุณาลองใหม่อีกครั้ง"));
  }, [district]);
  const valid = !!from && !!to && from <= to;

  // ---- เลือกดูตามปีงบประมาณ ----
  const curFy = cur ? fiscalYearOf(cur) : 0, fy = to ? fiscalYearOf(to) : 0;
  const fyOptions = useMemo(() => {
    const ms = [...(reports ?? []).filter(r => r.district === district).map(r => r.month), ...area.map(r => r.month), ...burn.map(r => r.month)];
    const all = [...(curFy ? [curFy - 2, curFy + 1] : []), ...(fy ? [fy] : []), ...ms.map(fiscalYearOf)];
    if (!all.length) return [];
    const lo = Math.min(...all), hi = Math.max(...all);
    return fiscalYearOptions(cfgOf(settings), Array.from({ length: hi - lo + 1 }, (_, i) => hi - i));
  }, [reports, area, burn, district, settings, curFy, fy]);
  const chooseFy = (v: number) => {
    const r = fiscalRange(v);
    setFrom(r.from); setTo(r.to); setCr(1);
    setCm(cur && cur >= r.from && cur <= r.to ? cur : cur && cur < r.from ? r.from : r.to); // เดือนที่ดูงานอยู่ในปีงบประมาณที่เลือกเสมอ
  };

  // จำนวนรอบ/วันกำหนดส่งแยกตามหัวข้อและปีงบประมาณของเดือนนั้น
  const nR = (t: Topic, m: string) => dueDaysFor(settings, t, m).length;
  const dueOf = (t: Topic, m: string, rd: number) => dueDateOf(m, dueDaysFor(settings, t, m)[rd - 1] ?? 31);
  const d = useMemo(() => {
    if (!reports || !valid) return null;
    const rounds = dueDaysFor(settings, "fert", to).length;
    const agg = aggregate(reports, from, to, rounds, cfg), me = agg.rows.find(r => r.name === district)!;
    const ranked = [...agg.rows].sort((a, b) => b.total - a.total);
    const mine = reports.filter(r => r.district === district);
    const arAll = aggregateArea(area, to, areaTotalsFor(settings, to), K), ar = arAll.rows.find(r => r.name === district)!;
    // เทียบกับปีงบประมาณก่อนหน้า
    const pfy = fiscalYearOf(to) - 1, pr = fiscalRange(pfy), pcfg = cfgOfMonth(settings, pr.to);
    const pagg = aggregate(reports, pr.from, pr.to, dueDaysFor(settings, "fert", pr.to).length, pcfg), pme = pagg.rows.find(r => r.name === district)!;
    const pRanked = [...pagg.rows].sort((a, b) => b.total - a.total);
    const par = aggregateArea(area, pr.to, areaTotalsFor(settings, pr.to), pcfg.area).rows.find(r => r.name === district)!;
    const prev = { fy: pfy, total: pme.total, accum: par.accum, rank: pme.any ? pRanked.findIndex(r => r.name === district) + 1 : 0 };
    // ย้อนหลัง 2 ปีงบประมาณของอำเภอนี้ (เก่า → ใหม่) สำหรับกราฟเปรียบเทียบ
    const hist = [2, 1, 0].map(back => {
      const y = fiscalYearOf(to) - back;
      if (back === 0) return { fy: y, fert: me.total, fertTarget: me.target, area: ar.accum, areaTarget: ar.target };
      const rg = fiscalRange(y), c = cfgOfMonth(settings, rg.to);
      const fa = aggregate(reports, rg.from, rg.to, dueDaysFor(settings, "fert", rg.to).length, c).rows.find(r => r.name === district)!;
      const aa = aggregateArea(area, rg.to, areaTotalsFor(settings, rg.to), c.area).rows.find(r => r.name === district)!;
      return { fy: y, fert: fa.total, fertTarget: fa.target, area: aa.accum, areaTarget: aa.target };
    });
    return { agg, me, ar, mine, prev, hist, prevByMonth: agg.months.map(m => { const pm = pagg.months.find(x => x.slice(5) === m.slice(5)); return pm ? pme.byMonth[pm] ?? 0 : 0; }), arRows: arAll.rows, season: arAll.season, arMonths: arAll.months, ranked, rank: ranked.findIndex(r => r.name === district) + 1,
      rec: (m: string, rd: number) => mine.find(r => r.month === m && r.round === rd),
      mstat: (m: string) => { const g = me.got[m] ?? 0; return g >= dueDaysFor(settings, "fert", m).length ? "ok" : g > 0 || mine.some(r => r.month === m) ? "warn" : "no"; },
      mlate: (m: string) => mine.some(r => r.month === m && r.late),
      pct: me.target ? Math.round((me.total / me.target) * 100) : 0 };
  }, [reports, valid, from, to, district, settings, area, cfg, K]);

  // ---- งานที่ต้องกรอก (เดือน/รอบที่เลือก) ----
  const rdOf = (t: Topic) => Math.min(cr, nR(t, cm));
  const tasks: Task[] = (() => {
    if (!d || !cm) return [];
    const out: Task[] = [];
    { // ปุ๋ยอินทรีย์
      const rd = rdOf("fert"), r = d.rec(cm, rd);
      const items = [...FIELDS.map(f => r?.values[f.key]), r?.reporter.name || undefined];
      const done = items.filter(v => v !== undefined).length, miss = [...FIELDS.map(f => f.label), "ชื่อผู้รายงาน"].filter((_, i) => items[i] === undefined);
      out.push({ key: "fert", title: "รายงานปุ๋ยอินทรีย์", icon: I.leaf, color: "#266a40", sub: `เดือน${thaiMonth(cm)}${nR("fert", cm) > 1 ? ` · รอบที่ ${rd}` : ""} · ส่งภายใน ${thaiDate(dueOf("fert", cm, rd))}`,
        status: r?.status, late: r?.late, submittedAt: r?.submittedAt, done, total: items.length, line: `กรอกแล้ว ${done} จาก ${items.length} ช่อง`,
        miss: miss.length ? <>ยังไม่ได้กรอก: <b>{miss.slice(0, 3).join(", ")}{miss.length > 3 ? ` และอีก ${miss.length - 3} ช่อง` : ""}</b></> : "กรอกครบทุกช่องแล้ว",
        href: `/district/report?month=${cm}&round=${rd}`, cta: r?.status === "submitted" ? "ดู / แก้ไขรายงาน" : done ? "กรอกต่อ" : "เริ่มกรอกรายงานปุ๋ย" });
    }
    { // พื้นที่ไถกลบฟางข้าว
      const rd = rdOf("area"), ar = area.find(x => x.month === cm && x.round === rd), v = ar?.values.area;
      out.push({ key: "area", title: "พื้นที่ไถกลบฟางข้าว", icon: I.sprout, color: "#b08a2c", inactive: !isAreaMonth(cm),
        sub: isAreaMonth(cm) ? `เดือน${thaiMonth(cm)}${nR("area", cm) > 1 ? ` · รอบที่ ${rd}` : ""} · ส่งภายใน ${thaiDate(dueOf("area", cm, rd))}` : `เดือน${thaiMonth(cm)}`,
        status: ar?.status, late: ar?.late, submittedAt: ar?.submittedAt, done: v !== undefined ? 1 : 0, total: 1,
        line: v !== undefined ? `กรอกแล้ว ${f2(v)} ไร่` : "ยังไม่ได้กรอกพื้นที่",
        miss: !isAreaMonth(cm) ? "เดือนนี้ไม่ต้องกรอก · รายงานเฉพาะช่วงปีงบประมาณ" : v !== undefined ? "ฟางข้าวและมูลค่าระบบคำนวณให้" : <>ยังไม่ได้กรอก: <b>{AREA_FIELDS[0].label}</b></>,
        href: `/district/area?month=${cm}&round=${rd}`, cta: ar?.status === "submitted" ? "ดู / แก้ไขข้อมูล" : v !== undefined ? "กรอกต่อ" : "เริ่มกรอกพื้นที่" });
    }
    { // หยุดเผา
      const rd = rdOf("burn"), br = burn.find(x => x.month === cm && x.round === rd);
      const items = BURN_FIELDS.map(f => ({ label: f.label, val: br?.values[f.key] }));
      const done = items.filter(i => i.val !== undefined).length, miss = items.filter(i => i.val === undefined);
      out.push({ key: "burn", title: "การเรียนรู้/ประชาสัมพันธ์หยุดเผา", icon: I.alert, color: "#c2410c", sub: `เดือน${thaiMonth(cm)}${nR("burn", cm) > 1 ? ` · รอบที่ ${rd}` : ""} · ส่งภายใน ${thaiDate(dueOf("burn", cm, rd))}`,
        status: br?.status, late: br?.late, submittedAt: br?.submittedAt, done, total: items.length, line: `กรอกแล้ว ${done} จาก ${items.length} ช่อง`,
        miss: miss.length ? <>ยังไม่ได้กรอก: <b>{miss.slice(0, 2).map(m => m.label).join(", ")}{miss.length > 2 ? ` และอีก ${miss.length - 2} ช่อง` : ""}</b></> : "กรอกครบทุกช่องแล้ว",
        href: `/district/burn?month=${cm}&round=${rd}`, cta: br?.status === "submitted" ? "ดู / แก้ไขข้อมูล" : done ? "กรอกต่อ" : "เริ่มกรอกข้อมูลหยุดเผา" });
    }
    return out;
  })();
  const active = tasks.filter(t => !t.inactive), pending = active.filter(t => t.status !== "submitted").length;

  // ---- ข้อมูลสำหรับกราฟ ----
  const monthlyFert = d ? d.agg.months.map((m, i) => ({ label: monthShort(m), prev: d.prevByMonth[i] ?? 0, cur: d.me.byMonth[m] ?? 0 })) : [];
  const areaSeries = d ? cumulate(d.arMonths, d.arMonths.map(m => d.ar.byMonth[m] ?? 0)) : [];
  const cmpRows = d ? d.hist.map(h => cmpTab === "fert"
    ? { name: `ปีงบฯ ${h.fy}`, accum: h.fert, target: h.fertTarget }
    : { name: `ปีงบฯ ${h.fy}`, accum: h.area, target: h.areaTarget }) : [];
  const cmpHasData = cmpRows.some(r => r.accum > 0);
  const bf = BURN_FIELDS.find(f => f.key === burnKey) ?? BURN_FIELDS[0];
  const burnSeries = (key: string) => d ? d.agg.months.map(m => ({ label: monthShort(m), value: burn.filter(b => b.status === "submitted" && b.month === m).reduce((a, b) => a + (b.values[key] ?? 0), 0) })) : [];

  // ---- ตารางรายการรายงาน (ทุกหัวข้อ ทุกเดือน ทุกรอบของปีงบประมาณ) ----
  const allRows: Row[] = (() => {
    if (!d) return [];
    const out: Row[] = [];
    const push = (topic: TabKey, m: string, rd: number, r?: { status: "draft" | "submitted"; late?: boolean; submittedAt?: string; dueDate?: string }) => {
      const st: Row["st"] = r ? (r.status === "submitted" ? (r.late ? "late" : "submitted") : "draft") : cur && m > cur ? "future" : "none";
      out.push({ key: `${topic}-${m}-${rd}`, topic, topicLabel: TOPIC_LABEL[topic], month: m, round: rd, due: r?.dueDate ?? dueOf(topic, m, rd), submittedAt: r?.submittedAt, st,
        href: `/district/${topic === "fert" ? "report" : topic}?month=${m}&round=${rd}` });
    };
    d.agg.months.forEach(m => { for (let rd = 1; rd <= nR("fert", m); rd++) push("fert", m, rd, d.rec(m, rd)); });
    d.arMonths.forEach(m => { for (let rd = 1; rd <= nR("area", m); rd++) push("area", m, rd, area.find(x => x.month === m && x.round === rd)); });
    d.agg.months.forEach(m => { for (let rd = 1; rd <= nR("burn", m); rd++) push("burn", m, rd, burn.find(x => x.month === m && x.round === rd)); });
    return out.sort((a, b) => b.month.localeCompare(a.month) || a.topic.localeCompare(b.topic) || a.round - b.round);
  })();
  const filtered = allRows.filter(r => (stF === "ALL" || r.st === stF) && (topicF === "ALL" || r.topic === topicF)
    && (!q.trim() || `${r.topicLabel} ${thaiMonth(r.month)} ${ST_LABEL[r.st]} รอบ${r.round}`.includes(q.trim())));
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE)), pg = Math.min(page, pages - 1), shown = filtered.slice(pg * PAGE, pg * PAGE + PAGE);
  const pageNums = Array.from({ length: pages }, (_, i) => i).filter(i => i === 0 || i === pages - 1 || Math.abs(i - pg) <= 1);

  // ---- กิจกรรมล่าสุด ----
  const feed = d ? [
    ...d.mine.map(r => ({ t: "fert" as TabKey, m: r.month, rd: r.round, st: r.status, late: r.late, ts: r.submittedAt ?? r.updatedAt })),
    ...area.map(r => ({ t: "area" as TabKey, m: r.month, rd: r.round, st: r.status, late: r.late, ts: r.submittedAt ?? r.updatedAt })),
    ...burn.map(r => ({ t: "burn" as TabKey, m: r.month, rd: r.round, st: r.status, late: r.late, ts: r.submittedAt ?? r.updatedAt })),
  ].filter(x => x.ts).sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, 5) : [];
  const FEED_ICON: Record<TabKey, { ic: string; c: string }> = { fert: { ic: "🌱", c: "green" }, area: { ic: "🌾", c: "amber" }, burn: { ic: "🔥", c: "rose" } };
  const pendingTitles = active.filter(t => t.status !== "submitted").map(t => t.title);

  return (
    <div className="ad">
      {/* ===== แถวชื่อหน้า + ตัวเลือกปีงบประมาณ + ปุ่มลัด ===== */}
      <div className="ad-title">
        <div>
          <h1>ภาพรวมอำเภอ{district}</h1>
          <p>{valid ? `ข้อมูลปีงบประมาณ ${fy} · ${thaiMonth(from)} – ${thaiMonth(to)}` : "กำลังเตรียมข้อมูล…"}</p>
        </div>
        <div className="ad-title-act">
          <div className="ad-sel">
            <label htmlFor="fy-d" className="sr-only">ปีงบประมาณ</label>
            <select id="fy-d" value={fy || ""} disabled={!fy} onChange={e => chooseFy(Number(e.target.value))}>
              {fyOptions.map(y => <option key={y} value={y}>ปีงบประมาณ {y}{y === curFy ? " (ปัจจุบัน)" : ""}</option>)}
            </select>
          </div>
          <a className="ad-btn line" href="#ad-table">📋 ตารางรายการ</a>
          {cm && <Link className="ad-btn" href={`/district/report?month=${cm}&round=${rdOf("fert")}`}>+ กรอกรายงานปุ๋ย</Link>}
        </div>
      </div>
      {loadError && <p className="ux-toast bad" role="alert">{loadError}</p>}
      {!reports && !loadError && <p className="ux-empty">กำลังโหลด…</p>}

      {d && <>
        {/* ===== แบนเนอร์แจ้งเตือน (ปิดได้) ===== */}
        {!bannerOff && (
          <div className={`ad-banner ${pending ? "warn" : "ok"}`} role="status">
            <span className="ic">{pending ? "⏰" : "🎉"}</span>
            <span className="tx">{pending ? <>เดือน{thaiMonth(cm)} ยังมีงานที่ต้องส่งอีก <b>{pending}</b> รายการ: {pendingTitles.join(", ")}</> : <>เดือน{thaiMonth(cm)} ส่งรายงานครบทุกรายการแล้ว</>}</span>
            <button type="button" aria-label="ปิดแจ้งเตือน" onClick={() => setBannerOff(true)}>✕</button>
          </div>
        )}

        {/* ===== การ์ด KPI 4 ใบ ===== */}
        <div className="ad-kpis">
          <div className="ad-kpi">
            <div className="ad-kpi-h"><span>ปุ๋ยอินทรีย์รวม</span><i className="ic green">🌱</i></div>
            <div className="ad-kpi-v"><h2>{fmt(d.me.total)} <small>ตัน</small></h2><Delta cur={d.me.total} prev={d.prev.total} /></div>
            <p>เทียบปีงบประมาณ {d.prev.fy} · {d.pct}% ของเป้าหมาย {fmt(d.me.target)} ตัน</p>
          </div>
          <div className="ad-kpi">
            <div className="ad-kpi-h"><span>เดือนที่ส่งรายงานแล้ว</span><i className="ic blue">✅</i></div>
            <div className="ad-kpi-v"><h2>{d.me.sent} / {d.agg.months.length} <small>เดือน</small></h2>
              <span className={`ad-delta ${d.me.sent < d.agg.months.length ? "warn" : "up"}`}>{d.me.sent < d.agg.months.length ? `ค้าง ${d.agg.months.length - d.me.sent} เดือน` : "ส่งครบ"}</span></div>
            <p>{d.me.late ? `ส่งช้า ${d.me.late} ครั้งในปีงบประมาณนี้` : "ไม่มีรายการส่งช้า"}</p>
          </div>
          <div className="ad-kpi">
            <div className="ad-kpi-h"><span>อันดับปุ๋ยในจังหวัด</span><i className="ic purple">🏆</i></div>
            <div className="ad-kpi-v"><h2>{d.me.sent ? `ที่ ${d.rank}` : "–"} <small>จาก {d.ranked.length}</small></h2>
              {d.me.sent && d.prev.rank ? (d.prev.rank === d.rank ? <span className="ad-delta mute">คงเดิม</span> : <span className={`ad-delta ${d.rank < d.prev.rank ? "up" : "down"}`}>{d.rank < d.prev.rank ? "▲" : "▼"} {Math.abs(d.prev.rank - d.rank)} อันดับ</span>) : <span className="ad-delta mute">ไม่มีข้อมูลปีก่อน</span>}</div>
            <p>เทียบอันดับปีงบประมาณ {d.prev.fy}</p>
          </div>
          <div className="ad-kpi">
            <div className="ad-kpi-h"><span>พื้นที่ไถกลบฟางข้าวสะสม</span><i className="ic amber">🌾</i></div>
            <div className="ad-kpi-v"><h2>{f2(d.ar.accum)} <small>ไร่</small></h2><Delta cur={d.ar.accum} prev={d.prev.accum} /></div>
            <p>เทียบปีงบประมาณ {d.prev.fy} · {f2(d.ar.pct)}% ของพื้นที่ปลูกทั้งหมด</p>
          </div>
        </div>

        {/* ===== กราฟแถวที่ 1 : กราฟหลัก (2 คอลัมน์) + โดนัท ===== */}
        <div className="ad-grid3">
          <section className="ad-card span2">
            <div className="ad-card-h">
              <div><h3>{mainTab === "fert" ? "ผลผลิตปุ๋ยอินทรีย์รายเดือน" : mainTab === "area" ? "พื้นที่ไถกลบรายเดือนและสะสม" : "ผลงานหยุดเผารายเดือน"}</h3>
                <p>{mainTab === "fert" ? "เทียบรายเดือนกับปีงบประมาณก่อนหน้า (ตัน)" : mainTab === "area" ? `ฤดูกาล ${thaiMonth(d.season.start)} – ${thaiMonth(d.season.end)}` : `หน่วย: ${bf?.unit ?? ""}`}</p></div>
              <div className="ad-seg" role="group" aria-label="หมวดกราฟ">
                {([["fert", "ปุ๋ย"], ["area", "ไถกลบ"], ["burn", "หยุดเผา"]] as const).map(([k, l]) => <button key={k} type="button" aria-pressed={mainTab === k} onClick={() => setMainTab(k)}>{l}</button>)}
              </div>
            </div>
            {mainTab === "fert" && <FertCompareBars data={monthlyFert} prevLabel={`ปีงบฯ ${d.prev.fy}`} curLabel={`ปีงบฯ ${fy}`} unit="ตัน" />}
            {mainTab === "area" && <>
              <AreaCombo data={areaSeries} target={d.ar.target} />
              <p className="pv-lg"><span><i style={{ background: "#297b48" }} />พื้นที่รายเดือน (ไร่)</span><span><i className="ln" style={{ background: "#c09a3a" }} />พื้นที่สะสม (ไร่)</span><span><i className="ds" />เป้าหมายของอำเภอ</span></p></>}
            {mainTab === "burn" && bf && <>
              {BURN_FIELDS.length > 1 && <select className="ad-mini-sel" aria-label="เลือกช่องข้อมูลหยุดเผา" value={bf.key} onChange={e => setBurnKey(e.target.value)}>{BURN_FIELDS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}</select>}
              <BarChart data={burnSeries(bf.key)} unit={bf.unit} /></>}
          </section>
          <section className="ad-card">
            <div className="ad-card-h"><div><h3>สัดส่วนตามชนิดปุ๋ย</h3><p>ปริมาณรวม (ตัน)</p></div></div>
            <TypeDonut unit="ตัน" parts={FIELDS.map((f, i) => ({ label: f.label, value: d.me.sums[f.key] ?? 0, color: PV_COLORS[i % PV_COLORS.length] }))} />
          </section>
        </div>

        {/* ===== กราฟแถวที่ 2 : เทียบอำเภอ (2 คอลัมน์) + กิจกรรมล่าสุด ===== */}
        <div className="ad-grid3">
          <section className="ad-card span2">
            <div className="ad-card-h">
              <div><h3>เปรียบเทียบย้อนหลัง 2 ปี</h3><p>{cmpTab === "fert" ? "ปุ๋ยอินทรีย์รวมรายปีงบประมาณ (ตัน) · เส้นขีด = เป้าหมายของอำเภอ" : "พื้นที่ไถกลบสะสมรายปีงบประมาณ (ไร่) · เส้นขีด = เป้าหมายของอำเภอ"}</p></div>
              <div className="ad-seg" role="group" aria-label="หมวดการเปรียบเทียบ">
                {([["fert", "ปุ๋ย"], ["area", "ไถกลบ"]] as const).map(([k, l]) => <button key={k} type="button" aria-pressed={cmpTab === k} onClick={() => setCmpTab(k)}>{l}</button>)}
              </div>
            </div>
            {cmpHasData ? <>
              <AreaHBars rows={cmpRows} highlight={`ปีงบฯ ${fy}`} unit={cmpTab === "fert" ? "ตัน" : "ไร่"} />
              <p className="pv-lg">{cmpRows.slice(1).map((r, i) => <span key={r.name}>{r.name} เทียบ {cmpRows[i].name}: <Delta cur={r.accum} prev={cmpRows[i].accum} /></span>)}</p>
            </> : <p className="pv-empty">ยังไม่มีข้อมูลในช่วงนี้</p>}
          </section>
          <section className="ad-card">
            <h3 className="ad-h3">กิจกรรมล่าสุด</h3>
            {feed.length === 0 ? <p className="pv-empty">ยังไม่มีการบันทึกรายงาน</p> : <ul className="ad-feed">{feed.map((x, i) => (
              <li key={i}>
                <span className={`ic ${FEED_ICON[x.t].c}`}>{FEED_ICON[x.t].ic}</span>
                <div><b>{x.st === "submitted" ? "ส่งรายงาน" : "บันทึกร่าง"}{TOPIC_LABEL[x.t]}</b><small>เดือน{thaiMonth(x.m)} · รอบที่ {x.rd}{x.late ? " · ส่งช้า" : ""}</small></div>
                <time>{thaiDateTime(x.ts)}</time>
              </li>))}</ul>}
          </section>
        </div>

        {/* ===== ตารางรายการรายงาน ===== */}
        <section id="ad-table" className="ad-card flush">
          <div className="ad-card-h pad">
            <div><h3>รายการรายงานปีงบประมาณ {fy}</h3><p>ติดตามสถานะการส่งของทุกหัวข้อ ทุกเดือน และทุกรอบ</p></div>
            <div className="ad-filters">
              <input type="search" value={q} onChange={e => { setQ(e.target.value); setPage(0); }} placeholder="ค้นหา เช่น มกราคม, ส่งช้า…" aria-label="ค้นหารายการ" />
              <select value={topicF} onChange={e => { setTopicF(e.target.value); setPage(0); }} aria-label="กรองตามหัวข้อ">
                <option value="ALL">ทุกหัวข้อ</option>{(Object.keys(TOPIC_LABEL) as TabKey[]).map(k => <option key={k} value={k}>{TOPIC_LABEL[k]}</option>)}
              </select>
              <select value={stF} onChange={e => { setStF(e.target.value); setPage(0); }} aria-label="กรองตามสถานะ">
                <option value="ALL">ทุกสถานะ</option>{(Object.keys(ST_LABEL) as Row["st"][]).map(k => <option key={k} value={k}>{ST_LABEL[k]}</option>)}
              </select>
            </div>
          </div>
          <div className="ad-tw">
            <table className="ad-table">
              <thead><tr><th>หัวข้อ</th><th>เดือน</th><th>รอบ</th><th>กำหนดส่ง</th><th>ส่งเมื่อ</th><th>สถานะ</th><th className="r">จัดการ</th></tr></thead>
              <tbody>
                {shown.length === 0 && <tr><td colSpan={7} className="empty">ไม่พบรายการตามเงื่อนไขที่เลือก</td></tr>}
                {shown.map(r => (
                  <tr key={r.key}>
                    <td><b>{r.topicLabel}</b></td><td>{thaiMonth(r.month)}</td><td>{r.round}</td><td>{thaiDate(r.due)}</td>
                    <td>{r.submittedAt ? thaiDateTime(r.submittedAt) : "–"}</td>
                    <td><span className={`ad-st ${ST_CLASS[r.st]}`}><i />{ST_LABEL[r.st]}</span></td>
                    <td className="r"><Link className="ad-link" href={r.href}>{r.st === "submitted" || r.st === "late" || r.st === "draft" ? "แก้ไข" : "กรอก"}</Link></td>
                  </tr>))}
              </tbody>
            </table>
          </div>
          <div className="ad-foot">
            <span>{filtered.length ? `แสดง ${pg * PAGE + 1} ถึง ${Math.min(filtered.length, pg * PAGE + PAGE)} จาก ${filtered.length} รายการ` : "ไม่มีรายการ"}</span>
            <div className="ad-pager">
              <button type="button" disabled={pg === 0} onClick={() => setPage(pg - 1)}>ก่อนหน้า</button>
              {pageNums.map((n, i) => <span key={n} style={{ display: "contents" }}>{i > 0 && n - pageNums[i - 1] > 1 && <em>…</em>}<button type="button" className={n === pg ? "on" : ""} aria-current={n === pg ? "page" : undefined} onClick={() => setPage(n)}>{n + 1}</button></span>)}
              <button type="button" disabled={pg >= pages - 1} onClick={() => setPage(pg + 1)}>ถัดไป</button>
            </div>
          </div>
        </section>

        {/* ===== สถานะรายเดือน + ตารางค่าที่กรอก (พับเก็บ) ===== */}
        <section className="ad-card">
          <div className="ad-card-h"><div><h3>สถานะการส่งรายงานปุ๋ยรายเดือน</h3><p>เขียว = ส่งครบ · เหลือง = ส่งบางรอบ/ร่าง · แดง = ยังไม่ส่ง · กดเพื่อกรอกหรือแก้ไข</p></div></div>
          <div className="db-chips">{d.agg.months.map(m => { const s = d.mstat(m), g = d.me.got[m] ?? 0;
            return <Link key={m} href={`/district/report?month=${m}`} className={`db-chip ${s}`}>{thaiMonth(m)}{nR("fert", m) > 1 && s === "warn" ? ` (${g}/${nR("fert", m)})` : ""}{d.mlate(m) ? " · ส่งช้า" : ""}</Link>; })}</div>
        </section>

        <details className="db-more">
          <summary>ดูรายละเอียดรายเดือน (ตารางปุ๋ยและพื้นที่ฟางข้าว)</summary>
          <section className="db-card"><h2>รายละเอียดรายเดือน · ปุ๋ยอินทรีย์และวัสดุอินทรีย์</h2>
            <div className="tw2"><table className="dt plain"><thead><tr><th>เดือน</th><th>รอบ</th><th>สถานะ</th><th>กำหนดส่ง</th><th>ส่งเมื่อ</th>{FIELDS.map(f => <th key={f.key}>{f.label}</th>)}<th>รวม (ตัน)</th><th></th></tr></thead>
              <tbody>{[...d.agg.months].reverse().flatMap(m => Array.from({ length: nR("fert", m) }, (_, i) => i + 1).map(rd => { const r = d.rec(m, rd); const due = r?.dueDate ?? dueOf("fert", m, rd); return (
                <tr key={`${m}-${rd}`}><td style={{ textAlign: "left" }}>{thaiMonth(m)}</td><td>{rd}</td>
                  <td><span className={`pill ${r ? (r.status === "submitted" ? (r.late ? "no" : "ok") : "warn") : "no"}`}>{r ? (r.status === "submitted" ? (r.late ? "ส่งช้า" : "ส่งแล้ว") : "ร่าง") : "ยังไม่ส่ง"}</span></td>
                  <td>{thaiDate(due)}</td><td>{r?.submittedAt ? thaiDateTime(r.submittedAt) : "–"}</td>
                  {FIELDS.map(f => <td key={f.key}>{r ? fmt(r.values[f.key] ?? 0) : "–"}</td>)}<td><b>{r ? fmt(sumValues(r.values, FIELDS)) : "–"}</b></td>
                  <td><Link className="btn alt" href={`/district/report?month=${m}&round=${rd}`}>{r ? "แก้ไข" : "กรอก"}</Link></td></tr>); }))}</tbody></table></div></section>
          <section className="db-card" style={{ marginTop: "1rem" }}><h2>รายละเอียดรายเดือน · พื้นที่และฟางข้าว</h2>
            <div className="tw2"><table className="dt plain"><thead><tr><th>เดือน</th><th>รอบ</th><th>สถานะ</th><th>กำหนดส่ง</th><th>ส่งเมื่อ</th><th>พื้นที่เดือนนี้ (ไร่)</th><th>ฟางข้าว (ตัน)</th><th>มูลค่า (บาท)</th><th>ฟางก้อน (ก้อน)</th><th>ราคาฟางก้อน (บาท)</th><th></th></tr></thead>
              <tbody>{[...d.arMonths].reverse().flatMap(m => Array.from({ length: nR("area", m) }, (_, i) => i + 1).map(rd => { const r = area.find(x => x.month === m && x.round === rd); const due = r?.dueDate ?? dueOf("area", m, rd); return (
                <tr key={`${m}-${rd}`}><td style={{ textAlign: "left" }}>{thaiMonth(m)}</td><td>{rd}</td>
                  <td><span className={`pill ${r ? (r.status === "submitted" ? (r.late ? "no" : "ok") : "warn") : "no"}`}>{r ? (r.status === "submitted" ? (r.late ? "ส่งช้า" : "ส่งแล้ว") : "ร่าง") : "ยังไม่ส่ง"}</span></td>
                  <td>{thaiDate(due)}</td><td>{r?.submittedAt ? thaiDateTime(r.submittedAt) : "–"}</td>
                  <td>{r ? f2(r.values.area ?? 0) : "–"}</td><td>{r ? f2(strawTons(r.values.area ?? 0, K)) : "–"}</td><td>{r ? f2(strawValue(r.values.area ?? 0, K)) : "–"}</td><td>{r ? f2(strawBales(r.values.area ?? 0, K)) : "–"}</td><td>{r ? f2(baleValue(r.values.area ?? 0, K)) : "–"}</td>
                  <td><Link className="btn alt" href={`/district/area?month=${m}&round=${rd}`}>{r ? "แก้ไข" : "กรอก"}</Link></td></tr>); }))}</tbody></table></div></section>
        </details>
      </>}
    </div>
  );
}
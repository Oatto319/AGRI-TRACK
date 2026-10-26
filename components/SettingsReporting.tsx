"use client";
import { startTransition, useEffect, useState } from "react";
import { DEFAULT_PER_TAMBON, DISTRICTS, MAX_ROUNDS, TOPICS, cfgOf, fiscalYearOptions, topicLabelOf, currentMonth, dueDateOf, fiscalRange, fiscalYearOf, thaiDate, thaiMonth, type AreaSet, type Schedule, type Settings, type TambonSet, type Topic } from "@/lib/data";
import { useProvince } from "@/components/Province";
import { I, Step } from "@/components/Entry";

const f2 = (v: number) => v.toLocaleString("th-TH", { maximumFractionDigits: 2 });
const even = (k: number) => Array.from({ length: k }, (_, i) => String(Math.round((31 / k) * (i + 1))));

export default function ReportingSettings() {
  const [q, setQ] = useState("");
  const { settings, setSettings } = useProvince();
  const cfg = cfgOf(settings), AREA_TARGET_PCT = cfg.area.targetPct;
  const [days, setDays] = useState<string[]>(["31"]);
  const [topic, setTopic] = useState<Topic>("area");
  const [fyIn, setFyIn] = useState<number | null>(null); // null = ปีงบประมาณปัจจุบัน
  const [editing, setEditing] = useState<string | null>(null); // id ของรายการที่กำลังแก้ไข
  const [msg, setMsg] = useState<{ t: string; bad?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [totals, setTotals] = useState<Record<string, string>>({});
  const [afyIn, setAfyIn] = useState<number | null>(null);
  const [aEditing, setAEditing] = useState<string | null>(null);
  const [amsg, setAmsg] = useState<{ t: string; bad?: boolean } | null>(null);
  const [abusy, setAbusy] = useState(false);
  // ปุ๋ยอินทรีย์และวัสดุอินทรีย์: จำนวนเกษตรตำบลรายอำเภอ + เป้าหมายการผลิต = เกษตรตำบล × ตัวคูณ (ค่าเริ่มต้น 130 ตัน/ราย)
  const [tq, setTq] = useState("");
  const [tambons, setTambons] = useState<Record<string, string>>({});
  const [perT, setPerT] = useState(String(DEFAULT_PER_TAMBON));
  const [tfyIn, setTfyIn] = useState<number | null>(null);
  const [tEditing, setTEditing] = useState<string | null>(null);
  const [tmsg, setTmsg] = useState<{ t: string; bad?: boolean } | null>(null);
  const [tbusy, setTbusy] = useState(false);
  const [cur, setCur] = useState(""); // อ่านเดือนปัจจุบันหลัง mount เท่านั้น (ห้ามเรียก new Date() ตอน render)
  useEffect(() => { startTransition(() => setCur(currentMonth())); }, []);
  const n = days.length;

  const list: Schedule[] = [...(settings.schedules ?? [])].sort((x, y) => y.fy - x.fy || x.topic.localeCompare(y.topic));
  const curFy = cur ? fiscalYearOf(cur) : 0;
  const fy = fyIn ?? curFy;
  const fyOptions = fiscalYearOptions(cfg, [...(curFy ? [curFy - 1, curFy, curFy + 1, curFy + 2] : []), ...list.map(x => x.fy), ...(fy ? [fy] : [])]);
  const topicLabel = (t: Topic) => topicLabelOf(cfg, t);
  const daysText = (d: number[]) => d.map((x, i) => `รอบ ${i + 1}: วันที่ ${x}`).join(" · ");

  async function putSchedules(next: Schedule[], okMsg: string) {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ schedules: next }) });
      const data: unknown = await res.json();
      if (!res.ok) {
        setMsg({ t: typeof data === "object" && data !== null && "error" in data && typeof data.error === "string" ? data.error : "บันทึกไม่สำเร็จ", bad: true });
        return false;
      }
      setSettings(data as Settings);
      setMsg({ t: okMsg });
      return true;
    } catch {
      setMsg({ t: "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่อีกครั้ง", bad: true });
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!fy) return;
    const others = list.filter(x => x.id !== editing);
    if (others.some(x => x.topic === topic && x.fy === fy)) {
      setMsg({ t: `มี “${topicLabel(topic)}” ปีงบประมาณ ${fy} อยู่ในรายการแล้ว กดปุ่ม “แก้ไข” ที่รายการด้านล่างได้เลย`, bad: true });
      return;
    }
    const item: Schedule = { id: `${topic}-${fy}`, topic, fy, dueDays: days.map(Number) };
    const ok = await putSchedules([...others, item], editing ? "บันทึกการแก้ไขแล้ว มีผลกับการส่งรายงานครั้งต่อไป (รายงานที่ส่งไปแล้วคงสถานะเดิม)" : "เพิ่มรายการแล้ว มีผลกับการส่งรายงานครั้งต่อไป (รายงานที่ส่งไปแล้วคงสถานะเดิม)");
    if (ok) { setEditing(null); setDays(["31"]); }
  }
  function startEdit(x: Schedule) {
    setMsg(null); setEditing(x.id); setTopic(x.topic); setFyIn(x.fy); setDays(x.dueDays.map(String));
    document.getElementById("sched-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function cancelEdit() { setEditing(null); setDays(["31"]); setMsg(null); }
  async function remove(x: Schedule) {
    if (!window.confirm(`ลบ “${topicLabel(x.topic)}” ปีงบประมาณ ${x.fy} ออกจากรายการ?\nปีงบประมาณนี้จะกลับไปใช้ค่าเริ่มต้น (${settings.dueDays.length} ครั้ง/เดือน) · รายงานที่ส่งแล้วไม่ถูกลบ`)) return;
    const ok = await putSchedules(list.filter(y => y.id !== x.id), "ลบรายการแล้ว");
    if (ok && editing === x.id) cancelEdit();
  }

  const num = (name: string) => Number(totals[name]) || 0;
  const sumTotal = DISTRICTS.reduce((a, d) => a + num(d.name), 0);

  const aList: AreaSet[] = [...(settings.areaSets ?? [])].sort((x, y) => y.fy - x.fy);
  const aFy = afyIn ?? curFy;
  const aFyOptions = fiscalYearOptions(cfg, [...(curFy ? [curFy - 1, curFy, curFy + 1, curFy + 2] : []), ...aList.map(x => x.fy), ...(aFy ? [aFy] : [])]);
  const legacyCount = Object.values(settings.areaTotals ?? {}).filter(v => v > 0).length;

  async function putAreaSets(next: AreaSet[], okMsg: string) {
    setAbusy(true); setAmsg(null);
    try {
      const res = await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ areaSets: next }) });
      const data: unknown = await res.json();
      if (!res.ok) {
        setAmsg({ t: typeof data === "object" && data !== null && "error" in data && typeof data.error === "string" ? data.error : "บันทึกไม่สำเร็จ", bad: true });
        return false;
      }
      setSettings(data as Settings);
      setAmsg({ t: okMsg });
      return true;
    } catch {
      setAmsg({ t: "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่อีกครั้ง", bad: true });
      return false;
    } finally {
      setAbusy(false);
    }
  }

  async function saveAreas() {
    if (!aFy) return;
    const out: Record<string, number> = {};
    for (const d of DISTRICTS) {
      const t = totals[d.name] ?? "";
      if (t === "") continue;
      const v = Number(t);
      if (!Number.isFinite(v) || v < 0) { setAmsg({ t: `พื้นที่ของอำเภอ${d.name}ต้องเป็นตัวเลขที่ไม่ติดลบ`, bad: true }); return; }
      out[d.name] = v;
    }
    if (!Object.keys(out).length) { setAmsg({ t: "กรอกพื้นที่ปลูกพืชอย่างน้อย 1 อำเภอก่อนบันทึก", bad: true }); return; }
    const others = aList.filter(x => x.id !== aEditing);
    if (others.some(x => x.fy === aFy)) { setAmsg({ t: `มีรายการพื้นที่ปลูกพืชปีงบประมาณ ${aFy} อยู่แล้ว กดปุ่ม “แก้ไข” ที่รายการด้านล่างได้เลย`, bad: true }); return; }
    const ok = await putAreaSets([...others, { id: `area-${aFy}`, fy: aFy, totals: out }], (aEditing ? "บันทึกการแก้ไขแล้ว" : "เพิ่มรายการแล้ว") + " Dashboard และไฟล์ Excel จะคำนวณเป้าหมายและร้อยละใหม่ทันที");
    if (ok) { setAEditing(null); setTotals({}); }
  }
  function startAreaEdit(x: AreaSet) {
    setAmsg(null); setAEditing(x.id); setAfyIn(x.fy); setQ("");
    setTotals(Object.fromEntries(DISTRICTS.map(d => [d.name, x.totals[d.name] ? String(x.totals[d.name]) : ""])));
    document.getElementById("area-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function cancelAreaEdit() { setAEditing(null); setTotals({}); setAmsg(null); }
  async function removeArea(x: AreaSet) {
    if (!window.confirm(`ลบรายการพื้นที่ปลูกพืชทั้งหมด ปีงบประมาณ ${x.fy}?\nปีงบประมาณนี้จะไม่มีค่าเป้าหมาย (ใช้พื้นที่สะสมแทน) · รายงานที่ส่งแล้วไม่ถูกลบ`)) return;
    const ok = await putAreaSets(aList.filter(y => y.id !== x.id), "ลบรายการแล้ว");
    if (ok && aEditing === x.id) cancelAreaEdit();
  }

  // ---------- ปุ๋ยอินทรีย์และวัสดุอินทรีย์ (เกษตรตำบลรายอำเภอ + เป้าหมายการผลิต) ----------
  const tList: TambonSet[] = [...(settings.tambonSets ?? [])].sort((x, y) => y.fy - x.fy);
  const tFy = tfyIn ?? curFy;
  const tFyOptions = fiscalYearOptions(cfg, [...(curFy ? [curFy - 1, curFy, curFy + 1, curFy + 2] : []), ...tList.map(x => x.fy), ...(tFy ? [tFy] : [])]);
  const perN = Number(perT), perOk = perT !== "" && Number.isFinite(perN) && perN >= 0;
  const tNum = (name: string) => Number(tambons[name]) || 0;
  const sumTambon = DISTRICTS.reduce((a, d) => a + tNum(d.name), 0);
  const tSetCount = DISTRICTS.filter(d => (tambons[d.name] ?? "") !== "").length;
  const tShown = DISTRICTS.filter(d => d.name.includes(tq.trim()));
  const f0 = (v: number) => v.toLocaleString("th-TH", { maximumFractionDigits: 2 });

  async function putTambonSets(next: TambonSet[], okMsg: string) {
    setTbusy(true); setTmsg(null);
    try {
      const res = await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tambonSets: next }) });
      const data: unknown = await res.json();
      if (!res.ok) {
        setTmsg({ t: typeof data === "object" && data !== null && "error" in data && typeof data.error === "string" ? data.error : "บันทึกไม่สำเร็จ", bad: true });
        return false;
      }
      setSettings(data as Settings);
      setTmsg({ t: okMsg });
      return true;
    } catch {
      setTmsg({ t: "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่อีกครั้ง", bad: true });
      return false;
    } finally {
      setTbusy(false);
    }
  }
  async function saveTambons() {
    if (!tFy) return;
    if (!perOk) { setTmsg({ t: "เป้าหมายต่อเกษตรตำบล 1 ราย ต้องเป็นตัวเลขที่ไม่ติดลบ", bad: true }); return; }
    const out: Record<string, number> = {};
    for (const d of DISTRICTS) {
      const t = tambons[d.name] ?? "";
      if (t === "") continue;
      const v = Number(t);
      if (!Number.isInteger(v) || v < 0) { setTmsg({ t: `จำนวนเกษตรตำบลของอำเภอ${d.name}ต้องเป็นจำนวนเต็มที่ไม่ติดลบ`, bad: true }); return; }
      out[d.name] = v;
    }
    if (!Object.keys(out).length) { setTmsg({ t: "กรอกจำนวนเกษตรตำบลอย่างน้อย 1 อำเภอก่อนบันทึก", bad: true }); return; }
    const others = tList.filter(x => x.id !== tEditing);
    if (others.some(x => x.fy === tFy)) { setTmsg({ t: `มีรายการเกษตรตำบลปีงบประมาณ ${tFy} อยู่แล้ว กดปุ่ม “แก้ไข” ที่รายการด้านล่างได้เลย`, bad: true }); return; }
    const ok = await putTambonSets([...others, { id: `tambon-${tFy}`, fy: tFy, perTambon: perN, tambon: out }], (tEditing ? "บันทึกการแก้ไขแล้ว" : "เพิ่มรายการแล้ว") + " ตารางปุ๋ยอินทรีย์ Dashboard และไฟล์ Excel จะคำนวณเป้าหมายการผลิตใหม่ทันที");
    if (ok) { setTEditing(null); setTambons({}); setPerT(String(DEFAULT_PER_TAMBON)); }
  }
  function startTambonEdit(x: TambonSet) {
    setTmsg(null); setTEditing(x.id); setTfyIn(x.fy); setTq(""); setPerT(String(x.perTambon));
    setTambons(Object.fromEntries(DISTRICTS.map(d => [d.name, x.tambon[d.name] !== undefined ? String(x.tambon[d.name]) : ""])));
    document.getElementById("tambon-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function cancelTambonEdit() { setTEditing(null); setTambons({}); setPerT(String(DEFAULT_PER_TAMBON)); setTmsg(null); }
  // เติมจำนวนเกษตรตำบลเริ่มต้นของแต่ละอำเภอ (ค่าจากไฟล์ Excel เดิม) เพื่อแก้ต่อได้เลย
  const fillDefaults = () => setTambons(Object.fromEntries(DISTRICTS.map(d => [d.name, String(d.tambon)])));
  async function removeTambon(x: TambonSet) {
    if (!window.confirm(`ลบรายการเกษตรตำบลและเป้าหมายการผลิต ปีงบประมาณ ${x.fy}?\nปีงบประมาณนี้จะกลับไปใช้จำนวนเกษตรตำบลเริ่มต้นและตัวคูณ ${f0(cfg.targetPerTambon)} ตัน/ราย · รายงานที่ส่งแล้วไม่ถูกลบ`)) return;
    const ok = await putTambonSets(tList.filter(y => y.id !== x.id), "ลบรายการแล้ว");
    if (ok && tEditing === x.id) cancelTambonEdit();
  }

  const shown = DISTRICTS.filter(d => d.name.includes(q.trim()));
  const setCount = DISTRICTS.filter(d => num(d.name) > 0).length;
  const dayOk = days.every(d => d !== "" && Number(d) >= 1 && Number(d) <= 31);

  return (
    <div style={{ maxWidth: 980 }}>
      <div className="ux-stack">
        <Step n={1} title="รายการที่ต้องรายงาน · รอบและวันกำหนดส่ง" hint="เลือกรายการ + ปีงบประมาณ แล้วกำหนดว่าอำเภอต้องรายงานกี่ครั้งต่อเดือน และส่งภายในวันที่เท่าไร">
          <div id="sched-form" style={{ scrollMarginTop: "5rem" }}>
            {editing && <div className="ux-banner warn" role="status">{I.info}<div>กำลังแก้ไขรายการ “{topicLabel(list.find(x => x.id === editing)?.topic ?? topic)}” ปีงบประมาณ {list.find(x => x.id === editing)?.fy} — ปรับแล้วกด “บันทึกการแก้ไข”</div></div>}
            <div className="ux-formgrid" style={{ marginTop: editing ? ".9rem" : 0 }}>
              <div>
                <label className="ux-lbl" htmlFor="sc-topic">รายการที่ต้องรายงาน</label>
                <select id="sc-topic" className="ux-select" value={topic} onChange={e => setTopic(e.target.value as Topic)}>
                  {TOPICS.filter(t => t.key !== "burn").map(t => <option key={t.key} value={t.key}>{topicLabelOf(cfg, t.key)}</option>)}
                </select>
              </div>
              <div>
                <label className="ux-lbl" htmlFor="sc-fy">ปีงบประมาณ</label>
                <select id="sc-fy" className="ux-select" value={fy || ""} onChange={e => setFyIn(Number(e.target.value))} disabled={!fy}>
                  {fyOptions.map(y => <option key={y} value={y}>ปีงบประมาณ {y}{y === curFy ? " (ปัจจุบัน)" : ""}</option>)}
                </select>
                {fy > 0 && <small className="ux-hint">{thaiMonth(fiscalRange(fy, topic).from)} – {thaiMonth(fiscalRange(fy, topic).to)}</small>}
              </div>
            </div>

            <span className="ux-lbl" id="rc" style={{ marginTop: "1.2rem" }}>จำนวนครั้งที่ต้องรายงานต่อเดือน</span>
            <div className="ux-rounds" role="group" aria-labelledby="rc">
              {Array.from({ length: MAX_ROUNDS }, (_, i) => i + 1).map(k => (
                <button key={k} type="button" aria-pressed={n === k} onClick={() => setDays(even(k))}><b>{k}</b>ครั้ง/เดือน</button>))}
            </div>
            <span className="ux-lbl" style={{ marginTop: "1.2rem" }}>วันที่ต้องส่งของแต่ละรอบ</span>
            <div style={{ display: "grid", gap: ".6rem" }}>
              {days.map((d, i) => (
                <div key={i} className="ux-due">
                  <b>รอบที่ {i + 1}</b>
                  <label htmlFor={`d${i}`}>ส่งภายในวันที่</label>
                  <input id={`d${i}`} type="number" min={1} max={31} value={d} onChange={e => setDays(days.map((x, j) => (j === i ? e.target.value : x)))} />
                  <span className="ux-hint" style={{ margin: 0 }}>{fy > 0 && <>ตัวอย่าง {thaiMonth(fiscalRange(fy, topic).from)}: ภายใน {d && Number(d) >= 1 && Number(d) <= 31 ? thaiDate(dueDateOf(fiscalRange(fy, topic).from, Number(d))) : "–"}</>}</span>
                </div>))}
            </div>
            <div className="ux-banner">{I.info}<div>วันที่ 31 = สิ้นสุดเดือน · วันที่ของแต่ละรอบต้องเรียงจากน้อยไปมาก · ส่งหลังวันกำหนดระบบจะแสดงว่า “ส่งช้า” (นับจากการส่งครั้งแรก) · แต่ละรอบกรอกเฉพาะปริมาณของรอบนั้น ระบบรวมเป็นยอดเดือนให้ · ปีงบประมาณที่ยังไม่มีรายการจะใช้ค่าเริ่มต้น {settings.dueDays.length} ครั้ง/เดือน</div></div>
            {msg && <p className={`ux-toast${msg.bad ? " bad" : ""}`} style={{ marginTop: ".9rem" }} role="status">{msg.t}</p>}
            <div style={{ marginTop: "1rem", display: "flex", gap: ".6rem", flexWrap: "wrap" }}>
              <button className="ux-btn" disabled={busy || !dayOk || !fy} onClick={save}>{I.save}{editing ? "บันทึกการแก้ไข" : "บันทึกรายการ"}</button>
              {editing && <button className="ux-btn line" disabled={busy} onClick={cancelEdit}>ยกเลิกการแก้ไข</button>}
            </div>
          </div>

          <div className="ux-sched">
            <h3>รายการที่บันทึกไว้ <span>{list.length} รายการ</span></h3>
            {list.length === 0 ? <p className="ux-empty">ยังไม่มีรายการที่บันทึกไว้ · เพิ่มรายการแรกจากฟอร์มด้านบน</p> : (
              <ul>{list.map(x => (
                <li key={x.id} className={editing === x.id ? "on" : ""}>
                  <div className="tx">
                    <b>{topicLabel(x.topic)}</b>
                    <span className="fy">ปีงบประมาณ {x.fy}</span>
                    <p><strong>รายงาน {x.dueDays.length} ครั้ง/เดือน</strong> · {daysText(x.dueDays)}</p>
                  </div>
                  <div className="act">
                    <button type="button" className="ux-btn line sm" disabled={busy} onClick={() => startEdit(x)}>แก้ไข</button>
                    <button type="button" className="ux-btn line sm danger" disabled={busy} onClick={() => remove(x)}>ลบ</button>
                  </div>
                </li>))}
              </ul>)}
          </div>
        </Step>

        <Step n={2} title="พื้นที่ปลูกพืชทั้งหมดรายอำเภอ" hint={`กำหนดรายปีงบประมาณ · ใช้คำนวณเป้าหมายร้อยละ ${AREA_TARGET_PCT} และร้อยละของพื้นที่สะสม · อำเภอไม่ต้องกรอก · เว้นว่าง = ยังไม่กำหนด`} done={aList.length > 0}>
          <div id="area-form" style={{ scrollMarginTop: "5rem" }}>
          {aEditing && <div className="ux-banner warn" role="status" style={{ marginTop: 0, marginBottom: ".9rem" }}>{I.info}<div>กำลังแก้ไขพื้นที่ปลูกพืชทั้งหมด ปีงบประมาณ {aList.find(x => x.id === aEditing)?.fy} — ปรับแล้วกด “บันทึกการแก้ไข”</div></div>}
          <div className="ux-formgrid" style={{ marginBottom: ".9rem" }}>
            <div>
              <label className="ux-lbl" htmlFor="ar-fy">ปีงบประมาณ</label>
              <select id="ar-fy" className="ux-select" value={aFy || ""} onChange={e => setAfyIn(Number(e.target.value))} disabled={!aFy}>
                {aFyOptions.map(y => <option key={y} value={y}>ปีงบประมาณ {y}{y === curFy ? " (ปัจจุบัน)" : ""}</option>)}
              </select>
              {aFy > 0 && <small className="ux-hint">{thaiMonth(fiscalRange(aFy, "area").from)} – {thaiMonth(fiscalRange(aFy, "area").to)}</small>}
            </div>
          </div>
          <div className="ux-kpis" style={{ marginBottom: ".9rem" }}>
            <div className="ux-kpi"><i>{I.box}</i><div><small>รวมทั้งจังหวัด</small><b>{f2(sumTotal)} <span>ไร่</span></b></div></div>
            <div className="ux-kpi" style={{ ["--kc" as string]: "#b08a2c" }}><i>{I.check}</i><div><small>เป้าหมายร้อยละ {AREA_TARGET_PCT}</small><b>{f2((sumTotal * AREA_TARGET_PCT) / 100)} <span>ไร่</span></b></div></div>
            <div className="ux-kpi" style={{ ["--kc" as string]: "#059669" }}><i>{I.send}</i><div><small>กำหนดแล้ว</small><b>{setCount} / {DISTRICTS.length} <span>อำเภอ</span></b></div></div>
          </div>
          <input className="ux-search" type="search" placeholder="ค้นหาชื่ออำเภอ" aria-label="ค้นหาอำเภอ" value={q} onChange={e => setQ(e.target.value)} />
          <div className="ux-areas" style={{ marginTop: ".9rem" }}>
            {shown.map(d => (
              <div className="ux-areacell" key={d.name}>
                <label htmlFor={`a-${d.name}`}>{d.name}<small>เป้า {f2((num(d.name) * AREA_TARGET_PCT) / 100)} ไร่</small></label>
                <div className={`ux-num-in${totals[d.name] ? " filled" : ""}`}>
                  <input id={`a-${d.name}`} type="number" inputMode="decimal" min={0} step="any" placeholder="ยังไม่กำหนด" value={totals[d.name] ?? ""} onChange={e => setTotals({ ...totals, [d.name]: e.target.value })} /><span>ไร่</span>
                </div>
              </div>))}
            {!shown.length && <p className="ux-empty">ไม่พบอำเภอที่ค้นหา</p>}
          </div>
          <div className="ux-sticky-save">
            <span>{amsg ? <span className={`ux-toast${amsg.bad ? " bad" : ""}`} role="status">{amsg.t}</span> : <span className="ux-note">กรอกเสร็จแล้วกดบันทึก ระบบจะคำนวณ Dashboard และ Excel ใหม่ทันที</span>}</span>
            <div style={{ display: "flex", gap: ".6rem", flexWrap: "wrap" }}>
              {aEditing && <button className="ux-btn line" disabled={abusy} onClick={cancelAreaEdit}>ยกเลิก</button>}
              <button className="ux-btn" disabled={abusy || !aFy} onClick={saveAreas}>{I.save}{aEditing ? "บันทึกการแก้ไข" : "บันทึกรายการ"}</button>
            </div>
          </div>
          </div>

          <div className="ux-sched">
            <h3>รายการที่บันทึกไว้ <span>{aList.length} รายการ</span></h3>
            {aList.length === 0 ? <p className="ux-empty">ยังไม่มีรายการที่บันทึกไว้ · กรอกพื้นที่ด้านบนแล้วกด “บันทึกรายการ”</p> : (
              <ul>{aList.map(x => {
                const sum = DISTRICTS.reduce((a, d) => a + (x.totals[d.name] ?? 0), 0), cnt = DISTRICTS.filter(d => (x.totals[d.name] ?? 0) > 0).length;
                return (
                  <li key={x.id} className={aEditing === x.id ? "on" : ""}>
                    <div className="tx">
                      <b>พื้นที่ปลูกพืชทั้งหมด</b>
                      <span className="fy">ปีงบประมาณ {x.fy}</span>
                      <p><strong>รวม {f2(sum)} ไร่</strong> · เป้าหมายร้อยละ {AREA_TARGET_PCT} = {f2((sum * AREA_TARGET_PCT) / 100)} ไร่ · กำหนดแล้ว {cnt} / {DISTRICTS.length} อำเภอ</p>
                    </div>
                    <div className="act">
                      <button type="button" className="ux-btn line sm" disabled={abusy} onClick={() => startAreaEdit(x)}>แก้ไข</button>
                      <button type="button" className="ux-btn line sm danger" disabled={abusy} onClick={() => removeArea(x)}>ลบ</button>
                    </div>
                  </li>);
              })}</ul>)}
            {legacyCount > 0 && <p className="ux-hint" style={{ marginTop: ".7rem" }}>มีค่าพื้นที่ที่เคยตั้งไว้แบบเดิม {legacyCount} อำเภอ — ระบบใช้กับปีงบประมาณที่ยังไม่มีรายการ</p>}
          </div>
        </Step>

        <Step n={3} title="ปุ๋ยอินทรีย์และวัสดุอินทรีย์ · เกษตรตำบลและเป้าหมายการผลิต" hint="กำหนดรายปีงบประมาณ · กรอกจำนวนเกษตรตำบลของแต่ละอำเภอ ระบบคำนวณเป้าหมายการผลิต = เกษตรตำบล × ตัวคูณ (ค่าเริ่มต้น 130 ตัน/ราย) · ช่องปุ๋ยที่ให้อำเภอกรอกแก้ได้ที่แท็บ “หัวข้อและรายการ”" done={tList.length > 0}>
          <div id="tambon-form" style={{ scrollMarginTop: "5rem" }}>
          {tEditing && <div className="ux-banner warn" role="status" style={{ marginTop: 0, marginBottom: ".9rem" }}>{I.info}<div>กำลังแก้ไขเกษตรตำบลและเป้าหมายการผลิต ปีงบประมาณ {tList.find(x => x.id === tEditing)?.fy} — ปรับแล้วกด “บันทึกการแก้ไข”</div></div>}
          <div className="ux-formgrid" style={{ marginBottom: ".9rem" }}>
            <div>
              <label className="ux-lbl" htmlFor="tb-fy">ปีงบประมาณ</label>
              <select id="tb-fy" className="ux-select" value={tFy || ""} onChange={e => setTfyIn(Number(e.target.value))} disabled={!tFy}>
                {tFyOptions.map(y => <option key={y} value={y}>ปีงบประมาณ {y}{y === curFy ? " (ปัจจุบัน)" : ""}</option>)}
              </select>
              {tFy > 0 && <small className="ux-hint">{thaiMonth(fiscalRange(tFy, "fert").from)} – {thaiMonth(fiscalRange(tFy, "fert").to)}</small>}
            </div>
            <div>
              <label className="ux-lbl" htmlFor="tb-per">เป้าหมายการผลิตต่อเกษตรตำบล 1 ราย</label>
              <div className="ux-num-in filled"><input id="tb-per" type="number" inputMode="decimal" min={0} step="any" value={perT} onChange={e => setPerT(e.target.value)} /><span>ตัน</span></div>
              <small className="ux-hint">สูตร: เป้าหมายการผลิต = จำนวนเกษตรตำบล × {perOk ? f0(perN) : "–"}{perOk && DISTRICTS[0] && <> · ตัวอย่าง {DISTRICTS[0].name} {tambons[DISTRICTS[0].name] ? tNum(DISTRICTS[0].name) : DISTRICTS[0].tambon} ราย = {f0((tambons[DISTRICTS[0].name] ? tNum(DISTRICTS[0].name) : DISTRICTS[0].tambon) * perN)} ตัน</>}</small>
            </div>
          </div>
          <div className="ux-kpis" style={{ marginBottom: ".9rem" }}>
            <div className="ux-kpi"><i>{I.box}</i><div><small>เกษตรตำบลรวมทั้งจังหวัด</small><b>{f0(sumTambon)} <span>ราย</span></b></div></div>
            <div className="ux-kpi" style={{ ["--kc" as string]: "#b08a2c" }}><i>{I.check}</i><div><small>เป้าหมายการผลิตรวม</small><b>{f0(perOk ? sumTambon * perN : 0)} <span>ตัน</span></b></div></div>
            <div className="ux-kpi" style={{ ["--kc" as string]: "#059669" }}><i>{I.send}</i><div><small>กำหนดแล้ว</small><b>{tSetCount} / {DISTRICTS.length} <span>อำเภอ</span></b></div></div>
          </div>
          <div style={{ display: "flex", gap: ".6rem", flexWrap: "wrap", alignItems: "center" }}>
            <input className="ux-search" style={{ flex: "1 1 220px" }} type="search" placeholder="ค้นหาชื่ออำเภอ" aria-label="ค้นหาอำเภอ (เกษตรตำบล)" value={tq} onChange={e => setTq(e.target.value)} />
            <button type="button" className="ux-btn line sm" onClick={fillDefaults}>ใช้จำนวนเริ่มต้นของทุกอำเภอ</button>
          </div>
          <div className="ux-areas" style={{ marginTop: ".9rem" }}>
            {tShown.map(d => (
              <div className="ux-areacell" key={d.name}>
                <label htmlFor={`t-${d.name}`}>{d.name}<small>เป้าหมาย {f0(perOk ? tNum(d.name) * perN : 0)} ตัน</small></label>
                <div className={`ux-num-in${tambons[d.name] ? " filled" : ""}`}>
                  <input id={`t-${d.name}`} type="number" inputMode="numeric" min={0} step={1} placeholder={`เริ่มต้น ${d.tambon}`} value={tambons[d.name] ?? ""} onChange={e => setTambons({ ...tambons, [d.name]: e.target.value })} /><span>ราย</span>
                </div>
              </div>))}
            {!tShown.length && <p className="ux-empty">ไม่พบอำเภอที่ค้นหา</p>}
          </div>
          <div className="ux-sticky-save">
            <span>{tmsg ? <span className={`ux-toast${tmsg.bad ? " bad" : ""}`} role="status">{tmsg.t}</span> : <span className="ux-note">เว้นว่าง = ใช้จำนวนเริ่มต้นของอำเภอ · กรอกเสร็จแล้วกดบันทึก ระบบจะคำนวณเป้าหมายการผลิตใหม่ทันที</span>}</span>
            <div style={{ display: "flex", gap: ".6rem", flexWrap: "wrap" }}>
              {tEditing && <button className="ux-btn line" disabled={tbusy} onClick={cancelTambonEdit}>ยกเลิก</button>}
              <button className="ux-btn" disabled={tbusy || !tFy || !perOk} onClick={saveTambons}>{I.save}{tEditing ? "บันทึกการแก้ไข" : "บันทึกรายการ"}</button>
            </div>
          </div>
          </div>

          <div className="ux-sched">
            <h3>รายการที่บันทึกไว้ <span>{tList.length} รายการ</span></h3>
            {tList.length === 0 ? <p className="ux-empty">ยังไม่มีรายการที่บันทึกไว้ · กรอกจำนวนเกษตรตำบลด้านบนแล้วกด “บันทึกรายการ”</p> : (
              <ul>{tList.map(x => {
                const sum = DISTRICTS.reduce((a, d) => a + (x.tambon[d.name] ?? d.tambon), 0), cnt = DISTRICTS.filter(d => x.tambon[d.name] !== undefined).length;
                return (
                  <li key={x.id} className={tEditing === x.id ? "on" : ""}>
                    <div className="tx">
                      <b>ปุ๋ยอินทรีย์และวัสดุอินทรีย์</b>
                      <span className="fy">ปีงบประมาณ {x.fy}</span>
                      <p><strong>เกษตรตำบล {f0(sum)} ราย</strong> · เป้าหมายการผลิต {f0(sum)} × {f0(x.perTambon)} = {f0(sum * x.perTambon)} ตัน · กำหนดแล้ว {cnt} / {DISTRICTS.length} อำเภอ</p>
                    </div>
                    <div className="act">
                      <button type="button" className="ux-btn line sm" disabled={tbusy} onClick={() => startTambonEdit(x)}>แก้ไข</button>
                      <button type="button" className="ux-btn line sm danger" disabled={tbusy} onClick={() => removeTambon(x)}>ลบ</button>
                    </div>
                  </li>);
              })}</ul>)}
          </div>
        </Step>
      </div>
    </div>
  );
}

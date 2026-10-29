import { FY_END_MONTH, FY_START_MONTH } from "./constants";
import { pad2, thaiMonth } from "./dates";
import type { FiscalYearDef, Settings, Topic, TopicPeriods } from "./types";

let PERIODS: Record<number, { s: number; e: number; t: TopicPeriods }> = {};

export const applyFiscalPeriods = (list: { fy: number; startMonth: number; endMonth: number; topics?: TopicPeriods }[] | undefined) => {
  PERIODS = Object.fromEntries((list ?? []).map(d => [d.fy, { s: d.startMonth, e: d.endMonth, t: d.topics ?? {} }]));
};

// เดือนเริ่ม > เดือนสิ้นสุด = ข้ามปี (เช่น พ.ย. – มิ.ย.: เริ่มในปี ค.ศ. ก่อนหน้า) · เดือนเริ่ม <= เดือนสิ้นสุด = อยู่ในปีเดียว
export const fiscalRangeFor = (fyBE: number, sm: number, em: number) => {
  const endY = fyBE - 543, startY = sm > em ? endY - 1 : endY;
  return { from: `${startY}-${pad2(sm)}`, to: `${endY}-${pad2(em)}` };
};

// topic = ช่วงเดือนของหัวข้อนั้น (ถ้าจังหวัดกำหนดแยกไว้) · ไม่ระบุ = ช่วงรวมของปี
export const fiscalRange = (fyBE: number, topic?: Topic) => {
  const p = PERIODS[fyBE], o = topic ? p?.t[topic] : undefined;
  const sm = o?.startMonth ?? p?.s ?? FY_START_MONTH, em = o?.endMonth ?? p?.e ?? FY_END_MONTH;
  return fiscalRangeFor(fyBE, sm, em);
};
/** เดือน ym อยู่ในช่วงรายงานของหัวข้อ topic หรือไม่ */

export const isTopicMonth = (topic: Topic, ym: string) => { const r = fiscalRange(fiscalYearOf(ym), topic); return ym >= r.from && ym <= r.to; };
/** เดือนที่อยู่ในช่วงรวมของปีงบประมาณ แต่หัวข้อนี้ไม่ต้องรายงาน (เช่น ปุ๋ยรายงานถึง พ.ค. แต่ช่วงรวมถึง มิ.ย.) */

export const topicOff = (topic: Topic, ym: string) => {
  const fy = fiscalYearOf(ym), o = fiscalRange(fy), t = fiscalRange(fy, topic);
  return ym >= o.from && ym <= o.to && (ym < t.from || ym > t.to);
};

export const fiscalYearOf = (ym: string) => {
  for (const k of Object.keys(PERIODS)) {
    const fy = Number(k), tops = Object.keys(PERIODS[fy].t) as Topic[]; // เดือนที่อยู่ในช่วงรวมหรือช่วงของหัวข้อใดหัวข้อหนึ่ง ถือเป็นของปีงบประมาณนั้น
    for (const r of [fiscalRange(fy), ...tops.map(t => fiscalRange(fy, t))]) if (ym >= r.from && ym <= r.to) return fy;
  }
  const [y, m] = ym.split("-").map(Number);
  return y + 543 + (m > FY_END_MONTH ? 1 : 0); // เดือนนอกช่วง: นับเป็นของปีงบประมาณถัดไป
};

export const periodMonths = (startMonth: number, endMonth: number) => ((endMonth - startMonth + 12) % 12) + 1;

export const normalizeFiscalYears = (raw: unknown): FiscalYearDef[] =>
  (Array.isArray(raw) ? raw : []).map(x => typeof x === "number" ? { fy: x, startMonth: FY_START_MONTH, endMonth: FY_END_MONTH } : x as FiscalYearDef);

export const isFiscalRange = (from: string, to: string) => !!from && !!to && fiscalRange(fiscalYearOf(to)).from === from && fiscalRange(fiscalYearOf(to)).to === to;

// วันกำหนดส่งของหัวข้อ ณ เดือนนั้น: ใช้รายการของปีงบประมาณที่เดือนนั้นอยู่ ถ้าไม่มีใช้ค่าเริ่มต้น settings.dueDays
export const dueDaysFor = (s: Settings, topic: Topic, month?: string): number[] => {
  if (!month) return s.dueDays;
  const fy = fiscalYearOf(month);
  return (s.schedules ?? []).find(x => x.topic === topic && x.fy === fy)?.dueDays ?? s.dueDays;
};

// พื้นที่ปลูกพืชทั้งหมดรายอำเภอ ณ เดือนนั้น: ใช้รายการของปีงบประมาณที่เดือนนั้นอยู่ ถ้าไม่มีใช้ค่าสำรอง settings.areaTotals
export const areaTotalsFor = (s: Settings, month: string): Record<string, number> =>
  (month ? (s.areaSets ?? []).find(x => x.fy === fiscalYearOf(month))?.totals : undefined) ?? s.areaTotals;

// ป้ายช่วงเวลา: ถ้าเป็นปีงบประมาณเต็มปี แสดง "ปีงบประมาณ 2569" ไม่เช่นนั้นแสดงช่วงเดือน
export const rangeLabel = (from: string, to: string) => (isFiscalRange(from, to) ? `ปีงบประมาณ ${fiscalYearOf(to)}` : `${thaiMonth(from)} – ${thaiMonth(to)}`);

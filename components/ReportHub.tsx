"use client";
import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import { useDistrict } from "@/components/District";
import { PageHead } from "@/components/Entry";
import DistrictReport from "@/components/DistrictReport";
import DistrictAreaReport from "@/components/DistrictAreaReport";
import DistrictBurnReport from "@/components/DistrictBurnReport";
import { TopicTabs, type TopicKey } from "@/components/ReportKit";

const isTopic = (v: string | null): v is TopicKey => v === "fert" || v === "area" || v === "burn";

// หน้ากรอกรายงานหน้าเดียว สลับ ปุ๋ย / ไถกลบ / หยุดเผา ด้วยแท็บ (ลิงก์เดิม /district/area และ /district/burn ยังใช้ได้)
export default function ReportHub({ initial }: { initial: TopicKey }) {
  const { district } = useDistrict();
  const [topic, setTopic] = useState<TopicKey | null>(null);
  const period = useRef({ month: "", round: 1 });

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search), q = sp.get("topic");
    const t = isTopic(q) ? q : initial;
    if (window.location.pathname !== "/district/report" || q !== t) { sp.set("topic", t); window.history.replaceState(null, "", `/district/report?${sp}`); }
    startTransition(() => setTopic(t));
  }, [initial]);

  const onPeriod = useCallback((month: string, round: number) => { period.current = { month, round }; }, []);
  const go = useCallback((t: TopicKey, month?: string, round?: number) => {
    const m = month ?? period.current.month, r = round ?? period.current.round;
    const sp = new URLSearchParams({ topic: t });
    if (m) sp.set("month", m);
    sp.set("round", String(r));
    window.history.replaceState(null, "", `/district/report?${sp}`); // ฟอร์มหัวข้อใหม่อ่านเดือน/รอบจาก URL ตอนเปิด
    setTopic(t);
    window.scrollTo({ top: 0 });
  }, []);

  if (!topic) return null;
  return (<>
    <PageHead title="กรอกรายงาน" sub={`อำเภอ${district} · เลือกหัวข้อที่ต้องการรายงาน ระบบเลือกเดือนปัจจุบันให้แล้ว`} />
    <TopicTabs topic={topic} onPick={t => go(t)} />
    <div role="tabpanel" aria-labelledby={`tab-${topic}`}>
      {topic === "fert" && <DistrictReport key="fert" onSwitch={go} onPeriod={onPeriod} />}
      {topic === "area" && <DistrictAreaReport key="area" onSwitch={go} onPeriod={onPeriod} />}
      {topic === "burn" && <DistrictBurnReport key="burn" onSwitch={go} onPeriod={onPeriod} />}
    </div>
  </>);
}

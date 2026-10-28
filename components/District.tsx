"use client";
import { createContext, startTransition, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Shell from "./Shell";

const C = createContext<{ district: string } | null>(null);
export const useDistrict = () => { const v = useContext(C); if (!v) throw new Error("DistrictFrame missing"); return v; };

// อำเภอที่เข้าสู่ระบบอ่านจาก session ฝั่งเซิร์ฟเวอร์ (/api/me) — ไม่เชื่อค่าใน localStorage เพราะผู้ใช้แก้เองได้
export function DistrictFrame({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [district, setDistrict] = useState("");
  useEffect(() => {
    fetch("/api/me").then(r => (r.ok ? r.json() : null)).then((me: { role?: string; district?: string } | null) => {
      if (me?.role === "district" && me.district) startTransition(() => setDistrict(me.district!));
      else router.replace(me?.role === "province" ? "/province" : "/");
    }).catch(() => router.replace("/"));
  }, [router]);
  if (!district) return null;
  return (
    <C.Provider value={{ district }}>
      <Shell org={`อำเภอ${district}`} role="เจ้าหน้าที่อำเภอ" links={[{ href: "/district", label: "ภาพรวมของอำเภอ", hint: "ดูงานที่ต้องกรอกและผลงาน", icon: "home" }, { href: "/district/report", label: "กรอกรายงานปุ๋ย", hint: "ปุ๋ยอินทรีย์และวัสดุอินทรีย์", icon: "edit" }, { href: "/district/area", label: "กรอกพื้นที่ไถกลบฟางข้าว", hint: "เฉพาะเดือน พ.ย. – มิ.ย.", icon: "leaf" }, { href: "/district/burn", label: "การเรียนรู้/ประชาสัมพันธ์หยุดเผา", hint: "กิจกรรมและสื่อรณรงค์หยุดเผา", icon: "leaf" }]}>{children}</Shell>
    </C.Provider>
  );
}

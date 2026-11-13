"use client";
import { createContext, startTransition, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Shell from "./Shell";
import RetentionBanner from "./RetentionBanner";

const C = createContext<{ district: string } | null>(null);
export const useDistrict = () => { const v = useContext(C); if (!v) throw new Error("DistrictFrame missing"); return v; };

// อำเภอที่เข้าสู่ระบบอ่านจาก session ฝั่งเซิร์ฟเวอร์ (/api/me) — ไม่เชื่อค่าใน localStorage เพราะผู้ใช้แก้เองได้
export function DistrictFrame({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [district, setDistrict] = useState("");
  useEffect(() => {
    fetch("/api/me").then(r => (r.ok ? r.json() : null)).then((me: { role?: string; district?: string; mustChange?: boolean } | null) => {
      if (me?.mustChange) router.replace("/change-password");
      else if (me?.role === "district" && me.district) startTransition(() => setDistrict(me.district!));
      else router.replace(me?.role === "province" ? "/province" : "/");
    }).catch(() => router.replace("/"));
  }, [router]);
  if (!district) return null;
  return (
    <C.Provider value={{ district }}>
      <Shell org={`อำเภอ${district}`} role="เจ้าหน้าที่อำเภอ" links={[
        { href: "/district", label: "หน้าหลัก", hint: "งานที่ต้องทำ", icon: "home" },
        { href: "/district/report", label: "กรอกรายงาน", short: "กรอกรายงาน", hint: "ปุ๋ย · ไถกลบ · หยุดเผา", icon: "edit" }]}><RetentionBanner role="district" />{children}</Shell>
    </C.Provider>
  );
}

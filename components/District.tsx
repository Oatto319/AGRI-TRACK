"use client";
import { createContext, startTransition, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Shell from "./Shell";

const C = createContext<{ district: string } | null>(null);
export const useDistrict = () => { const v = useContext(C); if (!v) throw new Error("DistrictFrame missing"); return v; };

// อำเภอที่เข้าสู่ระบบถูกเก็บไว้ใน localStorage (ตัวอย่าง — ควรเปลี่ยนเป็นระบบล็อกอินจริง)
export function DistrictFrame({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [district, setDistrict] = useState("");
  useEffect(() => {
    const d = localStorage.getItem("district");
    if (d) startTransition(() => setDistrict(d)); else router.replace("/");
  }, [router]);
  if (!district) return null;
  return (
    <C.Provider value={{ district }}>
      <Shell org={`อำเภอ${district}`} role="เจ้าหน้าที่อำเภอ" links={[{ href: "/district", label: "Dashboard อำเภอ" }, { href: "/district/report", label: "กรอกรายงานรายเดือน" }, { href: "/district/area", label: "ข้อมูลพื้นที่และฟางข้าว" }]}>{children}</Shell>
    </C.Provider>
  );
}

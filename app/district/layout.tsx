import type { ReactNode } from "react";
import { DistrictFrame } from "@/components/District";

// layout อยู่คงที่ระหว่างเปลี่ยนหน้า จึงเก็บข้อมูลที่กรอกไว้ได้ครบทุกหัวข้อ
export default function DistrictLayout({ children }: { children: ReactNode }) {
  return <DistrictFrame>{children}</DistrictFrame>;
}

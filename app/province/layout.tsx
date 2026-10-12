import type { ReactNode } from "react";
import { ProvinceFrame } from "@/components/Province";

export default function ProvinceLayout({ children }: { children: ReactNode }) {
  return <ProvinceFrame>{children}</ProvinceFrame>;
}

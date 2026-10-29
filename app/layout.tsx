import type { Metadata } from "next";
import { Prompt, Sarabun } from "next/font/google";
import "./globals.css";
import "./ux.css";
import { ConfirmProvider } from "@/components/ConfirmDialog";

const head = Prompt({ subsets: ["thai", "latin"], weight: ["500", "600"], variable: "--f-head" });
const body = Sarabun({ subsets: ["thai", "latin"], weight: ["400", "500", "700"], variable: "--f-body" });
export const metadata: Metadata = { title: "ระบบรายงานผลการดำเนินงานระดับอำเภอ" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="th"><body className={`${head.variable} ${body.variable}`}><ConfirmProvider>{children}</ConfirmProvider></body></html>);
}

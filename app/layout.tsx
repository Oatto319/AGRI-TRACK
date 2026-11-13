import type { Metadata } from "next";
import { Sarabun } from "next/font/google";
import "./globals.css";
import "./ux.css";
import "./gov.css";
import { ConfirmProvider } from "@/components/ConfirmDialog";

const body = Sarabun({ subsets: ["thai", "latin"], weight: ["400", "500", "600", "700"], variable: "--f-body" });
export const metadata: Metadata = { title: "ระบบรายงานผลการดำเนินงานระดับอำเภอ" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="th" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: `try{var v=localStorage.getItem("agri-fs");if(/^[0-3]$/.test(v))document.documentElement.dataset.fs=v}catch(e){}` }} /></head><body className={body.variable}><ConfirmProvider>{children}</ConfirmProvider></body></html>);
}

"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";

export type NavIcon = "home" | "edit" | "leaf" | "table" | "gear";
export interface NavLink { href: string; label: string; hint?: string; icon?: NavIcon; done?: boolean }

const p = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;
export const NavIcons: Record<NavIcon, ReactNode> = {
  home: <svg {...p}><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /><path d="M10 20v-6h4v6" /></svg>,
  edit: <svg {...p}><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z" /><path d="M13.5 6.5l4 4" /></svg>,
  leaf: <svg {...p}><path d="M5 19C5 10 10 5 20 4c0 10-5 15-14 15" /><path d="M5 19c3-5 6-8 10-10" /></svg>,
  table: <svg {...p}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 10h18M9 4v16" /></svg>,
  gear: <svg {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>,
};
const Logo = <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 22V9" /><path d="M12 9c0-3 2-5 5-5 0 3-2 5-5 5z" /><path d="M12 13c0-3-2-5-5-5 0 3 2 5 5 5z" /><path d="M12 17c0-3 2-5 5-5 0 3-2 5-5 5z" /></svg>;

export default function Shell({ org, role, links, children }:
  { org: string; role: string; links: NavLink[]; children: ReactNode }) {
  const path = usePathname();
  const [openPath, setOpenPath] = useState<string | null>(null);
  const open = openPath === path;
  const burger = useRef<HTMLButtonElement>(null);
  const current = links.find(l => l.href === path)?.label ?? "";

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpenPath(null); burger.current?.focus(); } };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="app">
      <header className="tb">
        <button ref={burger} className="tb-btn" aria-label="เปิดเมนู" aria-expanded={open} aria-controls="sidebar" onClick={() => setOpenPath(path)}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
        </button>
        <div><b>{current || org}</b><small>{org}</small></div>
      </header>

      <div className={`sb-scrim${open ? " open" : ""}`} onClick={() => setOpenPath(null)} aria-hidden="true" />
      <aside id="sidebar" className={`sb${open ? " open" : ""}`} aria-label="เมนู">
        <div className="sb-brand">
          <span className="sb-logo">{Logo}</span>
          <div><b>ระบบรายงานปุ๋ยอินทรีย์</b><small>จังหวัดศรีสะเกษ</small></div>
          <button className="sb-x" aria-label="ปิดเมนู" onClick={() => { setOpenPath(null); burger.current?.focus(); }}>✕</button>
        </div>
        <div className="sb-who"><small>{role}</small><b>{org}</b></div>
        <nav className="sb-nav" aria-label="เมนูหลัก">
          {links.map(l => (
            <Link key={l.href} href={l.href} aria-current={path === l.href ? "page" : undefined} onClick={() => setOpenPath(null)}>
              <span className="sb-ic">{NavIcons[l.icon ?? "home"]}</span>
              <span><b>{l.label}</b>{l.hint && <small>{l.hint}</small>}</span>
            </Link>))}
        </nav>
        <Link className="sb-out" href="/" onClick={() => { void fetch("/api/logout", { method: "POST" }); }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></svg>ออกจากระบบ
        </Link>
      </aside>

      <div className="main-wrap"><main className="main">{children}</main></div>
    </div>
  );
}

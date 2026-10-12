"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export interface NavLink { href: string; label: string; hint?: string; done?: boolean }

export default function Shell({ org, role, links, children }:
  { org: string; role: string; links: NavLink[]; children: React.ReactNode }) {
  const path = usePathname();
  const [openPath, setOpenPath] = useState<string | null>(null);
  const open = openPath === path;
  const burger = useRef<HTMLButtonElement>(null);
  const current = links.find(l => l.href === path)?.label ?? "";

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpenPath(null); burger.current?.focus(); } };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [open]);

  return (
    <div className="app">
      <header className="top">
        <button ref={burger} className="burger" aria-label="เปิดเมนู" aria-expanded={open} aria-controls="drawer" onClick={() => setOpenPath(path)}>
          <span /><span /><span />
        </button>
        <div className="ttl"><b>{current || org}</b><small>{org}</small></div>
      </header>

      <div className={`scrim-nav${open ? " open" : ""}`} onClick={() => setOpenPath(null)} aria-hidden="true" />
      <aside id="drawer" className={`drawer weave${open ? " open" : ""}`} aria-label="เมนู">
        <div className="dhead">
          <div><p className="org">{org}</p><p className="role">{role}</p></div>
          <button className="x" aria-label="ปิดเมนู" onClick={() => { setOpenPath(null); burger.current?.focus(); }}>✕</button>
        </div>
        <nav aria-label="เมนูหลัก">
          {links.map(l => (
            <Link key={l.href} href={l.href} aria-current={path === l.href ? "page" : undefined}>
              <span>{l.label}{l.hint && <small>{l.hint}</small>}</span>
              {l.done && <i className="tick" aria-label="กรอกครบแล้ว">✓</i>}
            </Link>))}
        </nav>
        <Link className="out" href="/">ออกจากระบบ</Link>
      </aside>

      <main className="main">{children}</main>
    </div>
  );
}

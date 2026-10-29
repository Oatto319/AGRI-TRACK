"use client";
import { useCallback, useEffect, useState } from "react";
import { DISTRICTS, thaiDateTime } from "@/lib/data";
import { PageHead } from "@/components/Entry";
import { useConfirm } from "@/components/ConfirmDialog";

interface U { username: string; role: "province" | "district"; district?: string; active: boolean; mustChange: boolean; lastLoginAt?: string }
interface Cred { username: string; password: string; kind: "สร้างบัญชีใหม่" | "รีเซ็ตรหัสผ่าน" }
const errOf = (d: unknown, fallback: string) => (typeof d === "object" && d !== null && "error" in d && typeof d.error === "string" ? d.error : fallback);

// หน้าจัดการบัญชีผู้ใช้ของจังหวัด: เพิ่มบัญชี · ปิด/เปิดใช้งาน · รีเซ็ตรหัสผ่าน (ระบบสร้างรหัสให้และแสดงครั้งเดียว)
export default function UsersAdmin() {
  const confirm = useConfirm();
  const [users, setUsers] = useState<U[] | null>(null);
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const [cred, setCred] = useState<Cred | null>(null); const [copied, setCopied] = useState(false);
  const [f, setF] = useState({ username: "", role: "district" as U["role"], district: DISTRICTS[0].name });
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    try { const r = await fetch("/api/users"); const d: unknown = await r.json(); if (!r.ok) throw new Error(errOf(d, "โหลดรายชื่อไม่สำเร็จ")); setUsers(d as U[]); setErr(""); }
    catch (e) { setErr(e instanceof Error ? e.message : "โหลดรายชื่อไม่สำเร็จ"); }
  }, []);
  useEffect(() => { void load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect -- โหลดข้อมูลตอนเปิดหน้า

  async function call(method: "POST" | "PATCH", body: unknown): Promise<Record<string, unknown> | null> {
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/users", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d: unknown = await r.json();
      if (!r.ok) { setErr(errOf(d, "ทำรายการไม่สำเร็จ")); return null; }
      return d as Record<string, unknown>;
    } catch { setErr("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่อีกครั้ง"); return null; }
    finally { setBusy(false); }
  }
  async function create(e: React.FormEvent) {
    e.preventDefault();
    const d = await call("POST", { username: f.username, role: f.role, ...(f.role === "district" ? { district: f.district } : {}) });
    if (d) { setCred({ username: (d.user as U).username, password: String(d.password), kind: "สร้างบัญชีใหม่" }); setCopied(false); setF({ ...f, username: "" }); await load(); }
  }
  async function reset(u: U) {
    if (!(await confirm({ title: "รีเซ็ตรหัสผ่าน", message: `สร้างรหัสผ่านใหม่ให้ “${u.username}”?\nรหัสเดิมจะใช้ไม่ได้ทันที และผู้ใช้จะถูกออกจากระบบทุกเครื่อง`, confirmLabel: "รีเซ็ต", danger: true }))) return;
    const d = await call("PATCH", { username: u.username, resetPassword: true });
    if (d) { setCred({ username: u.username, password: String(d.password), kind: "รีเซ็ตรหัสผ่าน" }); setCopied(false); await load(); }
  }
  async function toggle(u: U) {
    if (u.active && !(await confirm({ title: "ปิดการใช้งานบัญชี", message: `ปิดบัญชี “${u.username}”?\nผู้ใช้จะเข้าระบบไม่ได้ และถูกออกจากระบบทันที (เปิดกลับมาได้ภายหลัง · ข้อมูลรายงานไม่ถูกลบ)`, confirmLabel: "ปิดบัญชี", danger: true }))) return;
    if (await call("PATCH", { username: u.username, active: !u.active })) await load();
  }
  const copy = async () => { if (!cred) return; try { await navigator.clipboard.writeText(`ชื่อผู้ใช้: ${cred.username}\nรหัสผ่าน: ${cred.password}`); setCopied(true); } catch { setErr("คัดลอกอัตโนมัติไม่ได้ กรุณาจดรหัสผ่านด้วยตนเอง"); } };

  const shown = (users ?? []).filter(u => !q.trim() || `${u.username} ${u.district ?? "จังหวัด"}`.toLowerCase().includes(q.trim().toLowerCase()));
  return (<>
    <PageHead title="จัดการผู้ใช้" sub="เพิ่มบัญชีเจ้าหน้าที่ ปิด/เปิดการใช้งาน และรีเซ็ตรหัสผ่านที่ลืม · รหัสผ่านที่ระบบสร้างให้จะแสดงครั้งเดียว และผู้ใช้ต้องเปลี่ยนเองตอนเข้าระบบครั้งแรก" />
    {err && <p className="msg bad" role="alert">{err}</p>}

    {cred && (
      <section className="ux-card us-cred" role="status" aria-live="polite">
        <h2>{cred.kind}สำเร็จ — จดรหัสผ่านนี้ไว้ตอนนี้</h2>
        <p className="ux-note">ระบบเก็บเฉพาะค่า hash จึงดูรหัสนี้อีกไม่ได้ (ลืมให้รีเซ็ตใหม่) · ส่งให้ผู้ใช้ผ่านช่องทางที่ปลอดภัย</p>
        <div className="us-code"><span>ชื่อผู้ใช้ <b>{cred.username}</b></span><span>รหัสผ่าน <b>{cred.password}</b></span></div>
        <div className="us-act"><button type="button" className="ux-btn sm" onClick={copy}>{copied ? "คัดลอกแล้ว ✓" : "คัดลอก"}</button><button type="button" className="ux-btn line sm" onClick={() => setCred(null)}>ปิด (จดแล้ว)</button></div>
      </section>)}

    <section className="ux-card" style={{ marginBottom: "1rem" }}>
      <h2>เพิ่มบัญชีใหม่</h2>
      <form className="us-form" onSubmit={create}>
        <div><label className="ux-lbl" htmlFor="nu">ชื่อผู้ใช้ (อังกฤษพิมพ์เล็ก/ตัวเลข 3–32 ตัว)</label><div className="ux-text-in"><input id="nu" value={f.username} onChange={e => setF({ ...f, username: e.target.value })} autoComplete="off" placeholder="เช่น phayuha2" /></div></div>
        <div><label className="ux-lbl" htmlFor="nr">สิทธิ์</label><select id="nr" className="ux-select" value={f.role} onChange={e => setF({ ...f, role: e.target.value as U["role"] })}><option value="district">เจ้าหน้าที่อำเภอ</option><option value="province">เจ้าหน้าที่จังหวัด</option></select></div>
        {f.role === "district" && <div><label className="ux-lbl" htmlFor="nd">อำเภอ</label><select id="nd" className="ux-select" value={f.district} onChange={e => setF({ ...f, district: e.target.value })}>{DISTRICTS.map(d => <option key={d.name} value={d.name}>{d.name}</option>)}</select></div>}
        <button className="ux-btn" disabled={busy || !f.username.trim()}>{busy ? "กำลังสร้าง…" : "สร้างบัญชี"}</button>
      </form>
    </section>

    <section className="ux-card">
      <div className="us-head"><h2>บัญชีทั้งหมด {users ? `(${users.length})` : ""}</h2><div className="ux-text-in" style={{ maxWidth: 260 }}><input aria-label="ค้นหาบัญชี" placeholder="ค้นหาชื่อผู้ใช้/อำเภอ" value={q} onChange={e => setQ(e.target.value)} /></div></div>
      {!users && !err && <p className="ux-empty">กำลังโหลด…</p>}
      {users && (
        <div className="us-wrap"><table className="us-tb">
          <thead><tr><th>ชื่อผู้ใช้</th><th>สิทธิ์</th><th>สถานะ</th><th>เข้าใช้ล่าสุด</th><th><span className="sr-only">จัดการ</span></th></tr></thead>
          <tbody>{shown.map(u => (
            <tr key={u.username} className={u.active ? "" : "off"}>
              <td data-l="ชื่อผู้ใช้"><b>{u.username}</b></td>
              <td data-l="สิทธิ์">{u.role === "province" ? "จังหวัด" : `อำเภอ${u.district}`}</td>
              <td data-l="สถานะ">{u.active ? <span className="us-pill ok">ใช้งานอยู่</span> : <span className="us-pill no">ปิดใช้งาน</span>}{u.mustChange && <span className="us-pill wait" title="ยังไม่ได้เปลี่ยนรหัสผ่านครั้งแรก">รอเปลี่ยนรหัส</span>}</td>
              <td data-l="เข้าใช้ล่าสุด">{u.lastLoginAt ? thaiDateTime(u.lastLoginAt) : "ยังไม่เคยเข้า"}</td>
              <td className="us-ops"><button type="button" className="ux-btn line sm" disabled={busy} onClick={() => reset(u)}>รีเซ็ตรหัสผ่าน</button><button type="button" className={`ux-btn line sm${u.active ? " danger" : ""}`} disabled={busy} onClick={() => toggle(u)}>{u.active ? "ปิดบัญชี" : "เปิดบัญชี"}</button></td>
            </tr>))}</tbody>
        </table>{!shown.length && <p className="ux-empty">ไม่พบบัญชี</p>}</div>)}
    </section>
  </>);
}

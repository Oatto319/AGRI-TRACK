"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

// กล่องยืนยันของระบบเอง (แทน window.confirm) — ใช้ <dialog> มาตรฐาน จึงจับโฟกัสในกล่อง กด Esc ปิดได้ และใช้งานบนมือถือได้ดีกว่า
export interface ConfirmOptions { title?: string; message: ReactNode; confirmLabel?: string; cancelLabel?: string; danger?: boolean }
export type Ask = (o: string | ConfirmOptions) => Promise<boolean>;
const Ctx = createContext<Ask | null>(null);

/** const confirm = useConfirm(); if (await confirm("ลบรายการนี้?")) { ... } */
export const useConfirm = (): Ask => { const v = useContext(Ctx); if (!v) throw new Error("ConfirmProvider missing"); return v; };

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [req, setReq] = useState<ConfirmOptions | null>(null);
  const pending = useRef<((v: boolean) => void) | null>(null);
  const ref = useRef<HTMLDialogElement>(null);

  const ask = useCallback<Ask>(o => new Promise<boolean>(resolve => {
    pending.current?.(false); // ถ้ามีกล่องค้างอยู่ ถือว่ายกเลิกอันเก่า
    pending.current = resolve;
    setReq(typeof o === "string" ? { message: o } : o);
  }), []);

  const done = useCallback((v: boolean) => { pending.current?.(v); pending.current = null; setReq(null); }, []);

  useEffect(() => {
    const d = ref.current; if (!d) return;
    if (req && !d.open) d.showModal();
    else if (!req && d.open) d.close();
  }, [req]);

  return (
    <Ctx.Provider value={ask}>
      {children}
      <dialog ref={ref} className="cfm" aria-labelledby="cfm-t" aria-describedby="cfm-m"
        onCancel={e => { e.preventDefault(); done(false); }}
        onClick={e => { if (e.target === ref.current) done(false); }}>
        {req && (
          <div className="cfm-box" role="alertdialog">
            <h2 id="cfm-t">{req.title ?? "ยืนยันการทำรายการ"}</h2>
            <div id="cfm-m" className="cfm-msg">{req.message}</div>
            <div className="cfm-act">
              <button type="button" className="ux-btn line" autoFocus onClick={() => done(false)}>{req.cancelLabel ?? "ยกเลิก"}</button>
              <button type="button" className={`ux-btn${req.danger ? " cfm-danger" : ""}`} onClick={() => done(true)}>{req.confirmLabel ?? "ตกลง"}</button>
            </div>
          </div>)}
      </dialog>
    </Ctx.Provider>);
}

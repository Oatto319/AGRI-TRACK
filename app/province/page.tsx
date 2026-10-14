"use client";
import Link from "next/link";
import { useMemo } from "react";
import { AREA_TARGET_PCT, FIELDS, thaiMonth } from "@/lib/data";
import { aggregateArea, fmt } from "@/lib/summary";
import { COLORS, Donut, RankRows, Trend } from "@/components/Charts";
import { FilterBar, useProvince } from "@/components/Province";

const f2 = (v: number) => v.toLocaleString("th-TH", { maximumFractionDigits: 2 });

export default function ProvinceDashboard() {
  const { reports, area, error, from, to, valid, agg } = useProvince();
  
  // คำนวณข้อมูลส่วนปุ๋ยอินทรีย์
  const rows = agg?.rows ?? [];
  const sum = (f: (r: (typeof rows)[number]) => number) => rows.reduce((a, r) => a + f(r), 0);
  const total = sum(r => r.total);
  const target = sum(r => r.target);
  const sent = rows.filter(r => r.any).length;
  const pct = target ? Math.min(100, Math.round((total / target) * 100)) : 0;
  const sentPct = rows.length ? Math.round((sent / rows.length) * 100) : 0;

  // คำนวณข้อมูลส่วนพื้นที่และฟางข้าว
  const ar = useMemo(() => (area && valid ? aggregateArea(area, from, to) : null), [area, from, to, valid]);

  return (
    <div className="db" style={{ padding: "1.5rem 2rem", background: "#f1f5f9", minHeight: "100vh" }}>
      
      {/* Header Bar */}
      <div className="db-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ fontSize: "1.6rem", fontWeight: "700", color: "#0f172a", margin: 0 }}>แดชบอร์ดข้อมูลจังหวัด</h1>
          <p className="sub" style={{ margin: "0.2rem 0 0 0", color: "#64748b", fontSize: "0.9rem" }}>
            {valid ? `${thaiMonth(from)} – ${thaiMonth(to)}` : ""} · สรุปรายงานการส่งข้อมูลและผลผลิตรายอำเภอ
          </p>
        </div>
        <FilterBar download />
      </div>

      {/* Error & Loading States */}
      {error && <p className="err" role="alert" style={{ padding: "1rem", background: "#fef2f2", color: "#dc2626", borderRadius: "10px", marginBottom: "1rem" }}>{error}</p>}
      {!reports && !area && !error && <div style={{ textAlign: "center", padding: "4rem", color: "#64748b" }}>กำลังโหลดข้อมูล...</div>}
      {((reports && !valid) || (area && !valid)) && <p className="err" style={{ padding: "1rem", background: "#fef2f2", color: "#dc2626", borderRadius: "10px" }}>เลือกช่วงเดือนให้ถูกต้อง</p>}

      {(agg || ar) && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          
          {/* ================= 1. Top Solid KPI Cards (สไตล์แบบที่ 2) ================= */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem" }}>
            
            {/* KPI Card 1: Dark Navy */}
            <div style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)", color: "#ffffff", padding: "1.25rem", borderRadius: "14px", position: "relative", overflow: "hidden", boxShadow: "0 4px 12px rgba(15, 23, 42, 0.15)" }}>
              <div style={{ fontSize: "0.85rem", opacity: 0.8, fontWeight: "500" }}>อำเภอที่ส่งรายงานแล้ว</div>
              <div style={{ fontSize: "2rem", fontWeight: "700", margin: "0.4rem 0 0.2rem 0" }}>{sent} <span style={{ fontSize: "1rem", fontWeight: "400", opacity: 0.7 }}>/ {rows.length}</span></div>
              <div style={{ fontSize: "0.8rem", color: "#38bdf8" }}>ส่งแล้ว {sentPct}% · ส่งช้า {sum(r => r.late)} ครั้ง</div>
            </div>

            {/* KPI Card 2: Deep Blue / Teal */}
            <div style={{ background: "linear-gradient(135deg, #0f4c81 0%, #1e3a8a 100%)", color: "#ffffff", padding: "1.25rem", borderRadius: "14px", boxShadow: "0 4px 12px rgba(15, 76, 129, 0.15)" }}>
              <div style={{ fontSize: "0.85rem", opacity: 0.8, fontWeight: "500" }}>ผลรวมปุ๋ยอินทรีย์ทั้งหมด</div>
              <div style={{ fontSize: "2rem", fontWeight: "700", margin: "0.4rem 0 0.2rem 0" }}>{fmt(total)} <span style={{ fontSize: "1rem", fontWeight: "400", opacity: 0.7 }}>ตัน</span></div>
              <div style={{ fontSize: "0.8rem", color: "#93c5fd" }}>เฉลี่ย {fmt(sent ? total / sent : 0)} ตัน/อำเภอ</div>
            </div>

            {/* KPI Card 3: Emerald / Dark Green */}
            <div style={{ background: "linear-gradient(135deg, #065f46 0%, #047857 100%)", color: "#ffffff", padding: "1.25rem", borderRadius: "14px", boxShadow: "0 4px 12px rgba(6, 95, 70, 0.15)" }}>
              <div style={{ fontSize: "0.85rem", opacity: 0.8, fontWeight: "500" }}>บรรลุเป้าหมายปุ๋ย</div>
              <div style={{ fontSize: "2rem", fontWeight: "700", margin: "0.4rem 0 0.2rem 0" }}>{pct}%</div>
              <div style={{ fontSize: "0.8rem", color: "#6ee7b7" }}>{target > total ? `ขาดอีก ${fmt(target - total)} ตัน` : "บรรลุเป้าหมายแล้ว"}</div>
            </div>

            {/* KPI Card 4: Gold / Amber Dark */}
            <div style={{ background: "linear-gradient(135deg, #854d0e 0%, #a16207 100%)", color: "#ffffff", padding: "1.25rem", borderRadius: "14px", boxShadow: "0 4px 12px rgba(133, 77, 14, 0.15)" }}>
              <div style={{ fontSize: "0.85rem", opacity: 0.8, fontWeight: "500" }}>พื้นที่สะสมทั้งหมด</div>
              <div style={{ fontSize: "2rem", fontWeight: "700", margin: "0.4rem 0 0.2rem 0" }}>{ar ? f2(ar.sums.accum) : "0"} <span style={{ fontSize: "1rem", fontWeight: "400", opacity: 0.7 }}>ไร่</span></div>
              <div style={{ fontSize: "0.8rem", color: "#fef08a" }}>คิดเป็น {ar ? f2(ar.pct) : "0"}% ของพื้นที่ทั้งหมด</div>
            </div>

          </div>

          {/* ================= 2. Main Visual Grid (จัดเลย์เอาต์ตามรูปภาพ 2) ================= */}
          <div className="db-split">
            
            {/* ด้านซ้าย: 10 อันดับอำเภอ */}
            <div style={{ background: "#ffffff", padding: "1.25rem", borderRadius: "14px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", display: "flex", flexDirection: "column" }}>
              <h3 style={{ fontSize: "1.05rem", fontWeight: "700", color: "#0f172a", marginBottom: "0.25rem" }}>10 อันดับอำเภอผลผลิตสูงสุด</h3>
              <p style={{ fontSize: "0.8rem", color: "#94a3b8", marginBottom: "1rem" }}>จัดอันดับข้อมูลปุ๋ยอินทรีย์สะสม</p>
              
              <div style={{ flex: 1 }}>
                {total === 0 ? (
                  <p style={{ color: "#94a3b8", textAlign: "center", padding: "3rem 0" }}>ยังไม่มีข้อมูลในช่วงนี้</p>
                ) : (
                  <RankRows rows={[...rows].sort((a, b) => b.total - a.total).slice(0, 10).map(r => ({ name: r.name, value: r.total }))} />
                )}
              </div>
            </div>

            {/* ด้านขวา: กราฟ Donut + Bar Trend Chart */}
            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              
              {/* Donut Chart Card */}
              <div style={{ background: "#ffffff", padding: "1.25rem", borderRadius: "14px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
                <h3 style={{ fontSize: "1.05rem", fontWeight: "700", color: "#0f172a", marginBottom: "0.75rem" }}>สัดส่วนตามชนิด</h3>
                <div style={{ minHeight: "180px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Donut parts={FIELDS.map((f, i) => ({ label: f.label, value: sum(r => r.sums[f.key]), color: COLORS[i] }))} />
                </div>
              </div>

              {/* Monthly Bar Trend Chart */}
              {agg && (
                <div style={{ background: "#ffffff", padding: "1.25rem", borderRadius: "14px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
                  <h3 style={{ fontSize: "1.05rem", fontWeight: "700", color: "#0f172a", marginBottom: "0.75rem" }}>ผลผลิตรายเดือน (ตัน)</h3>
                  <Trend data={agg.months.map(m => ({ label: thaiMonth(m), value: sum(r => r.byMonth[m] ?? 0) }))} />
                </div>
              )}

            </div>
          </div>

          {/* ================= 3. Bottom Section: พื้นที่ & สถานะส่งข้อมูล ================= */}
          <div className="db-split db-even">
            
            {/* การ์ดพื้นที่และฟางข้าว */}
            {ar && (
              <div style={{ background: "#ffffff", padding: "1.25rem", borderRadius: "14px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
                <h3 style={{ fontSize: "1.05rem", fontWeight: "700", color: "#0f172a", marginBottom: "1rem" }}>พื้นที่และฟางข้าว</h3>
                
                <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #f1f5f9", paddingBottom: "0.5rem" }}>
                    <span style={{ fontSize: "0.9rem", color: "#475569" }}>พื้นที่ปลูกพืชทั้งหมด</span>
                    <span style={{ fontWeight: "700", color: "#0f172a" }}>{f2(ar.sums.total)} ไร่</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #f1f5f9", paddingBottom: "0.5rem" }}>
                    <span style={{ fontSize: "0.9rem", color: "#475569" }}>เป้าหมายร้อยละ {AREA_TARGET_PCT}</span>
                    <span style={{ fontWeight: "700", color: "#d97706" }}>{f2(ar.sums.target)} ไร่</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #f1f5f9", paddingBottom: "0.5rem" }}>
                    <span style={{ fontSize: "0.9rem", color: "#475569" }}>ปริมาณฟางข้าว</span>
                    <span style={{ fontWeight: "700", color: "#059669" }}>{f2(ar.sums.straw)} ตัน</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "0.9rem", color: "#475569" }}>คิดเป็นมูลค่ารวม</span>
                    <span style={{ fontWeight: "700", color: "#2563eb" }}>{f2(ar.sums.value)} บาท</span>
                  </div>
                </div>
              </div>
            )}

            {/* การ์ดสถานะการส่งข้อมูล (Chip Grid สไตล์ Option 2) */}
            <div style={{ background: "#ffffff", padding: "1.25rem", borderRadius: "14px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <h3 style={{ fontSize: "1.05rem", fontWeight: "700", color: "#0f172a", marginBottom: "0.75rem" }}>สถานะการส่งข้อมูลเดือน {thaiMonth(to)}</h3>
                
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", maxHeight: "150px", overflowY: "auto", paddingRight: "0.2rem" }}>
                  {rows.map(r => { 
                    const g = r.got[to] ?? 0; 
                    const isOk = g >= (agg?.rounds ?? 1);
                    const isWarn = g > 0 && g < (agg?.rounds ?? 1);
                    return (
                      <span key={r.name} style={{ 
                        padding: "0.3rem 0.6rem", 
                        borderRadius: "6px", 
                        fontSize: "0.8rem", 
                        fontWeight: "600",
                        background: isOk ? "#0f4c81" : isWarn ? "#b45309" : "#991b1b", 
                        color: "#ffffff"
                      }}>
                        {r.name}{g > 0 && g < (agg?.rounds ?? 1) ? ` (${g}/${agg?.rounds})` : ""}
                      </span>
                    ); 
                  })}
                </div>
              </div>

              <p style={{ fontSize: "0.8rem", color: "#64748b", margin: "0.75rem 0 0 0" }}>
                * น้ำเงิน = ส่งครบ · ส้ม = ส่งบางรอบ · แดง = ยังไม่ส่ง
              </p>
            </div>

          </div>

          {/* ================= 4. Full Width Table ================= */}
          {ar && (
            <div style={{ background: "#ffffff", borderRadius: "14px", padding: "1.25rem", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
              <h3 style={{ fontSize: "1.05rem", fontWeight: "700", color: "#0f172a", marginBottom: "1rem" }}>
                ตารางรายละเอียดรายอำเภอ (ส่งแล้ว {ar.rows.filter(r => r.any).length} จาก {ar.rows.length} อำเภอ)
              </h3>
              
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.85rem" }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0", color: "#475569" }}>
                      <th style={{ padding: "0.6rem" }}>ที่</th>
                      <th style={{ padding: "0.6rem" }}>อำเภอ</th>
                      <th style={{ padding: "0.6rem", textAlign: "right" }}>พื้นที่ปลูก (ไร่)</th>
                      <th style={{ padding: "0.6rem", textAlign: "right" }}>เป้าหมาย {AREA_TARGET_PCT}% (ไร่)</th>
                      <th style={{ padding: "0.6rem", textAlign: "right" }}>พื้นที่สะสม (ไร่)</th>
                      <th style={{ padding: "0.6rem", textAlign: "center" }}>สะสม (%)</th>
                      <th style={{ padding: "0.6rem", textAlign: "right" }}>ฟางข้าว (ตัน)</th>
                      <th style={{ padding: "0.6rem", textAlign: "right" }}>มูลค่า (บาท)</th>
                      <th style={{ padding: "0.6rem", textAlign: "center" }}>ส่งช้า</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ar.rows.map((r, i) => (
                      <tr key={r.name} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "0.6rem" }}>{i + 1}</td>
                        <td style={{ padding: "0.6rem", fontWeight: "600" }}>{r.name}</td>
                        <td style={{ padding: "0.6rem", textAlign: "right" }}>{f2(r.total)}</td>
                        <td style={{ padding: "0.6rem", textAlign: "right" }}>{f2(r.target)}</td>
                        <td style={{ padding: "0.6rem", textAlign: "right" }}>{f2(r.accum)}</td>
                        <td style={{ padding: "0.6rem", textAlign: "center" }}>
                          <span style={{ 
                            padding: "0.2rem 0.5rem", 
                            borderRadius: "4px", 
                            fontSize: "0.75rem", 
                            fontWeight: "600",
                            background: !r.any ? "#fee2e2" : r.pct >= AREA_TARGET_PCT ? "#dcfce7" : "#fef9c3", 
                            color: !r.any ? "#991b1b" : r.pct >= AREA_TARGET_PCT ? "#166534" : "#854d0e" 
                          }}>
                            {r.any ? `${f2(r.pct)}%` : "ยังไม่ส่ง"}
                          </span>
                        </td>
                        <td style={{ padding: "0.6rem", textAlign: "right" }}>{f2(r.straw)}</td>
                        <td style={{ padding: "0.6rem", textAlign: "right" }}>{f2(r.value)}</td>
                        <td style={{ padding: "0.6rem", textAlign: "center" }}>
                          {r.late ? <span style={{ color: "#dc2626", fontWeight: "600" }}>{r.late}</span> : "–"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Footer Link Button */}
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "0.5rem" }}>
            <Link className="btn go" href="/province/table" style={{ background: "#0f4c81", color: "#ffffff", padding: "0.65rem 1.25rem", borderRadius: "8px", fontWeight: "600", textDecoration: "none", fontSize: "0.9rem", boxShadow: "0 2px 4px rgba(15, 76, 129, 0.2)" }}>
              ดูตารางข้อมูลรายละเอียดทั้งหมด (หน้าที่ 2) →
            </Link>
          </div>

        </div>
      )}
    </div>
  );
}

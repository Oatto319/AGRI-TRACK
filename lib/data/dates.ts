const TH = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];

export const thaiMonth = (ym: string) => { const [y, m] = ym.split("-").map(Number); return `${TH[m - 1]} ${y + 543}`; };

export const currentMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };

export const pad2 = (n: number) => String(n).padStart(2, "0");

const TH_S = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

// วันที่ตามเวลาไทย (UTC+7) รูปแบบ YYYY-MM-DD
export const bkkDate = (d: Date | string = new Date()) => new Date(new Date(d).getTime() + 7 * 3600e3).toISOString().slice(0, 10);

// วันกำหนดส่ง: ถ้าเดือนนั้นมีวันน้อยกว่า (เช่น 31 ในเดือนกุมภาพันธ์) ใช้วันสุดท้ายของเดือน
export const dueDateOf = (month: string, day: number) => {
  const [y, m] = month.split("-").map(Number), last = new Date(y, m, 0).getDate();
  return `${month}-${String(Math.min(day, last)).padStart(2, "0")}`;
};

// เดือนแบบย่อ + ปี พ.ศ. 2 หลัก เช่น "ธ.ค. 68" (ใช้เป็นหัวคอลัมน์รายเดือน)
export const thaiMonthShort = (ym: string) => { const [y, m] = ym.split("-").map(Number); return `${TH_S[m - 1]} ${String(y + 543).slice(2)}`; };

export const thaiDate = (ymd: string) => { const [y, m, d] = ymd.slice(0, 10).split("-").map(Number); return `${d} ${TH_S[m - 1]} ${y + 543}`; };

export const thaiDateTime = (iso: string) => { const b = new Date(new Date(iso).getTime() + 7 * 3600e3).toISOString(); return `${thaiDate(b)} ${b.slice(11, 16)} น.`; };

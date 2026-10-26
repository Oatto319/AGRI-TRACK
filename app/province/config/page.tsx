import { redirect } from "next/navigation";

// หน้านี้ถูกรวมเข้ากับ /province/settings แล้ว — คงลิงก์/บุ๊กมาร์กเดิมไว้ด้วยการพาไปส่วน "หัวข้อและรายการ"
export default function ConfigMoved() {
  redirect("/province/settings#config");
}

"use client";
import { redirect } from "next/navigation";

// รวมตารางพื้นที่และฟางข้าวไว้ในหน้า "ตารางข้อมูลรายอำเภอ" (แท็บพื้นที่และฟางข้าว) แล้ว
export default function ProvinceArea() { redirect("/province/table"); }

// 临时占位首页：重定向到 Overview（登录态接入后改为条件跳转 — PRD §11）
import { redirect } from "next/navigation";

export default function Home() {
  redirect("/overview");
}

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Little Job Helper",
  description: "体制内人事科工作回溯与待办管理基础原型",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}

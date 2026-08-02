import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ErrorBoundary } from "@/components/error-boundary";

export const metadata: Metadata = {
  title: "Little Job Helper",
  description: "体制内人事科工作回溯与待办管理基础原型",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#eff8f0",
};

/** 首帧读取 localStorage 主题，避免暗色模式闪烁（FOUC） */
const themeInitScript = `
(function () {
  try {
    var t = localStorage.getItem("little-job-helper-theme");
    if (t === "dark") document.documentElement.dataset.theme = "dark";
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <ErrorBoundary>{children}</ErrorBoundary>
      </body>
    </html>
  );
}

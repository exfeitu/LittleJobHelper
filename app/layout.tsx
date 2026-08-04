import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ErrorBoundary } from "@/components/error-boundary";

export const metadata: Metadata = {
  title: "工作台账 - 工作记录与待办管理工具",
  description:
    "工作台账是一款浏览器端的工作记录与待办管理工具，支持时间轴回溯、多级待办、日历视图、搜索与云端同步。",
  keywords: ["工作记录", "待办管理", "工作日志", "时间轴", "待办清单", "云端同步"],
  openGraph: {
    title: "工作台账 - 工作记录与待办管理工具",
    description:
      "工作台账是一款浏览器端的工作记录与待办管理工具，支持时间轴回溯、多级待办、日历视图、搜索与云端同步。",
    siteName: "工作台账",
    type: "website",
    locale: "zh_CN",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#eff8f0",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>
        <ErrorBoundary>{children}</ErrorBoundary>
      </body>
    </html>
  );
}

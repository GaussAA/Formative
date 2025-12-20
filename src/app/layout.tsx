import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "定型 Formative - AI开发前的需求澄清工具",
  description: "帮助用户将模糊想法转化为AI可执行的开发方案",
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

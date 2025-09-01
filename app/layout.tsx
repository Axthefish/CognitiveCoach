import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { HydrationMonitor } from "@/components/hydration-monitor";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "CognitiveCoach - AI认知教练平台",
    template: "%s | CognitiveCoach"
  },
  description: "基于AI的个性化认知教练平台，提供目标精炼、知识框架构建、系统动力学分析、行动计划制定和进度跟踪等全方位学习支持。",
  keywords: [
    "AI教练", "认知教练", "学习规划", "知识框架", "系统动力学", 
    "行动计划", "进度跟踪", "个性化学习", "AI学习助手", "认知科学"
  ],
  authors: [{ name: "CognitiveCoach Team" }],
  creator: "CognitiveCoach",
  publisher: "CognitiveCoach",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "zh_CN",
    url: "https://cognitivecoach.ai",
    title: "CognitiveCoach - AI认知教练平台",
    description: "基于AI的个性化认知教练平台，助力高效学习与成长",
    siteName: "CognitiveCoach",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "CognitiveCoach AI认知教练平台",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "CognitiveCoach - AI认知教练平台",
    description: "基于AI的个性化认知教练平台，助力高效学习与成长",
    images: ["/twitter-card.png"],
  },
  alternates: {
    canonical: "https://cognitivecoach.ai",
  },
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 5,
  },
  category: "Education",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <HydrationMonitor />
        {children}
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

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
    default: "CognitiveCoach - AI Cognitive Coaching Platform",
    template: "%s | CognitiveCoach"
  },
  description: "AI-powered personalized cognitive coaching platform providing goal refinement, knowledge framework building, system dynamics analysis, action planning, and progress tracking.",
  keywords: [
    "AI coach", "cognitive coaching", "learning planning", "knowledge framework", "system dynamics", 
    "action plan", "progress tracking", "personalized learning", "AI learning assistant", "cognitive science"
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
    locale: "en_US",
    alternateLocale: ["zh_CN"],
    url: "https://cognitivecoach.ai",
    title: "CognitiveCoach - AI Cognitive Coaching Platform",
    description: "AI-powered personalized cognitive coaching platform for effective learning and growth",
    siteName: "CognitiveCoach",
  },
  twitter: {
    card: "summary",
    title: "CognitiveCoach - AI Cognitive Coaching Platform",
    description: "AI-powered personalized cognitive coaching platform for effective learning and growth",
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
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}

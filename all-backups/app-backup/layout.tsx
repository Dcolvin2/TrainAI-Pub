import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import Nav from "./components/Nav";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "TrainAI - Your AI-Powered Workout Partner",
  description: "Track progress, get stronger, and stay consistent with intelligent training guidance from TrainAI.",
  keywords: ["fitness", "workout", "AI", "training", "exercise", "strength"],
  authors: [{ name: "TrainAI Team" }],
  creator: "TrainAI",
  publisher: "TrainAI",
  robots: "index, follow",
  openGraph: {
    title: "TrainAI - Your AI-Powered Workout Partner",
    description: "Track progress, get stronger, and stay consistent with intelligent training guidance.",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "TrainAI - Your AI-Powered Workout Partner",
    description: "Track progress, get stronger, and stay consistent with intelligent training guidance.",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/favicon.svg" />
      </head>
      <body className={`${inter.variable} antialiased`}>
        <Providers>
          <Nav />
          {children}
        </Providers>
      </body>
    </html>
  );
}

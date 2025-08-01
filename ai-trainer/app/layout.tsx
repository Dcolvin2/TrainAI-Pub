import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import Nav from "./components/Nav";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "TrainAI - Your Personal Fitness Coach",
  description: "AI-powered workout planning and coaching",
  keywords: ["fitness", "workout", "AI", "coaching", "training"],
  authors: [{ name: "TrainAI Team" }],
  creator: "TrainAI",
  publisher: "TrainAI",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  icons: {
    icon: "/next.svg",
    shortcut: "/next.svg",
    apple: "/next.svg",
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
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
        <link rel="icon" href="/next.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/next.svg" />
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

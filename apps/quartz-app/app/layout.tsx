import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Header from "../src/components/layout/Header";
import Providers from "@/app/providers";
import { ReactNode } from "react";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Quartz Energy | Rajasthan",
  description: "Solar and Wind Forecasting Service",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          <Header />
          {children}
        </Providers>
      </body>
    </html>
  );
}

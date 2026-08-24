import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ReactNode } from "react";
import { UserProvider } from "@auth0/nextjs-auth0/client";
import LayoutWrapper from "@/src/components/layout/LayoutWrapper";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Quartz Energy | Rajasthan",
  description: "Solar and Wind Forecasting Service"
};

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <UserProvider>
        <body className={inter.className}>
          <LayoutWrapper>{children}</LayoutWrapper>
        </body>
      </UserProvider>
    </html>
  );
}

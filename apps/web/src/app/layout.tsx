import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";
import "./report.css";

export const metadata: Metadata = {
  title: "GitHub Opportunity Radar",
  description: "Decide whether a GitHub issue deserves your time.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

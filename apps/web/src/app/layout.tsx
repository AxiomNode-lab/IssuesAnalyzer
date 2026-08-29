import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";
import "./report.css";
import "./report-layout-fix.css";

export const metadata: Metadata = {
  title: "Issue Analyzer",
  description: "Know before you code. Analyze a public GitHub issue before you invest your time.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

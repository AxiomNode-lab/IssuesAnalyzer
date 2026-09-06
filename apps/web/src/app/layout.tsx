import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";
import "./report.css";
import "./report-layout-fix.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://issueanalyzer.site"),
  title: {
    default: "Issue Analyzer — Know before you code",
    template: "%s | Issue Analyzer",
  },
  description:
    "Analyze a public GitHub issue before you invest your time. Get an explainable opportunity score based on activity, competition, responsiveness, actionability, and risk.",
  alternates: {
    canonical: "/",
  },
  applicationName: "Issue Analyzer",
  authors: [{ name: "Issue Analyzer" }],
  creator: "Issue Analyzer",
  publisher: "Issue Analyzer",
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Issue Analyzer",
    title: "Issue Analyzer — Know before you code",
    description:
      "Turn a public GitHub issue into a clear, evidence-backed decision before you invest your time.",
  },
  twitter: {
    card: "summary",
    title: "Issue Analyzer — Know before you code",
    description:
      "Turn a public GitHub issue into a clear, evidence-backed decision before you invest your time.",
  },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

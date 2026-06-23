import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AWS Cert Verifier — powered by Credly",
  description:
    "Verify whether a Credly badge is a genuine AWS certification and inspect its details.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="text-slate-100 antialiased">{children}</body>
    </html>
  );
}

import type { Metadata } from "next";
import "../styles/globals.css";
import "../styles/dashboard.css";

export const metadata: Metadata = {
  title: "Second Space",
  description: "Agent Office Simulator"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="app-shell">{children}</body>
    </html>
  );
}

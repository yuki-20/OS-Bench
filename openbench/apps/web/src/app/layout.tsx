import type { Metadata, Viewport } from "next";
import "../styles/globals.css";

import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: "OpenBench OS",
  description: "Protocol execution runtime for lab work.",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#1e1b4b",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

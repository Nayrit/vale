import type { Metadata } from "next";
import { Instrument_Serif, Outfit } from "next/font/google";
import { Providers } from "@/components/providers";
import { siteOrigin } from "@/lib/site";
import "./globals.css";

const instrument = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
});

const ui = Outfit({
  subsets: ["latin"],
  variable: "--font-ui",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin()),
  title: "Vale — your subscription steward",
  description:
    "Match bank charges to cancellation pages, optionally read billed Gmail receipts, and keep the money you stop spending.",
  icons: {
    icon: "/vale-logo.png",
    apple: "/vale-logo.png",
  },
  openGraph: {
    title: "Vale — your subscription steward",
    description:
      "Match bank charges to cancellation pages, optionally read billed Gmail receipts, and keep the money you stop spending.",
    images: ["/vale-logo.png"],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${instrument.variable} ${ui.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

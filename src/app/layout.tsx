import type { Metadata } from "next";
import { Figtree, Noto_Sans } from "next/font/google";
import "./globals.css";

const figtree = Figtree({
  subsets: ["latin", "latin-ext"],
  variable: "--font-figtree",
  display: "swap",
});

const noto = Noto_Sans({
  subsets: ["latin", "latin-ext"],
  variable: "--font-noto",
  display: "swap",
});

export const metadata: Metadata = {
  title: "tıp_ai — Klinik Karar Simülasyon Sistemi",
  description:
    "Türkçe klinik karar verme eğitimi için tasarlanmış web uygulaması. Vaka gör, soru sor, test iste, klinik yaklaşımını puanla.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" className={`${figtree.variable} ${noto.variable}`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="tr">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}

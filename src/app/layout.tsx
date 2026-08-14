import type { Metadata } from "next";
import Script from "next/script";
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
    <html lang="tr" suppressHydrationWarning>
      <head>
        {process.env.NODE_ENV === "development" && (
          <Script
            src="https://unpkg.com/react-scan/dist/auto.global.js"
            crossOrigin="anonymous"
            strategy="beforeInteractive"
          />
        )}
        {process.env.NODE_ENV === "development" && (
          <Script
            src="//unpkg.com/react-grab/dist/index.global.js"
            crossOrigin="anonymous"
            strategy="beforeInteractive"
          />
        )}
        <style>{`
          #app-boot { position: fixed; inset: 0; z-index: 2147483647; display: grid; place-items: center; background: #ffffff; color: #0a0a0a; }
          #app-boot > div { display: grid; justify-items: center; gap: 12px; font: 500 14px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
          #app-boot i { width: 28px; height: 28px; border: 3px solid #99f6e4; border-top-color: #0f766e; border-radius: 999px; animation: app-boot-spin 650ms linear infinite; }
          @keyframes app-boot-spin { to { transform: rotate(360deg); } }
          html[data-ui-ready] #app-boot { opacity: 0; visibility: hidden; transition: opacity 120ms ease-out, visibility 0s linear 120ms; }
          html:not([data-ui-ready]) #app-content { visibility: hidden; }
        `}</style>
        <script
          dangerouslySetInnerHTML={{
            __html: `(() => { const reveal = () => document.documentElement.setAttribute("data-ui-ready", ""); if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => requestAnimationFrame(reveal), { once: true }); else requestAnimationFrame(reveal); window.setTimeout(reveal, 4000); })();`,
          }}
        />
      </head>
      <body className="font-sans antialiased">
        <div id="app-boot" role="status" aria-live="polite">
          <div><i aria-hidden="true" /><span>Sistem hazırlanıyor…</span></div>
        </div>
        <noscript>
          <style>{"#app-boot { display: none; } #app-content { visibility: visible; }"}</style>
        </noscript>
        <div id="app-content">{children}</div>
      </body>
    </html>
  );
}

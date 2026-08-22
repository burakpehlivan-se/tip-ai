"use client";

import { useEffect } from "react";

/**
 * Root layout seviyesinde yakalanan hatalar için son çare ekranı.
 * Root layout devreye girmediğinden <html>/<body> ve inline stiller zorunlu.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="tr">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f7f6f2",
          fontFamily: "system-ui, -apple-system, sans-serif",
          padding: "24px",
        }}
      >
        <main
          style={{
            maxWidth: "26rem",
            width: "100%",
            textAlign: "center",
            background: "#fff",
            border: "1px solid #e5e2da",
            borderRadius: "12px",
            padding: "32px 24px",
          }}
        >
          <h1 style={{ margin: "0 0 8px", fontSize: "1.25rem", color: "#1a1a1a" }}>
            Beklenmeyen bir sorun oluştu
          </h1>
          <p
            style={{
              margin: "0 0 24px",
              fontSize: "0.9rem",
              lineHeight: 1.6,
              color: "#555",
            }}
          >
            Uygulama yüklenirken bir hata meydana geldi. Sayfayı yeniden deneyebilirsiniz.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              minHeight: "44px",
              padding: "0 20px",
              borderRadius: "9999px",
              border: "none",
              background: "#1a1a1a",
              color: "#fff",
              fontSize: "0.9rem",
              cursor: "pointer",
            }}
          >
            Yeniden dene
          </button>
        </main>
      </body>
    </html>
  );
}

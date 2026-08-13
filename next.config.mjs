/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  outputFileTracingRoot: process.cwd(),
  async headers() {
    const securityHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(), payment=(), usb=()" },
      { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
      { key: "X-DNS-Prefetch-Control", value: "off" },
      // Next.js'in bootstrap kodu ve Tailwind stil etiketleri nedeniyle nonce
      // geçişine kadar gerekli olan dar uyumluluk istisnaları korunur. Diğer
      // tüm aktif içerik kaynakları aynı origin ile sınırlandırılır.
      {
        key: "Content-Security-Policy",
        value:
          "default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; worker-src 'self' blob:; manifest-src 'self'",
      },
    ];

    // HSTS yalnızca üretim derlemesinde eklenir; yerel HTTP geliştirme akışını
    // ve geçici preview domain'lerini kalıcı HTTPS politikasına zorlamaz.
    if (process.env.NODE_ENV === "production") {
      securityHeaders.push({
        key: "Strict-Transport-Security",
        value: "max-age=31536000; includeSubDomains",
      });
    }

    return [{ source: "/:path*", headers: securityHeaders }];
  },
  experimental: {
    useTypeScriptCli: false,
    // Proxy kullanılan her istekte Next.js'in gövde tamponunu 10 MiB yerine
    // 1 MiB ile sınırlar. Proxy ayrıca bildirilen aşırı API gövdelerini 413
    // ile geri çevirir; deneysel ayarın tek başına reddetme yapmadığını
    // varsaymayız.
    proxyClientMaxBodySize: "1mb",
  },
};

export default nextConfig;

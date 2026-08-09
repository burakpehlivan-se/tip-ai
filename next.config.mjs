/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  outputFileTracingRoot: process.cwd(),
  experimental: {
    useTypeScriptCli: false,
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // lab-motor → rule-engine-store (fs tabanlı) client graph'ında BUILD zamanında
      // resolve edilememesi için fallback. Runtime'da lab-motor guard'ı (process.versions.node
      // kontrolü) sayesinde store hiç çalıştırılmaz; FALLBACK_RULES kullanılır.
      // Kalıcı çözüm: Faz 8 — case-generator/VakaWorkspace server/client sınırı ayrımı.
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
      };
    }
    return config;
  },
};

export default nextConfig;

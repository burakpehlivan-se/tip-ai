import { NextResponse, type NextRequest } from "next/server";
import { validateMutationOrigin } from "@/lib/security/request-origin";

/**
 * Uygulamanın tek network sınırı. Route handler'lar hâlâ rol/nesne bazlı
 * yetkilendirmeyi yapar; proxy yalnızca cross-site cookie mutation saldırılarını
 * daha route'a ulaşmadan engeller.
 */
export function proxy(request: NextRequest) {
  const decision = validateMutationOrigin({
    method: request.method,
    url: request.url,
    headers: request.headers,
    appUrl: process.env.APP_URL,
  });
  if (decision === "reject") {
    return NextResponse.json(
      { error: "Geçersiz istek kaynağı." },
      { status: 403, headers: { "Cache-Control": "no-store" } }
    );
  }
  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};

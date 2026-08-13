import { NextResponse, type NextRequest } from "next/server";
import { getRequestId } from "@/lib/logger";
import { validateMutationOrigin } from "@/lib/security/request-origin";
import { exceedsApiMutationBodyLimit } from "@/lib/security/request-size";

/**
 * Uygulamanın tek network sınırı. Route handler'lar hâlâ rol/nesne bazlı
 * yetkilendirmeyi yapar; proxy yalnızca cross-site cookie mutation saldırılarını
 * daha route'a ulaşmadan engeller.
 */
export function proxy(request: NextRequest) {
  const requestId = getRequestId(request);
  const responseHeaders = { "Cache-Control": "no-store", "X-Request-Id": requestId };
  if (
    ["POST", "PUT", "PATCH", "DELETE"].includes(request.method.toUpperCase()) &&
    exceedsApiMutationBodyLimit(request.headers.get("content-length"))
  ) {
    return NextResponse.json(
      { error: "İstek gövdesi izin verilen boyutu aşıyor." },
      { status: 413, headers: responseHeaders }
    );
  }

  const decision = validateMutationOrigin({
    method: request.method,
    url: request.url,
    headers: request.headers,
    appUrl: process.env.APP_URL,
  });
  if (decision === "reject") {
    return NextResponse.json(
      { error: "Geçersiz istek kaynağı." },
      { status: 403, headers: responseHeaders }
    );
  }
  const forwardedHeaders = new Headers(request.headers);
  forwardedHeaders.set("x-request-id", requestId);
  const response = NextResponse.next({ request: { headers: forwardedHeaders } });
  response.headers.set("x-request-id", requestId);
  return response;
}

export const config = {
  matcher: "/api/:path*",
};

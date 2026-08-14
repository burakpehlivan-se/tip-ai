"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type MeInfo = { username: string; displayName: string };
type PrivacyRequest = {
  id: string;
  type: "correction" | "erasure";
  status: "pending" | "resolved";
  requestedAt: number;
  resolvedAt?: number;
};

const PRIVACY_REQUEST_COPY: Record<PrivacyRequest["type"], { title: string; description: string }> = {
  correction: {
    title: "Bilgi düzeltme talebi",
    description: "Profil bilgilerinizde düzeltme ihtiyacı olduğunu yönetime iletir.",
  },
  erasure: {
    title: "Silme / anonimleştirme talebi",
    description: "Hesabınız ve öğrenme kaydınız için yetkili inceleme sürecini başlatır; hemen silmez.",
  },
};

async function responseError(response: Response, fallback: string): Promise<Error> {
  if (response.ok) return new Error(fallback);
  const body = await response.json().catch(() => null);
  return new Error(body?.error || fallback);
}

export default function AyarlarPage() {
  const router = useRouter();
  const [me, setMe] = useState<MeInfo | null>(null);
  const [exportBusy, setExportBusy] = useState(false);
  const [exportMessage, setExportMessage] = useState("");
  const [privacyRequests, setPrivacyRequests] = useState<PrivacyRequest[]>([]);
  const [privacyBusy, setPrivacyBusy] = useState<PrivacyRequest["type"] | null>(null);
  const [privacyMessage, setPrivacyMessage] = useState("");
  const [hata, setHata] = useState("");

  useEffect(() => {
    fetch("/api/session", { cache: "no-store" })
      .then(async (response) => {
        const session = response.ok ? await response.json() : null;
        if (!session?.student) {
          router.replace(`/giris?sonraki=${encodeURIComponent("/ayarlar")}`);
          return null;
        }
        return session.student as MeInfo;
      })
      .then(async (data) => {
        if (!data) return;
        setMe(data);
        const requestsResponse = await fetch("/api/student/privacy-requests", { cache: "no-store" }).catch(() => null);
        const requests = requestsResponse && requestsResponse.ok ? await requestsResponse.json() : null;
        if (requests?.requests) setPrivacyRequests(requests.requests);
      })
      .catch(() => setHata("Ayarlar yüklenemedi."));
  }, [router]);

  async function cikisYap() {
    await fetch("/api/session/logout", { method: "POST" });
    router.replace("/");
  }

  async function downloadPersonalData() {
    setExportBusy(true);
    setExportMessage("");
    try {
      const response = await fetch("/api/student/data-export", { cache: "no-store" });
      if (!response.ok) throw await responseError(response, "Veri kopyası hazırlanamadı.");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "tip-ai-kisisel-veri.json";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => window.URL.revokeObjectURL(url), 0);
      setExportMessage("Kişisel öğrenme verileriniz indirildi.");
    } catch (error) {
      setExportMessage(error instanceof Error ? error.message : "Veri kopyası hazırlanamadı.");
    } finally {
      setExportBusy(false);
    }
  }

  async function submitPrivacyRequest(type: PrivacyRequest["type"]) {
    const copy = PRIVACY_REQUEST_COPY[type];
    if (!confirm(`${copy.title} oluşturulsun mu? Bu işlem hesabınızı veya eğitim kaydınızı hemen silmez.`)) return;
    setPrivacyBusy(type);
    setPrivacyMessage("");
    try {
      const response = await fetch("/api/student/privacy-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      if (!response.ok) throw await responseError(response, "Gizlilik talebi oluşturulamadı.");
      const body = (await response.json()) as { request: PrivacyRequest; created: boolean };
      setPrivacyRequests((items) => {
        const remaining = items.filter((item) => item.id !== body.request.id);
        return [body.request, ...remaining];
      });
      setPrivacyMessage(
        body.created ? "Talebiniz kayda alındı. Yetkili operasyon süreci inceleyecektir." : "Aynı türde açık talebiniz zaten kayıtlı."
      );
    } catch (error) {
      setPrivacyMessage(error instanceof Error ? error.message : "Gizlilik talebi oluşturulamadı.");
    } finally {
      setPrivacyBusy(null);
    }
  }

  if (!me) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <p className="text-sm text-steel">Yükleniyor…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas">
      <a href="#ana-icerik" className="skip-link">İçeriğe atla</a>

      <nav className="sticky top-0 z-50 border-b border-hairline-soft bg-canvas/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl font-semibold tracking-tight text-ink">
              tıp<span className="text-brand">_ai</span>
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/profilim" className="text-sm font-medium text-steel hover:text-ink transition-colors">
              Profilim
            </Link>
            <button onClick={() => void cikisYap()} className="btn-secondary text-sm">
              Çıkış Yap
            </button>
          </div>
        </div>
      </nav>

      <main id="ana-icerik" tabIndex={-1} className="mx-auto max-w-5xl px-6 pt-14 pb-24">
        <div className="mb-10">
          <h1 className="text-4xl font-semibold tracking-tight text-ink" style={{ letterSpacing: "-1.5px" }}>
            Ayarlar
          </h1>
          <p className="mt-2 text-sm text-steel">
            Veri ve gizlilik kontrolleri ile hesap talepleri burada yönetilir.
          </p>
        </div>

        {hata && <p className="text-sm text-clinical-red mb-6">{hata}</p>}

        <section className="mb-10" aria-labelledby="veri-ve-gizlilik">
          <div className="card border-hairline">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              <div className="max-w-2xl">
                <h2 id="veri-ve-gizlilik" className="text-xl font-semibold text-ink">Veri ve gizlilik</h2>
                <p className="mt-2 text-sm leading-6 text-steel">
                  Profiliniz ve tamamlanmış vaka sonuçlarınızın size ait kopyasını indirebilirsiniz. Parola, oturum bilgileri,
                  tam vaka/rubrik içeriği ve aktif serbest metin taslakları bu dosyaya eklenmez.
                </p>
                <p className="mt-2 text-xs leading-5 text-muted">
                  Bu indirme yalnızca kişisel veri kopyası içindir; hesap veya eğitim kaydı silme işlemi başlatmaz.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void downloadPersonalData()}
                disabled={exportBusy}
                className="btn-secondary shrink-0 justify-center disabled:cursor-not-allowed disabled:opacity-60"
              >
                {exportBusy ? "Hazırlanıyor…" : "Verilerimin kopyasını indir"}
              </button>
            </div>
            {exportMessage && (
              <p
                role="status"
                aria-live="polite"
                className={`mt-4 text-sm ${exportMessage.includes("indirildi") ? "text-brand-deep" : "text-clinical-red"}`}
              >
                {exportMessage}
              </p>
            )}
          </div>
        </section>

        <section className="mb-10" aria-labelledby="ilgili-kisi-talepleri">
          <div className="card border-hairline">
            <div className="max-w-2xl">
              <h2 id="ilgili-kisi-talepleri" className="text-xl font-semibold text-ink">Bilgi ve hesap talepleri</h2>
              <p className="mt-2 text-sm leading-6 text-steel">
                Düzeltme veya silme/anonimleştirme talebinizi buradan iletebilirsiniz. Talep, yetkili inceleme için kayda alınır;
                uygulama bu ekranda otomatik veri silmez.
              </p>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {(Object.keys(PRIVACY_REQUEST_COPY) as PrivacyRequest["type"][]).map((type) => {
                const copy = PRIVACY_REQUEST_COPY[type];
                const pending = privacyRequests.some((request) => request.type === type && request.status === "pending");
                return (
                  <div key={type} className="rounded-lg border border-hairline-soft bg-surface-soft p-4">
                    <h3 className="text-sm font-semibold text-ink">{copy.title}</h3>
                    <p className="mt-1 text-xs leading-5 text-steel">{copy.description}</p>
                    <button
                      type="button"
                      onClick={() => void submitPrivacyRequest(type)}
                      disabled={privacyBusy !== null || pending}
                      className="btn-secondary mt-4 w-full justify-center text-sm disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {pending ? "Açık talep var" : privacyBusy === type ? "Kaydediliyor…" : "Talep oluştur"}
                    </button>
                  </div>
                );
              })}
            </div>
            {privacyMessage && (
              <p
                role="status"
                aria-live="polite"
                className={`mt-4 text-sm ${privacyMessage.includes("kayda") || privacyMessage.includes("zaten") ? "text-brand-deep" : "text-clinical-red"}`}
              >
                {privacyMessage}
              </p>
            )}
            {privacyRequests.length > 0 && (
              <div className="mt-5 border-t border-hairline-soft pt-4">
                <h3 className="text-sm font-semibold text-ink">Talep geçmişiniz</h3>
                <ul className="mt-3 space-y-2" aria-label="Gizlilik talep geçmişi">
                  {privacyRequests.map((request) => (
                    <li key={request.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span className="text-steel">
                        {PRIVACY_REQUEST_COPY[request.type].title} · {new Date(request.requestedAt).toLocaleDateString("tr-TR")}
                      </span>
                      <span className={`badge ${request.status === "resolved" ? "badge-brand" : "badge-orange"}`}>
                        {request.status === "resolved" ? "Çözümlendi" : "İnceleniyor"}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

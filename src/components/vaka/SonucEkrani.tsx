"use client";

import Link from "next/link";
import { DegerlendirmeSonuc, Vaka } from "@/lib/types";

export default function SonucEkrani({
  vaka,
  sonuc,
  embed = false,
}: {
  vaka: Vaka;
  sonuc: DegerlendirmeSonuc;
  embed?: boolean;
}) {
  const yuzde = Math.round((sonuc.toplamPuan / sonuc.maxPuan) * 100);
  const renk =
    yuzde >= 80 ? "text-brand-deep" : yuzde >= 60 ? "text-clinical-orange" : "text-clinical-red";
  const tedaviTakvimiVar = Boolean(
    sonuc.tedavi?.ilaclar.some((ilac) => ilac.siklik || ilac.sure)
  );

  return (
    <div
      className={`bg-canvas ${
        embed ? "flex h-full min-h-0 flex-col overflow-hidden" : "min-h-screen"
      }`}
    >
      <nav className="shrink-0 border-b border-hairline-soft bg-canvas">
        <div
          className={`flex items-center justify-between px-4 ${
            embed ? "h-10 max-w-none" : "mx-auto h-16 max-w-4xl sm:px-6"
          }`}
        >
          {!embed ? (
            <Link
              href="/vakalar"
              className="text-sm font-medium text-steel transition-colors hover:text-ink"
            >
              ← Vakalar
            </Link>
          ) : (
            <span className="text-xs font-medium text-steel">Admin debug · değerlendirme</span>
          )}
          <span className={`font-medium text-ink ${embed ? "text-xs" : "text-sm"}`}>
            Değerlendirme
          </span>
        </div>
      </nav>

      <div
        className={`mx-auto max-w-4xl px-4 ${
          embed ? "min-h-0 flex-1 overflow-y-auto py-6 scrollbar-thin lg:px-6" : "py-8 sm:px-6 sm:py-12"
        }`}
      >
        {/* Puan */}
        <div className="mb-12 text-center">
          <div className="mb-2 text-sm font-medium uppercase tracking-wide text-muted">
            Vaka Sonu Puanı
          </div>
          <div className={`text-7xl font-semibold ${renk}`} style={{ letterSpacing: "-2px" }}>
            {sonuc.toplamPuan}
            <span className="text-3xl text-muted">/{sonuc.maxPuan}</span>
          </div>
          <div className={`mt-2 text-2xl font-semibold ${renk}`}>{yuzde}%</div>
          <div className="mt-4 text-sm text-steel">
            {yuzde >= 80
              ? "Mükemmel klinik yaklaşım! 🎉"
              : yuzde >= 60
              ? "İyi yaklaşım, bazı eksikler var."
              : "Klinik yaklaşımı geliştirmek gerekiyor."}
          </div>
        </div>

        {sonuc.clinicalReasoning?.feedback.recorded && (
          <section className="mb-8" aria-labelledby="muhakeme-geribildirim-baslik">
            <h3 id="muhakeme-geribildirim-baslik" className="mb-4 text-lg font-semibold text-ink">🧠 Klinik Muhakeme Özeti</h3>
            <div className="card-feature grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted">Ayırıcı tanı</p>
                <p className="mt-1 text-sm text-ink">{sonuc.clinicalReasoning.feedback.differentialCount} olasılık kaydettin</p>
              </div>
              {sonuc.clinicalReasoning.feedback.confidence !== null && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted">Tanı kalibrasyonu</p>
                  <p className="mt-1 text-sm text-ink">
                    Güvenin %{sonuc.clinicalReasoning.feedback.confidence} · {calibrationCopy(sonuc.clinicalReasoning.feedback.calibrationLabel)}
                  </p>
                </div>
              )}
              {sonuc.clinicalReasoning.input.problemRepresentation && (
                <div className="sm:col-span-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted">Problem temsili</p>
                  <p className="mt-1 text-sm leading-6 text-steel">{sonuc.clinicalReasoning.input.problemRepresentation}</p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Güçlü Yönler */}
        {sonuc.gucluYonler.length > 0 && (
          <div className="mb-8">
            <h3 className="mb-4 text-lg font-semibold text-ink">✅ Güçlü Yönler</h3>
            <div className="space-y-2">
              {sonuc.gucluYonler.map((yon) => (
                <div key={yon} className="rounded-lg bg-brand/10 px-4 py-3 text-sm text-brand-deep">
                  {yon}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Zayıf Yönler */}
        {sonuc.zayifYonler.length > 0 && (
          <div className="mb-8">
            <h3 className="mb-4 text-lg font-semibold text-ink">⚠️ Geliştirilecek Yönler</h3>
            <div className="space-y-2">
              {sonuc.zayifYonler.map((yon) => (
                <div key={yon} className="rounded-lg bg-clinical-red/10 px-4 py-3 text-sm text-clinical-red">
                  {yon}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Atlanan Red Flag'ler */}
        {sonuc.atlananRedFlagler.length > 0 && (
          <div className="mb-8">
            <h3 className="mb-4 text-lg font-semibold text-clinical-red">🚨 Atlanan Red Flag'ler</h3>
            <div className="space-y-2">
              {sonuc.atlananRedFlagler.map((rf) => (
                <div key={rf} className="rounded-lg border border-clinical-red/20 bg-clinical-red/5 px-4 py-3 text-sm text-clinical-red">
                  {rf}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Anamnez Analizi */}
        <div className="mb-8">
          <h3 className="mb-4 text-lg font-semibold text-ink">🔍 Anamnez Analizi</h3>
          <div className="card-feature">
            <div className="mb-4 flex flex-col items-start gap-2 text-sm sm:flex-row sm:items-center sm:gap-4">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-ink">{sonuc.anamnezAnalizi.toplamSoruldu}/{sonuc.anamnezAnalizi.toplamBeklenen}</span>
                <span className="text-steel">kritik soru soruldu</span>
              </div>
              {sonuc.anamnezAnalizi.enIyiKategori && (
                <div className="flex items-center gap-1 text-brand-deep">
                  <span>🏆 En iyi:</span>
                  <span className="font-medium">{sonuc.anamnezAnalizi.enIyiKategori}</span>
                </div>
              )}
              {sonuc.anamnezAnalizi.enCokEksikKategori && (
                <div className="flex items-center gap-1 text-clinical-orange">
                  <span>⚠️ En eksik:</span>
                  <span className="font-medium">{sonuc.anamnezAnalizi.enCokEksikKategori}</span>
                </div>
              )}
            </div>
            <div className="space-y-2">
              {sonuc.anamnezAnalizi.kategoriBazinda.map((k) => {
                if (k.beklenen === 0) return null;
                const oran = Math.round((k.soruldu / k.beklenen) * 100);
                const renk = oran >= 80 ? "bg-brand" : oran >= 50 ? "bg-clinical-orange" : "bg-clinical-red";
                return (
                  <div key={k.kategori} className="flex items-center gap-3">
                    <div className="w-40 flex-shrink-0 text-xs font-medium text-ink">{k.etiket}</div>
                    <div className="flex-1 overflow-hidden rounded-full bg-surface">
                      <div
                        className={`h-2 w-full origin-left rounded-full transition-transform motion-reduce:transition-none ${renk}`}
                        style={{ transform: `scaleX(${oran / 100})` }}
                      />
                    </div>
                    <div className="w-20 flex-shrink-0 text-right text-xs text-steel">
                      {k.soruldu}/{k.beklenen} ({oran}%)
                    </div>
                  </div>
                );
              })}
            </div>
            {sonuc.anamnezAnalizi.kategoriBazinda.some((k) => k.eksik.length > 0) && (
              <div className="mt-4 space-y-1.5">
                <div className="text-xs font-semibold text-muted">Sorulmayan kritik sorular:</div>
                {sonuc.anamnezAnalizi.kategoriBazinda.map((k) => {
                  if (k.eksik.length === 0) return null;
                  return (
                    <div key={k.kategori} className="flex items-start gap-2 text-xs text-clinical-red/80">
                      <span className="mt-0.5">•</span>
                      <span>
                        <strong>{k.etiket}:</strong> {k.eksik.join(", ")}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* İdeal Yol */}
        <div className="mb-8">
          <h3 className="mb-4 text-lg font-semibold text-ink">📋 İdeal Klinik Yaklaşım</h3>
          <div className="card-feature space-y-2">
            {sonuc.idealYol.map((adim) => (
              <div key={adim} className="text-sm text-steel" style={{ lineHeight: "1.6" }}>
                {adim}
              </div>
            ))}
          </div>
        </div>

        {/* Eğitim Notu */}
        <div className="mb-8">
          <h3 className="mb-4 text-lg font-semibold text-ink">📚 Eğitim Notu</h3>
          <div className="card">
            <p className="text-sm text-steel whitespace-pre-line" style={{ lineHeight: "1.7" }}>
              {sonuc.egitimNotu}
            </p>
          </div>
        </div>

        {/* Tedavi Planı */}
        {sonuc.tedavi && (
          <div className="mb-8">
            <h3 className="mb-4 text-lg font-semibold text-ink">💊 Tedavi Planı</h3>
            <div className="card overflow-hidden p-0">
              {/* Tedavi Özet */}
              <div className="bg-brand/10 px-4 py-3 border-b border-hairline">
                <p className="text-sm font-medium text-brand-deep">{sonuc.tedavi.aciklama}</p>
              </div>

              {/* İlaç Tablosu */}
              {sonuc.tedavi.ilaclar.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-hairline bg-surface-soft">
                        <th className="px-4 py-2 font-semibold text-ink">İlaç</th>
                        <th className="px-4 py-2 font-semibold text-ink">Doz</th>
                        <th className="px-4 py-2 font-semibold text-ink">Yol</th>
                        {tedaviTakvimiVar && (
                          <th className="px-4 py-2 font-semibold text-ink">Sıklık</th>
                        )}
                        {tedaviTakvimiVar && (
                          <th className="px-4 py-2 font-semibold text-ink">Süre</th>
                        )}
                        <th className="px-4 py-2 font-semibold text-ink">Endikasyon</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sonuc.tedavi.ilaclar.map((ilac) => (
                        <tr key={`${ilac.ad}-${ilac.doz}-${ilac.yol}`} className="border-b border-hairline-soft last:border-0 hover:bg-surface transition-colors">
                          <td className="px-4 py-2.5 font-medium text-ink">{ilac.ad}</td>
                          <td className="px-4 py-2.5 text-steel">{ilac.doz}</td>
                          <td className="px-4 py-2.5 text-steel">{ilac.yol}</td>
                          {tedaviTakvimiVar && (
                            <td className="px-4 py-2.5 text-steel">{ilac.siklik || "—"}</td>
                          )}
                          {tedaviTakvimiVar && (
                            <td className="px-4 py-2.5 text-steel">{ilac.sure || "—"}</td>
                          )}
                          <td className="px-4 py-2.5 text-steel">{ilac.endikasyon}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Prosedürler */}
              {sonuc.tedavi.prosedurler.length > 0 && (
                <div className="border-t border-hairline px-4 py-3">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Prosedürler</div>
                  <ul className="space-y-1">
                    {sonuc.tedavi.prosedurler.map((p) => (
                      <li key={p} className="flex items-start gap-2 text-sm text-steel">
                        <span className="mt-1 text-[10px] text-brand">●</span>
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Notlar */}
              {sonuc.tedavi.notlar.length > 0 && (
                <div className="border-t border-hairline bg-surface-soft px-4 py-3">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Önemli Notlar</div>
                  <ul className="space-y-1">
                    {sonuc.tedavi.notlar.map((n) => (
                      <li key={n} className="flex items-start gap-2 text-sm text-steel">
                        <span className="mt-1 text-[10px] text-clinical-orange">!</span>
                        <span>{n}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Kaynak */}
              <div className="border-t border-hairline px-4 py-2">
                <span className="text-[11px] text-muted">Kaynak: {sonuc.tedavi.kaynak}</span>
              </div>
            </div>
          </div>
        )}

        {/* Özet */}
        <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <OzetKart baslik="Doğru Sorular" deger={sonuc.dogruSorular.length} renk="brand" />
          <OzetKart baslik="Eksik Sorular" deger={sonuc.eksikSorular.length} renk="orange" />
          <OzetKart baslik="Doğru Testler" deger={sonuc.dogruTestler.length} renk="brand" />
          <OzetKart baslik="Eksik Testler" deger={sonuc.eksikTestler.length} renk="orange" />
        </div>

        {/* Aksiyonlar */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link href="/vakalar" className="btn-primary flex-1 justify-center">
            Yeni Vaka Seç →
          </Link>
          <Link href="/" className="btn-secondary flex-1 justify-center">
            Ana Sayfa
          </Link>
        </div>
      </div>
    </div>
  );
}

function calibrationCopy(label: "iyi-kalibre" | "asiri-guvenli" | "temkinli" | null): string {
  if (label === "iyi-kalibre") return "güvenin sonuçla uyumlu";
  if (label === "asiri-guvenli") return "sonuçla karşılaştırınca güvenin yüksekti";
  if (label === "temkinli") return "sonuçla karşılaştırınca temkinliydin";
  return "güven düzeyini değerlendirdin";
}
function OzetKart({ baslik, deger, renk }: { baslik: string; deger: number; renk: string }) {
  const renkSinif =
    renk === "brand"
      ? "text-brand-deep bg-brand/10"
      : renk === "orange"
      ? "text-clinical-orange bg-clinical-orange/10"
      : "text-clinical-red bg-clinical-red/10";

  return (
    <div className={`rounded-lg p-4 text-center ${renkSinif}`}>
      <div className="text-3xl font-semibold">{deger}</div>
      <div className="mt-1 text-xs font-medium">{baslik}</div>
    </div>
  );
}

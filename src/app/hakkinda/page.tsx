import Link from "next/link";
import { LAB_KAYNAKLARI, LAB_FUSION_POLITIKA } from "@/lib/data/lab-kaynaklari";

export default function HakkindaPage() {
  const durumEtiket: Record<string, string> = {
    aktif: "Aktif",
    planlanan: "Planlanan",
    referans: "Referans",
  };
  const durumRenk: Record<string, string> = {
    aktif: "badge-brand",
    planlanan: "badge-orange",
    referans: "badge-steel",
  };

  return (
    <div className="min-h-screen bg-canvas">
      <nav className="sticky top-0 z-50 border-b border-hairline-soft bg-canvas/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl font-semibold tracking-tight text-ink">
              tıp<span className="text-brand">_ai</span>
            </span>
          </Link>
          <Link href="/vakalar" className="btn-primary text-sm">
            Vakalara Dön
          </Link>
        </div>
      </nav>

      <div className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-4xl font-semibold tracking-tight text-ink mb-8" style={{ letterSpacing: "-1px" }}>
          Hakkında
        </h1>

        <div className="prose prose-sm max-w-none text-steel space-y-6">
          <section>
            <h2 className="text-xl font-semibold text-ink mb-3">Bu proje nedir?</h2>
            <p>
              tıp_ai, tıp öğrencilerinin klinik karar verme becerilerini geliştirmek için
              tasarlanmış Türkçe bir simülasyon platformudur. Sistem, öğrencinin yalnızca
              nihai tanısını değil; doğru anamnez sorularını sorup sormadığını, uygun testleri
              isteyip istemediğini ve klinik akıl yürütmesini ne kadar doğru yürüttüğünü
              değerlendirir.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-ink mb-3">Nasıl çalışır?</h2>
            <ol className="list-decimal pl-5 space-y-2">
              <li>Vaka seçim ekranından bir semptom başlığı seçersiniz.</li>
              <li>Hasta kartını okur, serbest Türkçe metinle hastaya soru sorarsınız.</li>
              <li>Uygun testleri istersiniz (EKG, troponin, hemogram, vb.).</li>
              <li>Sonuçları sağ panelde görürsünüz.</li>
              <li>Ön tanınızı girer ve vakayı tamamlarsınız.</li>
              <li>Sistem rubrik tabanlı puanlama yapar ve geri bildirim verir.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-ink mb-3">Değerlendirme nasıl yapılır?</h2>
            <p>
              Her vaka için bir klinik rubrik tanımlanmıştır. Bu rubrik şunları içerir:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Beklenen anamnez soruları (+2 puan)</li>
              <li>Kritik red flag sorgulamaları (+2 puan, atlama -3 puan)</li>
              <li>Beklenen testler (+2 puan)</li>
              <li>Gereksiz/erken testler (-1 puan)</li>
              <li>Doğru tanı (+5 puan)</li>
            </ul>
            <p className="mt-3">
              Puanlama kural tabanlı ve deterministiktir — yapay zeka ile üretim yapılmaz.
              Bu, açıklanabilirlik ve güvenilirlik için önemlidir.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-ink mb-3">Veriler nereden geliyor?</h2>
            <p>
              Vaka iskeleti (şikayet, patoloji testleri, rubrik) eğitim amaçlı sentetik
              şablonlardır. Bazal / “normal” lab paneli ise aralıktan uydurulmaz;
              import edilmiş lab havuzundan hasta profiline (yaş, cinsiyet) göre örneklenir.
            </p>
            <p className="mt-2 text-sm text-muted">{LAB_FUSION_POLITIKA}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-ink mb-3">Lab / EHR veri kaynakları</h2>
            <div className="not-prose space-y-4 mt-4">
              {LAB_KAYNAKLARI.map((k) => (
                <div
                  key={k.id}
                  className="rounded-lg border border-hairline bg-canvas p-4"
                >
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="text-sm font-semibold text-ink">{k.ad}</span>
                    <span className={`badge ${durumRenk[k.durum] || "badge-steel"}`}>
                      {durumEtiket[k.durum] || k.durum}
                    </span>
                  </div>
                  <p className="text-sm text-steel mb-2">{k.rol}</p>
                  <p className="text-xs text-muted mb-2">{k.not}</p>
                  {k.tablolar && (
                    <p className="text-xs text-muted mb-2">
                      Tablolar: {k.tablolar.join(", ")}
                    </p>
                  )}
                  <p className="text-xs text-muted mb-2">Lisans: {k.lisans}</p>
                  <div className="flex flex-wrap gap-3 text-xs">
                    <a
                      href={k.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-clinical-blue underline hover:text-ink"
                    >
                      Kaynak linki →
                    </a>
                    {k.ekUrl?.map((e) => (
                      <a
                        key={e.url}
                        href={e.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-clinical-blue underline hover:text-ink"
                      >
                        {e.etiket} →
                      </a>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-ink mb-3">Limitler</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Bu platform eğitim amaçlıdır, klinik karar desteği değildir.</li>
              <li>Rubrik&apos;ler uzman hekim onayı gerektirir.</li>
              <li>Görüntüleme DICOM değil, PNG formatındadır.</li>
              <li>Tanı üretimi yapay zeka ile yapılmaz — halüsinasyon riski nedeniyle.</li>
              <li>Tüm tıbbi içerik eğitim amaçlıdır, gerçek hasta tedavisinde kullanılmaz.</li>
              <li>MIMIC-IV için PhysioNet credential gerekir; henüz bağlanmamıştır.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-ink mb-3">Teknoloji</h2>
            <p>
              Next.js 14, TypeScript, Tailwind CSS ile geliştirilmiştir. Puanlama motoru
              kural tabanlıdır. Türkçe NLP katmanı dictionary + fuzzy matching ile çalışır.
              Lab fusion: Synthea lab-pool JSON + profil eşleşmeli örnekleme.
            </p>
          </section>
        </div>

        <div className="mt-12">
          <Link href="/vakalar" className="btn-accent">
            Vaka Seç ve Başla →
          </Link>
        </div>
      </div>
    </div>
  );
}

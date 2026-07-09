import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-canvas">
      {/* Disclaimer Banner */}
      <div className="bg-canvas-dark text-on-dark text-center text-sm font-medium py-2.5 px-4">
        ⚕️ Bu platform eğitim amaçlıdır, klinik karar desteği değildir. Gerçek hasta verisi içermez.
      </div>

      {/* Top Nav */}
      <nav className="sticky top-0 z-50 border-b border-hairline-soft bg-canvas/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl font-semibold tracking-tight text-ink">
              tıp<span className="text-brand">_ai</span>
            </span>
          </Link>
          <div className="hidden items-center gap-8 md:flex">
            <Link href="/vakalar" className="text-sm font-medium text-steel hover:text-ink transition-colors">
              Vakalar
            </Link>
            <Link href="/hakkinda" className="text-sm font-medium text-steel hover:text-ink transition-colors">
              Hakkında
            </Link>
            <Link href="/doktorlar" className="text-sm font-medium text-steel hover:text-ink transition-colors">
              Doktorlar
            </Link>
          </div>
          <Link href="/vakalar" className="btn-primary">
            Vakaya Başla
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-brand-soft/10 via-canvas to-canvas" />
        <div className="relative mx-auto max-w-4xl px-6 pt-32 pb-24 text-center">
          <div className="badge badge-brand mb-6">
            <span className="mr-1.5">🩺</span> Türkçe Klinik Simülasyon
          </div>
          <h1 className="text-5xl font-semibold tracking-tight text-ink sm:text-6xl md:text-7xl" style={{ letterSpacing: "-2px", lineHeight: "1.05" }}>
            Daha çok vaka gör.
            <br />
            <span className="text-brand-deep">Daha iyi hekim ol.</span>
          </h1>
          <p className="mx-auto mt-8 max-w-2xl text-lg text-steel sm:text-xl" style={{ lineHeight: "1.5" }}>
            Gerçek poliklinik karşılaşmasını simüle eden Türkçe platform. Soru sor, test iste,
            sonuçları değerlendir — sadece tanıyı değil, klinik yaklaşımını puanla.
          </p>
          <div className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link href="/vakalar" className="btn-accent text-base px-8 py-3">
              Poliklinik Seç →
            </Link>
            <Link href="/cemicegek" className="inline-flex items-center justify-center gap-2 rounded-full bg-clinical-red px-8 py-3 text-base font-medium text-white transition-colors hover:bg-clinical-red/80">
              🚑 Çemiçgezek Acil
            </Link>
            <Link href="/hakkinda" className="btn-secondary text-base px-8 py-3">
              Nasıl Çalışır?
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-6 py-24">
        <div className="mb-16 text-center">
          <h2 className="text-4xl font-semibold tracking-tight text-ink" style={{ letterSpacing: "-1px" }}>
            ChatGPT'nin yapamadığını yapar
          </h2>
          <p className="mt-4 text-lg text-steel">
            Serbest metinle soru sor, test iste, rubrik tabanlı puan al — hepsi Türkçe.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <FeatureCard
            icon="📋"
            title="Rubrik Puanlama"
            description="Sadece tanı doğru mu değil; doğru soruları sordun mu, red flag'i atlattın mı, gereksiz test istedin mi — heksi puanlanır."
          />
          <FeatureCard
            icon="🚩"
            title="Red Flag Takibi"
            description="Kritik belirtileri atlarsan negatif puan. Gerçek hasta güvenliği refleksi kazan."
          />
          <FeatureCard
            icon="🧪"
            title="Esnek Test İsteme"
            description="Kan testi, EKG, röntgen, MR — ne istersen iste. Sistem uygun sonucu gösterir."
          />
          <FeatureCard
            icon="🇹🇷"
            title="Tamamen Türkçe"
            description="EKG çek, kalp filmi bak, troponin iste — Türkçe tıbbi terminasyonin tüm varyasyonları."
          />
          <FeatureCard
            icon="📊"
            title="İdeal Yol Karşılaştırma"
            description="Vaka sonunda senin yolun ile ideal klinik yaklaşım yan yana. Hata farkındalığı somut."
          />
          <FeatureCard
            icon="🔓"
            title="Kayıt Yok, Ücretsiz"
            description="E-posta vermeden, hesap açmadan, tek tıkla başla. Anonim UUID ile ilerlemen takip edilir."
          />
        </div>
      </section>

      {/* How It Works */}
      <section className="bg-surface py-24">
        <div className="mx-auto max-w-4xl px-6">
          <h2 className="mb-16 text-center text-4xl font-semibold tracking-tight text-ink" style={{ letterSpacing: "-1px" }}>
            Nasıl Çalışır?
          </h2>
          <div className="space-y-8">
            <StepCard
              number="1"
              title="Vaka Seç"
              description="Sınıfını ve seviyeni gir, sana uygun vakayı seç. Her vaka gerçek bir poliklinik karşılaşması."
            />
            <StepCard
              number="2"
              title="Anamnez Topla"
              description="Hastaya serbest Türkçe metinle soru sor. 'Ağrı yayılıyor mu?' 'Aile öyküsü var mı?' Sistem tüm varyasyonları anlar."
            />
            <StepCard
              number="3"
              title="Test İste"
              description="Dropdown'dan veya serbest metinle test iste. EKG, troponin, röntgen — sonucu anında gör."
            />
            <StepCard
              number="4"
              title="Tanı Koy"
              description="Ön tanını gir ve vakayı tamamla."
            />
            <StepCard
              number="5"
              title="Değerlendirme Al"
              description="Puanın, güçlü yönlerin, eksiklerin, atladığın red flag'ler ve ideal yaklaşım — hepsi Türkçe, açıklanabilir."
            />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-4xl px-6 py-24">
        <div className="card-feature text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-ink" style={{ letterSpacing: "-0.5px" }}>
            İlk vakana bugün başla
          </h2>
          <p className="mt-4 text-lg text-steel">
            Kayıt yok, ödeme yok, bekleme yok. Tek tıkla başla.
          </p>
          <Link href="/vakalar" className="btn-accent mt-8 text-base px-8 py-3">
            Vaka Seç →
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-hairline bg-surface-soft py-12">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex flex-col items-center justify-between gap-8 md:flex-row">
            <div>
              <span className="text-lg font-semibold tracking-tight text-ink">
                tıp<span className="text-brand">_ai</span>
              </span>
              <p className="mt-2 text-sm text-steel">
                Türkçe klinik karar simülasyon sistemi · Eğitim amaçlıdır
              </p>
            </div>
            <div className="flex gap-8 text-sm">
              <Link href="/vakalar" className="text-steel hover:text-ink transition-colors">Vakalar</Link>
              <Link href="/hakkinda" className="text-steel hover:text-ink transition-colors">Hakkında</Link>
              <Link href="/doktorlar" className="text-steel hover:text-ink transition-colors">Doktorlar</Link>
            </div>
          </div>
          <div className="mt-8 border-t border-hairline-soft pt-8 text-center text-xs text-muted">
            © 2026 tıp_ai · Bu platform eğitim amaçlıdır, tıbbi tavsiye değildir · Sentetik vaka verisi kullanılır
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="card-feature">
    <div className="text-3xl mb-4">{icon}</div>
    <h3 className="text-lg font-semibold text-ink mb-2">{title}</h3>
    <p className="text-sm text-steel" style={{ lineHeight: "1.5" }}>{description}</p>
    </div>
  );
}

function StepCard({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <div className="flex gap-6">
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-brand text-ink font-semibold text-sm">
        {number}
      </div>
      <div className="pt-1">
        <h3 className="text-lg font-semibold text-ink mb-1">{title}</h3>
        <p className="text-sm text-steel" style={{ lineHeight: "1.5" }}>{description}</p>
      </div>
    </div>
  );
}

import Link from "next/link";
import { SessionNavigation } from "@/components/auth/SessionNavigation";

const navigationItems = [
  { href: "/vakalar", label: "Vakalar" },
  { href: "/hakkinda", label: "Nasıl çalışır?" },
  { href: "/doktorlar", label: "Doktorlar" },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-canvas">
      <a href="#ana-icerik" className="skip-link">
        İçeriğe atla
      </a>

      <div className="bg-canvas-dark px-4 py-2 text-center text-xs font-medium text-on-dark sm:text-sm">
        <span aria-hidden="true">⚕️ </span>
        Eğitim amaçlı klinik simülasyon · Gerçek hasta verisi içermez · Klinik karar desteği değildir
      </div>

      <header className="sticky top-0 z-50 border-b border-hairline-soft bg-canvas/95 backdrop-blur-md">
        <nav className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6" aria-label="Ana menü">
          <Link href="/" className="shrink-0 text-xl font-semibold tracking-tight text-ink" aria-label="tıp_ai ana sayfa">
            tıp<span className="text-brand">_ai</span>
          </Link>
          <div className="hidden items-center gap-7 md:flex">
            {navigationItems.map((item) => (
              <Link key={item.href} href={item.href} className="text-sm font-medium text-steel transition-colors hover:text-ink">
                {item.label}
              </Link>
            ))}
          </div>
          <div className="hidden md:block"><SessionNavigation /></div>
          <div className="md:hidden"><SessionNavigation compact /></div>
        </nav>
        <nav className="flex gap-1 overflow-x-auto border-t border-hairline-soft px-4 py-2 md:hidden" aria-label="Mobil ana menü">
          {navigationItems.map((item) => (
            <Link key={item.href} href={item.href} className="shrink-0 rounded-full px-3 py-1.5 text-sm font-medium text-steel transition-colors hover:bg-surface hover:text-ink">
              {item.label}
            </Link>
          ))}
          <Link href="/cemicegek" className="shrink-0 rounded-full px-3 py-1.5 text-sm font-medium text-clinical-red transition-colors hover:bg-clinical-red/10">
            Acil simülatör
          </Link>
        </nav>
      </header>

      <main id="ana-icerik" tabIndex={-1}>
        <section className="relative overflow-hidden border-b border-hairline-soft">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-gradient-to-b from-brand-soft/20 via-brand-soft/5 to-transparent" />
          <div className="relative mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-28">
            <div>
              <p className="badge badge-brand mb-6">Türkçe klinik karar simülasyonu</p>
              <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-ink sm:text-6xl" style={{ letterSpacing: "-2px", lineHeight: "1.05" }}>
                Vakayı çöz.
                <br />
                <span className="text-brand-deep">Düşünme biçimini gör.</span>
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-7 text-steel sm:text-lg">
                Anamnez topla, uygun testleri iste ve ön tanını oluştur. Vaka sonunda yalnızca cevabını değil,
                klinik yaklaşımını da anlaşılır bir geri bildirimle değerlendir.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/deneme" className="btn-primary min-h-11 px-6 text-base">
                  Deneme vakasını aç <span aria-hidden="true">→</span>
                </Link>
                <Link href="/giris" className="btn-secondary min-h-11 px-6 text-base">
                  Giriş yap veya kayıt ol
                </Link>
              </div>
              <p className="mt-4 text-sm text-steel">
                Deneme vakası hesap gerektirmez. İlerlemeni kaydetmek için ücretsiz öğrenci hesabı oluşturabilirsin.
              </p>
            </div>

            <section className="rounded-xl border border-hairline bg-canvas p-5 shadow-subtle sm:p-7" aria-labelledby="akis-baslik">
              <div className="flex items-start justify-between gap-4 border-b border-hairline-soft pb-5">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-muted">Bir vaka oturumu</p>
                  <h2 id="akis-baslik" className="mt-1 text-xl font-semibold text-ink">Klinik akışın görünür olsun</h2>
                </div>
                <span className="badge badge-brand">Eğitim modu</span>
              </div>
              <ol className="mt-2 divide-y divide-hairline-soft">
                <FlowItem number="01" title="Anamnez" description="Hastaya serbest Türkçe sorular yönelt." />
                <FlowItem number="02" title="Tetkik" description="Klinik gerekçenle test iste, sonucu yorumla." />
                <FlowItem number="03" title="Tanı ve geri bildirim" description="Yaklaşımını rubrik üzerinden gözden geçir." />
              </ol>
              <Link href="/vakalar" className="btn-accent mt-6 w-full min-h-11 text-base">
                Polikliniklerden vaka seç <span aria-hidden="true">→</span>
              </Link>
            </section>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24" aria-labelledby="neden-baslik">
          <div className="max-w-2xl">
            <p className="text-sm font-medium text-brand-deep">Vaka sonundan önce de, sonra da rehberlik</p>
            <h2 id="neden-baslik" className="mt-3 text-3xl font-semibold tracking-tight text-ink sm:text-4xl" style={{ letterSpacing: "-1px" }}>
              Klinik kararını adım adım kur.
            </h2>
            <p className="mt-4 text-base leading-7 text-steel">
              Sistem serbest metinli düşünme alanını, yapılandırılmış tetkik isteme ve açıklanabilir değerlendirmeyle bir araya getirir.
            </p>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            <FeatureCard icon="🗣️" eyebrow="Önce dinle" title="Doğal anamnez" description="Ezber seçenekler yerine hastaya kendi cümlelerinle soru sor; klinik konuşma pratiğini koru." />
            <FeatureCard icon="🧪" eyebrow="Sonra kanıt ara" title="Gerekçeli tetkik" description="Test sonuçlarını tek tek gör, gereksiz istemlerin ve atlanan kritik adımların farkına var." />
            <FeatureCard icon="📈" eyebrow="Sonunda düşün" title="Açıklanabilir değerlendirme" description="Tanı, red flag, anamnez ve tetkik yaklaşımını ayrı ayrı görerek bir sonraki vakaya hazırlan." />
          </div>
        </section>

        <section className="border-y border-hairline-soft bg-surface-soft py-16 sm:py-20" aria-labelledby="baslangic-baslik">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
              <div className="max-w-2xl">
                <p className="text-sm font-medium text-brand-deep">Başlangıç noktası</p>
                <h2 id="baslangic-baslik" className="mt-3 text-3xl font-semibold tracking-tight text-ink sm:text-4xl" style={{ letterSpacing: "-1px" }}>
                  İki farklı şekilde başlayabilirsin.
                </h2>
              </div>
              <p className="max-w-lg text-sm leading-6 text-steel">İlk kez geliyorsan deneme vakasıyla ilerle. Düzenli çalışmak ve sonuçlarını takip etmek için öğrenci hesabını kullan.</p>
            </div>
            <div className="mt-8 grid gap-4 md:grid-cols-2">
              <Link href="/deneme" className="group rounded-xl border border-hairline bg-canvas p-6 transition-[border-color,box-shadow] hover:border-brand hover:shadow-card">
                <span className="badge badge-brand">Hesapsız</span>
                <h3 className="mt-4 text-xl font-semibold text-ink">Deneme vakasını çöz</h3>
                <p className="mt-2 text-sm leading-6 text-steel">Platformun akışını tanı, hasta öyküsünü topla ve ilk geri bildirimini al.</p>
                <span className="mt-5 inline-flex text-sm font-medium text-brand-deep">Hemen başla <span className="ml-1 transition-transform group-hover:translate-x-1" aria-hidden="true">→</span></span>
              </Link>
              <Link href="/giris" className="group rounded-xl border border-hairline bg-canvas p-6 transition-[border-color,box-shadow] hover:border-brand hover:shadow-card">
                <span className="badge badge-steel">Ücretsiz hesap</span>
                <h3 className="mt-4 text-xl font-semibold text-ink">İlerlemeni takip et</h3>
                <p className="mt-2 text-sm leading-6 text-steel">Poliklinik vakalarına eriş, geçmiş oturumlarını ve performans eğilimini profilinde gör.</p>
                <span className="mt-5 inline-flex text-sm font-medium text-brand-deep">Girişe git <span className="ml-1 transition-transform group-hover:translate-x-1" aria-hidden="true">→</span></span>
              </Link>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6 sm:py-24">
          <p className="badge badge-red">Acil karar simülasyonu</p>
          <h2 className="mt-5 text-3xl font-semibold tracking-tight text-ink sm:text-4xl" style={{ letterSpacing: "-1px" }}>
            Tempo yüksekse, önceliğini de test et.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-steel">
            Çemiçgezek Acil Simülatörü rastgele bir acil başvurusuyla başlar; ilk değerlendirmeyi ve güvenlik önceliklerini sen belirlersin.
          </p>
          <Link href="/cemicegek" className="mt-8 inline-flex min-h-11 items-center justify-center rounded-full bg-clinical-red px-6 text-base font-medium text-white transition-colors hover:bg-clinical-red/80">
            Acil simülatöre git <span className="ml-2" aria-hidden="true">→</span>
          </Link>
        </section>
      </main>

      <footer className="border-t border-hairline bg-surface-soft">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-lg font-semibold tracking-tight text-ink">tıp<span className="text-brand">_ai</span></p>
            <p className="mt-2 max-w-lg text-sm leading-6 text-steel">Türkçe klinik karar simülasyon sistemi. Sentetik vakalarla eğitim için tasarlanmıştır.</p>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium text-steel">
            {navigationItems.map((item) => <Link key={item.href} href={item.href} className="transition-colors hover:text-ink">{item.label}</Link>)}
            <Link href="/giris" className="transition-colors hover:text-ink">Giriş</Link>
          </div>
        </div>
        <div className="border-t border-hairline-soft px-4 py-4 text-center text-xs text-muted">© 2026 tıp_ai · Bu platform tıbbi tavsiye vermez.</div>
      </footer>
    </div>
  );
}

function FlowItem({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <li className="flex gap-4 py-5">
      <span className="pt-0.5 font-mono text-xs font-medium text-brand-deep" aria-hidden="true">{number}</span>
      <div>
        <h3 className="text-base font-semibold text-ink">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-steel">{description}</p>
      </div>
    </li>
  );
}

function FeatureCard({ icon, eyebrow, title, description }: { icon: string; eyebrow: string; title: string; description: string }) {
  return (
    <article className="rounded-xl border border-hairline bg-canvas p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <span className="text-2xl" aria-hidden="true">{icon}</span>
        <span className="text-xs font-medium text-muted">{eyebrow}</span>
      </div>
      <h3 className="mt-6 text-lg font-semibold text-ink">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-steel">{description}</p>
    </article>
  );
}

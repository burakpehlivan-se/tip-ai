import Link from "next/link";

export default function DoktorlarPage() {
  return (
    <div className="min-h-[100dvh] bg-canvas">
      <nav className="sticky top-0 z-50 border-b border-hairline-soft bg-canvas/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
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

      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl" style={{ letterSpacing: "-1px" }}>
            Doktorlar ve Uzmanlar İçin
          </h1>
          <p className="mt-2 max-w-2xl text-base text-steel">
            Bu projenin tıbbi doğruluğu uzman hekim onayına bağlıdır. İşsize nasıl katkı
            sağlayabileceğiniz:
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="card">
            <div className="flex items-start gap-3">
              <div className="text-2xl">🔴</div>
              <div>
                <h3 className="text-lg font-semibold text-ink">Rubrik Gözden Geçirme</h3>
                <p className="mt-1 text-sm leading-6 text-steel">
                  Her hastalık için tanımlanan klinik rubrik'i (beklenen sorular, red flag'ler,
                  test listesi, puanlama ağırlıkları) gözden geçirin. "Bu sorunun sorulması
                  zorunlu, bu kısmı atladığında -5 demem doğru mu?" türünden feedback.
                </p>
                <div className="mt-3 text-xs text-muted">~60-90 dakika</div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-start gap-3">
              <div className="text-2xl">🟡</div>
              <div>
                <h3 className="text-lg font-semibold text-ink">Örnek Vaka Üretme</h3>
                <p className="mt-1 text-sm leading-6 text-steel">
                  2-3 örnek vaka paylaşın (yaş, cinsiyet, EKG bulgusu, troponin, beklenen tanı).
                  Bu vakalar sisteme eklenecektir.
                </p>
                <div className="mt-3 text-xs text-muted">~30 dakika/vaka</div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-start gap-3">
              <div className="text-2xl">🟢</div>
              <div>
                <h3 className="text-lg font-semibold text-ink">Öğrenci Yönlendirme</h3>
                <p className="mt-1 text-sm leading-6 text-steel">
                  Beta test aşamasında 3-5 öğrenciyi platforma yönlendirin ve geri bildirim
                  toplayın.
                </p>
                <div className="mt-3 text-xs text-muted">~10 dakika</div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 card-feature">
          <h3 className="text-lg font-semibold text-ink mb-2">Neden önemli?</h3>
          <p className="text-sm text-steel" style={{ lineHeight: "1.6" }}>
            Yanlış tıp öğretmek, hiç öğretmemekten daha kötüdür. Bir öğrenciye yanlış red flag
            öğretmek, gerçek bir hastada zarar anlamına gelebilir. Bu yüzden uzman hekim onayı
            bu projenin etik bir gereğidir, opsiyonel bir adım değildir.
          </p>
        </div>

        <div className="mt-6">
          <Link href="/vakalar" className="btn-secondary">
            ← Vakalara Dön
          </Link>
        </div>
      </main>
    </div>
  );
}

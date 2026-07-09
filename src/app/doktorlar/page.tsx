import Link from "next/link";

export default function DoktorlarPage() {
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
        <h1 className="text-4xl font-semibold tracking-tight text-ink mb-4" style={{ letterSpacing: "-1px" }}>
          Doktorlar ve Uzmanlar İçin
        </h1>
        <p className="text-lg text-steel mb-12">
          Bu projenin tıbbi doğruluğu uzman hekim onayına bağlıdır. İşsize nasıl katkı
          sağlayabileceğiniz:
        </p>

        <div className="space-y-6">
          <div className="card">
            <div className="flex items-start gap-4">
              <div className="text-2xl">🔴</div>
              <div>
                <h3 className="text-lg font-semibold text-ink mb-2">Rubrik Gözden Geçirme</h3>
                <p className="text-sm text-steel mb-3">
                  Her hastalık için tanımlanan klinik rubrik'i (beklenen sorular, red flag'ler,
                  test listesi, puanlama ağırlıkları) gözden geçirin. "Bu sorunun sorulması
                  zorunlu, bu kısmı atladığında -5 demem doğru mu?" türünden feedback.
                </p>
                <div className="text-xs text-muted">~60-90 dakika</div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-start gap-4">
              <div className="text-2xl">🟡</div>
              <div>
                <h3 className="text-lg font-semibold text-ink mb-2">Örnek Vaka Üretme</h3>
                <p className="text-sm text-steel mb-3">
                  2-3 örnek vaka paylaşın (yaş, cinsiyet, EKG bulgusu, troponin, beklenen tanı).
                  Bu vakalar sisteme eklenecektir.
                </p>
                <div className="text-xs text-muted">~30 dakika/vaka</div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-start gap-4">
              <div className="text-2xl">🟢</div>
              <div>
                <h3 className="text-lg font-semibold text-ink mb-2">Öğrenci Yönlendirme</h3>
                <p className="text-sm text-steel mb-3">
                  Beta test aşamasında 3-5 öğrenciyi platforma yönlendirin ve geri bildirim
                  toplayın.
                </p>
                <div className="text-xs text-muted">~10 dakika</div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-12 card-feature">
          <h3 className="text-lg font-semibold text-ink mb-2">Neden önemli?</h3>
          <p className="text-sm text-steel" style={{ lineHeight: "1.6" }}>
            Yanlış tıp öğretmek, hiç öğretmemekten daha kötüdür. Bir öğrenciye yanlış red flag
            öğretmek, gerçek bir hastada zarar anlamına gelebilir. Bu yüzden uzman hekim onayı
            bu projenin etik bir gereğidir, opsiyonel bir adım değildir.
          </p>
        </div>

        <div className="mt-8">
          <Link href="/vakalar" className="btn-secondary">
            ← Vakalara Dön
          </Link>
        </div>
      </div>
    </div>
  );
}

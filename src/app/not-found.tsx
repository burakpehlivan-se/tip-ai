import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-canvas px-4 py-10">
      <section
        aria-labelledby="bulunamadi-baslik"
        className="w-full max-w-md rounded-xl border border-hairline bg-canvas p-6 text-center shadow-sm sm:p-8"
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-deep">404</p>
        <h1 id="bulunamadi-baslik" className="mt-2 text-2xl font-semibold tracking-tight text-ink">
          Sayfa bulunamadı
        </h1>
        <p className="mt-3 text-sm leading-6 text-steel">
          Adres değişmiş olabilir ya da bu sayfa artık mevcut değil. Ana sayfadan güvenli bir şekilde devam edebilirsin.
        </p>
        <Link href="/" className="btn-primary mt-6 inline-flex min-h-11 items-center justify-center px-5 text-sm">
          Ana sayfaya dön
        </Link>
      </section>
    </main>
  );
}

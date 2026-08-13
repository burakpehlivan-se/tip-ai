import type { Metadata } from "next";
import Link from "next/link";
import { SessionNavigation } from "@/components/auth/SessionNavigation";

export const metadata: Metadata = {
  title: "Veri ve Gizlilik | tıp_ai",
  description: "tıp_ai eğitim simülasyonunda veri kullanımı, kişisel öğrenme kayıtları ve gizlilik yaklaşımı.",
};

const dataGroups = [
  {
    title: "Hesap bilgileri",
    body: "Kullanıcı adı, isteğe bağlı görünen ad, rol ve güvenli parola özeti. Parolanın kendisi saklanmaz.",
  },
  {
    title: "Öğrenme kayıtları",
    body: "Tamamlanan vaka sonuçları, puanlar, güvenlik adımları ve klinik muhakeme için türetilmiş öğrenme metrikleri.",
  },
  {
    title: "Oturum ve güvenlik",
    body: "Cihaz türü etiketi, son etkinlik ve güvenlik denetim olayları. Oturum tokenları okunabilir biçimde saklanmaz.",
  },
  {
    title: "Yönetim kayıtları",
    body: "Yetkili kullanıcıların vaka ve kullanıcı yönetimi işlemleri için denetim izleri. Bu kayıtlar erişim güvenliği için kullanılır.",
  },
];

export default function GizlilikPage() {
  return (
    <div className="min-h-[100dvh] bg-canvas">
      <a href="#ana-icerik" className="skip-link">İçeriğe atla</a>

      <header className="border-b border-hairline-soft bg-canvas/95 backdrop-blur-md">
        <nav className="mx-auto flex min-h-16 max-w-4xl items-center justify-between gap-4 px-4 py-3 sm:px-6" aria-label="Gizlilik sayfası menüsü">
          <Link href="/" className="shrink-0 text-xl font-semibold tracking-tight text-ink" aria-label="tıp_ai ana sayfa">
            tıp<span className="text-brand">_ai</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/hakkinda" className="hidden text-sm font-medium text-steel transition-colors hover:text-ink sm:inline">Hakkında</Link>
            <SessionNavigation compact />
          </div>
        </nav>
      </header>

      <main id="ana-icerik" tabIndex={-1} className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="max-w-3xl">
          <p className="badge badge-brand">Veri ve gizlilik</p>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight text-ink sm:text-5xl" style={{ letterSpacing: "-1.5px" }}>
            Eğitim verisini açık ve sınırlı kullanırız.
          </h1>
          <p className="mt-5 text-base leading-7 text-steel sm:text-lg">
            tıp_ai, sentetik klinik vakalarla eğitim için tasarlanmıştır. Bu sayfa; hangi bilgilerin işlendiğini,
            neden işlendiğini ve hesabınızla ilgili hangi kontrollerin mevcut olduğunu açıklar.
          </p>
        </div>

        <aside className="mt-8 rounded-lg border border-clinical-orange/30 bg-clinical-orange/5 p-4" aria-labelledby="gercek-veri-uyarisi">
          <h2 id="gercek-veri-uyarisi" className="text-sm font-semibold text-ink">Gerçek hasta bilgisi girmeyin</h2>
          <p className="mt-1 text-sm leading-6 text-steel">
            İsim, kimlik numarası, iletişim bilgisi, gerçek tetkik sonucu veya başka kişisel sağlık verisini serbest metin alanlarına yazmayın.
            Vakalar sentetiktir ve platform klinik karar desteği değildir.
          </p>
        </aside>

        <section className="mt-12" aria-labelledby="islenen-veriler">
          <div className="max-w-2xl">
            <p className="text-sm font-medium text-brand-deep">Veri envanteri</p>
            <h2 id="islenen-veriler" className="mt-2 text-2xl font-semibold tracking-tight text-ink">İşlenen bilgi kategorileri</h2>
            <p className="mt-3 text-sm leading-6 text-steel">Yalnızca eğitim akışı, hesap güvenliği ve yetkili yönetim için gerekli bilgiler işlenir.</p>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {dataGroups.map((group) => (
              <article key={group.title} className="card">
                <h3 className="text-base font-semibold text-ink">{group.title}</h3>
                <p className="mt-2 text-sm leading-6 text-steel">{group.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-12 border-t border-hairline pt-10" aria-labelledby="neden-isliyoruz">
          <h2 id="neden-isliyoruz" className="text-2xl font-semibold tracking-tight text-ink">Bu bilgiler neden kullanılır?</h2>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-steel">
            <li><span className="font-medium text-ink">Öğrenme sürekliliği:</span> Vaka ilerlemesini, geri bildirimi ve kişisel gelişim özetini göstermek için.</li>
            <li><span className="font-medium text-ink">Hesap güvenliği:</span> Oturumları doğrulamak, kötüye kullanımı sınırlamak ve yetki değişikliklerini izlemek için.</li>
            <li><span className="font-medium text-ink">Eğitim yönetimi:</span> Yetkili öğretim üyelerinin sınıf atamalarını ve içerik kalitesini yönetmesi için.</li>
          </ul>
        </section>

        <section className="mt-12 rounded-xl border border-hairline bg-surface-soft p-5 sm:p-6" aria-labelledby="hesap-kontrolleri">
          <h2 id="hesap-kontrolleri" className="text-2xl font-semibold tracking-tight text-ink">Hesap kontrolleri</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-steel">
            Giriş yaptıktan sonra profilinizden aktif cihaz oturumlarını görebilir, istediğiniz oturumu kapatabilir ve kendi öğrenme verilerinizin
            taşınabilir JSON kopyasını indirebilirsiniz. Dışa aktarma dosyası parola, token, tam vaka gövdesi veya aktif serbest metin taslakları içermez.
          </p>
          <Link href="/profilim" className="btn-primary mt-5 min-h-11 px-5">
            Profil ve veri kontrollerine git
          </Link>
        </section>

        <section className="mt-12 border-t border-hairline pt-10" aria-labelledby="sinirlar-ve-politika">
          <h2 id="sinirlar-ve-politika" className="text-2xl font-semibold tracking-tight text-ink">Sınırlar ve veri yaşam döngüsü</h2>
          <p className="mt-3 text-sm leading-6 text-steel">
            Oturum, denetim, öğrenme sonucu, yedek ve dışa aktarma kayıtları aynı süreyle tutulmaz. Saklama ve silme süreleri kurum politikası ile
            açıkça tanımlanmalıdır; bu ekran hukukî tavsiye veya kurumunuza özel uyum taahhüdü değildir.
          </p>
          <p className="mt-3 text-sm leading-6 text-steel">
            Sistem, sentetik eğitim içeriği ile hesap/öğrenme verisini ayrı tutmayı; erişim, dışa aktarma ve denetim işlemlerini yetki kontrolüyle yürütmeyi hedefler.
          </p>
        </section>
      </main>
    </div>
  );
}

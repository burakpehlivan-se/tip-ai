"use client";

import type { ReactNode, RefObject } from "react";
import type { ChatMesaj, TestIstegi, Vaka } from "@/lib/types";
import type { ClinicalHistory } from "@/lib/clinical-history/types";
import { birlesikTestKatalogu } from "@/lib/data/test-catalogue";
import ResmiRapor from "./ResmiRapor";
import { FAZLAR, type WorkspaceFaz } from "./workspace-constants";

export function KlinikGecmisDialog({
  dialogRef,
  history,
  onClose,
}: {
  dialogRef: RefObject<HTMLDialogElement | null>;
  history: ClinicalHistory;
  onClose: () => void;
}) {
  return (
    <dialog
      ref={dialogRef}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      aria-labelledby="klinik-gecmis-baslik"
      className="fixed inset-0 z-50 m-auto max-h-[88dvh] w-[min(42rem,calc(100%-2rem))] overflow-hidden rounded-lg border border-hairline bg-canvas p-0 shadow-xl backdrop:bg-black/20"
    >
      <div className="flex max-h-[88dvh] flex-col">
        <header className="flex items-start justify-between gap-4 border-b border-hairline px-4 py-4 sm:px-6">
          <div>
            <h2 id="klinik-gecmis-baslik" className="text-heading-5 text-ink">Klinik geçmiş</h2>
            <p className="mt-1 text-xs leading-5 text-steel">Bu görünüm kimlik bilgisi içermez; yalnızca eğitim amaçlı sentetik klinik kayıtlardan oluşur.</p>
          </div>
          <button type="button" onClick={onClose} className="btn-ghost min-h-11 min-w-11 shrink-0 text-sm" aria-label="Klinik geçmişi kapat">Kapat</button>
        </header>
        <div className="overflow-y-auto px-4 py-5 sm:px-6 scrollbar-thin">
          <HistorySection title="Klinik zaman çizelgesi">
            {history.timeline.length ? (
              <ul className="space-y-3">
                {history.timeline.map((item, index) => <HistoryRow key={`${item.kind}-${item.title}-${index}`} date={item.date} label={item.kind} title={item.title} detail={item.detail} code={item.code} codeSystem={item.codeSystem} />)}
              </ul>
            ) : <EmptyHistory />}
          </HistorySection>
          <HistorySection title="Alerjiler">
            {history.allergies.length ? <ul className="space-y-2">{history.allergies.map((item, index) => <HistoryRow key={`${item.title}-${index}`} date={item.date} title={item.title} detail={item.detail} code={item.code} codeSystem={item.codeSystem} />)}</ul> : <EmptyHistory />}
          </HistorySection>
          <HistorySection title="Aşılar">
            {history.immunizations.length ? <ul className="space-y-2">{history.immunizations.map((item, index) => <HistoryRow key={`${item.title}-${index}`} date={item.date} title={item.title} detail={item.detail} code={item.code} codeSystem={item.codeSystem} />)}</ul> : <EmptyHistory />}
          </HistorySection>
          <HistorySection title="Laboratuvar eğilimleri">
            {history.labTrends.length ? (
              <div className="space-y-2">
                {history.labTrends.map((trend) => (
                  <div key={`${trend.title}-${trend.unit || ""}`} className="rounded-lg border border-hairline bg-surface-soft px-3 py-3">
                    <p className="text-sm font-medium text-ink">{trend.title}{trend.unit ? <span className="ml-1 font-normal text-steel">({trend.unit})</span> : null}{trend.code ? <span className="ml-2 align-middle rounded bg-surface px-1.5 py-0.5 text-[10px] font-normal text-muted">{trend.codeSystem ? `${trend.codeSystem} ` : ""}{trend.code}</span> : null}</p>
                    <p className="mt-1 text-xs leading-5 text-steel">{trend.values.map((value) => `${value.date || "Tarih yok"}: ${value.value}`).join(" · ")}</p>
                  </div>
                ))}
              </div>
            ) : <EmptyHistory />}
          </HistorySection>
        </div>
      </div>
    </dialog>
  );
}

function HistorySection({ title, children }: { title: string; children: ReactNode }) {
  return <section className="mb-6"><h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">{title}</h3>{children}</section>;
}

function HistoryRow({ date, label, title, detail, code, codeSystem }: { date: string | null; label?: string; title: string; detail?: string; code?: string; codeSystem?: string }) {
  return (
    <li className="rounded-lg border border-hairline bg-canvas px-3 py-3">
      <p className="text-sm font-medium text-ink">{label ? <span className="mr-2 text-xs font-medium text-brand-deep">{label}</span> : null}{title}{code ? <span className="ml-2 align-middle rounded bg-surface px-1.5 py-0.5 text-[10px] font-normal text-muted">{codeSystem ? `${codeSystem} ` : ""}{code}</span> : null}</p>
      <p className="mt-1 text-xs text-steel">{[date, detail].filter(Boolean).join(" · ") || "Ek tarih veya durum bilgisi yok"}</p>
    </li>
  );
}

function EmptyHistory() {
  return <p className="rounded-lg bg-surface px-3 py-3 text-sm text-steel">Gösterilebilir kayıt bulunamadı.</p>;
}

export function ClinicalReasoningFields({
  problemRepresentation,
  differentialsText,
  supportingFindingsText,
  opposingFindingsText,
  confidence,
  savedState,
  onProblemRepresentationChange,
  onDifferentialsChange,
  onSupportingFindingsChange,
  onOpposingFindingsChange,
  onConfidenceChange,
}: {
  problemRepresentation: string;
  differentialsText: string;
  supportingFindingsText: string;
  opposingFindingsText: string;
  confidence: number | null;
  savedState: "idle" | "saving" | "saved" | "error";
  onProblemRepresentationChange: (value: string) => void;
  onDifferentialsChange: (value: string) => void;
  onSupportingFindingsChange: (value: string) => void;
  onOpposingFindingsChange: (value: string) => void;
  onConfidenceChange: (value: number | null) => void;
}) {
  const savedLabel = savedState === "saving"
    ? "Taslak kaydediliyor…"
    : savedState === "saved"
      ? "Taslak kaydedildi"
      : savedState === "error"
        ? "Taslak kaydedilemedi; vaka tamamlanırken yeniden gönderilecek."
        : "";

  return (
    <fieldset className="mb-6 rounded-lg border border-hairline bg-canvas p-3">
      <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-muted">Klinik muhakeme</legend>
      <p className="mb-3 text-xs leading-5 text-steel">Düşünme sürecini kaydet. Her listeye satır başına bir madde yaz; en fazla 5 madde eklenir. Gerçek hasta bilgisi girmeyin.</p>
      <div className="space-y-3">
        <div>
          <label htmlFor="problem-temsili" className="mb-1 block text-xs font-medium text-ink">Problem temsili</label>
          <textarea id="problem-temsili" value={problemRepresentation} maxLength={600} onChange={(event) => onProblemRepresentationChange(event.target.value)} aria-describedby="simule-vaka-uyarisi" className="input h-20 resize-none text-sm" placeholder="Yaş, bağlam, temel sorun ve ayırt edici bulguları özetle." rows={3} />
        </div>
        <div>
          <label htmlFor="ayirici-tanilar" className="mb-1 block text-xs font-medium text-ink">Ayırıcı tanılar</label>
          <textarea id="ayirici-tanilar" value={differentialsText} maxLength={604} onChange={(event) => onDifferentialsChange(event.target.value)} aria-describedby="simule-vaka-uyarisi" className="input h-20 resize-none text-sm" placeholder={"Akut koroner sendrom\nPulmoner emboli"} rows={3} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="destekleyen-bulgular" className="mb-1 block text-xs font-medium text-ink">Destekleyen bulgular</label>
            <textarea id="destekleyen-bulgular" value={supportingFindingsText} maxLength={904} onChange={(event) => onSupportingFindingsChange(event.target.value)} aria-describedby="simule-vaka-uyarisi" className="input h-20 resize-none text-sm" placeholder="Her satıra bir bulgu" rows={3} />
          </div>
          <div>
            <label htmlFor="karsi-bulgular" className="mb-1 block text-xs font-medium text-ink">Karşı çıkan bulgular</label>
            <textarea id="karsi-bulgular" value={opposingFindingsText} maxLength={904} onChange={(event) => onOpposingFindingsChange(event.target.value)} aria-describedby="simule-vaka-uyarisi" className="input h-20 resize-none text-sm" placeholder="Her satıra bir bulgu" rows={3} />
          </div>
        </div>
        <div>
          <label htmlFor="tani-guveni" className="mb-1 block text-xs font-medium text-ink">Tanına güvenin</label>
          <select id="tani-guveni" value={confidence ?? ""} onChange={(event) => onConfidenceChange(event.target.value === "" ? null : Number(event.target.value))} className="input text-sm">
            <option value="">Belirtmek istemiyorum</option>
            {[20, 40, 60, 80, 100].map((value) => <option key={value} value={value}>%{value}</option>)}
          </select>
        </div>
      </div>
      <p aria-live="polite" className={`mt-3 text-xs ${savedState === "error" ? "text-clinical-red" : "text-steel"}`}>{savedLabel}</p>
    </fieldset>
  );
}

export function FazStepper({ faz, onChange, maxAcikFazIndex, className = "", compact = false }: {
  faz: WorkspaceFaz;
  onChange: (faz: WorkspaceFaz) => void;
  maxAcikFazIndex: number;
  className?: string;
  compact?: boolean;
}) {
  const aktifIndex = FAZLAR.findIndex((item) => item.id === faz);
  return (
    <nav aria-label="Vaka aşamaları" className={`${compact ? "overflow-x-auto border-b border-hairline px-1" : ""} ${className}`}>
      <div className={`flex ${compact ? "min-w-max" : "items-center gap-1"}`}>
        {FAZLAR.map((item, index) => {
          const aktif = item.id === faz;
          const tamamlandi = index < aktifIndex;
          const kilitli = index > maxAcikFazIndex;
          return (
            <button key={item.id} type="button" aria-current={aktif ? "step" : undefined} aria-disabled={kilitli} onClick={() => onChange(item.id)} className={`min-h-11 shrink-0 border-b-2 px-3 text-xs font-medium transition-colors ${aktif ? "border-brand text-ink" : kilitli ? "cursor-not-allowed border-transparent text-muted" : "border-transparent text-steel hover:text-ink"}`}>
              <span className={`mr-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${aktif ? "bg-ink text-white" : tamamlandi ? "bg-brand/20 text-brand-deep" : "bg-surface text-steel"}`}>{tamamlandi ? "✓" : item.sira}</span>
              {item.etiket}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export function TaslakDurumu({ durum }: { durum: "kaydediliyor" | "yerel" }) {
  return (
    <p className="shrink-0 text-xs text-steel" role="status" aria-live="polite">
      {durum === "kaydediliyor" ? "Taslak kaydediliyor…" : "Taslak bu cihazda kaydedildi"}
    </p>
  );
}

export function FazGorevYuzeyi({
  faz,
  taniInput,
  tedaviInput,
  seciliTestKeyleri,
  testIstekleri,
  testKatalogu,
  onFazChange,
}: {
  faz: WorkspaceFaz;
  taniInput: string;
  tedaviInput: string;
  seciliTestKeyleri: string[];
  testIstekleri: TestIstegi[];
  testKatalogu: typeof birlesikTestKatalogu;
  onFazChange: (faz: WorkspaceFaz) => void;
}) {
  const seciliAdlar = seciliTestKeyleri.map((key) => testKatalogu.find((test) => test.key === key)?.ad).filter(Boolean);
  return (
    <section className="flex-1 overflow-y-auto px-4 py-6 lg:px-8 scrollbar-thin">
      <div className="mx-auto max-w-4xl space-y-4">
        {faz === "test" && (
          <div className="card">
            <h2 className="text-heading-5 text-ink">Tetkik istemi hazırlayın</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-steel">Katalogdan gerekli tetkikleri seçin. Seçimler sonuç üretmez; sağdaki “Tetkikleri iste” eylemi tüm seçimi açıkça gönderir.</p>
            {seciliAdlar.length === 0 ? <p className="mt-5 rounded-lg bg-surface px-4 py-5 text-sm text-steel">Henüz tetkik seçilmedi. Gereksiz istemlerden kaçınarak klinik sorunu yanıtlayacak testleri seçin.</p> : <ul className="mt-5 grid gap-2 sm:grid-cols-2">{seciliAdlar.map((ad) => <li key={ad} className="rounded-lg border border-brand/25 bg-brand/5 px-3 py-3 text-sm font-medium text-ink">{ad}</li>)}</ul>}
            {testIstekleri.length > 0 && <button type="button" onClick={() => onFazChange("tani")} className="btn-secondary mt-5">Tanı aşamasına geç</button>}
          </div>
        )}
        {faz === "tani" && (
          <div className="card">
            <h2 className="text-heading-5 text-ink">Klinik değerlendirme</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-steel">Tanınızı bulgularla ilişkilendirin. Kaydettiğiniz tanı sonraki aşamada tedavi kararınızın bağlamı olur.</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg bg-surface p-4"><p className="text-xs font-medium text-muted">İSTENEN TETKİK</p><p className="mt-1 text-heading-5 text-ink">{testIstekleri.length}</p></div>
              <div className="rounded-lg bg-surface p-4"><p className="text-xs font-medium text-muted">ÖN TANI</p><p className="mt-1 text-sm text-ink">{taniInput || "Henüz kaydedilmedi"}</p></div>
            </div>
          </div>
        )}
        {faz === "tedavi" && (
          <div className="card">
            <h2 className="text-heading-5 text-ink">Tedavi ve izlem planı</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-steel">Planınızda tedavi veya girişim, doz/yöntem, izlem ve takip kararlarını açıkça belirtin. Değerlendirme, yalnızca plan eklenince etkinleşir.</p>
            <ol className="mt-5 grid gap-2 sm:grid-cols-2" aria-label="Tedavi planı kontrol listesi">
              {['Tedavi veya girişim', 'Doz, yol ya da yöntem', 'İzlem parametreleri', 'Takip veya konsültasyon'].map((madde, index) => <li key={madde} className="flex gap-3 rounded-lg bg-surface p-3 text-sm text-steel"><span className="font-medium text-ink">{index + 1}</span>{madde}</li>)}
            </ol>
            {tedaviInput && <div className="mt-5 rounded-lg border border-hairline bg-surface-soft p-4"><p className="text-xs font-medium text-muted">PLAN TASLAĞI</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-ink">{tedaviInput}</p></div>}
          </div>
        )}
      </div>
    </section>
  );
}

export function MesajBalonu({ msg, vaka, hastaneAdi, debugMode }: { msg: ChatMesaj; vaka: Vaka; hastaneAdi: string; debugMode?: boolean }) {
  if (msg.rol === "sistem") {
    const isWarning = msg.metin.startsWith("⚠️");
    const isComplete = msg.metin.startsWith("✅");
    return (
      <div className="flex flex-col items-center">
        <div className={`rounded-lg px-4 py-2 text-xs whitespace-pre-line ${
          isWarning
            ? "bg-clinical-orange/15 text-clinical-orange border border-clinical-orange/30"
            : isComplete
            ? "bg-brand/10 text-brand-deep border border-brand/30"
            : "bg-surface text-steel"
        }`}>
          {msg.metin}
        </div>
        {msg.testSonucu && (
          <div className="mt-3 w-full">
            <ResmiRapor sonuc={msg.testSonucu} hasta={vaka.hasta} hastaneAdi={hastaneAdi} debugMode={debugMode} />
          </div>
        )}
      </div>
    );
  }

  const isOgrenci = msg.rol === "ogrenci";
  return (
    <div className={`flex items-start gap-1.5 ${isOgrenci ? "justify-end" : "justify-start"}`}>
      {!isOgrenci && <span className="mt-1 shrink-0 rounded bg-surface-soft border border-hairline px-1.5 py-0.5 text-[10px] font-semibold text-steel">H</span>}
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
          isOgrenci
            ? "bg-ink text-white rounded-br-md"
            : "bg-white text-ink rounded-bl-md border border-hairline shadow-sm"
        }`}
      >
        <div className="text-sm" style={{ lineHeight: "1.5" }}>
          {msg.metin}
        </div>
      </div>
      {isOgrenci && <span className="mt-1 shrink-0 rounded bg-ink/80 px-1.5 py-0.5 text-[10px] font-semibold text-white/70">Ö</span>}
    </div>
  );
}

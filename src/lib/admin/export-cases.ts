import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";
import { AdminVaka, CasesStore } from "./types";
import { TestSonucu } from "../types";

const FONT_REG = path.join(process.cwd(), "assets/fonts/DejaVuSans.ttf");
const FONT_BOLD = path.join(process.cwd(), "assets/fonts/DejaVuSans-Bold.ttf");

export type ExportFormat = "json" | "pdf";

const SEVIYE_ETIKET: Record<string, string> = {
  baslangic: "Başlangıç",
  orta: "Orta",
  ileri: "İleri",
};

const DURUM_ETIKET: Record<string, string> = {
  taslak: "Taslak",
  aktif: "Aktif",
  arsiv: "Arşiv",
};

const CINSIYET_ETIKET: Record<string, string> = {
  E: "Erkek",
  K: "Kadın",
  herhangi: "Fark etmez",
};

export function filterCasesForExport(
  cases: AdminVaka[],
  poliklinikKey?: string | null
): AdminVaka[] {
  const list = [...cases].sort((a, b) => {
    const p = a.poliklinikAd.localeCompare(b.poliklinikAd, "tr");
    if (p !== 0) return p;
    return a.hastalikAdi.localeCompare(b.hastalikAdi, "tr");
  });
  if (!poliklinikKey) return list;
  return list.filter((c) => c.poliklinikKey === poliklinikKey);
}

/** DB'de saklanan tüm alanlar + export meta */
export function buildCasesJsonExport(
  store: CasesStore,
  cases: AdminVaka[],
  opts: { poliklinikKey?: string | null }
): Record<string, unknown> {
  return {
    exportMeta: {
      format: "tip_ai_cases_export",
      version: 1,
      exportedAt: new Date().toISOString(),
      scope: opts.poliklinikKey ? "poliklinik" : "all",
      poliklinikKey: opts.poliklinikKey || null,
      caseCount: cases.length,
      storeVersion: store.version,
      storeChangeCount: store.changeCount,
      storeSeededAt: store.seededAt,
      storeUpdatedAt: store.updatedAt,
    },
    /** Depodaki ham vaka kayıtları — tüm alanlar */
    cases: cases.map((c) => JSON.parse(JSON.stringify(c))),
  };
}

function formatTestSonucReadable(t: TestSonucu): string {
  const parts: string[] = [];
  if (typeof t.sonuc === "string") {
    parts.push(t.sonuc);
  } else if (t.sonuc && typeof t.sonuc === "object") {
    const o = t.sonuc as Record<string, unknown>;
    if ("deger" in o) {
      const birim = o.birim != null ? ` ${o.birim}` : "";
      const ref = o.referansAralik != null ? ` (ref: ${o.referansAralik})` : "";
      parts.push(`${o.deger}${birim}${ref}`);
    } else {
      for (const [k, v] of Object.entries(o)) {
        parts.push(`${k}: ${String(v)}`);
      }
    }
  }
  if (t.referans) parts.push(`Referans: ${t.referans}`);
  if (t.yorum) parts.push(`Yorum: ${t.yorum}`);
  return parts.join(" · ") || "—";
}

function slugFilePart(s: string): string {
  return s
    .toLowerCase()
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || "export";
}

export function exportFilename(
  format: ExportFormat,
  opts: { poliklinikKey?: string | null; poliklinikAd?: string }
): string {
  const day = new Date().toISOString().slice(0, 10);
  const scope = opts.poliklinikKey
    ? slugFilePart(opts.poliklinikAd || opts.poliklinikKey)
    : "tum-vakalar";
  return `tip-ai-vakalar-${scope}-${day}.${format}`;
}

type PdfCtx = {
  doc: PDFKit.PDFDocument;
  pageW: number;
  pageH: number;
  margin: number;
  contentW: number;
};

function ensureSpace(ctx: PdfCtx, need: number) {
  if (ctx.doc.y + need > ctx.pageH - ctx.margin) {
    ctx.doc.addPage();
  }
}

function sectionTitle(ctx: PdfCtx, title: string) {
  ensureSpace(ctx, 28);
  ctx.doc.moveDown(0.4);
  ctx.doc
    .font("Bold")
    .fontSize(11)
    .fillColor("#0f172a")
    .text(title, ctx.margin, ctx.doc.y, { width: ctx.contentW });
  const y = ctx.doc.y + 2;
  ctx.doc
    .strokeColor("#94a3b8")
    .lineWidth(0.6)
    .moveTo(ctx.margin, y)
    .lineTo(ctx.margin + ctx.contentW, y)
    .stroke();
  ctx.doc.moveDown(0.5);
  ctx.doc.fillColor("#1e293b");
}

function bodyText(ctx: PdfCtx, text: string, opts?: { indent?: number; bold?: boolean }) {
  ensureSpace(ctx, 14);
  ctx.doc
    .font(opts?.bold ? "Bold" : "Regular")
    .fontSize(9.5)
    .fillColor("#1e293b")
    .text(text, ctx.margin + (opts?.indent || 0), ctx.doc.y, {
      width: ctx.contentW - (opts?.indent || 0),
      align: "left",
      lineGap: 1.5,
    });
}

function bullet(ctx: PdfCtx, text: string) {
  ensureSpace(ctx, 14);
  ctx.doc
    .font("Regular")
    .fontSize(9.5)
    .fillColor("#1e293b")
    .text(`•  ${text}`, ctx.margin + 4, ctx.doc.y, {
      width: ctx.contentW - 4,
      lineGap: 1.5,
    });
}

function writeCasePdf(ctx: PdfCtx, vaka: AdminVaka, index: number, total: number) {
  ctx.doc.addPage();

  // Başlık bloğu
  ctx.doc
    .font("Bold")
    .fontSize(16)
    .fillColor("#0f172a")
    .text(vaka.hastalikAdi, ctx.margin, ctx.margin, { width: ctx.contentW });

  ctx.doc
    .font("Regular")
    .fontSize(10)
    .fillColor("#475569")
    .text(
      `${vaka.poliklinikIcon || "🏥"} ${vaka.poliklinikAd}  ·  Vaka ${index + 1}/${total}`,
      { width: ctx.contentW }
    );

  ctx.doc.moveDown(0.3);
  const meta = [
    `Seviye: ${SEVIYE_ETIKET[vaka.seviye] || vaka.seviye}`,
    `Durum: ${DURUM_ETIKET[vaka.durum] || vaka.durum}`,
    vaka.uzmanOnayi ? "Uzman onayı: Var" : "Uzman onayı: Yok",
    `Sürüm: v${vaka.surum ?? 1}`,
  ].join("   ·   ");
  bodyText(ctx, meta);
  if (vaka.etiketler?.length) {
    bodyText(ctx, `Etiketler: ${vaka.etiketler.join(", ")}`);
  }

  // Hasta profili
  sectionTitle(ctx, "Hasta profili");
  bodyText(
    ctx,
    `Yaş aralığı: ${vaka.yasAraligi?.[0] ?? "—"}–${vaka.yasAraligi?.[1] ?? "—"} yaş`
  );
  bodyText(
    ctx,
    `Cinsiyet tercihi: ${CINSIYET_ETIKET[vaka.cinsiyetTercih] || vaka.cinsiyetTercih}`
  );
  bodyText(ctx, `Ana şikayet: ${vaka.anaSikayet || "—"}`);
  if (vaka.semptomSablon) {
    bodyText(ctx, `Semptom özeti: ${vaka.semptomSablon}`);
  }
  if (vaka.ozetBilgiler?.length) {
    bodyText(ctx, "Bilinen özet bilgiler:", { bold: true });
    for (const b of vaka.ozetBilgiler) bullet(ctx, b);
  }

  // Tanı
  sectionTitle(ctx, "Beklenen / kabul edilen tanılar");
  const tanilar = vaka.rubric?.kabulEdilenTani || [];
  if (tanilar.length === 0) bodyText(ctx, "Belirtilmemiş.");
  else for (const t of tanilar) bullet(ctx, t);

  // Red flags
  sectionTitle(ctx, "Kritik uyarılar (red flag)");
  const rfs = vaka.rubric?.redFlagler || [];
  if (rfs.length === 0) bodyText(ctx, "Tanımlanmamış.");
  else {
    for (const r of rfs) {
      const line = r.aciklama ? `${r.etiket} — ${r.aciklama}` : r.etiket;
      bullet(ctx, line);
    }
  }

  // Anamnez
  sectionTitle(ctx, "Önerilen anamnez soruları");
  const sorular = vaka.rubric?.beklenenSorular || [];
  if (sorular.length === 0) bodyText(ctx, "Tanımlanmamış.");
  else {
    for (const s of sorular) {
      const line = s.aciklama ? `${s.etiket} — ${s.aciklama}` : s.etiket;
      bullet(ctx, line);
    }
  }

  // Testler
  sectionTitle(ctx, "Önerilen tetkikler");
  const bekTest = vaka.rubric?.beklenenTestler || [];
  if (bekTest.length === 0) bodyText(ctx, "Tanımlanmamış.");
  else {
    for (const t of bekTest) {
      const line = t.aciklama ? `${t.etiket} — ${t.aciklama}` : t.etiket;
      bullet(ctx, line);
    }
  }

  const gerTest = vaka.rubric?.gereksizTestler || [];
  if (gerTest.length > 0) {
    sectionTitle(ctx, "Genellikle gereksiz tetkikler");
    for (const t of gerTest) {
      const line = t.aciklama ? `${t.etiket} — ${t.aciklama}` : t.etiket;
      bullet(ctx, line);
    }
  }

  // Lab sonuçları (klinik)
  sectionTitle(ctx, "Vaka lab / görüntüleme sonuçları");
  const tests = Object.values(vaka.statikTestler || {});
  if (tests.length === 0) {
    bodyText(ctx, "Bu vaka için sabit sonuç tanımlanmamış (simülasyonda normal paneller üretilebilir).");
  } else {
    for (const t of tests) {
      ensureSpace(ctx, 20);
      ctx.doc
        .font("Bold")
        .fontSize(9.5)
        .fillColor("#0f172a")
        .text(t.testAdi || t.testKey, ctx.margin, ctx.doc.y, { width: ctx.contentW });
      bodyText(ctx, formatTestSonucReadable(t), { indent: 8 });
    }
  }

  // Hasta yanıtları — klinisyen diliyle
  const yanitlar = Object.entries(vaka.hastaYanitlari || {}).filter(
    ([k, v]) => v && k !== "OZEL"
  );
  sectionTitle(ctx, "Örnek hasta yanıtları (eğitim)");
  if (yanitlar.length === 0) {
    bodyText(ctx, "Tanımlanmamış.");
  } else {
    for (const [aksiyon, yanit] of yanitlar) {
      // aksiyon key'ini biraz okunabilir yap
      const baslik = aksiyon
        .replace(/_/g, " ")
        .toLowerCase()
        .replace(/^\w/, (c) => c.toUpperCase());
      ensureSpace(ctx, 22);
      ctx.doc
        .font("Bold")
        .fontSize(9)
        .fillColor("#475569")
        .text(baslik, ctx.margin, ctx.doc.y, { width: ctx.contentW });
      bodyText(ctx, yanit, { indent: 6 });
    }
  }

  // İdeal yol
  if (vaka.idealYol?.length) {
    sectionTitle(ctx, "Önerilen klinik yaklaşım sırası");
    vaka.idealYol.forEach((adim, i) => {
      bullet(ctx, `${i + 1}. ${adim}`);
    });
  }

  // Eğitim notu
  if (vaka.egitimNotu?.trim()) {
    sectionTitle(ctx, "Eğitim notu");
    bodyText(ctx, vaka.egitimNotu.trim());
  }
}

function writeCoverPage(
  ctx: PdfCtx,
  cases: AdminVaka[],
  opts: { poliklinikKey?: string | null; poliklinikAd?: string }
) {
  ctx.doc
    .font("Bold")
    .fontSize(20)
    .fillColor("#0f172a")
    .text("tıp_ai — Eğitim Vaka Rehberi", ctx.margin, ctx.margin + 40, {
      width: ctx.contentW,
      align: "center",
    });

  ctx.doc.moveDown(1);
  ctx.doc
    .font("Regular")
    .fontSize(12)
    .fillColor("#334155")
    .text(
      opts.poliklinikKey
        ? `Poliklinik: ${opts.poliklinikAd || opts.poliklinikKey}`
        : "Kapsam: Tüm poliklinikler",
      { align: "center", width: ctx.contentW }
    );

  ctx.doc.moveDown(0.5);
  ctx.doc.fontSize(11).text(`${cases.length} vaka`, {
    align: "center",
    width: ctx.contentW,
  });

  ctx.doc.moveDown(0.5);
  ctx.doc
    .fontSize(10)
    .fillColor("#64748b")
    .text(
      `Oluşturulma: ${new Date().toLocaleString("tr-TR", {
        dateStyle: "long",
        timeStyle: "short",
      })}`,
      { align: "center", width: ctx.contentW }
    );

  ctx.doc.moveDown(1.5);
  ctx.doc
    .fontSize(9)
    .fillColor("#64748b")
    .text(
      "Bu belge eğitim amaçlıdır. Klinik karar desteği yerine geçmez. " +
        "İçerik, vaka yazarları tarafından tanımlanan senaryo ve beklenen yaklaşımı özetler.",
      ctx.margin + 20,
      ctx.doc.y,
      { width: ctx.contentW - 40, align: "center" }
    );

  // İçindekiler
  if (cases.length > 0) {
    ctx.doc.addPage();
    ctx.doc
      .font("Bold")
      .fontSize(14)
      .fillColor("#0f172a")
      .text("İçindekiler", ctx.margin, ctx.margin, { width: ctx.contentW });
    ctx.doc.moveDown(0.6);

    let lastPoli = "";
    cases.forEach((c, i) => {
      if (c.poliklinikAd !== lastPoli) {
        lastPoli = c.poliklinikAd;
        ensureSpace(ctx, 20);
        ctx.doc
          .font("Bold")
          .fontSize(10)
          .fillColor("#0f172a")
          .text(`${c.poliklinikIcon || ""} ${c.poliklinikAd}`, ctx.margin, ctx.doc.y, {
            width: ctx.contentW,
          });
        ctx.doc.moveDown(0.2);
      }
      ensureSpace(ctx, 14);
      ctx.doc
        .font("Regular")
        .fontSize(9.5)
        .fillColor("#1e293b")
        .text(`${i + 1}.  ${c.hastalikAdi}`, ctx.margin + 8, ctx.doc.y, {
          width: ctx.contentW - 8,
        });
    });
  }
}

/** Klinik odaklı çok sayfalı PDF (teknik anahtarlar yok) */
export async function buildCasesPdfBuffer(
  cases: AdminVaka[],
  opts: { poliklinikKey?: string | null; poliklinikAd?: string }
): Promise<Buffer> {
  if (!fs.existsSync(FONT_REG) || !fs.existsSync(FONT_BOLD)) {
    throw new Error(
      "PDF fontları bulunamadı (assets/fonts/DejaVuSans*.ttf). Export için font dosyaları gerekli."
    );
  }

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      bufferPages: true,
      margins: { top: 48, bottom: 48, left: 48, right: 48 },
      info: {
        Title: "tıp_ai Eğitim Vaka Rehberi",
        Author: "tıp_ai admin",
        Subject: opts.poliklinikAd
          ? `Poliklinik: ${opts.poliklinikAd}`
          : "Tüm vakalar",
      },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c as Buffer));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.registerFont("Regular", FONT_REG);
    doc.registerFont("Bold", FONT_BOLD);

    const margin = 48;
    const ctx: PdfCtx = {
      doc,
      pageW: doc.page.width,
      pageH: doc.page.height,
      margin,
      contentW: doc.page.width - margin * 2,
    };

    writeCoverPage(ctx, cases, opts);

    if (cases.length === 0) {
      ctx.doc.addPage();
      bodyText(ctx, "Dışa aktarılacak vaka bulunamadı.");
    } else {
      cases.forEach((c, i) => writeCasePdf(ctx, c, i, cases.length));
    }

    // Sayfa numaraları
    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(pages.start + i);
      const label = `${i + 1} / ${pages.count}`;
      doc
        .font("Regular")
        .fontSize(8)
        .fillColor("#94a3b8")
        .text(label, margin, doc.page.height - 36, {
          width: ctx.contentW,
          align: "center",
        });
    }

    doc.end();
  });
}

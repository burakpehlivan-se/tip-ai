/**
 * WFDB (PTB-XL) EKG render — 12 derivasyonlu sinyali standart EKG kağıdı
 * düzeninde (25 mm/s, 10 mm/mV) SVG'ye, oradan sharp ile PNG'ye çevirir.
 *
 * PTB-XL .dat: int16 little-endian, kanallar interleaved, 100 Hz, 10 sn.
 * Gain: 1000 ADC birimi/mV (başlıktan okunur).
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

export interface WfdbHeader {
  fs: number;
  nSig: number;
  sigLen: number;
  names: string[];
  gains: number[];
  baselines: number[];
}

/** .hea başlığını çözer. */
export async function parseHea(heaPath: string): Promise<WfdbHeader> {
  const text = await readFile(heaPath, "utf8");
  const lines = text.split("\n").filter((l) => l.trim());
  const head = lines[0].split(/\s+/);
  const nSig = Number(head[1]);
  const fs = Number(head[2]);
  const sigLen = Number(head[3]);
  const names: string[] = [];
  const gains: number[] = [];
  const baselines: number[] = [];
  for (let i = 1; i <= nSig && i < lines.length; i++) {
    const parts = lines[i].split(/\s+/);
    const gainMatch = parts[2].match(/^([0-9.]+)/);
    gains.push(gainMatch ? Number(gainMatch[1]) : 200);
    baselines.push(Number(parts[5] ?? 0));
    names.push(parts[8] ?? `CH${i}`);
  }
  return { fs, nSig, sigLen, names, gains, baselines };
}

/**
 * .dat okur ve her kanal için mV dizisi döndürür.
 * ADC değeri = (mV * gain) + baseline → mV = (adc - baseline) / gain.
 */
export async function readSignalsMv(
  datPath: string,
  header: WfdbHeader
): Promise<Float32Array[]> {
  const buf = await readFile(datPath);
  const { nSig, sigLen, gains, baselines } = header;
  const out: Float32Array[] = [];
  for (let c = 0; c < nSig; c++) out.push(new Float32Array(sigLen));
  let off = 0;
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  for (let s = 0; s < sigLen; s++) {
    for (let c = 0; c < nSig; c++) {
      const adc = dv.getInt16(off, true); // little-endian
      off += 2;
      out[c][s] = (adc - baselines[c]) / gains[c];
    }
  }
  return out;
}

export interface RenderOptions {
  /** Her derivasyon için gösterilecek saniye. Varsayılan 2.5 sn. */
  seconds?: number;
  /** Piksel ölçeği: 1mm kaç px. Varsayılan 4 (→ 100px/sn, 40px/mV). */
  pxPerMm?: number;
  /** 3 sütunlu klasik 12-derivasyon grid. */
  columns?: number;
}

const LEADS_3x4 = [
  "I", "II", "III",
  "AVR", "AVL", "AVF",
  "V1", "V2", "V3",
  "V4", "V5", "V6",
];

function leadColor(lead: string): string {
  // Limb leads siyah, precordial kırmızı — standart EKG kağıdı
  return lead.startsWith("V") ? "#c00000" : "#000000";
}

/** Sinyali standart EKG kağıdı düzeninde SVG'ye çizer. */
export function ecgToSvg(signals: Float32Array[], names: string[], fs: number, opts: RenderOptions = {}): string {
  const seconds = opts.seconds ?? 2.5;
  const pxPerMm = opts.pxPerMm ?? 4;
  const columns = opts.columns ?? 3;
  const nSamples = Math.floor(seconds * fs);

  const mmPerSec = 25; // 25 mm/sn kağıt hızı
  const mmPerMv = 10; // 10 mm/mV
  const cellW = mmPerSec * seconds * pxPerMm;
  const cellH = 40 * pxPerMm; // ±2 mV görünür alan

  const rows = Math.ceil(signals.length / columns);
  const width = columns * cellW;
  const height = rows * cellH;

  const leadNames = signals.length === 12 ? LEADS_3x4 : names.map((n) => n.toUpperCase());

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(width)}" height="${Math.round(height)}" viewBox="0 0 ${Math.round(width)} ${Math.round(height)}">
  <rect width="${Math.round(width)}" height="${Math.round(height)}" fill="#ffffff"/>`;

  // Grid: küçük kare 1mm (0.25mV), büyük kare 5mm
  const minorStep = 1 * pxPerMm;
  const majorStep = 5 * pxPerMm;
  svg += `<g stroke="#f2d0d0" stroke-width="0.5">`;
  for (let x = minorStep; x < width; x += minorStep) svg += `<line x1="${x}" y1="0" x2="${x}" y2="${height}"/>`;
  for (let y = minorStep; y < height; y += minorStep) svg += `<line x1="0" y1="${y}" x2="${width}" y2="${y}"/>`;
  svg += `</g>`;
  svg += `<g stroke="#e00000" stroke-width="1">`;
  for (let x = majorStep; x < width; x += majorStep) svg += `<line x1="${x}" y1="0" x2="${x}" y2="${height}"/>`;
  for (let y = majorStep; y < height; y += majorStep) svg += `<line x1="0" y1="${y}" x2="${width}" y2="${y}"/>`;
  svg += `</g>`;

  const centerY = cellH / 2; // 0 mV çizgisi

  for (let c = 0; c < signals.length; c++) {
    const row = Math.floor(c / columns);
    const col = c % columns;
    const x0 = col * cellW;
    const y0 = row * cellH;

    const sig = signals[c];
    const color = leadColor(leadNames[c]);

    // Sinyal yolu
    let d = "";
    for (let i = 0; i < nSamples; i++) {
      const x = (i / fs) * mmPerSec * pxPerMm;
      const y = centerY - sig[i] * mmPerMv * pxPerMm;
      d += `${i === 0 ? "M" : "L"}${(x0 + x).toFixed(2)},${(y0 + y).toFixed(2)} `;
    }
    svg += `<path d="${d.trim()}" fill="none" stroke="${color}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>`;

    // Derivasyon etiketi
    svg += `<text x="${(x0 + 2).toFixed(1)}" y="${(y0 + 10).toFixed(1)}" font-family="Arial, sans-serif" font-size="10" font-weight="bold" fill="${color}">${leadNames[c]}</text>`;
  }

  svg += `</svg>`;
  return svg;
}

/** Sinyali PNG buffer'a çevirir. */
export async function renderEkgPng(signals: Float32Array[], names: string[], fs: number, opts?: RenderOptions): Promise<Buffer> {
  const svg = ecgToSvg(signals, names, fs, opts);
  return sharp(Buffer.from(svg), { density: 96 }).png().toBuffer();
}

/** PTB-XL kaydını (.hea + .dat) doğrudan PNG'ye çevirir. */
export async function renderRecordToPng(datPath: string, opts?: RenderOptions): Promise<{ png: Buffer; names: string[]; fs: number }> {
  const heaPath = path.join(path.dirname(datPath), path.basename(datPath, ".dat") + ".hea");
  const header = await parseHea(heaPath);
  const signals = await readSignalsMv(datPath, header);
  const png = await renderEkgPng(signals, header.names, header.fs, opts);
  return { png, names: header.names, fs: header.fs };
}
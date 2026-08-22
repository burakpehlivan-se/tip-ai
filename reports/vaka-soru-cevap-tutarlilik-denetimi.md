# Vaka–Soru-Cevap Tutarlılık Denetimi (12 aktif vaka)

> Kaynak: üretim `clinical_cases` tablosu, poliklinik başına 2'şer örneklem.
> Yöntem: case bilgisi ↔ soru chipleri ↔ hazırlanmış yanıtlar çapraz incelemesi.

---

## 1. Sistemik Kök Nedenler (vaka bazlı sorunların ana kaynağı)

### K1. Global chip havuzu her vakaya kopyalanıyor — EN KRİTİK
`src/lib/admin/case-to-vaka.ts:201` → `soruChipleri: [...CHIP_HAVUZU]`.
Öğrenci hangi vakayı açarsa açsın **~100 genel sorunun tamamını** görüyor
(ağrı, kusma, idrar, kitle…). Vakada o soruya hazır yanıt yoksa cevap:
`OZEL` fallback → **"Anlamadım" / "Bu konuda ek bilgi veremiyorum."**
Sonuç: öğrenci Alzheimer hastasına "Ağrının yeri nerede?" sorup "Anlamadım"
duyuyor. Soru–vaka uyumsuzluğunun %80'i budur.

### K2. İki ayrık aksiyon-sözlüğü — TR kısa kod vs EN uzun kod
- Legacy vakalar: `AGRI_YER, KUSMA, VITAL_ATES…`
- Synthea/AI vakaları: `CHIEF_COMPLAINT, HISTORY_OF_PRESENT, MEDICATIONS…`

Global chip havuzu **yalnızca TR kodları** biliyor. Synthea vakalarında
zengin İngilizce yanıtlar var ama hiçbir chip o aksiyona bağlanmıyor →
o yanıtlara chip üzerinden ulaşılamaz; tersinden TR chip'lere yanıt yok.
Rubrik/relevantAksiyonlar da TR-keyed olduğundan puanlama da iki sözlükte
aynı anda çalışamaz.

### K3. Zenginleştirme başarısızlığı sessizce yayınlanıyor
`noroloji::alzheimer-synthea-24acfead8ab92eab`: 6 alan hâlâ
**(Synthea iskeleti — AI/uzman dolduracak)** placeholder'ıyla öğrenciye
gidiyor. `validateCdmReadiness` bunu yakalamıyor → taslak yerine `aktif`.
Enrichment hatası = yayına placeholder sızması.

### K4. Vital değerleri yaş-farkındalığı olmayan sabit şablondan
Pediatrik vakalarda erişkin default vitaler görünüyor:
- `kasik-fitigi-cocuk` (32 haftalık prematüre bebek): **TA 120/80, nabız 80**
  → yenidoğan için imkânsız (beklenen TA ~55-70 sistolik, nabız 100-160).
- Aynı batch'te `invajinasyon` (6 aylık): nabız 130, TA 90/60 → doğru.
Yani iki pediatrik vakada iki farklı standart: biri ayarlanmış biri
kopyala-yapıştır erişkin.

### K5. Vaka içi çelişkiler (AI zenginleştirme kalite kontrolsüz)
- `hepatit-b`: `ATES_SORGU="37.8 hafif ateş"` ama aynı vakada
  `VITAL_ATES=36.5` → kendi içinde ters düşüyor.
- `diyabetik-noropati`: `DIYABET="10 yıllık şeker"` + `ILAC="Yok"` →
  10 yıllık diyabetin ilaçsız olması klinik olarak imkânsız.

### K6. Tekrarlayan/eş anlamlı anahtar çiftleri
`ILAC` ↔ `ILAC_OYKUSU`, `KANAMA` ↔ `KANAMA_KONTROLSUZ`,
`GECE_ARTIS` ↔ `YANMA` (nöropati) — aynı bilgi iki aksiyonda;
puanlamada hangisinin "beklenen" olduğu belirsiz.

### K7. Biçim tutarsızlığı
Legacy: noktasız kısa ("Yok"). Kardiyoloji AI: cümle+nokta ("Yok.",
"%92.", "36.5."). Hepatit: "37.8 hafif ateş" (birim+yorum karışık).
UI'da vital ayrıştırıcısı bu biçimleri farklı yorumlayabilir.

---

## 2. Vaka Bazlı Değerlendirme

| Vaka | Tutarlılık | Not |
|------|-----------|-----|
| kardiyoloji::kalp-yetmezligi | ✅ En iyi örnek | HT+KAH+ortopne+ödem+ilaçlar birbiriyle uyumlu; SpO2 %92 KY ile uyumlu. Eksik: ILAC/ILAC_OYKUSU duplikasyonu |
| uroloji::bph | ✅ İyi | Dizuri/nokturi/pollakürü/akım klasik BPH; hematüri negatif uygun |
| uroloji::prostat-ca | ✅ İyi | Aile öyküsü+kilo kaybı+sırt ağrısı (metastaz şüphesi) tutarlı |
| plastik-cerrahi::el-tendon | ✅ İyi | Travma mekanizması, hareket kısıtı, iskemi negatif, tetanos sorgusu doğru; KANAMA duplikasyonu var |
| cocuk-cerrahisi::invajinasyon | ✅ İyi | Koloikalık ("çilek reçeli"), safralı kusma, danslı ağlama klasik; vitaller yaşa uygun |
| enfeksiyon::hepatit-b | ⚠️ Orta | Sararma+koyu idrar+halsizlik uyumlu AMA ateş çelişkisi (K5) + diş çekimi HBV risk faktörü olarak zayıf/yanıltıcı (kan ürünü, piercing, IVDU, cinsel temas beklenir) |
| endokrin::diyabetik-noropati | ⚠️ Orta | Uyuşma/yanma uyumlu AMA ilaçsız 10 yıllık DM imkânsız (K5) + GECE_ARTIS/YANMA duplikasyonu (K6) |
| solunum::akut-bronsit | ⚠️ Orta | Öksürük/balgam hikâyesi iyi; ancak PAST_MEDICAL "şeker+tansiyon" ile akut bronsit dışı ek yük — kabul edilebilir; OZEL tek kelime ("Anlamadım") diğer zengin cevaplarla stil uyumsuz |
| kbb::alerjik-rinit | ⚠️ Orta | İçerik iyi ama tamamen EN-kodlu (K2); "iğne kalem" anamnezde anafilaksi öyküsü ima ediyor ama hiçbir yerde derinleştirilmiyor |
| ortopedi::burkulma | ⚠️ Orta | Hikâye iyi; MEDICATIONS'taki epinefrin iğnesi alerjik-rinit şablonundan taşma izlenimi (KBB vakasıyla neredeyse aynı cümle) → şablon kanaması şüphesi (doğrulanmalı) |
| cocuk-cerrahisi::kasik-fitigi | ❌ Kötü | Pediatrik vitaler erişkin (K4) — 120/80 prematüre bebekte tıbbi hata; fıtık içeriği (KITLE_HAREKET) iyi ama bu hata vakanı bozar |
| noroloji::alzheimer | ❌ Kritik | Placeholder iskelet canlıda (K3) — vaka fiilen oynanamaz durumda |

**Skor:** 5 iyi / 5 orta / 2 kötü-kritik (12 vakanın %58'inde en az bir
tutarlılık sorunu).

---

## 3. Önerilen Düzeltmeler (öncelik sırasıyla)

1. **Chip havuzunu vakaya daralt (K1+K2):** `case-to-vaka.ts:201`'de
   `CHIP_HAVUZU` yerine vakanın `hastaYanitlari` anahtarlarına eşlenen
   chip'ler kullan; EN→TR aksiyon alias tablosu ekle (tek seferlik
   sözlük, LLM değil). Bu tek değişiklik öğrenci deneyimindeki
   uyumsuzluğun büyük kısmını bitirir.
2. **Placeholder yayını engelle (K3):** `validateCdmReadiness`'a
   "(Synthea iskeleti" / "dolduracak" içeren yanıtlar = hata kuralı;
   re-enrich'i bu vakalara zorla.
3. **Yaşa göre vital şablonu (K4):** pediatrik vakalarda neonatal/infant
   aralıklar; üretici script'te yaş<18 kontrolü.
4. **Vaka içi çelişki lint'i (K5):** enrichment sonrası basit kurallar
   (ateş sorusu ↔ vital ateş farkı >0.5°C = uyarı; kronik hastalık +
   "İlaç=Yok" = uyarı) — publish gate'e bağla.
5. **Dup anahtar temizliği (K6) ve biçim normalizasyonu (K7)** —
   re-enrich pass'ine eklenecek.

---

## 4. Doğrulanan Yapısal Bulgular

- `content->'hasta'` yolu yok → demografi `patientProfil`/presentation
  altında (sorgu yolu hatasıydı, veri eksikliği değil).
- `soruChipleri` DB'de saklanmıyor (712 vakada 0) → oyun sırasında
  global havuzdan enjekte ediliyor (K1 ile uyumlu).

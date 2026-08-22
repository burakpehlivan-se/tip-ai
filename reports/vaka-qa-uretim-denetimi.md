# Vaka Soru-Cevap Üretim Denetimi (5 rastgele vaka × hasta tipi × AI)

> Yöntem: Canlıdan 5 rastgele deneme, her birine rastgele hasta tipi, doktor
> perspektifinden 8-11 soru; AI yanıt üretimi beklendi. Ham Q&A:
> `/tmp/opencode/vaka-qa.json` (vaka ID'leri ile birlikte).

## Bulgular (önem sırasıyla)

### F1 — `{{yas}} {{cinsiyet}}` placeholder'ı çözülmemiş — 5/5 vakada
Tüm vakalarda semptom alanı: "{{yas}} yaş {{cinsiyet}}, genel yakınma" /
"...burun tıkanıklığı ve yüz ağrısı". Şablon interpolasyonu Synthea yolunda
çalışmıyor → öğrenci vaka kartında yaş/cinsiyet göremiyor. Üretim hatası.

### F2 — Ana şikayetle doğrudan çelişen negatif cevap
Vaka "hışıltı ve NEFES DARLIĞI" iken NEFES_DARLIGI sorusuna cevap:
"Nefes darlığım yok." Kök neden: base cevap yoksa buildDefaultYanitlar
negatif veriyor; enrichHastaYanitlari'nin bağlam koruması yalnız AĞRI için
var (agriBaglam), solunum/ateş belirtileri korunmuyor.

### F3 — Base şablonda yazım/bozuk cümle hataları (AI'dan önce)
- "şeker hastalığıim yok." (3 farklı vakada birebir aynı typo)
- "astım tanım yok" (tanım yok olacak)
- HT_OYKUSU: "yüksek tansiyonum yok / bilmiyorum." (iki cevap birleşik)
- SIKAYET_SURE hep "bir süredir devam ediyor" — süre bilgisi içermeyen boş kalıp.

### F4 — Hasta tipi stil taşması
"Endişeli ve Kaygılı" tipinde HER cevapta aynı kaygı kalıbı tekrarı
(9× "çok korkuyorum"), cevap başına 400-700 karakter. Karakter tutarlı ama
pedagojik gürültü yüksek; maksimum uzunluk ve tekrar kısıtı prompt'ta yok.

### F5 — Vital anamnez cevapları arasında
VITAL_TANSIYON soru-cevap akışında dönüyor ("120/80") — vital bulgu anamnez
sorusu değil; önceki geri bildirimle çelişiyor (veri katmanı hâlâ öyle).

### F6 — Dup anahtarlar öğrenciye çift soru olarak yansıyor
SIGARA + SIGARA_OYKUSU ayrı chip'ler, neredeyse aynı cevap.

## Vaka bazlı özet

| # | Alan | Şikayet | Tip | Değerlendirme |
|---|------|---------|-----|---------------|
| 1 | Dahiliye | öksürüük+kanlı balgam | Sakın | İçerik zayıf: risk faktörleri düz negatif, süre boş |
| 2 | Genel Cerrahi | makat kanaması | Endişeli | En iyi içerik; ama aşırı uzunluk/tekrar |
| 3 | Göğüs | hışıltı+nefes darlığı | Sakın | F2 çelişkisi + dup |
| 4 | KBB | burun tıkanıklığı+yüz ağrısı | Dramatik | Stil uygun; F3 typo'lar burada da var |
| 5 | Göğüs | hışıltı+nefes darlığı | Ketum | Kısmi toplandı; F2 aynı vaka tipinde teyit |

## İyileştirme önerileri (adım 5)

1. **F1 fix:** semptom üretiminde şablon değişkenlerini yaş/cinsiyet ile doldur
   (`adminVakaToPlayable` veya ETL'de tek satır).
2. **F2 fix:** `enrichHastaYanitlari` bağlam korumasını genişlet — vaka
   semptomu/hastalık adında geçen belirti anahtarları için negatif default
   YASAK; yerine "(Synthea iskeleti)" tarzı işaretleyip enrichment'e bırak.
3. **F3 fix:** buildDefaultYanitlar typo düzeltmeleri + SIKAYET_SURE base'ini
   vaka başına gerçek süre ile doldur (conditions onset tarihinden).
4. **F4 fix:** hasta-tipi prompt'una "tek seferde en fazla 2 cümle; aynı
   kaygıyı her cevapta tekrar etme" kuralı.
5. **F5/F6:** VITAL_* cevaplarını Q&A dışına taşı (zaten K-fix'lerde chip'i
   çıkarıldı; bu turda eski vakalardan geldi), SIGARA/SIGARA_OYKUSU tekilere
   indir.

# Kalp Damar Cerrahisi — Vaka Verileri

## Abdominal Aort Anevrizması (AAA)

| Alan | Değer |
|---|---|
| **hastalikKey** | `aort-anevrizmasi` |
| **Poliklinik** | Kalp ve Damar Cerrahisi |
| **Seviye** | İleri |
| **Yaş Aralığı** | 65-85 |
| **Cinsiyet** | Erkek |

---

### Semptom Şablonu
`${yas} yaş erkek, karında nabız hissi ve sırt ağrısı`

### Ana Şikayet
Karında nabız atan kitle, bel ağrısı

### Bilinen Bilgiler (ozetBilgiler)
1. Karında nabız hissi
2. Bel ve sırt ağrısı
3. Hipertansiyon öyküsü
4. Sigara (40 paket-yıl)

---

## Rubrik

### Beklenen Anamnez Soruları

| Key | Etiket | Açıklama |
|---|---|---|
| `BATIN_KITLE` | Nabız atan kitle | AAA palpasyon bulgusu |
| `SIRT_AGRISI` | Sırt ağrısı | Rüptür habercisi olabilir |
| `HT_OYKUSU` | HT | Risk faktörü |
| `SIGARA_OYKUSU` | Sigara | Risk faktörü |
| `AILE_OYKUSU` | Aile | AAA aile öyküsü |

### Beklenen Testler

| Key | Etiket | Açıklama |
|---|---|---|
| `BT_ABDOMEN` | BT Abdomen | AAA boyutu |
| `CBC` | Hemogram | Bazal |
| `KREATININ` | Kreatinin | Kontrast öncesi |
| `EKG` | EKG | Preop kardiyak |

### Gereksiz Testler

| Key | Etiket | Açıklama |
|---|---|---|
| `TROPONIN` | Troponin | İlgisiz |

### Red Flag'ler

| Key | Etiket | Açıklama |
|---|---|---|
| `RÜPTÜR_BULGULARI` | Rüptür | Ani bel ağrısı + hipotansiyon |
| `SENKOP` | Senkop | Rüptür habercisi |

### Kabul Edilen Tanılar

- Abdominal Aort Anevrizması
- AAA

### Puanlama Ağırlıkları

| Davranış | Puan |
|---|---|
| dogru_kritik_soru | +2 |
| dogru_yardimci_soru | +1 |
| dogru_test | +2 |
| gereksiz_test | -1 |
| red_flag_atlama | -3 |
| tehlikeli_eksik | -5 |
| tani_dogru | +5 |
| tani_yanlis | -3 |

---

## Hasta Yanıtları

| Aksiyon | Yanıt |
|---|---|
| `BATIN_KITLE` | Göbeğimin üstünde nabız atan şişlik var |
| `SIRT_AGRISI` | Bel ağrım var, sürekli |
| `HT_OYKUSU` | Evet, 20 yıldır tansiyon |
| `SIGARA_OYKUSU` | Günde 1 paket, 40 yıl |
| `AILE_OYKUSU` | Babamda da vardı |
| `RÜPTÜR_BULGULARI` | Ani bir ağrı olmadı |
| `SENKOP` | Bayılmadım |
| `VITAL_TANSIYON` | 155/90 |
| `VITAL_NABIZ` | 78 |
| `VITAL_ATES` | 36.5°C |
| `VITAL_SPO2` | %97 |

---

## Statik Test Sonuçları

| Test Key | Test Adı | Sonuç | Yorum |
|---|---|---|---|
| `BT_ABDOMEN` | BT Abdomen | Abdominal aortada infrarenal 5.5 cm anevrizma, rüptür yok | İnfrarenal AAA |
| `CBC` | Hemogram | Hb: 14.0, Lökosit: 9.5 | Normal |
| `KREATININ` | Kreatinin | 1.0 mg/dL (0.7-1.3) | Normal |
| `EKG` | EKG | Sinüs ritmi, HR: 85 | Normal |

---

## İdeal Klinik Yaklaşım

1. Anamnez + risk faktörleri
2. USG / BT: AAA çapı
3. < 5.5 cm → takip
4. > 5.5 cm → cerrahi (EVAR / açık)

---

## Eğitim Notu

AAA — >3 cm dilatasyon. En sık infrarenal. >5.5 cm → cerrahi endikasyon. TEDAVİ: EVAR (endovasküler) veya açık onarım. Rüptür mortalitesi %80.

---

## Tedavi Planı

### İlaçlar (yapılandırılmış)

| İlaç | Doz | Yol | Endikasyon |
|---|---|---|---|
| Beta bloker | Titre edilerek | Oral | Duvar stresini azaltır |
| Statin | Yüksek doz | Oral | Ateroskleroz |

### Prosedürler
- EVAR (endovasküler anevrizma onarımı)
- Açık cerrahi onarım
- Preop kardiyak risk değerlendirmesi
- Postop BT takibi (6-12 ay)

### Notlar
- < 5.5 cm → konservatif takip, yıllık USG
- Sigara bırakma zorunlu
- HT kontrolü hayati
- Aile taraması (1. derece akrabalara USG)

### Kaynak
ESC 2014 Aort Hastalıkları Kılavuzu

---

## Veri Kaynakları (KAYNAKLAR_SABLONLARI)

Bu vaka sistemimizdeki şu kaynaklara dayanır:

1. Kılavuz · ESC 2014 Aort Hastalıkları → AAA tarama ve tedavi algoritması
2. BT Abdomen · Sentetik → infrarenal 5.5 cm anevrizma, rüptür yok
3. Laboratuvar · CBC + Kreatinin → preoperatif değerlendirme
4. Demografik · 65-85 yaş erkek → AAA en sık bu grupta

---

## Chip'ler (Soru Havuzundan)

| Kategori | Chip Etiketi | Aksiyon |
|---|---|---|
| Şikayet & Semptom | Karında nabız var mı? | `BATIN_KITLE` |
| Şikayet & Semptom | Sırt ağrın var mı? | `SIRT_AGRISI` |
| Özgeçmiş | Tansiyon yüksekliği var mı? | `HT_OYKUSU` |
| Özgeçmiş | Kaç sigara içiyorsun? | `SIGARA_OYKUSU` |
| Özgeçmiş | Aile öyküsü var mı? | `AILE_OYKUSU` |
| Kritik Sorgulama | Ani şiddetli ağrı oldu mu? | `RÜPTÜR_BULGULARI` |
| Kritik Sorgulama | Bayılma oldu mu? | `SENKOP` |

---

## Sistemdeki Diğer KVC Vakaları

| hastalikKey | Hastalık Adı |
|---|---|
| `aort-anevrizmasi` | Abdominal Aort Anevrizması |
| `periferik-arter` | Periferik Arter Hastalığı |
| `varis` | Kronik Venöz Yetmezlik (Varis) |

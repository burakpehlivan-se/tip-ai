# Türkçe Klinik Karar Simülasyon Sistemi MVP Raporu

## Genel Bakış
Bu rapor, Türkçe çalışan bir klinik karar simülasyon sistemi için MVP kapsamını tanımlar. Amaç, öğrencinin yalnızca nihai tanısını değil; doğru anamnez sorularını sorup sormadığını, uygun testleri isteyip istemediğini ve klinik akıl yürütmesini ne kadar doğru yürüttüğünü değerlendiren bir yapı kurmaktır.[1][2][3]

MVP için beş hastalık seçilmiştir: kalp hastalığı, diyabet, kronik böbrek hastalığı, pnömoni ve meme kanseri. Bu seçim, farklı organ sistemlerini kapsaması, eğitim senaryosu üretmeye uygun olması ve açık erişimli veri kaynaklarının bulunabilmesi nedeniyle yapılmıştır.[4][5][6][7][8]

Türkçe tarafta temel problem, her hastalık için yüksek kaliteli açık Türkçe veri seti bulunmamasıdır. Bu nedenle sistem, hastalık bilgisini uluslararası veri setlerinden alan; fakat değerlendirmeyi Türkçe terim eşleme, synonym sözlüğü ve yapılandırılmış klinik rubric üzerinden yapan hibrit bir mimariyle tasarlanmalıdır.[9][10][11]

## MVP Amaçları
MVP'nin temel amacı, öğrencinin klinik yaklaşımını ölçmektir. Sistem şu sorulara cevap vermelidir: doğru anamnez sorularını sordu mu, kritik red flag belirtileri sorguladı mı, gerekli testleri uygun sırayla istedi mi, gereksiz test istedi mi ve elde edilen verilerle makul bir ön tanı kurabildi mi.[1][12][13]

Bu nedenle MVP'de ilk sürümün odağı serbest tanı üretmekten çok yapılandırılmış değerlendirme olmalıdır. Tanı motoru daha sonra gelişebilir, ancak ilk ürün değerini öğrencinin yaklaşımını puanlamaktan alır.[1][2]

## Seçilen 5 Hastalık

| Hastalık | Klinik Alan | MVP'de neden uygun | Önerilen veri kaynağı |
|---|---|---|---|
| Kalp Hastalığı | Kardiyovasküler | Göğüs ağrısı, vital bulgular, EKG ve biyomarker isteme mantığını ölçmek için güçlü bir vaka alanı sunar.[4][14] | UCI Heart Disease: <https://archive.ics.uci.edu/dataset/45/heart+disease> [4] |
| Diyabet | Endokrin | Anamnez, yaşam tarzı, risk faktörü sorgulama ve temel laboratuvar isteme akışını değerlendirmek için uygundur.[8][15] | Kaggle Diabetes/BRFSS: <https://www.kaggle.com/datasets/prosperchuks/health-dataset/code> [8] |
| Kronik Böbrek Hastalığı | Nefroloji | İdrar analizi, kreatinin, üre, elektrolitler ve komorbid durumların birlikte değerlendirilmesini sağlar.[16] | UCI CKD: <https://archive-beta.ics.uci.edu/dataset/336/chronic+kidney+disease> [16] |
| Pnömoni | Solunum | Öykü + fizik muayene + görüntüleme isteme davranışını ölçmek için idealdir.[6][17] | Kaggle Chest X-Ray Pneumonia: <https://www.kaggle.com/datasets/paultimothymooney/chest-xray-pneumonia> [6] |
| Meme Kanseri | Onkoloji | Kitle öyküsü, görüntüleme ve ileri inceleme isteme zinciri açısından değerlidir.[7][18] | UCI Breast Cancer Wisconsin Diagnostic: <https://dev.uci-ics-mlr-prod.aws.uci.edu/dataset/17/breast+cancer+wisconsin+diagnostic> [7] |

## Hastalık Bazlı MVP Çerçevesi

### 1. Kalp Hastalığı
Heart Disease veri seti, yaş, cinsiyet, göğüs ağrısı tipi, tansiyon, kolesterol, EKG ile ilişkili değişkenler ve kalp hastalığı varlığı gibi klinik özellikler içerir.[4][14] Bu nedenle sistemde göğüs ağrısı senaryoları için güçlü bir temel sağlar.[4]

Türkçe değerlendirme rubric'inde öğrenciden beklenen temel davranışlar şunlar olmalıdır:
- Ağrının yeri, süresi, yayılımı, eforla ilişkisi ve eşlik eden nefes darlığı/terleme sorgulanmalı.
- Vital bulgular istenmeli.
- EKG ve troponin benzeri kardiyak değerlendirme testleri erken aşamada istenmeli.
- Düşük değerli veya erken gereksiz görüntüleme istekleri negatif puanlanmalı.

Türkçe synonym katmanında şu varyasyonlar aynı eyleme bağlanmalıdır: “EKG çek”, “elektrokardiyografi iste”, “kalp grafisi bak”; ayrıca “troponin bak”, “kardiyak enzim iste” gibi ifadeler de tek aksiyona normalize edilmelidir.[9][19]

### 2. Diyabet
BRFSS tabanlı Kaggle veri seti, diyabetle ilişkili risk faktörleri ve sağlık göstergelerini içerir; yaş, BMI, fiziksel aktivite, hipertansiyon, kolesterol ve genel sağlık değişkenleri bulunur.[8][20][15] Bu yapı, yaşam tarzı ve sistem sorgulamasını değerlendirmek için uygundur.[8]

Türkçe rubric'te beklenen davranışlar şunlar olmalıdır:
- Poliüri, polidipsi, kilo kaybı, görme bulanıklığı ve aile öyküsü sorgulanmalı.
- Açlık kan şekeri, HbA1c ve temel metabolik değerlendirme istenmeli.
- Rastgele ve klinik bağlamı olmayan test istekleri negatif puanlanmalı.

Türkçe normalizasyon katmanında “şeker bak”, “kan şekeri ölç”, “açlık glukozu iste” ve “HbA1c bak” gibi ifadelerin ilgili test slot'larına eşlenmesi gerekir.[9][11]

### 3. Kronik Böbrek Hastalığı
UCI CKD veri seti 24 özellik ve CKD/notCKD sınıfı içerir; serum kreatinin, üre, sodyum, potasyum, hemoglobin, idrar bulguları ve hipertansiyon/diyabet gibi komorbid değişkenler yer alır.[16] Bu veri seti, laboratuvar isteme davranışının değerlendirilmesi için MVP'de çok değerlidir.[16]

Türkçe rubric'te beklenen davranışlar şunlar olmalıdır:
- Ödem, idrar miktarı değişikliği, halsizlik, hipertansiyon ve diyabet öyküsü sorgulanmalı.
- Kreatinin, üre, elektrolitler ve tam idrar tetkiki istenmeli.
- Sonuçları birlikte yorumlama becerisi değerlendirilmelidir; örneğin yalnızca kreatinin istemek yeterli kabul edilmemelidir.

Türkçe test eşleme katmanı “böbrek fonksiyon testi”, “üre kreatinin bak”, “renal panel iste”, “tam idrar tahlili iste” gibi farklı ifadeleri normalize etmelidir.[9][21]

### 4. Pnömoni
Kaggle'daki Chest X-Ray Images (Pneumonia) veri seti 5,863 görüntü ve iki ana kategori içerir; normal ve pnömoni sınıfları ile çalışmak mümkündür.[6] Alternatif kopyalarda veri yapısı train/test ve normal/pneumonia klasörleriyle sunulmaktadır.[17]

Bu hastalık MVP açısından değerlidir çünkü yalnızca test isteme değil, doğru zamanda görüntüleme isteme davranışını da ölçer.[6][17] Türkçe rubric'te şu davranışlar beklenmelidir:
- Ateş, öksürük, balgam, nefes darlığı ve semptom süresi sorgulanmalı.
- Oskültasyon ve vital bulgular istenmeli.
- Akciğer grafisi uygun aşamada istenmeli.
- Çok erken ileri görüntüleme istemek negatif puanlanmalı.

Türkçe synonym eşleme için “akciğer grafisi”, “PA akciğer”, “ciğer filmi”, “toraks grafisi” gibi ifadeler tek görüntüleme eylemine indirgenmelidir.[9][22]

### 5. Meme Kanseri
Wisconsin Diagnostic veri seti, meme kitlesinden alınan ince iğne aspirasyonu görüntülerinden türetilmiş 30 özellik ve benign/malign etiketleri içerir.[7][18] Bu veri seti doğrudan tarama sürecini değil, ileri değerlendirme ve sınıflandırma katmanını destekler.[7]

MVP'de bu hastalık için Türkçe rubric şu şekilde kurulmalıdır:
- Kitlenin süresi, ağrı durumu, akıntı, aile öyküsü ve büyüme hızı sorgulanmalı.
- Meme muayenesi, uygun görüntüleme ve gerektiğinde biyopsi isteme akışı değerlendirilmelidir.
- Klinik bağlam olmadan ileri tetkike atlamak negatif puanlanabilir.

Türkçe normalizasyon tarafında “mamografi iste”, “meme USG bak”, “biyopsi planla”, “ince iğne aspirasyonu yap” gibi ifadeler standart aksiyonlara dönüştürülmelidir.[9][19]

## Türkçe Değerlendirme Mimarisi
Sistem Türkçe etiketli büyük veri setlerine bağımlı olmamalıdır. Bunun yerine değerlendirme üç katmanlı kurulmalıdır: yapılandırılmış klinik rubric, Türkçe terim/synonym katmanı ve puanlama motoru.[9][10][2]

### 1. Klinik Rubric Katmanı
Her hastalık için şu yapı tutulmalıdır:
- Beklenen anamnez soruları.
- Beklenen fizik muayene adımları.
- İstenmesi gereken testler.
- İstenmemesi gereken veya erken aşamada gereksiz testler.
- Kritik red flag öğeleri.
- Kabul edilebilir tanı yolları.

Bu yaklaşım, veri seti yetersiz olsa bile uzman destekli gold-standard üretmeye izin verir.[1][2]

### 2. Türkçe Terim Katmanı
Türkçede aynı klinik aksiyon çok farklı şekillerde ifade edilebilir. Bu nedenle NLP katmanı serbest metni doğrudan puanlamak yerine önce normalize etmelidir.[9][11]

Örnek eşlemeler:
- “tam kan sayımı”, “hemogram”, “cbc” → CBC.
- “idrar tahlili”, “tam idrar tetkiki”, “TİT” → urinalysis.
- “akciğer filmi”, “PA akciğer”, “akciğer grafisi” → chest x-ray.

Türkçe medikal model ve NER çalışmalarının varlığı, bu normalizasyon katmanının geliştirilebilir olduğunu gösterir.[19][9][22]

### 3. Puanlama Motoru
Puanlama başlangıçta kural tabanlı olabilir. Öğrencinin aksiyonları vaka rubric'i ile karşılaştırılır ve her aksiyon için pozitif, nötr veya negatif skor üretilir.[1][13]

Örnek puan mantığı:
- Doğru kritik soru: +2
- Yardımcı ama kritik olmayan soru: +1
- Gerekli test: +2
- Gereksiz erken test: -1
- Red flag'i atlama: -3
- Klinik olarak tehlikeli eksik yaklaşım: -5

Bu puanlama daha sonra LLM tabanlı yorumlayıcı katmanla zenginleştirilebilir; ancak MVP için deterministik kurallar daha güvenli ve açıklanabilir olacaktır.[23][24]

## Frontend Tasarım Raporu
Frontend'in amacı modern görünen bir panel üretmekten çok, öğrencinin klinik karar sürecini net ve akıcı biçimde yöneten bir deneyim sunmaktır. Arayüz, öğrenme ve değerlendirme odaklı olmalıdır; oyunlaştırma varsa bile ikincil düzeyde kalmalıdır.[25][26]

### Ana kullanıcı akışı
Önerilen akış şu şekilde olmalıdır:
1. Vaka seçimi ekranı.
2. Hasta kartı ve ilk başvuru şikayeti.
3. Öğrencinin serbest metin veya seçilebilir chip yapısıyla soru sorması.
4. İstenen testlerin seçimi.
5. Gelen sonuçların aşamalı gösterimi.
6. Ön tanı / ayırıcı tanı girişi.
7. Değerlendirme ve geri bildirim ekranı.

Bu yapı, OSCE ve data-rich klinik reasoning araçlarında kullanılan aşamalı değerlendirme mantığıyla uyumludur.[1][25]

### Bilgi mimarisi
Arayüz üç ana panel mantığında tasarlanmalıdır:
- Sol panel: hasta özeti, yaş, cinsiyet, ana şikayet, mevcut bilinen bilgiler.
- Orta panel: konuşma/etkileşim akışı; öğrencinin soruları ve hastanın yanıtları burada görünür.
- Sağ panel: istenen testler, mevcut sonuçlar, puan ipuçları ve ayırıcı tanı listesi.

Mobilde bu yapı sekmeli veya alt gezinmeli bir düzene dönüşmelidir. Masaüstünde üç panel verimlidir; mobilde ise “Vaka”, “Sorular”, “Testler”, “Sonuç” sekmeleri daha uygundur.

### Tasarım ilkeleri
Frontend için önerilen tasarım ilkeleri şunlardır:
- Sade ve klinik görünümlü arayüz; aşırı parlak renklerden kaçınılmalı.
- Kritik aksiyonlar için net çağrı butonları kullanılmalı.
- Test isteme ve soru sorma alanları aynı sayfada ama görsel olarak ayrılmış olmalı.
- Her sonuç anında değil, eğitim akışını destekleyecek biçimde kontrollü açılmalı.
- Öğrenciye anlık doğru/yanlış yerine, vaka sonunda açıklamalı geri bildirim verilmeli.

Renk paleti için açık arka plan, koyu gri metin, bir ana vurgu rengi ve hata/uyarı için kontrollü ikinci renk yeterlidir. Klinik yazılım hissi veren sade tasarım dili güven oluşturur ve bilişsel yükü azaltır.

### Temel ekranlar
#### 1. Vaka seçim ekranı
Kart bazlı bir yapı kullanılmalıdır. Her kartta hastalık adı değil, semptom başlığı yer alması daha gerçekçi olur; örneğin “Göğüs ağrısı”, “Öksürük ve ateş”, “Memede kitle” gibi.[1]

#### 2. Vaka çalışma ekranı
Bu ekran ürünün çekirdeğidir. Üst bölümde hasta özeti, orta bölümde sohbet ve veri toplama, sağ tarafta test isteme ve sonuç yönetimi bulunmalıdır. Öğrencinin o anda hangi aşamada olduğu net biçimde görünmelidir.

#### 3. Sonuç ekranı
Sonuç ekranı sadece puan göstermemelidir. Şu yapıyı içermelidir:
- Doğru yaptığı klinik adımlar.
- Atladığı kritik sorular.
- Gereksiz istediği testler.
- Önerilen ideal yaklaşım akışı.
- Kısa eğitim notu.

Bu ekran ürünün öğrenme değerini belirleyen en kritik bölümdür.[1][2]

### Bileşen önerileri
- Serbest metin giriş alanı + öneri chip'leri.
- Test isteme için searchable dropdown veya kategorili drawer.
- Gelen test sonuçları için kart yapısı.
- Ayırıcı tanı için reorder edilebilir liste.
- Vaka sonu için rubric tabanlı feedback paneli.

### Tasarım sistemi
Tasarım sistemi küçük ama tutarlı olmalıdır:
- 8 px spacing sistemi.
- 3 tipografi seviyesi: başlık, gövde, yardımcı metin.
- 1 ana buton, 1 ikincil buton, 1 text button.
- Kart, badge, input, result-row, feedback-block gibi sınırlı komponent seti.

Bu, ilk sürümün hızlı geliştirilmesini ve daha sonra komponent bazlı ölçeklenmesini kolaylaştırır.

## Yapay Zekaya Verilecek Uygulama Özeti
Bu sistem, Türkçe klinik karar verme eğitimi için tasarlanmış bir web uygulamasıdır. Öğrenci bir semptom tabanlı vaka açar, hastaya soru sorar, uygun testleri ister, sonuçları görür ve ön tanı geliştirir. Sistem öğrenciyi sadece tanısına göre değil; sorduğu soruların kalitesi, istediği testlerin uygunluğu, kritik belirtileri atlayıp atlamadığı ve izlediği klinik yol üzerinden değerlendirir.[1][2][3]

İlk sürümde beş vaka alanı bulunmalıdır: kalp hastalığı, diyabet, kronik böbrek hastalığı, pnömoni ve meme kanseri. Hastalık bilgisinin kaynağı açık uluslararası veri setleri olmalı; Türkçe değerlendirme ise yapılandırılmış rubric ve Türkçe terim eşleme katmanıyla yapılmalıdır.[4][8][16][6][7][9]

Öncelik, yüksek doğruluklu serbest üretim değil; açıklanabilir, kontrollü ve eğitim değeri yüksek bir değerlendirme deneyimidir. Bu nedenle MVP aşamasında kural tabanlı hibrit yaklaşım önerilir; LLM destekli serbest değerlendirme katmanı daha sonraki sürümlerde eklenebilir.[1][23][24]
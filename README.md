# ASKİ Su Kesintisi Twitter Botu

Ankara Su ve Kanalizasyon İdaresi (ASKİ) su kesintilerini otomatik olarak takip edip Twitter'da paylaşan bot.

## Özellikler

- ASKİ web sitesindeki kesinti sayfasını periyodik olarak tarar
- Yeni kesinti tespit edildiğinde Twitter'da paylaşır
- Aynı kesinti için tekrar tweet atmaz (içerik tabanlı benzersiz kimlik)
- Tweet 280 karakteri aşarsa Google Gemini ile iki aşamalı kısaltma uygular
- Başarısız tweet denemeleri için yapılandırılabilir retry mekanizması
- Yalnızca tweet'i başarıyla atılan kesintileri kalıcı olarak kaydeder
- GitHub Actions ile 9 dakikada bir otomatik çalışır
- Docker ile tek komutla ayağa kalkar

## Gereksinimler

- Node.js 20 veya üzeri
- RapidAPI hesabı ve `twitter-api-v1-1-enterprise` API aboneliği
- Twitter hesabı (cookie tabanlı `auth_token`)
- Google Gemini API anahtarı (opsiyonel, tweet kısaltma için)

## Kurulum

```bash
# Bağımlılıkları yükle
npm install

# Örnek ortam dosyasını kopyala
cp .env.example .env

# .env dosyasını düzenleyip API anahtarlarını gir
```

## Ortam Değişkenleri

Aşağıdaki varsayılanlar, değişken tanımlanmadığında kodun kullandığı değerlerdir.

| Değişken                  | Zorunlu | Varsayılan                                   | Açıklama                                 |
|---------------------------|---------|----------------------------------------------|------------------------------------------|
| `RAPIDAPI_KEY`            | Evet    | -                                            | RapidAPI anahtarı                        |
| `TWITTER_AUTH_TOKEN`      | Evet    | -                                            | Twitter oturum token'ı (cookie)          |
| `TWITTER_API_KEY`         | Evet    | -                                            | Twitter API key (query parametresi)      |
| `GEMINI_API_KEY`          | Hayır   | -                                            | Tweet kısaltma için, yoksa devre dışı    |
| `RAPIDAPI_HOST`           | Hayır   | `twitter-api-v1-1-enterprise.p.rapidapi.com` | RapidAPI host adresi                     |
| `MAX_TWEET_RETRIES`       | Hayır   | `100`                                        | Maksimum tweet deneme sayısı             |
| `TWEET_RETRY_DELAY_MS`    | Hayır   | `5000`                                       | Tweet denemeleri arası bekleme (ms)      |
| `CHECK_INTERVAL_MS`       | Hayır   | `300000`                                     | Periyodik kontrol aralığı (ms)           |
| `TWEET_MAX_LENGTH`        | Hayır   | `280`                                        | Maksimum tweet uzunluğu                  |
| `GEMINI_RATE_LIMIT_DELAY` | Hayır   | `4000`                                       | Gemini çağrıları arası bekleme (ms)      |

## Kullanım

| Komut                       | Açıklama                                                      |
|-----------------------------|---------------------------------------------------------------|
| `npm run build`             | TypeScript kodunu `dist/` dizinine derler                     |
| `npm run dev -- --once`     | Tek seferlik çalıştırır (tarar ve tweet atar)                 |
| `npm run dry`               | Tweet atmadan test eder, çıktıyı konsola yazar                |
| `npm start`                 | Derlenmiş kodu periyodik modda çalıştırır                     |
| `npm run dev`               | Derlemeden periyodik modda çalıştırır (sonsuz döngü, Ctrl+C)  |
| `npm run scrape`            | Yalnızca scraper'ı çalıştırır ve kesintileri listeler         |
| `npm run scrape -- --debug` | ASKİ sayfasındaki kesinti sayısını gösterir                   |

`npm start` komutundan önce `npm run build` çalıştırılmalıdır.

Test framework kullanılmaz. Doğrulama `npm run build` ve `npm run dry` ile yapılır.

## Docker

```bash
docker compose build
docker compose up -d
docker compose logs -f
```

Multi-stage build ile `node:20-alpine` üzerine kurulur. `./data` dizini konteynere bağlanır, böylece kayıtlı kesintiler ve loglar kalıcı olur. Ortam değişkenleri `.env` dosyasından okunur.

## GitHub Actions

Depo GitHub'a gönderildiğinde iş akışı otomatik olarak devreye girer. Her 9 dakikada bir (`*/9 * * * *`) tek seferlik mod ile çalışır. Yeni kesinti bulunduğunda `data/kesintiler.json` ve `data/run.log` dosyalarını commit eder. Commit mesajındaki `[skip ci]` etiketi sonsuz tetiklenme döngüsünü engeller.

### Zorunlu Secret'lar

Repository > Settings > Secrets and variables > Actions > New repository secret

| Secret               | Açıklama                |
|----------------------|-------------------------|
| `RAPIDAPI_KEY`       | RapidAPI anahtarı       |
| `TWITTER_AUTH_TOKEN` | Twitter oturum token'ı  |
| `TWITTER_API_KEY`    | Twitter API key         |

### Opsiyonel Secret'lar

| Secret                 | Varsayılan | Açıklama                            |
|------------------------|------------|-------------------------------------|
| `GEMINI_API_KEY`       | -          | Tweet kısaltmayı etkinleştirir      |
| `TWEET_MAX_LENGTH`     | `280`      | Maksimum tweet uzunluğu             |
| `MAX_TWEET_RETRIES`    | `100`      | Maksimum tweet deneme sayısı        |
| `TWEET_RETRY_DELAY_MS` | `5000`     | Denemeler arası bekleme (ms)        |

### Manuel Tetikleme

Actions > ASKİ Su Kesintisi Kontrolü > Run workflow

## Tweet Formatı

```
⚠️ YENİMAHALLE - Plansız Kesinti

📅 4.01.2026 11:10:00 - 4.01.2026 23:55:00
📍 Demetevler Mahallesi, Demetlale Mahallesi, Demetgül Mahallesi

#AnkaraSuKesintisi #ASKİ #Yenimahalle
```

Planlı kesintilerde uyarı simgesi yerine tamir simgesi kullanılır. Hashtag'deki ilçe adı Türkçe karakterlerden arındırılır ve ilk harfi büyük yazılır: `YENİMAHALLE` ilçesi `#Yenimahalle` olur.

## Çalışma Akışı

1. Scraper, ASKİ kesinti sayfasını çeker ve HTML içeriğini ayrıştırır
2. Bulunan kesintiler `data/kesintiler.json` ile karşılaştırılır, yeni olanlar seçilir
3. Tweet metni oluşturulur, 280 karakteri aşarsa Gemini ile kısaltılır
4. Tweet Twitter'a gönderilir
5. Yalnızca tweet'i başarıyla atılan kesintiler `kesintiler.json` dosyasına yazılır

Son adım kritiktir: tweet atılamazsa kesinti kaydedilmez, böylece sonraki çalışmada tekrar denenir.

## Teknik Detaylar

### Veri Kaynağı

ASKİ standart bir API sunmaz. Kesinti sayfası (`/tr/Kesinti.aspx`) cheerio ile ayrıştırılır. Tüm liste elemanları taranır, hem arıza hem tamir tarihi içerenler kesinti kartı kabul edilir. İlçe adı ve kesinti türü başlık elemanlarından, tarihler ve etkilenen yerler ise düzenli ifadelerle çıkarılır. ASKİ sayfa yapısını değiştirirse ayrıştırma mantığı güncellenmelidir.

### Twitter API

RapidAPI üzerinden `twitter-api-v1-1-enterprise` kullanılır.

| İşlem     | Endpoint                     | Method |
|-----------|------------------------------|--------|
| ct0 token | `/base/apitools/getCt0`      | POST   |
| Tweet at  | `/base/apitools/createTweet` | GET    |
| Yanıt at  | `/base/apitools/tweetReply`  | GET    |

ct0 token her çalıştırmada dinamik olarak alınır. Yanıt tweet özelliği kodda mevcuttur ancak şu anda devre dışıdır.

### Retry Mekanizması

Tweet başarısız olursa `MAX_TWEET_RETRIES` kez denenir ve her deneme arasında `TWEET_RETRY_DELAY_MS` beklenir. Her 10 başarısız denemede ct0 token yenilenir. API hataları yanıt gövdesi ve HTTP durum kodu ile birlikte loglanır.

### Tweet Kısaltma

Gemini `gemini-2.5-flash-lite` modeli kullanılır ve kısaltma iki aşamalıdır. Birinci aşamada tweet şablonu korunarak yalnızca etkilenen yerler listesi kısaltılır. Bu yeterli olmazsa ikinci aşamada tüm tweet metni kısaltılır. Her aşama en fazla 10 kez denenir. Gemini anahtarı yoksa veya tüm denemeler başarısız olursa orijinal metin kullanılır.

### Benzersiz Kimlik

Her kesinti için içerik tabanlı bir kimlik üretilir:

```
id = sha256(ilce + arizaTarihi + kesintiTuru + etkilenenYerler)
```

Kimliğin ilk 16 karakteri kullanılır. Tamir tarihi ve detay alanları kimliğe dahil edilmez, çünkü aynı kesinti için sonradan güncellenebilirler. Bu yaklaşım sayesinde aynı ilçede farklı zamanlarda veya farklı mahallelerde oluşan kesintiler ayrı kayıtlar olarak tutulur, planlı ve plansız kesintiler birbirine karışmaz.

### Loglama

Loglar hem konsola hem `data/run.log` dosyasına yazılır. Her kayıt zaman damgası ve seviye bilgisi taşır. Uygulama her başlatıldığında 7 günden eski kayıtlar silinir.

### Veri Bütünlüğü

`kesintiler.json` dosyasına yazma işlemi atomiktir. İçerik önce geçici bir dosyaya yazılır, ardından hedef dosyanın üzerine taşınır. Böylece yazma işlemi yarıda kesilse bile mevcut veri bozulmaz.

Periyodik modda eşzamanlı kontrol çalışmaz. Önceki kontrol tamamlanmadan yenisi başlatılmaz.

## Proje Yapısı

```
src/
├── index.ts      # Giriş noktası, komut satırı bayrakları, kontrol döngüsü
├── scraper.ts    # ASKİ sayfasını çeker ve ayrıştırır
├── storage.ts    # kesintiler.json okuma, yazma ve karşılaştırma
├── twitter.ts    # RapidAPI Twitter entegrasyonu ve tweet biçimlendirme
├── gemini.ts     # Gemini ile tweet kısaltma
├── logger.ts     # Dosya ve konsol loglama
└── types.ts      # Tip tanımları ve kimlik üretici

data/
├── kesintiler.json  # Kayıtlı kesintiler
└── run.log          # Çalışma logları
```

`data/` dizinindeki dosyalar depoya dahildir, çünkü GitHub Actions durumu bu dosyalar üzerinden taşır.

## Lisans

MIT

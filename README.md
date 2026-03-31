# ASKİ Su Kesintisi Twitter Botu

Ankara Su ve Kanalizasyon İdaresi (ASKİ) su kesintilerini otomatik olarak takip edip Twitter'da paylaşan bot.

## Özellikler

- ASKİ web sitesinden su kesintilerini otomatik olarak çeker
- Yeni kesinti tespit edildiğinde Twitter'da paylaşır
- Duplicate tweetleri önler (aynı kesinti için tekrar tweet atmaz)
- Başarısız tweet'ler için otomatik retry mekanizması
- GitHub Actions ile 9 dakikada bir otomatik çalışır

## Kurulum

### Gereksinimler

- Node.js 20+
- RapidAPI hesabı (twitter-api-v1-1-enterprise)
- Twitter hesabı

### Yerel Kurulum

```bash
# Bağımlılıkları yükle
npm install

# .env dosyası oluştur
cp .env.example .env

# .env dosyasını düzenle ve API anahtarlarını ekle
```

### Ortam Değişkenleri

| Değişken               | Açıklama                     | Varsayılan                                 |
|------------------------|------------------------------|--------------------------------------------|
| `RAPIDAPI_KEY`         | RapidAPI anahtarı            | -                                          |
| `RAPIDAPI_HOST`        | RapidAPI host                | twitter-api-v1-1-enterprise.p.rapidapi.com |
| `TWITTER_AUTH_TOKEN`   | Twitter oturum token'ı       | -                                          |
| `TWITTER_API_KEY`      | Twitter API key              | -                                          |
| `MAX_TWEET_RETRIES`    | Maksimum deneme sayısı       | 100                                        |
| `TWEET_RETRY_DELAY_MS` | Denemeler arası bekleme (ms) | 5000                                       |
| `CHECK_INTERVAL_MS`    | Kontrol aralığı (ms)         | 300000                                     |

## Kullanım

```bash
# Tek seferlik çalıştır (test için)
npm run dev -- --once

# Sürekli çalıştır (belirtilen aralıkta kontrol eder)
npm start

# Sadece scraper'ı test et
npm run scrape

# Debug modu (kaç kesinti olduğunu göster)
npm run scrape -- --debug

# Build
npm run build
```

## GitHub Actions

Repository'yi GitHub'a push ettiğinizde otomatik olarak çalışır.

### Secrets Ayarları

Repository > Settings > Secrets and variables > Actions > New repository secret

| Secret               | Açıklama               |
|----------------------|------------------------|
| `RAPIDAPI_KEY`       | RapidAPI anahtarı      |
| `TWITTER_AUTH_TOKEN` | Twitter oturum token'ı |
| `TWITTER_API_KEY`    | Twitter API key        |

### Opsiyonel Secrets

| Secret                 | Varsayılan | Açıklama                |
|------------------------|------------|-------------------------|
| `MAX_TWEET_RETRIES`    | 100        | Maksimum deneme sayısı  |
| `TWEET_RETRY_DELAY_MS` | 5000       | Denemeler arası bekleme |

### Manuel Tetikleme

Actions > ASKİ Su Kesintisi Kontrolü > Run workflow

## Tweet Formatı

Her kesinti için tweet atılır:

### Ana Tweet
```
⚠️ YENİMAHALLE - Plansız Kesinti

📅 4.01.2026 11:10:00 - 4.01.2026 23:55:00
📍 Demetevler Mahallesi, Demetlale Mahallesi, Demetgül Mahallesi...

#AnkaraSuKesintisi #ASKİ #Yenimahalle
```

## Teknik Detaylar

### Twitter API (RapidAPI)

RapidAPI üzerinden `twitter-api-v1-1-enterprise` kullanılıyor.

| İşlem     | Endpoint                     | Method |
|-----------|------------------------------|--------|
| ct0 token | `/base/apitools/getCt0`      | POST   |
| Tweet at  | `/base/apitools/createTweet` | GET    |
| Yanıt at  | `/base/apitools/tweetReply`  | GET    |

ct0 token her çalıştırmada dinamik olarak alınır.

### Retry Mekanizması

- Tweet/reply başarısız olursa `MAX_TWEET_RETRIES` kez denenir
- Her deneme arasında `TWEET_RETRY_DELAY_MS` beklenir
- API hataları detaylı loglanır (response.data, HTTP status)

### Duplicate Önleme

Her kesinti için benzersiz bir ID oluşturulur:

```
id = sha256(ilce + arizaTarihi + kesintiTuru + etkilenenYerler)
```

Bu sayede:
- Aynı ilçede farklı zamanlarda kesinti olabilir
- Aynı ilçede farklı mahallelerde kesinti olabilir
- Planlı ve plansız kesintiler ayrı sayılır

### Dosya Yapısı

```
src/
├── index.ts      # Ana çalışma döngüsü
├── scraper.ts    # ASKİ sayfasını çeker ve parse eder
├── storage.ts    # JSON dosya yönetimi
├── twitter.ts    # RapidAPI ile Twitter entegrasyonu
└── types.ts      # TypeScript tanımlamaları

data/
└── kesintiler.json  # Bilinen kesintilerin listesi
```

## Lisans

MIT


# ASKİ Su Kesintisi Twitter Botu

Ankara Su ve Kanalizasyon İdaresi (ASKİ) su kesintilerini otomatik olarak takip edip Twitter'da paylaşan bot.

Takip etmek isterseniz https://x.com/ANKSuKesintisi

## Ozellikler

- ASKİ web sitesinden su kesintilerini otomatik olarak ceker
- Yeni kesinti tespit edildiginde Twitter'da paylasir
- Duplicate tweetleri onler (aynı kesinti icin tekrar tweet atmaz)
- Basarisiz tweet'ler icin otomatik retry mekanizmasi
- GitHub Actions ile 5 dakikada bir otomatik calisir

## Kurulum

### Gereksinimler

- Node.js 20+
- RapidAPI hesabi (twitter-api-v1-1-enterprise)
- Twitter hesabi

### Yerel Kurulum

```bash
# Bagimliliklari yukle
npm install

# .env dosyasi olustur
cp .env.example .env

# .env dosyasini duzenle ve API anahtarlarini ekle
```

### Ortam Degiskenleri

| Degisken               | Aciklama                                   | Varsayilan                                  |
|------------------------|--------------------------------------------|---------------------------------------------|
| `RAPIDAPI_KEY`         | RapidAPI anahtari                          | -                                           |
| `RAPIDAPI_HOST`        | RapidAPI host                              | twitter-api-v1-1-enterprise.p.rapidapi.com  |
| `TWITTER_AUTH_TOKEN`   | Twitter oturum token'i                     | -                                           |
| `TWITTER_API_KEY`      | Twitter API key                            | -                                           |
| `MAX_TWEET_RETRIES`    | Maksimum deneme sayisi                     | 100                                         |
| `TWEET_RETRY_DELAY_MS` | Denemeler arasi bekleme (ms)               | 5000                                        |
| `CHECK_INTERVAL_MS`    | Kontrol araligi (ms)                       | 300000                                      |

## Kullanim

```bash
# Tek seferlik calistir (test icin)
npm run dev -- --once

# Surekli calistir (belirtilen aralikta kontrol eder)
npm start

# Sadece scraper'i test et
npm run scrape

# Debug modu (kac kesinti oldugunu goster)
npm run scrape -- --debug

# Build
npm run build
```

## GitHub Actions

Repository'yi GitHub'a push ettiginizde otomatik olarak calisir.

### Secrets Ayarlari

Repository > Settings > Secrets and variables > Actions > New repository secret

| Secret               | Aciklama                        |
|----------------------|---------------------------------|
| `RAPIDAPI_KEY`       | RapidAPI anahtari               |
| `TWITTER_AUTH_TOKEN` | Twitter oturum token'i          |
| `TWITTER_API_KEY`    | Twitter API key                 |

### Opsiyonel Secrets

| Secret                 | Varsayilan | Aciklama                    |
|------------------------|------------|-----------------------------|
| `MAX_TWEET_RETRIES`    | 100        | Maksimum deneme sayisi      |
| `TWEET_RETRY_DELAY_MS` | 5000       | Denemeler arasi bekleme     |

### Manuel Tetikleme

Actions > ASKİ Su Kesintisi Kontrolu > Run workflow

## Tweet Formati

Her kesinti icin 2 tweet atilir:

### Ana Tweet
```
⚠️ YENİMAHALLE - Plansiz Kesinti

📅 4.01.2026 11:10:00 - 4.01.2026 23:55:00
📍 Demetevler Mahallesi, Demetlale Mahallesi, Demetgul Mahallesi...

#AnkaraSuKesintisi #ASKİ #Yenimahalle
```

### Yanit Tweet (Detay)
```
📋 Kesinti Aciklamasi:

Devam eden kuraklik ve artan nufus nedeniyle su kaynaklarimiz 
uzerindeki yuk artmistir. Bu nedenle bazi bolgelerde zaman zaman 
basinc dusukluğu ve su kesintileri yasanabilmektedir...
```

## Teknik Detaylar

### Twitter API (RapidAPI)

RapidAPI uzerinden `twitter-api-v1-1-enterprise` kullaniliyor.

| Islem      | Endpoint                      | Method |
|------------|-------------------------------|--------|
| ct0 token  | `/base/apitools/getCt0`       | POST   |
| Tweet at   | `/base/apitools/createTweet`  | GET    |
| Yanit at   | `/base/apitools/tweetReply`   | GET    |

ct0 token her calistirmada dinamik olarak alinir.

### Retry Mekanizmasi

- Tweet/reply basarisiz olursa `MAX_TWEET_RETRIES` kez denenir
- Her deneme arasinda `TWEET_RETRY_DELAY_MS` beklenir
- API hatalari detayli loglanir (response.data, HTTP status)

### Duplicate Onleme

Her kesinti icin benzersiz bir ID olusturulur:

```
id = sha256(ilce + arizaTarihi + kesintiTuru + etkilenenYerler)
```

Bu sayede:
- Ayni ilcede farkli zamanlarda kesinti olabilir
- Ayni ilcede farkli mahallelerde kesinti olabilir
- Planli ve plansiz kesintiler ayri sayilir

### Dosya Yapisi

```
src/
├── index.ts      # Ana calisma dongusu
├── scraper.ts    # ASKİ sayfasini ceker ve parse eder
├── storage.ts    # JSON dosya yonetimi
├── twitter.ts    # RapidAPI ile Twitter entegrasyonu
└── types.ts      # TypeScript tanimlamalari

data/
└── kesintiler.json  # Bilinen kesintilerin listesi
```

## Lisans

MIT


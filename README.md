# ASKİ Su Kesintisi Twitter Botu

Ankara Su ve Kanalizasyon İdaresi (ASKİ) su kesintilerini otomatik olarak takip edip Twitter'da paylaşan bot.

## Ozellikler

- ASKİ web sitesinden su kesintilerini otomatik olarak ceker
- Yeni kesinti tespit edildiginde Twitter'da paylasir
- Duplicate tweetleri onler (ayni kesinti icin tekrar tweet atmaz)
- GitHub Actions ile 5 dakikada bir otomatik calisir

## Kurulum

### Gereksinimler

- Node.js 20+
- Twitter Developer hesabi ve API anahtarlari

### Yerel Kurulum

```bash
# Bagimliliklari yukle
npm install

# .env dosyasi olustur
cp .env.example .env

# .env dosyasini duzenle ve Twitter API anahtarlarini ekle
```

### Ortam Degiskenleri

| Degisken                       | Aciklama                  |
|--------------------------------|---------------------------|
| `TWITTER_API_KEY`              | Twitter API Key           |
| `TWITTER_API_SECRET`           | Twitter API Secret        |
| `TWITTER_ACCESS_TOKEN`         | Twitter Access Token      |
| `TWITTER_ACCESS_TOKEN_SECRET`  | Twitter Access Token Secret |
| `CHECK_INTERVAL_MS`            | Kontrol araligi (ms, varsayilan: 300000) |

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

Repository'yi GitHub'a push ettiginde otomatik olarak calisir.

### Secrets Ayarlari

Repository > Settings > Secrets and variables > Actions > New repository secret

- `TWITTER_API_KEY`
- `TWITTER_API_SECRET`
- `TWITTER_ACCESS_TOKEN`
- `TWITTER_ACCESS_TOKEN_SECRET`

### Manuel Tetikleme

Actions > ASKİ Su Kesintisi Kontrolu > Run workflow

## Tweet Formati

```
⚠️ YENİMAHALLE - Plansız Kesinti

📅 04.01.2026 11:10 - 23:55
📍 Demetevler, Demetlale, Demetgul...

#AnkaraSuKesintisi #ASKİ #Yenimahalle
```

## Teknik Detaylar

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
├── twitter.ts    # Twitter API entegrasyonu
└── types.ts      # TypeScript tanimlamalari

data/
└── kesintiler.json  # Bilinen kesintilerin listesi (gitignore)
```

## Lisans

MIT

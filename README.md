# ASKİ Su Kesintisi Twitter Botu

Ankara Su ve Kanalizasyon İdaresi (ASKİ) su kesintilerini otomatik olarak takip edip Twitter'da paylaşan bot.

## Özellikler

- ASKİ web sitesinden su kesintilerini otomatik olarak çeker
- Yeni kesinti tespit edildiğinde Twitter'da paylaşır
- Duplicate tweetleri önler (aynı kesinti için tekrar tweet atmaz)
- GitHub Actions ile 5 dakikada bir otomatik çalışır

## Kurulum

### Gereksinimler

- Node.js 20+
- Twitter Developer hesabı ve API anahtarları

### Yerel Kurulum

```bash
# Bağımlılıkları yükle
npm install

# .env dosyası oluştur
cp .env.example .env

# .env dosyasını düzenle ve Twitter API anahtarlarını ekle
```

### Ortam Değişkenleri

| Değişken                       | Açıklama                                   |
|--------------------------------|--------------------------------------------|
| `TWITTER_API_KEY`              | Twitter API Key                            |
| `TWITTER_API_SECRET`           | Twitter API Secret                         |
| `TWITTER_ACCESS_TOKEN`         | Twitter Access Token                       |
| `TWITTER_ACCESS_TOKEN_SECRET`  | Twitter Access Token Secret                |
| `CHECK_INTERVAL_MS`            | Kontrol aralığı (ms, varsayılan: 300000)   |

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

Repository'yi GitHub'a push ettiğinde otomatik olarak çalışır.

### Secrets Ayarları

Repository > Settings > Secrets and variables > Actions > New repository secret

- `TWITTER_API_KEY`
- `TWITTER_API_SECRET`
- `TWITTER_ACCESS_TOKEN`
- `TWITTER_ACCESS_TOKEN_SECRET`

### Manuel Tetikleme

Actions > ASKİ Su Kesintisi Kontrolü > Run workflow

## Tweet Formatı

Her kesinti için 2 tweet atılır:

### Ana Tweet
```
⚠️ YENİMAHALLE - Plansız Kesinti

📅 4.01.2026 11:10:00 - 4.01.2026 23:55:00
📍 Demetevler Mahallesi, Demetlale Mahallesi, Demetgül Mahallesi...

#AnkaraSuKesintisi #ASKİ #Yenimahalle
```

### Yanıt Tweet (Detay)
```
📋 Kesinti Açıklaması:

Devam eden kuraklık ve artan nüfus nedeniyle su kaynaklarımız 
üzerindeki yük artmıştır. Bu nedenle bazı bölgelerde zaman zaman 
basınç düşüklüğü ve su kesintileri yaşanabilmektedir...
```

Not: Twitter Premium hesap kullanıldığı için karakter limiti yoktur, metinler kısaltılmaz.

## Teknik Detaylar

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
├── twitter.ts    # Twitter API entegrasyonu
└── types.ts      # TypeScript tanımlamaları

data/
└── kesintiler.json  # Bilinen kesintilerin listesi
```

## Lisans

MIT

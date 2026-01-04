# Plan: ASKİ Su Kesintisi Twitter Botu

## Mimari

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Scraper       │────▶│   Karşılaştırma  │────▶│  Twitter API    │
│ (aski.gov.tr)   │     │   (JSON dosya)   │     │  (Tweet atma)   │
└─────────────────┘     └──────────────────┘     └─────────────────┘
        │                        │
        ▼                        ▼
   HTML Parse              kesintiler.json
   (Cheerio)               (Durum takibi)
```

## Bileşenler

| Dosya                  | Görev                                                   |
|------------------------|---------------------------------------------------------|
| `src/scraper.ts`       | ASKİ sayfasını çeker, kesintileri parse eder            |
| `src/twitter.ts`       | Twitter API v2 ile tweet atar                           |
| `src/storage.ts`       | Önceki kesintileri JSON'da saklar, yenileri tespit eder |
| `src/index.ts`         | Ana çalışma döngüsü (cron veya interval)                |
| `data/kesintiler.json` | Bilinen kesintilerin listesi                            |

## Veri Yapısı

```typescript
interface Kesinti {
  id: string;           // hash(ilce + arizaTarihi + kesintiTuru + etkilenenYerler)
  ilce: string;         // "YENİMAHALLE"
  kesintiTuru: string;  // "Planlı Kesinti" | "Plansız Kesinti"
  arizaTarihi: string;  // "4.01.2026 11:10:00"
  tamirTarihi: string;  // "4.01.2026 23:55:00"
  detay: string;
  etkilenenYerler: string;
}
```

## Duplicate Önleme Stratejisi

Her kesinti için benzersiz bir `id` oluşturulur:

```typescript
id = sha256(ilce + arizaTarihi + kesintiTuru + etkilenenYerler)
```

**Neden bu alanlar?**

| Alan              | Sebep                                            |
|-------------------|--------------------------------------------------|
| `ilce`            | Aynı anda farklı ilçelerde kesinti olabilir      |
| `arizaTarihi`     | Aynı ilçede farklı zamanlarda kesinti olabilir   |
| `kesintiTuru`     | Planlı ve plansız kesinti aynı anda olabilir     |
| `etkilenenYerler` | Aynı ilçede farklı mahallelerde kesinti olabilir |

**Dahil edilmeyen alanlar:**

| Alan          | Sebep                                              |
|---------------|----------------------------------------------------|
| `tamirTarihi` | Tamir süresi uzayabilir, kesinti aynı kalır        |
| `detay`       | Açıklama metni güncellenebilir, kesinti aynı kalır |

**Akış:**

1. Yeni kesintileri çek
2. Her biri için `id` hesapla
3. `kesintiler.json`'daki id'lerle karşılaştır
4. Eşleşmeyen id varsa → yeni kesinti → tweet at

## Tweet Formatı

```
⚠️ YENİMAHALLE - Plansız Kesinti

📅 04.01.2026 11:10 - 23:55
📍 Demetevler, Demetlale, Demetgül...

#AnkaraSuKesintisi #ASKİ #Yenimahalle
```

## Gerekli Paketler

- `node-fetch` veya `axios` - HTTP istekleri
- `cheerio` - HTML parse
- `twitter-api-v2` - Twitter API
- `node-cron` - Zamanlayıcı (opsiyonel)
- `dotenv` - Ortam değişkenleri

## Çalışma Akışı

1. Her 5-10 dakikada bir ASKİ sayfasını çek
2. Kesintileri parse et
3. `kesintiler.json` ile karşılaştır
4. Yeni kesinti varsa tweet at ve JSON'u güncelle

## Twitter API Gereksinimleri

- Twitter Developer hesabı
- API Key, API Secret, Access Token, Access Token Secret
- `.env` dosyasında saklanacak

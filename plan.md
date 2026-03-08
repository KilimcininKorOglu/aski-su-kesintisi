# Plan: ASKİ Water Outage Twitter Bot

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Scraper       │────▶│   Comparison     │────▶│  Twitter API    │
│ (aski.gov.tr)   │     │   (JSON file)    │     │  (RapidAPI)     │
└─────────────────┘     └──────────────────┘     └─────────────────┘
        │                        │                        │
        ▼                        ▼                        ▼
   HTML Parse              kesintiler.json           Gemini API
   (Cheerio)               (State tracking)       (Tweet shortening)
```

## Components

| File                   | Purpose                                           |
|------------------------|---------------------------------------------------|
| `src/scraper.ts`       | Fetches ASKİ page, parses outages                 |
| `src/twitter.ts`       | Posts tweets via RapidAPI, retry mechanism        |
| `src/storage.ts`       | Stores previous outages in JSON, detects new ones |
| `src/gemini.ts`        | Shortens tweets exceeding 280 chars via Gemini    |
| `src/logger.ts`        | File + console logging, 7-day retention           |
| `src/types.ts`         | Kesinti interface, sha256 ID generator            |
| `src/index.ts`         | Main loop, CLI flags (--once, --dry)              |
| `data/kesintiler.json` | List of known outages                             |
| `data/run.log`         | Run logs                                          |

## Data Structure

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

## Duplicate Prevention Strategy

A unique `id` is generated for each outage:

```typescript
id = sha256(ilce + arizaTarihi + kesintiTuru + etkilenenYerler)
```

**Why these fields?**

| Field             | Reason                                             |
|-------------------|----------------------------------------------------|
| `ilce`            | Multiple districts can have outages simultaneously |
| `arizaTarihi`     | Same district can have outages at different times  |
| `kesintiTuru`     | Planned and unplanned outages can occur together   |
| `etkilenenYerler` | Same district can have outages in different areas  |

**Excluded fields:**

| Field         | Reason                                          |
|---------------|-------------------------------------------------|
| `tamirTarihi` | Repair time may extend, outage remains the same |
| `detay`       | Description may be updated, outage remains same |

**Flow:**

1. Fetch new outages
2. Calculate `id` for each
3. Compare with ids in `kesintiler.json`
4. If no match → new outage → post tweet
5. Only successfully tweeted outages are saved

## Tweet Format

```
⚠️ YENİMAHALLE - Plansız Kesinti

📅 04.01.2026 11:10 - 23:55
📍 Demetevler, Demetlale, Demetgül...

#AnkaraSuKesintisi #ASKİ #Yenimahalle
```

Planned outages use 🔧 instead of ⚠️.

## Dependencies

- `axios` - HTTP requests (ASKİ scraping + RapidAPI)
- `cheerio` - HTML parsing
- `@google/generative-ai` - Tweet shortening via Gemini
- `dotenv` - Environment variables

## Workflow

1. Runs every 9 minutes via GitHub Actions (`*/9 * * * *`)
2. Fetch and parse outages from ASKİ page
3. Compare with `kesintiler.json`
4. If new outage found:
   - Shorten via Gemini if tweet exceeds 280 chars
   - Post tweet via RapidAPI
   - Save to `kesintiler.json` if successful
5. `[skip ci]` prevents infinite loop

## Twitter API (RapidAPI)

Uses `twitter-api-v1-1-enterprise` via RapidAPI.

| Operation | Endpoint                     | Method |
|-----------|------------------------------|--------|
| ct0 token | `/base/apitools/getCt0`      | POST   |
| Tweet     | `/base/apitools/createTweet` | GET    |
| Reply     | `/base/apitools/tweetReply`  | GET    |

- ct0 token is fetched dynamically on each run
- Failed tweets retry up to MAX_TWEET_RETRIES (100) times
- TWEET_RETRY_DELAY_MS (5000ms) wait between retries

## Environment Variables

| Variable             | Required | Default |
|----------------------|----------|---------|
| `RAPIDAPI_KEY`       | Yes      | -       |
| `TWITTER_AUTH_TOKEN` | Yes      | -       |
| `TWITTER_API_KEY`    | Yes      | -       |
| `GEMINI_API_KEY`     | No       | -       |
| `MAX_TWEET_RETRIES`  | No       | 100     |
| `TWEET_MAX_LENGTH`   | No       | 280     |

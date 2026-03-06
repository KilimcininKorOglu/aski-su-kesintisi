import { GoogleGenerativeAI } from '@google/generative-ai';
import { log, warn, error as logError } from './logger';

let genAI: GoogleGenerativeAI | null = null;
let model: any = null;

const TWEET_MAX_LENGTH = parseInt(process.env.TWEET_MAX_LENGTH || '280', 10);
const GEMINI_RATE_LIMIT_DELAY = parseInt(process.env.GEMINI_RATE_LIMIT_DELAY || '4000', 10);
const MAX_GEMINI_RETRIES = 10;

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function initGeminiClient(): boolean {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    warn('GEMINI_API_KEY eksik. Tweet kısaltma devre dışı.');
    return false;
  }

  genAI = new GoogleGenerativeAI(apiKey);
  model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
  log('Gemini API başarıyla yapılandırıldı.');
  return true;
}

export interface TweetData {
  emoji: string;
  ilce: string;
  kesintiTuru: string;
  tarih: string;
  etkilenenYerler: string;
  hashtags: string;
}

function formatTweetFromData(data: TweetData): string {
  return `${data.emoji} ${data.ilce} - ${data.kesintiTuru}

📅 ${data.tarih}
📍 ${data.etkilenenYerler}

${data.hashtags}`;
}

export async function shortenPlaces(etkilenenYerler: string, maxLength: number): Promise<string> {
  if (!model) {
    return etkilenenYerler.substring(0, maxLength);
  }

  const prompt = `Bu mahalle/bölge listesini ${maxLength} karakter veya daha az olacak şekilde kısalt.
Kurallar:
- Sadece 2-3 önemli mahalle yaz
- Sonuna "vb." ekle
- Yanıt olarak SADECE kısaltılmış listeyi ver, başka açıklama ekleme

Liste:
${etkilenenYerler}`;

  for (let attempt = 0; attempt < MAX_GEMINI_RETRIES; attempt++) {
    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const shortened = response.text().trim();
      await delay(GEMINI_RATE_LIMIT_DELAY);
      return shortened || etkilenenYerler;
    } catch (err: any) {
      const retryAfter = err?.errorDetails?.find((d: any) => d['@type']?.includes('RetryInfo'))?.retryDelay;
      const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : GEMINI_RATE_LIMIT_DELAY * 3;
      if (err?.status === 429) {
        warn(`Gemini rate limit. ${waitTime / 1000} saniye bekleniyor...`);
      } else if (err?.status === 503) {
        warn(`Gemini overload. ${waitTime / 1000} saniye bekleniyor...`);
      } else {
        logError(`Gemini API hatası. ${waitTime / 1000} saniye bekleniyor...`, err);
      }
      await delay(waitTime);
    }
  }

  warn(`Gemini ${MAX_GEMINI_RETRIES} denemede başarısız oldu. Orijinal metin kullanılıyor.`);
  return etkilenenYerler;
}

export async function shortenTweet(text: string, type: 'main' | 'reply', tweetData?: TweetData): Promise<string> {
  if (text.length <= TWEET_MAX_LENGTH) {
    return text;
  }

  if (!model) {
    warn(`Tweet ${text.length} karakter ama Gemini API yok. Kısaltılamadı.`);
    return text;
  }

  // Ana tweet için: şablonu koruyarak sadece etkilenen yerleri kısalt
  if (type === 'main' && tweetData) {
    const baseLength = `${tweetData.emoji} ${tweetData.ilce} - ${tweetData.kesintiTuru}\n\n📅 ${tweetData.tarih}\n📍 \n\n${tweetData.hashtags}`.length;
    const maxPlacesLength = TWEET_MAX_LENGTH - baseLength - 5; // 5 karakter buffer
    
    if (maxPlacesLength > 20) {
      const shortenedPlaces = await shortenPlaces(tweetData.etkilenenYerler, maxPlacesLength);
      const newTweet = formatTweetFromData({
        ...tweetData,
        etkilenenYerler: shortenedPlaces
      });
      
      if (newTweet.length <= TWEET_MAX_LENGTH) {
        log(`Tweet kısaltıldı: ${text.length} -> ${newTweet.length} karakter`);
        return newTweet;
      }
    }
  }

  // Reply veya main başarısız olduysa eski yöntem
  const prompt = type === 'main'
    ? `Bu su kesintisi duyurusunu MUTLAKA ${TWEET_MAX_LENGTH} karakter veya daha az olacak şekilde kısalt.
Kurallar:
- Formatı AYNEN koru (satır sonları dahil)
- Emoji'leri koru (⚠️, 🔧, 📅, 📍)
- Hashtag'leri koru
- Tarih bilgisini koru
- İlçe adını koru
- Sadece mahalle listesini kısalt, 2-3 mahalle yaz ve "vb." ekle
- Yanıt olarak SADECE kısaltılmış tweet metnini ver

Tweet:
${text}`
    : `Bu kesinti açıklamasını MUTLAKA ${TWEET_MAX_LENGTH} karakter veya daha az olacak şekilde kısalt.
Kurallar:
- "📋 Kesinti Açıklaması:" başlığını koru
- Ana mesajı özetle
- Gereksiz cümleleri çıkar
- Yanıt olarak SADECE kısaltılmış metni ver

Metin:
${text}`;

  for (let attempt = 0; attempt < MAX_GEMINI_RETRIES; attempt++) {
    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const shortened = response.text().trim();

      if (shortened.length > 0 && shortened.length <= TWEET_MAX_LENGTH) {
        log(`Tweet kısaltıldı: ${text.length} -> ${shortened.length} karakter`);
        await delay(GEMINI_RATE_LIMIT_DELAY);
        return shortened;
      } else if (shortened.length > TWEET_MAX_LENGTH) {
        warn(`Gemini kısaltması hala uzun: ${shortened.length} karakter. Tekrar deneniyor...`);
        await delay(GEMINI_RATE_LIMIT_DELAY);
      } else {
        warn('Gemini boş yanıt döndü. Tekrar deneniyor...');
        await delay(GEMINI_RATE_LIMIT_DELAY);
      }
    } catch (err: any) {
      const retryAfter = err?.errorDetails?.find((d: any) => d['@type']?.includes('RetryInfo'))?.retryDelay;
      const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : GEMINI_RATE_LIMIT_DELAY * 3;
      if (err?.status === 429) {
        warn(`Gemini rate limit. ${waitTime / 1000} saniye bekleniyor...`);
      } else if (err?.status === 503) {
        warn(`Gemini overload. ${waitTime / 1000} saniye bekleniyor...`);
      } else {
        logError(`Gemini API hatası. ${waitTime / 1000} saniye bekleniyor...`, err);
      }
      await delay(waitTime);
    }
  }

  warn(`Gemini ${MAX_GEMINI_RETRIES} denemede tweet kısaltamadı. Orijinal metin kullanılıyor.`);
  return text;
}

export function getTweetMaxLength(): number {
  return TWEET_MAX_LENGTH;
}

import { GoogleGenerativeAI } from '@google/generative-ai';

let genAI: GoogleGenerativeAI | null = null;
let model: any = null;

const TWEET_MAX_LENGTH = parseInt(process.env.TWEET_MAX_LENGTH || '280', 10);
const GEMINI_RATE_LIMIT_DELAY = parseInt(process.env.GEMINI_RATE_LIMIT_DELAY || '6000', 10);

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function initGeminiClient(): boolean {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.warn('GEMINI_API_KEY eksik. Tweet kısaltma devre dışı.');
    return false;
  }

  genAI = new GoogleGenerativeAI(apiKey);
  model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  console.log('Gemini API başarıyla yapılandırıldı.');
  return true;
}

export async function shortenTweet(text: string, type: 'main' | 'reply'): Promise<string> {
  if (text.length <= TWEET_MAX_LENGTH) {
    return text;
  }

  if (!model) {
    console.warn(`Tweet ${text.length} karakter ama Gemini API yok. Kısaltılamadı.`);
    return text;
  }

  const maxRetries = 3;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const prompt = type === 'main'
      ? `Bu su kesintisi duyurusunu MUTLAKA ${TWEET_MAX_LENGTH} karakter veya daha az olacak şekilde kısalt.
Kurallar:
- Emoji'leri koru (⚠️, 🔧, 📅, 📍)
- Hashtag'leri koru (#AnkaraSuKesintisi, #ASKİ, #İlçeAdı)
- Tarih bilgisini koru
- İlçe adını koru
- Mahalle listesini agresif şekilde kısalt, sadece 2-3 mahalle yaz ve "vb." ekle
- Yanıt olarak SADECE kısaltılmış tweet metnini ver, başka açıklama ekleme
- KARAKTER LİMİTİ: ${TWEET_MAX_LENGTH}

Tweet (${text.length} karakter):
${text}`
      : `Bu kesinti açıklamasını MUTLAKA ${TWEET_MAX_LENGTH} karakter veya daha az olacak şekilde kısalt.
Kurallar:
- "📋 Kesinti Açıklaması:" başlığını koru
- Ana mesajı özetle
- Gereksiz cümleleri çıkar
- Yanıt olarak SADECE kısaltılmış metni ver, başka açıklama ekleme
- KARAKTER LİMİTİ: ${TWEET_MAX_LENGTH}

Metin (${text.length} karakter):
${text}`;

    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const shortened = response.text().trim();

      if (shortened.length > 0 && shortened.length <= TWEET_MAX_LENGTH) {
        console.log(`Tweet kısaltıldı: ${text.length} -> ${shortened.length} karakter`);
        // Rate limit için bekle
        await delay(GEMINI_RATE_LIMIT_DELAY);
        return shortened;
      } else if (shortened.length > TWEET_MAX_LENGTH) {
        console.warn(`Gemini kısaltması hala uzun (deneme ${attempt}/${maxRetries}): ${shortened.length} karakter`);
        // Rate limit için bekle
        await delay(GEMINI_RATE_LIMIT_DELAY);
        if (attempt === maxRetries) {
          // Son deneme de başarısız, manuel kısalt
          const truncated = shortened.substring(0, TWEET_MAX_LENGTH - 3) + '...';
          console.log(`Manuel kısaltma yapıldı: ${truncated.length} karakter`);
          return truncated;
        }
      } else {
        console.warn('Gemini boş yanıt döndü. Orijinal kullanılıyor.');
        return text;
      }
    } catch (error: any) {
      // Rate limit hatası mı kontrol et
      if (error?.status === 429) {
        const retryAfter = error?.errorDetails?.find((d: any) => d['@type']?.includes('RetryInfo'))?.retryDelay;
        const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : GEMINI_RATE_LIMIT_DELAY * 2;
        console.warn(`Gemini rate limit aşıldı. ${waitTime / 1000} saniye bekleniyor...`);
        await delay(waitTime);
        // Retry etmek için continue
        continue;
      }
      console.error('Gemini API hatası:', error);
      return text;
    }
  }

  return text;
}

export function getTweetMaxLength(): number {
  return TWEET_MAX_LENGTH;
}

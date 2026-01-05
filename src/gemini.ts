import { GoogleGenerativeAI } from '@google/generative-ai';

let genAI: GoogleGenerativeAI | null = null;
let model: any = null;

const TWEET_MAX_LENGTH = parseInt(process.env.TWEET_MAX_LENGTH || '280', 10);

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
        return shortened;
      } else if (shortened.length > TWEET_MAX_LENGTH) {
        console.warn(`Gemini kısaltması hala uzun (deneme ${attempt}/${maxRetries}): ${shortened.length} karakter`);
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
    } catch (error) {
      console.error('Gemini API hatası:', error);
      return text;
    }
  }

  return text;
}

export function getTweetMaxLength(): number {
  return TWEET_MAX_LENGTH;
}

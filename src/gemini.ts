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
  model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
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

  const prompt = type === 'main'
    ? `Bu su kesintisi duyurusunu maksimum ${TWEET_MAX_LENGTH} karaktere kısalt. 
Kurallar:
- Emoji'leri koru (⚠️, 🔧, 📅, 📍)
- Hashtag'leri koru (#AnkaraSuKesintisi, #ASKİ, #İlçeAdı)
- Tarih bilgisini koru
- İlçe adını koru
- Sadece mahalle listesini kısalt, "ve diğer mahalleler" gibi ifadeler kullan
- Yanıt olarak SADECE kısaltılmış tweet metnini ver, başka açıklama ekleme

Tweet:
${text}`
    : `Bu kesinti açıklamasını maksimum ${TWEET_MAX_LENGTH} karaktere kısalt.
Kurallar:
- "📋 Kesinti Açıklaması:" başlığını koru
- Ana mesajı koru
- Gereksiz cümleleri çıkar
- Yanıt olarak SADECE kısaltılmış metni ver, başka açıklama ekleme

Metin:
${text}`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const shortened = response.text().trim();

    if (shortened.length > 0 && shortened.length <= TWEET_MAX_LENGTH) {
      console.log(`Tweet kısaltıldı: ${text.length} -> ${shortened.length} karakter`);
      return shortened;
    } else if (shortened.length > TWEET_MAX_LENGTH) {
      console.warn(`Gemini kısaltması hala uzun: ${shortened.length} karakter. Orijinal kullanılıyor.`);
      return text;
    } else {
      console.warn('Gemini boş yanıt döndü. Orijinal kullanılıyor.');
      return text;
    }
  } catch (error) {
    console.error('Gemini API hatası:', error);
    return text;
  }
}

export function getTweetMaxLength(): number {
  return TWEET_MAX_LENGTH;
}

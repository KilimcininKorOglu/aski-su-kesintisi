import { TwitterApi } from 'twitter-api-v2';
import { Kesinti } from './types';

let twitterClient: TwitterApi | null = null;

export function initTwitterClient(): TwitterApi | null {
  const apiKey = process.env.TWITTER_API_KEY;
  const apiSecret = process.env.TWITTER_API_SECRET;
  const accessToken = process.env.TWITTER_ACCESS_TOKEN;
  const accessTokenSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET;

  if (!apiKey || !apiSecret || !accessToken || !accessTokenSecret) {
    console.warn('Twitter API anahtarlari eksik. Tweet atilmayacak.');
    return null;
  }

  twitterClient = new TwitterApi({
    appKey: apiKey,
    appSecret: apiSecret,
    accessToken: accessToken,
    accessSecret: accessTokenSecret,
  });

  return twitterClient;
}

export function formatTweet(kesinti: Kesinti): string {
  const emoji = kesinti.kesintiTuru === 'Planlı Kesinti' ? '🔧' : '⚠️';
  
  // Tarihleri düzenle
  const arizaSaat = kesinti.arizaTarihi.split(' ')[1]?.substring(0, 5) || '';
  const tamirSaat = kesinti.tamirTarihi.split(' ')[1]?.substring(0, 5) || '';
  const tarih = kesinti.arizaTarihi.split(' ')[0] || '';
  
  // Etkilenen yerleri kısalt (Twitter karakter limiti)
  let yerler = kesinti.etkilenenYerler;
  if (yerler.length > 150) {
    yerler = yerler.substring(0, 147) + '...';
  }
  
  // Hashtag için ilçe adını düzenle
  const ilceHashtag = kesinti.ilce
    .replace(/İ/g, 'i')
    .replace(/Ğ/g, 'g')
    .replace(/Ü/g, 'u')
    .replace(/Ş/g, 's')
    .replace(/Ö/g, 'o')
    .replace(/Ç/g, 'c')
    .toLowerCase()
    .replace(/^./, c => c.toUpperCase());

  const tweet = `${emoji} ${kesinti.ilce} - ${kesinti.kesintiTuru}

📅 ${tarih} ${arizaSaat} - ${tamirSaat}
📍 ${yerler}

#AnkaraSuKesintisi #ASKİ #${ilceHashtag}`;

  // Twitter 280 karakter limiti
  if (tweet.length > 280) {
    const fazla = tweet.length - 280;
    const kisaYerler = yerler.substring(0, yerler.length - fazla - 3) + '...';
    return `${emoji} ${kesinti.ilce} - ${kesinti.kesintiTuru}

📅 ${tarih} ${arizaSaat} - ${tamirSaat}
📍 ${kisaYerler}

#AnkaraSuKesintisi #ASKİ #${ilceHashtag}`;
  }

  return tweet;
}

export async function postTweet(kesinti: Kesinti): Promise<boolean> {
  if (!twitterClient) {
    console.log('[DRY RUN] Tweet atilacakti:');
    console.log(formatTweet(kesinti));
    console.log('---');
    return false;
  }

  try {
    const tweet = formatTweet(kesinti);
    await twitterClient.v2.tweet(tweet);
    console.log(`Tweet atildi: ${kesinti.ilce} - ${kesinti.kesintiTuru}`);
    return true;
  } catch (error) {
    console.error('Tweet atilamadi:', error);
    return false;
  }
}

export async function postMultipleTweets(kesintiler: Kesinti[]): Promise<number> {
  let successCount = 0;
  
  for (const kesinti of kesintiler) {
    const success = await postTweet(kesinti);
    if (success) successCount++;
    
    // Rate limit için bekle
    if (twitterClient) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  return successCount;
}

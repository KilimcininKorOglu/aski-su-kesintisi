import axios from 'axios';
import { Kesinti } from './types';
import { shortenTweet, TweetData } from './gemini';

interface TwitterConfig {
  rapidApiKey: string;
  rapidApiHost: string;
  authToken: string;
  apiKey: string;
  ct0: string | null;
}

let twitterConfig: TwitterConfig | null = null;

async function getCt0Token(): Promise<string | null> {
  if (!twitterConfig) return null;

  const params = new URLSearchParams({
    auth_token: twitterConfig.authToken,
    apiKey: twitterConfig.apiKey,
    resFormat: 'json'
  });

  try {
    const response = await axios.post(
      `https://${twitterConfig.rapidApiHost}/base/apitools/getCt0?${params.toString()}`,
      {},
      {
        headers: {
          'x-rapidapi-key': twitterConfig.rapidApiKey,
          'x-rapidapi-host': twitterConfig.rapidApiHost,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    if (response.data.code === 1 && response.data.msg === 'SUCCESS') {
      return response.data.data;
    } else {
      console.error('ct0 token alınamadı:', response.data.msg);
      return null;
    }
  } catch (error) {
    console.error('getCt0 API hatası:', error);
    return null;
  }
}

export async function initTwitterClient(): Promise<boolean> {
  const rapidApiKey = process.env.RAPIDAPI_KEY;
  const rapidApiHost = process.env.RAPIDAPI_HOST || 'twitter-api-v1-1-enterprise.p.rapidapi.com';
  const authToken = process.env.TWITTER_AUTH_TOKEN;
  const apiKey = process.env.TWITTER_API_KEY;

  if (!rapidApiKey || !authToken || !apiKey) {
    console.warn('Twitter API anahtarları eksik. Tweet atılmayacak.');
    return false;
  }

  twitterConfig = {
    rapidApiKey,
    rapidApiHost,
    authToken,
    apiKey,
    ct0: null
  };

  // ct0 token'ı dinamik olarak al
  const ct0 = await getCt0Token();
  if (!ct0) {
    console.error('ct0 token alınamadı. Tweet atılmayacak.');
    twitterConfig = null;
    return false;
  }

  twitterConfig.ct0 = ct0;
  console.log('Twitter API başarıyla yapılandırıldı.');
  return true;
}

function formatIlceHashtag(ilce: string): string {
  return ilce
    .replace(/İ/g, 'i')
    .replace(/Ğ/g, 'g')
    .replace(/Ü/g, 'u')
    .replace(/Ş/g, 's')
    .replace(/Ö/g, 'o')
    .replace(/Ç/g, 'c')
    .toLowerCase()
    .replace(/ı/g, 'i')
    .replace(/^./, c => c.toUpperCase());
}

export function formatMainTweet(kesinti: Kesinti): string {
  const emoji = kesinti.kesintiTuru === 'Planlı Kesinti' ? '🔧' : '⚠️';
  const ilceHashtag = formatIlceHashtag(kesinti.ilce);

  return `${emoji} ${kesinti.ilce} - ${kesinti.kesintiTuru}

📅 ${kesinti.arizaTarihi} - ${kesinti.tamirTarihi}
📍 ${kesinti.etkilenenYerler}

#AnkaraSuKesintisi #ASKİ #${ilceHashtag}`;
}

export function getTweetData(kesinti: Kesinti): TweetData {
  const emoji = kesinti.kesintiTuru === 'Planlı Kesinti' ? '🔧' : '⚠️';
  const ilceHashtag = formatIlceHashtag(kesinti.ilce);

  return {
    emoji,
    ilce: kesinti.ilce,
    kesintiTuru: kesinti.kesintiTuru,
    tarih: `${kesinti.arizaTarihi} - ${kesinti.tamirTarihi}`,
    etkilenenYerler: kesinti.etkilenenYerler,
    hashtags: `#AnkaraSuKesintisi #ASKİ #${ilceHashtag}`
  };
}

export function formatReplyTweet(kesinti: Kesinti): string {
  return `📋 Kesinti Açıklaması:

${kesinti.detay}`;
}

export function formatTweet(kesinti: Kesinti): string {
  return formatMainTweet(kesinti);
}

const MAX_RETRIES = parseInt(process.env.MAX_TWEET_RETRIES || '100', 10);
const RETRY_DELAY_MS = parseInt(process.env.TWEET_RETRY_DELAY_MS || '5000', 10);

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function createTweet(text: string): Promise<string | null> {
  if (!twitterConfig || !twitterConfig.ct0) return null;

  const params = new URLSearchParams({
    auth_token: twitterConfig.authToken,
    ct0: twitterConfig.ct0,
    apiKey: twitterConfig.apiKey,
    resFormat: 'json',
    medias: '[]',
    text: text
  });

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await axios.get(
        `https://${twitterConfig.rapidApiHost}/base/apitools/createTweet?${params.toString()}`,
        {
          headers: {
            'x-rapidapi-key': twitterConfig.rapidApiKey,
            'x-rapidapi-host': twitterConfig.rapidApiHost
          },
          timeout: 30000
        }
      );

      if (response.data.code === 1 && response.data.msg === 'SUCCESS') {
        const tweetId = response.data.data?.data?.create_tweet?.tweet_results?.result?.rest_id;
        if (tweetId) {
          return tweetId;
        } else {
          console.error(`Tweet ID alınamadı (deneme ${attempt}/${MAX_RETRIES})`);
          console.error('API yanıtı:', JSON.stringify(response.data, null, 2));
          if (attempt < MAX_RETRIES) {
            console.log(`${RETRY_DELAY_MS / 1000} saniye sonra tekrar denenecek...`);
            await delay(RETRY_DELAY_MS);
          }
        }
      } else {
        console.error(`Tweet oluşturulamadı (deneme ${attempt}/${MAX_RETRIES})`);
        console.error('API yanıtı:', JSON.stringify(response.data, null, 2));
        if (attempt < MAX_RETRIES) {
          console.log(`${RETRY_DELAY_MS / 1000} saniye sonra tekrar denenecek...`);
          await delay(RETRY_DELAY_MS);
        }
      }
    } catch (error: any) {
      console.error(`Tweet API hatası (deneme ${attempt}/${MAX_RETRIES})`);
      if (error.response) {
        console.error('API hata yanıtı:', JSON.stringify(error.response.data, null, 2));
        console.error('HTTP status:', error.response.status);
      } else {
        console.error('Hata:', error.message);
      }
      if (attempt < MAX_RETRIES) {
        console.log(`${RETRY_DELAY_MS / 1000} saniye sonra tekrar denenecek...`);
        await delay(RETRY_DELAY_MS);
      }
    }
  }

  return null;
}

async function replyToTweet(text: string, tweetId: string): Promise<boolean> {
  if (!twitterConfig || !twitterConfig.ct0) return false;

  const params = new URLSearchParams({
    auth_token: twitterConfig.authToken,
    ct0: twitterConfig.ct0,
    apiKey: twitterConfig.apiKey,
    resFormat: 'json',
    medias: '[]',
    text: text,
    tweetId: tweetId
  });

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await axios.get(
        `https://${twitterConfig.rapidApiHost}/base/apitools/tweetReply?${params.toString()}`,
        {
          headers: {
            'x-rapidapi-key': twitterConfig.rapidApiKey,
            'x-rapidapi-host': twitterConfig.rapidApiHost
          },
          timeout: 30000
        }
      );

      if (response.data.code === 1 && response.data.msg === 'SUCCESS') {
        return true;
      } else {
        console.error(`Yanıt tweet oluşturulamadı (deneme ${attempt}/${MAX_RETRIES})`);
        console.error('API yanıtı:', JSON.stringify(response.data, null, 2));
        if (attempt < MAX_RETRIES) {
          console.log(`${RETRY_DELAY_MS / 1000} saniye sonra tekrar denenecek...`);
          await delay(RETRY_DELAY_MS);
        }
      }
    } catch (error: any) {
      console.error(`Reply API hatası (deneme ${attempt}/${MAX_RETRIES})`);
      if (error.response) {
        console.error('API hata yanıtı:', JSON.stringify(error.response.data, null, 2));
        console.error('HTTP status:', error.response.status);
      } else {
        console.error('Hata:', error.message);
      }
      if (attempt < MAX_RETRIES) {
        console.log(`${RETRY_DELAY_MS / 1000} saniye sonra tekrar denenecek...`);
        await delay(RETRY_DELAY_MS);
      }
    }
  }

  return false;
}

export async function postTweet(kesinti: Kesinti): Promise<boolean> {
  let mainTweet = formatMainTweet(kesinti);
  const tweetData = getTweetData(kesinti);
  // let replyTweet = formatReplyTweet(kesinti);
  
  // Gerekirse tweet'leri kısalt (tweetData ile format korunur)
  mainTweet = await shortenTweet(mainTweet, 'main', tweetData);
  // replyTweet = await shortenTweet(replyTweet, 'reply');
  
  if (!twitterConfig) {
    console.log('[DRY RUN] Ana tweet:');
    console.log(mainTweet);
    console.log(`(${mainTweet.length} karakter)`);
    // console.log('\n[DRY RUN] Yanıt tweet:');
    // console.log(replyTweet);
    // console.log(`(${replyTweet.length} karakter)`);
    console.log('---');
    return false;
  }

  try {
    // Ana tweet'i at
    const tweetId = await createTweet(mainTweet);
    if (!tweetId) {
      console.error(`Ana tweet atılamadı: ${kesinti.ilce} - ${kesinti.kesintiTuru}`);
      console.error(`Tweet içeriği (${mainTweet.length} karakter):\n${mainTweet}`);
      return false;
    }
    console.log(`Ana tweet atıldı: ${kesinti.ilce} - ${kesinti.kesintiTuru} (ID: ${tweetId})`);
    
    // Yanıt tweet şimdilik devre dışı
    // const replyTweet = formatReplyTweet(kesinti);
    // const shortenedReply = await shortenTweet(replyTweet, 'reply');
    // const replySuccess = await replyToTweet(shortenedReply, tweetId);
    // if (replySuccess) {
    //   console.log(`Yanıt tweet atıldı: ${kesinti.ilce}`);
    // } else {
    //   console.warn(`Yanıt tweet atılamadı: ${kesinti.ilce}`);
    //   console.warn(`Reply içeriği (${shortenedReply.length} karakter):\n${shortenedReply}`);
    // }
    
    return true;
  } catch (error) {
    console.error('Tweet atılamadı:', error);
    return false;
  }
}

export async function postMultipleTweets(kesintiler: Kesinti[]): Promise<Kesinti[]> {
  const successfulKesintiler: Kesinti[] = [];
  
  for (const kesinti of kesintiler) {
    const success = await postTweet(kesinti);
    if (success) {
      successfulKesintiler.push(kesinti);
    }
    
    // Rate limit için bekle
    if (twitterConfig) {
      await delay(RETRY_DELAY_MS);
    }
  }
  
  return successfulKesintiler;
}

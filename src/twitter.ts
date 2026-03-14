import axios from 'axios';
import { Kesinti } from './types';
import { shortenTweet, TweetData } from './gemini';
import { log, warn, error as logError, success } from './logger';

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
      logError('ct0 token alınamadı:', response.data.msg);
      return null;
    }
  } catch (err) {
    logError('getCt0 API hatası:', err);
    return null;
  }
}

export async function initTwitterClient(): Promise<boolean> {
  const rapidApiKey = process.env.RAPIDAPI_KEY;
  const rapidApiHost = process.env.RAPIDAPI_HOST || 'twitter-api-v1-1-enterprise.p.rapidapi.com';
  const authToken = process.env.TWITTER_AUTH_TOKEN;
  const apiKey = process.env.TWITTER_API_KEY;

  if (!rapidApiKey || !authToken || !apiKey) {
    warn('Twitter API anahtarları eksik. Tweet atılmayacak.');
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
    logError('ct0 token alınamadı. Tweet atılmayacak.');
    twitterConfig = null;
    return false;
  }

  twitterConfig.ct0 = ct0;
  log('Twitter API başarıyla yapılandırıldı.');
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

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    if (attempt % 10 === 0 && attempt > 0) {
      log('ct0 token yenileniyor...');
      const newCt0 = await getCt0Token();
      if (newCt0) twitterConfig.ct0 = newCt0;
    }

    const params = new URLSearchParams({
      auth_token: twitterConfig.authToken,
      ct0: twitterConfig.ct0!,
      apiKey: twitterConfig.apiKey,
      resFormat: 'json',
      medias: '[]',
      text: text
    });

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
          logError(`Tweet ID alınamadı (deneme ${attempt}/${MAX_RETRIES})`);
          log('API yanıtı: ' + JSON.stringify(response.data, null, 2));
          if (attempt < MAX_RETRIES) {
            log(`${RETRY_DELAY_MS / 1000} saniye sonra tekrar denenecek...`);
            await delay(RETRY_DELAY_MS);
          }
        }
      } else {
        logError(`Tweet oluşturulamadı (deneme ${attempt}/${MAX_RETRIES})`);
        log('API yanıtı: ' + JSON.stringify(response.data, null, 2));
        if (attempt < MAX_RETRIES) {
          log(`${RETRY_DELAY_MS / 1000} saniye sonra tekrar denenecek...`);
          await delay(RETRY_DELAY_MS);
        }
      }
    } catch (err: any) {
      logError(`Tweet API hatası (deneme ${attempt}/${MAX_RETRIES})`);
      if (err.response) {
        log('API hata yanıtı: ' + JSON.stringify(err.response.data, null, 2));
        log('HTTP status: ' + err.response.status);
      } else {
        logError('Hata:', err.message);
      }
      if (attempt < MAX_RETRIES) {
        log(`${RETRY_DELAY_MS / 1000} saniye sonra tekrar denenecek...`);
        await delay(RETRY_DELAY_MS);
      }
    }
  }

  return null;
}

async function replyToTweet(text: string, tweetId: string): Promise<boolean> {
  if (!twitterConfig || !twitterConfig.ct0) return false;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    if (attempt % 10 === 0 && attempt > 0) {
      log('ct0 token yenileniyor...');
      const newCt0 = await getCt0Token();
      if (newCt0) twitterConfig.ct0 = newCt0;
    }

    const params = new URLSearchParams({
      auth_token: twitterConfig.authToken,
      ct0: twitterConfig.ct0!,
      apiKey: twitterConfig.apiKey,
      resFormat: 'json',
      medias: '[]',
      text: text,
      tweetId: tweetId
    });

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
        logError(`Yanıt tweet oluşturulamadı (deneme ${attempt}/${MAX_RETRIES})`);
        log('API yanıtı: ' + JSON.stringify(response.data, null, 2));
        if (attempt < MAX_RETRIES) {
          log(`${RETRY_DELAY_MS / 1000} saniye sonra tekrar denenecek...`);
          await delay(RETRY_DELAY_MS);
        }
      }
    } catch (err: any) {
      logError(`Reply API hatası (deneme ${attempt}/${MAX_RETRIES})`);
      if (err.response) {
        log('API hata yanıtı: ' + JSON.stringify(err.response.data, null, 2));
        log('HTTP status: ' + err.response.status);
      } else {
        logError('Hata:', err.message);
      }
      if (attempt < MAX_RETRIES) {
        log(`${RETRY_DELAY_MS / 1000} saniye sonra tekrar denenecek...`);
        await delay(RETRY_DELAY_MS);
      }
    }
  }

  return false;
}

export async function postTweet(kesinti: Kesinti, isDryRun: boolean = false): Promise<boolean> {
  let mainTweet = formatMainTweet(kesinti);

  if (!twitterConfig) {
    const label = isDryRun ? '[DRY RUN]' : '[TWITTER DEVRE DIŞI]';
    log(`${label} Ana tweet:`);
    log(mainTweet);
    log(`(${mainTweet.length} karakter)`);
    log('---');
    return false;
  }

  const tweetData = getTweetData(kesinti);
  mainTweet = await shortenTweet(mainTweet, 'main', tweetData);

  try {
    // Ana tweet'i at
    const tweetId = await createTweet(mainTweet);
    if (!tweetId) {
      logError(`Ana tweet atılamadı: ${kesinti.ilce} - ${kesinti.kesintiTuru}`);
      log(`Tweet içeriği (${mainTweet.length} karakter):\n${mainTweet}`);
      return false;
    }
    success(`Ana tweet atıldı: ${kesinti.ilce} - ${kesinti.kesintiTuru} (ID: ${tweetId})`);
    
    // Yanıt tweet şimdilik devre dışı
    // const replyTweet = formatReplyTweet(kesinti);
    // const shortenedReply = await shortenTweet(replyTweet, 'reply');
    // const replySuccess = await replyToTweet(shortenedReply, tweetId);
    // if (replySuccess) {
    //   success(`Yanıt tweet atıldı: ${kesinti.ilce}`);
    // } else {
    //   warn(`Yanıt tweet atılamadı: ${kesinti.ilce}`);
    //   log(`Reply içeriği (${shortenedReply.length} karakter):\n${shortenedReply}`);
    // }
    
    return true;
  } catch (err) {
    logError('Tweet atılamadı:', err);
    return false;
  }
}

export async function postMultipleTweets(kesintiler: Kesinti[], isDryRun: boolean = false): Promise<Kesinti[]> {
  const successfulKesintiler: Kesinti[] = [];

  for (const kesinti of kesintiler) {
    const success = await postTweet(kesinti, isDryRun);
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

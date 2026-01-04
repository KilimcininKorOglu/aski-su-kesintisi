import { TwitterApi } from 'twitter-api-v2';
import { Kesinti } from './types';

let twitterClient: TwitterApi | null = null;

export function initTwitterClient(): TwitterApi | null {
  const apiKey = process.env.TWITTER_API_KEY;
  const apiSecret = process.env.TWITTER_API_SECRET;
  const accessToken = process.env.TWITTER_ACCESS_TOKEN;
  const accessTokenSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET;

  if (!apiKey || !apiSecret || !accessToken || !accessTokenSecret) {
    console.warn('Twitter API anahtarları eksik. Tweet atılmayacak.');
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

function formatIlceHashtag(ilce: string): string {
  return ilce
    .replace(/İ/g, 'i')
    .replace(/Ğ/g, 'g')
    .replace(/Ü/g, 'u')
    .replace(/Ş/g, 's')
    .replace(/Ö/g, 'o')
    .replace(/Ç/g, 'c')
    .toLowerCase()
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

export function formatReplyTweet(kesinti: Kesinti): string {
  return `📋 Kesinti Açıklaması:

${kesinti.detay}`;
}

export function formatTweet(kesinti: Kesinti): string {
  return formatMainTweet(kesinti);
}

export async function postTweet(kesinti: Kesinti): Promise<boolean> {
  const mainTweet = formatMainTweet(kesinti);
  const replyTweet = formatReplyTweet(kesinti);
  
  if (!twitterClient) {
    console.log('[DRY RUN] Ana tweet:');
    console.log(mainTweet);
    console.log('\n[DRY RUN] Yanıt tweet:');
    console.log(replyTweet);
    console.log('---');
    return false;
  }

  try {
    // Ana tweet'i at
    const mainResult = await twitterClient.v2.tweet(mainTweet);
    const tweetId = mainResult.data.id;
    console.log(`Ana tweet atıldı: ${kesinti.ilce} - ${kesinti.kesintiTuru}`);
    
    // Yanıt olarak detay tweet'i at
    await twitterClient.v2.reply(replyTweet, tweetId);
    console.log(`Yanıt tweet atıldı: ${kesinti.ilce}`);
    
    return true;
  } catch (error) {
    console.error('Tweet atılamadı:', error);
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

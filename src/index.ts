import dotenv from 'dotenv';
dotenv.config();

import { fetchKesintiler } from './scraper';
import { loadKesintiler, saveKesintiler, findNewKesintiler, mergeKesintiler } from './storage';
import { initTwitterClient, postMultipleTweets } from './twitter';
import { initGeminiClient } from './gemini';

const CHECK_INTERVAL = parseInt(process.env.CHECK_INTERVAL_MS || '300000', 10); // 5 dakika

async function checkAndTweet(): Promise<void> {
  console.log(`[${new Date().toISOString()}] Kesintiler kontrol ediliyor...`);
  
  try {
    // Mevcut kesintileri çek
    const currentKesintiler = await fetchKesintiler();
    console.log(`${currentKesintiler.length} kesinti bulundu.`);
    
    // Kayıtlı kesintileri yükle
    const storedKesintiler = loadKesintiler();
    console.log(`${storedKesintiler.length} kayıtlı kesinti var.`);
    
    // Yeni kesintileri bul
    const newKesintiler = findNewKesintiler(currentKesintiler, storedKesintiler);
    
    if (newKesintiler.length > 0) {
      console.log(`${newKesintiler.length} yeni kesinti bulundu!`);
      
      // Tweet at ve başarılı olanları al
      const successfulKesintiler = await postMultipleTweets(newKesintiler);
      console.log(`${successfulKesintiler.length} tweet atıldı.`);
      
      // Sadece başarılı tweet atılan kesintileri kaydet
      if (successfulKesintiler.length > 0) {
        const merged = mergeKesintiler(successfulKesintiler, storedKesintiler);
        saveKesintiler(merged);
        console.log(`${successfulKesintiler.length} kesinti kaydedildi.`);
      } else {
        console.warn('Hiç tweet atılamadı, kesintiler kaydedilmedi.');
      }
    } else {
      console.log('Yeni kesinti yok.');
      // Yeni kesinti yoksa dosyayı değiştirme (gereksiz commit önlenir)
    }
  } catch (error) {
    console.error('Hata oluştu:', error);
  }
}

async function main(): Promise<void> {
  console.log('ASKİ Su Kesintisi Twitter Botu başlatılıyor...');
  
  // Gemini client'i başlat (opsiyonel)
  initGeminiClient();
  
  // Twitter client'i başlat
  await initTwitterClient();
  
  // İlk kontrol
  await checkAndTweet();
  
  // Periyodik kontrol
  console.log(`Her ${CHECK_INTERVAL / 1000} saniyede bir kontrol edilecek.`);
  setInterval(checkAndTweet, CHECK_INTERVAL);
}

// Dry run modu (tweet atmadan test)
const isDryRun = process.argv.includes('--dry');

// Tek seferlik çalıştırma modu
if (process.argv.includes('--once')) {
  console.log(isDryRun ? 'Dry run modu...' : 'Tek seferlik mod...');
  initGeminiClient();
  if (!isDryRun) {
    initTwitterClient().then(() => {
      checkAndTweet().then(() => {
        console.log('Tamamlandı.');
        process.exit(0);
      });
    });
  } else {
    // Dry run: Twitter client başlatılmaz
    checkAndTweet().then(() => {
      console.log('Dry run tamamlandı.');
      process.exit(0);
    });
  }
} else {
  main();
}

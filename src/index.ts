import dotenv from 'dotenv';
dotenv.config();

import { fetchKesintiler } from './scraper';
import { loadKesintiler, saveKesintiler, findNewKesintiler, mergeKesintiler } from './storage';
import { initTwitterClient, postMultipleTweets } from './twitter';
import { initGeminiClient } from './gemini';
import { log, warn, error, success, initLogger } from './logger';

const CHECK_INTERVAL = parseInt(process.env.CHECK_INTERVAL_MS || '300000', 10); // 5 dakika
let isChecking = false;

async function checkAndTweet(): Promise<void> {
  if (isChecking) {
    warn('Önceki kontrol hala devam ediyor, bu çalışma atlanıyor.');
    return;
  }
  isChecking = true;

  try {
    log('Kesintiler kontrol ediliyor...');

    // Mevcut kesintileri çek
    const currentKesintiler = await fetchKesintiler();
    log(`${currentKesintiler.length} kesinti bulundu.`);

    // Kayıtlı kesintileri yükle
    const storedKesintiler = loadKesintiler();
    log(`${storedKesintiler.length} kayıtlı kesinti var.`);

    // Yeni kesintileri bul
    const newKesintiler = findNewKesintiler(currentKesintiler, storedKesintiler);

    if (newKesintiler.length > 0) {
      log(`${newKesintiler.length} yeni kesinti bulundu!`);

      // Tweet at ve başarılı olanları al
      const successfulKesintiler = await postMultipleTweets(newKesintiler);
      log(`${successfulKesintiler.length} tweet atıldı.`);

      // Sadece başarılı tweet atılan kesintileri kaydet
      if (successfulKesintiler.length > 0) {
        const merged = mergeKesintiler(successfulKesintiler, storedKesintiler);
        saveKesintiler(merged);
        success(`${successfulKesintiler.length} kesinti kaydedildi.`);
      } else {
        warn('Hiç tweet atılamadı, kesintiler kaydedilmedi.');
      }
    } else {
      log('Yeni kesinti yok.');
    }
  } catch (err) {
    error('Hata oluştu:', err);
  } finally {
    isChecking = false;
  }
}

async function main(): Promise<void> {
  initLogger();
  log('ASKİ Su Kesintisi Twitter Botu başlatılıyor...');
  
  // Gemini client'i başlat (opsiyonel)
  initGeminiClient();
  
  // Twitter client'i başlat
  await initTwitterClient();
  
  // İlk kontrol
  await checkAndTweet();
  
  // Periyodik kontrol
  log(`Her ${CHECK_INTERVAL / 1000} saniyede bir kontrol edilecek.`);
  setInterval(checkAndTweet, CHECK_INTERVAL);
}

// Dry run modu (tweet atmadan test)
const isDryRun = process.argv.includes('--dry');

// Tek seferlik çalıştırma modu
if (process.argv.includes('--once')) {
  (async () => {
    try {
      initLogger();
      log(isDryRun ? 'Dry run modu...' : 'Tek seferlik mod...');
      initGeminiClient();
      if (!isDryRun) await initTwitterClient();
      await checkAndTweet();
      success(isDryRun ? 'Dry run tamamlandı.' : 'Tamamlandı.');
    } catch (err) {
      error('Kritik hata:', err);
      process.exit(1);
    }
    process.exit(0);
  })();
} else {
  main();
}

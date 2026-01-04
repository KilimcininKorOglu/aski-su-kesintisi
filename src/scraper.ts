import axios from 'axios';
import * as cheerio from 'cheerio';
import { Kesinti, generateKesintiId } from './types';

const ASKI_URL = 'https://www.aski.gov.tr/tr/Kesinti.aspx';

export async function fetchKesintiler(): Promise<Kesinti[]> {
  const response = await axios.get(ASKI_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });

  const $ = cheerio.load(response.data);
  return parseKesintiler($);
}

function parseKesintiler($: cheerio.CheerioAPI): Kesinti[] {
  const kesintiler: Kesinti[] = [];
  
  // Her li elementi bir kesinti kartı
  $('li').each((_, li) => {
    const $li = $(li);
    const text = $li.text();
    
    // Bu bir kesinti kartı mı kontrol et
    if (!text.includes('Arıza Tarihi:') || !text.includes('Tamir Tarihi:')) {
      return;
    }
    
    // Tüm h4 elementlerini bul
    const h4Texts: string[] = [];
    $li.find('h4').each((_, h4) => {
      const t = $(h4).text().trim();
      if (t) h4Texts.push(t);
    });
    
    // İlçe adı ve kesinti türünü bul
    let ilce = '';
    let kesintiTuru = 'Plansız Kesinti';
    
    for (const h4Text of h4Texts) {
      if (h4Text.includes('Planlı Kesinti')) {
        kesintiTuru = 'Planlı Kesinti';
      } else if (h4Text.includes('Plansız Kesinti')) {
        kesintiTuru = 'Plansız Kesinti';
      } else if (/^[A-ZİĞÜŞÖÇI\s]+$/.test(h4Text) && h4Text.length > 2) {
        ilce = h4Text.trim();
      }
    }
    
    if (!ilce) return;
    
    // Tarihleri çıkar
    const arizaMatch = text.match(/Arıza Tarihi:\s*(\d{1,2}\.\d{2}\.\d{4}\s+\d{2}:\d{2}:\d{2})/);
    const tamirMatch = text.match(/Tamir Tarihi:\s*(\d{1,2}\.\d{2}\.\d{4}\s+\d{2}:\d{2}:\d{2})/);
    const detayMatch = text.match(/Detay:\s*([\s\S]*?)(?=Etkilenen Yerler:|$)/);
    const yerlerMatch = text.match(/Etkilenen Yerler:\s*([\s\S]*?)$/);
    
    if (!arizaMatch || !tamirMatch) return;
    
    const kesintiData = {
      ilce,
      kesintiTuru,
      arizaTarihi: arizaMatch[1].trim(),
      tamirTarihi: tamirMatch[1].trim(),
      detay: detayMatch?.[1]?.trim() || '',
      etkilenenYerler: yerlerMatch?.[1]?.trim().replace(/\s+/g, ' ') || ''
    };

    const id = generateKesintiId(kesintiData);
    kesintiler.push({ id, ...kesintiData });
  });

  return kesintiler;
}

// Test amaçlı çalıştırma
if (require.main === module) {
  const debugMode = process.argv.includes('--debug');
  
  if (debugMode) {
    axios.get(ASKI_URL).then(response => {
      const $ = cheerio.load(response.data);
      // Tüm "Arıza Tarihi" içeren metinleri say
      const bodyText = $('body').text();
      const count = (bodyText.match(/Arıza Tarihi:/g) || []).length;
      console.log(`Toplam "Arıza Tarihi:" sayısı: ${count}`);
    });
  } else {
    fetchKesintiler()
      .then(kesintiler => {
        console.log(`Toplam ${kesintiler.length} kesinti bulundu:\n`);
        kesintiler.forEach((k, i) => {
          console.log(`${i + 1}. ${k.ilce} - ${k.kesintiTuru}`);
          console.log(`   Arıza: ${k.arizaTarihi}`);
          console.log(`   Tamir: ${k.tamirTarihi}`);
          console.log(`   ID: ${k.id}\n`);
        });
      })
      .catch(console.error);
  }
}

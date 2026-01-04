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
  const bodyText = $('body').text();
  
  // Tüm Türkçe büyük harfler dahil
  const turkishUpper = 'A-ZİĞÜŞÖÇIİ';
  
  // Kesinti bloklarını ayır - her blok ilçe adıyla başlar
  const kesintiPattern = new RegExp(
    `([${turkishUpper}]+)\\s*(Planlı Kesinti|Plansız Kesinti)\\s*Arıza Tarihi:\\s*(\\d{1,2}\\.\\d{2}\\.\\d{4}\\s+\\d{2}:\\d{2}:\\d{2})\\s*Tamir Tarihi:\\s*(\\d{1,2}\\.\\d{2}\\.\\d{4}\\s+\\d{2}:\\d{2}:\\d{2})\\s*Detay:\\s*([\\s\\S]*?)Etkilenen Yerler:\\s*([\\s\\S]*?)(?=[${turkishUpper}]+\\s*(?:Planlı|Plansız)|$)`,
    'g'
  );

  let match;
  while ((match = kesintiPattern.exec(bodyText)) !== null) {
    const kesintiData = {
      ilce: match[1].trim(),
      kesintiTuru: match[2].trim(),
      arizaTarihi: match[3].trim(),
      tamirTarihi: match[4].trim(),
      detay: match[5].trim(),
      etkilenenYerler: match[6].trim().replace(/\s+/g, ' ')
    };

    const id = generateKesintiId(kesintiData);
    kesintiler.push({ id, ...kesintiData });
  }

  return kesintiler;
}

// Test amaçlı çalıştırma
if (require.main === module) {
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

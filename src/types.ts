import crypto from 'crypto';

export interface Kesinti {
  id: string;
  ilce: string;
  kesintiTuru: string;
  arizaTarihi: string;
  tamirTarihi: string;
  detay: string;
  etkilenenYerler: string;
}

export function generateKesintiId(kesinti: Omit<Kesinti, 'id'>): string {
  const data = `${kesinti.ilce}|${kesinti.arizaTarihi}|${kesinti.kesintiTuru}|${kesinti.etkilenenYerler}`;
  return crypto.createHash('sha256').update(data, 'utf8').digest('hex').substring(0, 16);
}

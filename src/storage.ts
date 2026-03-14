import fs from 'fs';
import path from 'path';
import { Kesinti } from './types';
import { error as logError } from './logger';

// Proje kökünden data klasörünü bul (src veya dist'ten bağımsız)
const PROJECT_ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(PROJECT_ROOT, 'data');
const KESINTILER_FILE = path.join(DATA_DIR, 'kesintiler.json');

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function loadKesintiler(): Kesinti[] {
  ensureDataDir();
  
  if (!fs.existsSync(KESINTILER_FILE)) {
    return [];
  }
  
  try {
    const data = fs.readFileSync(KESINTILER_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    logError('kesintiler.json okunamadı:', err);
    throw err;
  }
}

export function saveKesintiler(kesintiler: Kesinti[]): void {
  ensureDataDir();
  const tmpFile = KESINTILER_FILE + '.tmp';
  fs.writeFileSync(tmpFile, JSON.stringify(kesintiler, null, 2), 'utf-8');
  fs.renameSync(tmpFile, KESINTILER_FILE);
}

export function findNewKesintiler(current: Kesinti[], stored: Kesinti[]): Kesinti[] {
  const storedIds = new Set(stored.map(k => k.id));
  return current.filter(k => !storedIds.has(k.id));
}

export function mergeKesintiler(current: Kesinti[], stored: Kesinti[]): Kesinti[] {
  const merged = new Map<string, Kesinti>();
  
  // Önceki kesintileri ekle
  for (const k of stored) {
    merged.set(k.id, k);
  }
  
  // Yeni kesintileri ekle veya güncelle
  for (const k of current) {
    merged.set(k.id, k);
  }
  
  return Array.from(merged.values());
}

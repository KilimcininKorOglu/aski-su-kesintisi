import fs from 'fs';
import path from 'path';

const LOG_DIR = path.join(process.cwd(), 'data');
const LOG_FILE = path.join(LOG_DIR, 'run.log');
const LOG_RETENTION_DAYS = 7;

function ensureLogDir(): void {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

function cleanOldLogs(): void {
  if (!fs.existsSync(LOG_FILE)) return;

  try {
    const content = fs.readFileSync(LOG_FILE, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - LOG_RETENTION_DAYS);
    
    const recentLines = lines.filter(line => {
      const match = line.match(/^\[(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/);
      if (match) {
        const logDate = new Date(match[1]);
        return logDate >= cutoffDate;
      }
      return true;
    });
    
    fs.writeFileSync(LOG_FILE, recentLines.join('\n') + '\n');
  } catch (error) {
    console.error('Log temizleme hatası:', error);
  }
}

function formatMessage(level: string, message: string): string {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] [${level}] ${message}`;
}

function writeToFile(formattedMessage: string): void {
  ensureLogDir();
  fs.appendFileSync(LOG_FILE, formattedMessage + '\n');
}

export function log(message: string): void {
  const formatted = formatMessage('INFO', message);
  console.log(formatted);
  writeToFile(formatted);
}

export function warn(message: string): void {
  const formatted = formatMessage('WARN', message);
  console.warn(formatted);
  writeToFile(formatted);
}

export function error(message: string, err?: any): void {
  const formatted = formatMessage('ERROR', message);
  console.error(formatted);
  writeToFile(formatted);
  if (err) {
    const errorDetail = err instanceof Error ? err.stack || err.message : String(err);
    writeToFile(`  ${errorDetail}`);
  }
}

export function success(message: string): void {
  const formatted = formatMessage('SUCCESS', message);
  console.log(formatted);
  writeToFile(formatted);
}

export function initLogger(): void {
  cleanOldLogs();
  log('Logger başlatıldı');
}

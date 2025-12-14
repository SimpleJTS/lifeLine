import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'db.json');

const ensureDb = async () => {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(DB_PATH);
  } catch {
    const init = { users: [], analyses: [] };
    await fs.writeFile(DB_PATH, JSON.stringify(init, null, 2), 'utf-8');
  }
};

export const readDb = async () => {
  await ensureDb();
  const raw = await fs.readFile(DB_PATH, 'utf-8');
  return JSON.parse(raw);
};

export const writeDb = async (db) => {
  await ensureDb();
  const tmpPath = `${DB_PATH}.tmp`;
  await fs.writeFile(tmpPath, JSON.stringify(db, null, 2), 'utf-8');
  await fs.rename(tmpPath, DB_PATH);
};

export const nowIso = () => new Date().toISOString();

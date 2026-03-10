// sp-brain file reader/writer
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join, dirname } from 'path';

const BRAIN_DIR = join(dirname(new URL(import.meta.url).pathname), '../../sp-brain');

export function readContext(filename) {
  const path = join(BRAIN_DIR, 'context', filename);
  if (!existsSync(path)) return null;
  return readFileSync(path, 'utf-8');
}

export function readMemory() {
  const path = join(BRAIN_DIR, 'MEMORY.md');
  if (!existsSync(path)) return null;
  return readFileSync(path, 'utf-8');
}

export function getLatestSessionLog() {
  const dir = join(BRAIN_DIR, 'memory/sessions');
  if (!existsSync(dir)) return null;
  const files = readdirSync(dir).filter(f => f.endsWith('.md')).sort().reverse();
  if (files.length === 0) return null;
  return {
    filename: files[0],
    content: readFileSync(join(dir, files[0]), 'utf-8'),
  };
}

export function writeSessionLog(date, content) {
  const dir = join(BRAIN_DIR, 'memory/sessions');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const filename = `${date}.md`;
  writeFileSync(join(dir, filename), content, 'utf-8');
  return filename;
}

export function readCurrentTasks() {
  const path = join(BRAIN_DIR, '../tasks/current.md');
  if (!existsSync(path)) return null;
  return readFileSync(path, 'utf-8');
}

export function updateWeeklyState(content) {
  const path = join(BRAIN_DIR, 'context/weekly-state.md');
  writeFileSync(path, content, 'utf-8');
}

export function readInbox() {
  const dir = join(BRAIN_DIR, 'inbox');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter(f => f.endsWith('.md') && f !== 'done')
    .map(f => ({
      filename: f,
      content: readFileSync(join(dir, f), 'utf-8'),
    }));
}

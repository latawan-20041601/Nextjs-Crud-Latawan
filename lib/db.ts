import 'server-only';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

const dataDir = path.join(process.cwd(), 'data');
fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'tasks.db'));
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    completed INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`);

const taskColumns = db
  .prepare('PRAGMA table_info(tasks)')
  .all() as { name: string }[];
const existingColumns = new Set(taskColumns.map(({ name }) => name));

if (!existingColumns.has('description')) {
  db.exec("ALTER TABLE tasks ADD COLUMN description TEXT NOT NULL DEFAULT ''");
}
if (!existingColumns.has('category')) {
  db.exec(
    "ALTER TABLE tasks ADD COLUMN category TEXT NOT NULL DEFAULT 'Personal'",
  );
}
if (!existingColumns.has('priority')) {
  db.exec(
    "ALTER TABLE tasks ADD COLUMN priority TEXT NOT NULL DEFAULT 'medium'",
  );
}
if (!existingColumns.has('due_date')) {
  db.exec('ALTER TABLE tasks ADD COLUMN due_date TEXT');
}

db.exec(`
  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL COLLATE NOCASE UNIQUE
  )
`);

const insertCategory = db.prepare(
  'INSERT OR IGNORE INTO categories (name) VALUES (?)',
);
const seedCategories = db.transaction(() => {
  for (const name of ['Personal', 'Work', 'Learning', 'Health']) {
    insertCategory.run(name);
  }
  const taskCategories = db
    .prepare('SELECT DISTINCT category FROM tasks WHERE category <> ?')
    .all('') as { category: string }[];
  for (const { category } of taskCategories) {
    insertCategory.run(category);
  }
});
seedCategories();

export default db;

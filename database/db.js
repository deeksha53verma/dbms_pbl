import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, 'rotaract_rvce.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');
const SEED_PATH = path.join(__dirname, 'seed.sql');

let dbInstance = null;

export function getDb() {
    if (dbInstance) return dbInstance;

    const isNewDb = !fs.existsSync(DB_PATH);
    dbInstance = new DatabaseSync(DB_PATH);
    dbInstance.exec('PRAGMA foreign_keys = ON;');
    dbInstance.exec('PRAGMA journal_mode = WAL;');

    const schemaSql = fs.readFileSync(SCHEMA_PATH, 'utf8');
    dbInstance.exec(schemaSql);

    if (isNewDb) {
        const seedSql = fs.readFileSync(SEED_PATH, 'utf8');
        dbInstance.exec(seedSql);
    } else {
        // Ensure seed data exists if tables are empty
        const row = dbInstance.prepare('SELECT COUNT(*) AS cnt FROM students').get();
        if (!row || row.cnt === 0) {
            const seedSql = fs.readFileSync(SEED_PATH, 'utf8');
            dbInstance.exec(seedSql);
        }
    }

    return dbInstance;
}

export function resetDatabase() {
    if (dbInstance) {
        dbInstance.close();
        dbInstance = null;
    }
    for (const suffix of ['', '-wal', '-shm']) {
        const target = DB_PATH + suffix;
        if (fs.existsSync(target)) fs.unlinkSync(target);
    }
    return getDb();
}

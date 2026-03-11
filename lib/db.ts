import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import crypto from 'crypto';
import path from 'path';

let db: Database | null = null;
let lastBackupCheck: number = 0;

export async function closeDb() {
    if (db) {
        await db.close();
        db = null;
    }
}

export async function getDb() {
    if (db) {
        // Run scheduled backup check asynchronously without blocking
        checkScheduledBackups(db).catch(console.error);
        return db;
    }

    // Create DB in project root
    db = await open({
        filename: path.join(process.cwd(), 'system.db'),
        driver: sqlite3.Database
    });

    await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'admin',
      assigned_db TEXT,
      failed_login_attempts INTEGER DEFAULT 0,
      locked_until DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS connection_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sessionId TEXT UNIQUE,
      host TEXT,
      database_name TEXT,
      username TEXT,
      status TEXT DEFAULT 'active',
      first_connected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      disconnected_at DATETIME,
      is_deleted INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS cached_activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      remote_id INTEGER,
      sessionId TEXT,
      table_name TEXT,
      action_type TEXT,
      record_id TEXT,
      action_timestamp DATETIME,
      details TEXT,
      UNIQUE(sessionId, remote_id)
    );
    CREATE TABLE IF NOT EXISTS system_activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      username TEXT,
      action_type TEXT,
      details TEXT,
      ip_address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS system_backups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_path TEXT NOT NULL,
      backup_type TEXT DEFAULT 'manual',
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS system_settings (
      setting_key TEXT PRIMARY KEY,
      setting_value TEXT
    );
  `);

    // Ensure default settings exist
    await db.run('INSERT OR IGNORE INTO system_settings (setting_key, setting_value) VALUES (?, ?)', ['auto_backup_enabled', 'false']);
    await db.run('INSERT OR IGNORE INTO system_settings (setting_key, setting_value) VALUES (?, ?)', ['auto_backup_interval_hours', '24']);
    await db.run('INSERT OR IGNORE INTO system_settings (setting_key, setting_value) VALUES (?, ?)', ['last_auto_backup_run', '0']);

    // Create default admin if it doesn't exist
    const admin = await db.get('SELECT * FROM users WHERE username = ?', ['admin']);
    if (!admin) {
        const hashedPassword = hashPassword('admin1234'); // Default password
        await db.run('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', ['admin', hashedPassword, 'superadmin']);
    }

    return db;
}

export function hashPassword(password: string): string {
    return crypto.createHash('sha256').update(password).digest('hex');
}

/**
 * Log any system action to system_activity_logs.
 * Call this from any API route to keep a full audit trail.
 */
export async function logSystemActivity(params: {
    userId?: number | null;
    username: string;
    actionType: string;
    details: string;
    ipAddress?: string;
}) {
    try {
        const database = await getDb();
        await database.run(
            `INSERT INTO system_activity_logs (user_id, username, action_type, details, ip_address)
             VALUES (?, ?, ?, ?, ?)`,
            [
                params.userId ?? null,
                params.username,
                params.actionType,
                params.details,
                params.ipAddress ?? 'SYSTEM',
            ]
        );
    } catch (e) {
        // Never crash the caller because of a logging failure
        console.error('[logSystemActivity] Failed to write log:', e);
    }
}

async function checkScheduledBackups(database: Database) {
    const defaultCheckInterval = 60 * 1000; // Check max once per minute
    if (Date.now() - lastBackupCheck < defaultCheckInterval) return;
    lastBackupCheck = Date.now();

    try {
        const enabledRow = await database.get('SELECT setting_value FROM system_settings WHERE setting_key = ?', ['auto_backup_enabled']);
        if (!enabledRow || enabledRow.setting_value !== 'true') return;

        const intervalRow = await database.get('SELECT setting_value FROM system_settings WHERE setting_key = ?', ['auto_backup_interval_hours']);
        const lastRunRow = await database.get('SELECT setting_value FROM system_settings WHERE setting_key = ?', ['last_auto_backup_run']);

        const intervalHours = parseFloat(intervalRow?.setting_value || '24');
        const intervalMs = intervalHours * 60 * 60 * 1000;
        const lastRun = parseInt(lastRunRow?.setting_value || '0', 10);

        if (Date.now() - lastRun >= intervalMs) {
            // Run backup
            const fs = require('fs');
            const backupsDir = path.join(process.cwd(), 'backups');
            if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true });

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupFileName = `fys_auto_backup_${timestamp}.db`;
            const backupFilePath = path.join(backupsDir, backupFileName);
            const sourceFilePath = path.join(process.cwd(), 'system.db');

            if (fs.existsSync(sourceFilePath)) {
                fs.copyFileSync(sourceFilePath, backupFilePath);
                await database.run(
                    'INSERT INTO system_backups (file_path, backup_type, created_by) VALUES (?, ?, ?)',
                    [backupFilePath, 'auto', 'SYSTEM']
                );
                await database.run('UPDATE system_settings SET setting_value = ? WHERE setting_key = ?', [Date.now().toString(), 'last_auto_backup_run']);
                console.log(`[Auto Backup] Successfully created automated backup: ${backupFileName}`);
            }
        }
    } catch (e) {
        console.error('[Auto Backup] Failed to process scheduled backup:', e);
    }
}

import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSession } from '@/lib/auth';
import fs from 'fs';
import path from 'path';

export async function GET() {
    try {
        const session = await getSession();
        if (!session || session.role !== 'superadmin') {
            return NextResponse.json({ success: false, message: 'غير مصرح لك' }, { status: 403 });
        }

        const db = await getDb();
        const backups = await db.all('SELECT * FROM system_backups ORDER BY created_at DESC');

        // Verify if physical files still exist
        const validatedBackups = backups.map(backup => ({
            ...backup,
            fileExists: fs.existsSync(backup.file_path)
        }));

        const stats = {
            total: backups.length,
            valid: validatedBackups.filter(b => b.fileExists).length,
            latest: backups.length > 0 ? backups[0].created_at : null
        };

        return NextResponse.json({ success: true, backups: validatedBackups, stats });
    } catch (error) {
        return NextResponse.json({ success: false, message: 'حدث خطأ في تحميل النسخ الاحتياطية' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const session = await getSession();
        if (!session || session.role !== 'superadmin') {
            return NextResponse.json({ success: false, message: 'غير مصرح لك' }, { status: 403 });
        }

        const db = await getDb();

        // Ensure backups directory exists
        const backupsDir = path.join(process.cwd(), 'backups');
        if (!fs.existsSync(backupsDir)) {
            fs.mkdirSync(backupsDir, { recursive: true });
        }

        // Generate backup file name
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFileName = `fys_system_backup_${timestamp}.db`;
        const backupFilePath = path.join(backupsDir, backupFileName);
        const sourceFilePath = path.join(process.cwd(), 'system.db');

        // Perform the backup simply by copying the database file
        // (Note: For SQLite, copying the file while no intense write operations are happening is generally safe)
        if (!fs.existsSync(sourceFilePath)) {
            return NextResponse.json({ success: false, message: 'قاعدة البيانات المصدر غير موجودة.' }, { status: 404 });
        }

        fs.copyFileSync(sourceFilePath, backupFilePath);

        // Record the backup in the database
        await db.run(
            'INSERT INTO system_backups (file_path, backup_type, created_by) VALUES (?, ?, ?)',
            [backupFilePath, 'manual', session.username]
        );

        // Also log this action in system_activity_logs for auditing
        await db.run(
            'INSERT INTO system_activity_logs (user_id, username, action_type, details) VALUES (?, ?, ?, ?)',
            [session.id, session.username, 'BACKUP_CREATED', `تم إنشاء نسخة احتياطية يدوية: ${backupFileName}`]
        );

        return NextResponse.json({ success: true, message: 'تم إنشاء النسخة الاحتياطية بنجاح!' });
    } catch (error) {
        console.error('Backup Error:', error);
        return NextResponse.json({ success: false, message: 'حدث خطأ أثناء إنشاء النسخة الاحتياطية' }, { status: 500 });
    }
}

import { NextResponse } from 'next/server';
import { getDb, closeDb } from '@/lib/db';
import { getSession } from '@/lib/auth';
import fs from 'fs';
import path from 'path';

export async function POST(request: Request, context: any) {
    try {
        const { params } = context;
        const { id } = await params;

        const session = await getSession();
        if (!session || session.role !== 'superadmin') {
            return NextResponse.json({ success: false, message: 'غير مصرح لك' }, { status: 403 });
        }

        let db = await getDb();
        const backup = await db.get('SELECT file_path FROM system_backups WHERE id = ?', [id]);

        if (!backup || !fs.existsSync(backup.file_path)) {
            return NextResponse.json({ success: false, message: 'تعذر العثور على النسخة المحددة وموجودة مادية' }, { status: 404 });
        }

        const sourceFilePath = backup.file_path;
        const targetFilePath = path.join(process.cwd(), 'system.db');

        // Close the active database connection to free any locks
        await closeDb();

        try {
            // Overwrite the current system.db with the backup file
            fs.copyFileSync(sourceFilePath, targetFilePath);
        } catch (copyErr) {
            console.error('File copy error during restore', copyErr);
            // Reopen db if it fails
            await getDb();
            return NextResponse.json({ success: false, message: 'تعذر استبدال ملف قاعدة البيانات، ربما يكون قيد الاستخدام.' }, { status: 500 });
        }

        // Reconnect to the newly restored database
        db = await getDb();

        // 3. Log restore action for audit inside the new database
        const fileName = path.basename(sourceFilePath);
        await db.run(
            'INSERT INTO system_activity_logs (user_id, username, action_type, details) VALUES (?, ?, ?, ?)',
            [session.id, session.username, 'RESTORE_COMPLETED', `تم استرجاع النظام من نسخة احتياطية محلية: ${fileName}`]
        );

        return NextResponse.json({ success: true, message: 'تم استرجاع النظام بنجاح من النسخة الاحتياطية المحددة!' });
    } catch (error) {
        console.error('Restore Error:', error);
        return NextResponse.json({ success: false, message: 'حدث خطأ خطير غير متوقع أثناء استرجاع النسخة.' }, { status: 500 });
    }
}

import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSession } from '@/lib/auth';
import fs from 'fs';
import path from 'path';

export async function GET(request: Request, context: any) {
    try {
        const { params } = context;
        const { id } = await params;

        const session = await getSession();
        if (!session || session.role !== 'superadmin') {
            return new NextResponse('غير مصرح لك بتنزيل هذه البيانات.', { status: 403 });
        }

        const db = await getDb();
        const backup = await db.get('SELECT file_path FROM system_backups WHERE id = ?', [id]);

        if (!backup || !fs.existsSync(backup.file_path)) {
            return new NextResponse('تعذر العثور على ملف النسخة الاحتياطية المادية.', { status: 404 });
        }

        const stats = fs.statSync(backup.file_path);
        const fileBuffer = fs.readFileSync(backup.file_path);
        const fileName = path.basename(backup.file_path);

        // Security Log: Record the download
        await db.run(
            'INSERT INTO system_activity_logs (user_id, username, action_type, details) VALUES (?, ?, ?, ?)',
            [session.id, session.username, 'BACKUP_DOWNLOADED', `تم تحميل بيانات النسخة الاحتياطية الحساسة: ${fileName}`]
        );

        return new NextResponse(fileBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/x-sqlite3',
                'Content-Length': stats.size.toString(),
                'Content-Disposition': `attachment; filename="${fileName}"`,
                'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
            },
        });
    } catch (error) {
        console.error('Backup Download Error:', error);
        return new NextResponse('خطأ داخلي أثناء استخراج النسخة الاحتياطية.', { status: 500 });
    }
}

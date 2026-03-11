import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSession } from '@/lib/auth';
import fs from 'fs';
import path from 'path';

export async function DELETE(request: Request, context: any) {
    try {
        const { params } = context;
        const { id } = await params;

        const session = await getSession();
        if (!session || session.role !== 'superadmin') {
            return NextResponse.json({ success: false, message: 'غير مصرح لك' }, { status: 403 });
        }

        const db = await getDb();
        const backup = await db.get('SELECT file_path FROM system_backups WHERE id = ?', [id]);

        if (!backup) {
            return NextResponse.json({ success: false, message: 'تعذر العثور على النسخة المحددة في النظام' }, { status: 404 });
        }

        // 1. Remove physical file
        if (fs.existsSync(backup.file_path)) {
            fs.unlinkSync(backup.file_path);
        }

        // 2. Remove from DB log
        await db.run('DELETE FROM system_backups WHERE id = ?', [id]);

        // 3. Log deletion for audit
        const fileName = path.basename(backup.file_path);
        await db.run(
            'INSERT INTO system_activity_logs (user_id, username, action_type, details) VALUES (?, ?, ?, ?)',
            [session.id, session.username, 'BACKUP_DELETED', `تم حذف النسخة الاحتياطية المادية: ${fileName}`]
        );

        return NextResponse.json({ success: true, message: 'تم التخلص من النسخة الاحتياطية بشكل آمن' });
    } catch (error) {
        console.error('Backup Delete Error:', error);
        return NextResponse.json({ success: false, message: 'حدث خطأ غير متوقع أثناء الحذف.' }, { status: 500 });
    }
}

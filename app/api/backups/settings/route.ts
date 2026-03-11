import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET(request: Request) {
    try {
        const session = await getSession();
        if (!session || session.role !== 'superadmin') {
            return NextResponse.json({ success: false, message: 'غير مصرح لك' }, { status: 403 });
        }

        const db = await getDb();
        const settings = await db.all('SELECT setting_key, setting_value FROM system_settings');
        
        let config: any = {
            auto_backup_enabled: false,
            auto_backup_interval_hours: 24,
            last_auto_backup_run: 0
        };

        for (const s of settings) {
            if (s.setting_key === 'auto_backup_enabled') config.auto_backup_enabled = s.setting_value === 'true';
            if (s.setting_key === 'auto_backup_interval_hours') config.auto_backup_interval_hours = parseFloat(s.setting_value);
            if (s.setting_key === 'last_auto_backup_run') config.last_auto_backup_run = parseInt(s.setting_value, 10);
        }

        return NextResponse.json({ success: true, settings: config });
    } catch (error) {
        return NextResponse.json({ success: false, message: 'حدث خطأ في تحميل إعدادات النسخ الاحتياطي' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const session = await getSession();
        if (!session || session.role !== 'superadmin') {
            return NextResponse.json({ success: false, message: 'غير مصرح لك' }, { status: 403 });
        }

        const body = await request.json();
        const { auto_backup_enabled, auto_backup_interval_hours } = body;

        const db = await getDb();

        await db.run('UPDATE system_settings SET setting_value = ? WHERE setting_key = ?', [auto_backup_enabled ? 'true' : 'false', 'auto_backup_enabled']);
        
        if (auto_backup_interval_hours && !isNaN(parseFloat(auto_backup_interval_hours))) {
            await db.run('UPDATE system_settings SET setting_value = ? WHERE setting_key = ?', [auto_backup_interval_hours.toString(), 'auto_backup_interval_hours']);
        }

        await db.run(
            'INSERT INTO system_activity_logs (user_id, username, action_type, details) VALUES (?, ?, ?, ?)',
            [session.id, session.username, 'BACKUP_SETTINGS_UPDATED', `تحديث إعدادات النسخ التلقائي: ${auto_backup_enabled ? 'مفعل' : 'معطل'} كل ${auto_backup_interval_hours} ساعة`]
        );

        return NextResponse.json({ success: true, message: 'تم تحديث إعدادات النسخ التلقائي بنجاح!' });
    } catch (error) {
        console.error('Backup Settings Error:', error);
        return NextResponse.json({ success: false, message: 'حدث خطأ أثناء حفظ الإعدادات' }, { status: 500 });
    }
}

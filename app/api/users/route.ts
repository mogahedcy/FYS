import { NextResponse } from 'next/server';
import { getDb, hashPassword, logSystemActivity } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET() {
    try {
        const session = await getSession() as { id: number, username: string, role: string } | null;
        if (!session || session.role !== 'superadmin') {
            return NextResponse.json({ success: false, message: 'غير مصرح لك' }, { status: 403 });
        }

        const db = await getDb();
        const users = await db.all('SELECT id, username, role, assigned_db, locked_until, created_at FROM users');
        return NextResponse.json({ success: true, users });
    } catch (error) {
        return NextResponse.json({ success: false, message: 'حدث خطأ' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const session = await getSession() as { id: number, username: string, role: string } | null;
        if (!session || session.role !== 'superadmin') {
            return NextResponse.json({ success: false, message: 'غير مصرح لك' }, { status: 403 });
        }

        const { username, password, role, assigned_db } = await request.json();

        if (!username || !password) {
            return NextResponse.json({ success: false, message: 'املأ جميع الحقول' }, { status: 400 });
        }

        const db = await getDb();

        // Check if exists
        const existing = await db.get('SELECT id FROM users WHERE username = ?', [username]);
        if (existing) {
            return NextResponse.json({ success: false, message: 'اسم المستخدم موجود مسبقاً' }, { status: 400 });
        }

        const finalRole = role || 'admin';
        const finalDb = finalRole === 'monitor' ? (assigned_db || null) : null;

        const hashed = hashPassword(password);
        await db.run('INSERT INTO users (username, password, role, assigned_db) VALUES (?, ?, ?, ?)', [username, hashed, finalRole, finalDb]);

        // Audit log
        await logSystemActivity({
            userId: session.id,
            username: session.username,
            actionType: 'USER_CREATED',
            details: `أضاف مستخدم جديد: اسم "${username}" بدور "${finalRole}"${finalDb ? ` مخصص لقاعدة: ${finalDb}` : ''}`,
        });

        return NextResponse.json({ success: true, message: 'تم إضافة المستخدم بنجاح' });
    } catch (error) {
        return NextResponse.json({ success: false, message: 'حدث خطأ أثناء الإضافة' }, { status: 500 });
    }
}

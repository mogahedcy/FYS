import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSession } from '@/lib/auth';
import { logSystemActivity } from '@/lib/db';

export async function POST() {
    try {
        // Read session BEFORE deleting the cookie
        const session = await getSession() as { id: number; username: string; role: string } | null;

        const cookieStore = await cookies();
        cookieStore.delete('auth-token');

        // Audit log
        if (session) {
            await logSystemActivity({
                userId: session.id,
                username: session.username,
                actionType: 'LOGOUT',
                details: `خروج من النظام الأمني (الدور: ${session.role})`,
            });
        }

        return NextResponse.json({ success: true, message: 'تم تسجيل الخروج بنجاح' });
    } catch (error) {
        return NextResponse.json({ success: false, message: 'حدث خطأ أثناء تسجيل الخروج' }, { status: 500 });
    }
}

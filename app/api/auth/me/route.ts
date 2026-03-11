import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

export async function GET() {
    try {
        const session = await getSession();

        if (!session) {
            return NextResponse.json(
                { success: false, message: 'غير مصدق' },
                { status: 401 }
            );
        }

        return NextResponse.json({
            success: true,
            user: {
                id: session.id,
                username: session.username,
                role: session.role,
                assigned_db: session.assigned_db
            }
        });

    } catch (error) {
        console.error('Auth check error:', error);
        return NextResponse.json(
            { success: false, message: 'حدث خطأ في الخادم' },
            { status: 500 }
        );
    }
}

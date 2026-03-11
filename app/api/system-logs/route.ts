import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET(request: Request) {
    try {
        const session = await getSession();

        if (!session || session.role !== 'superadmin') {
            return NextResponse.json(
                { success: false, message: 'غير مصرح لك بالوصول لهذه البيانات' },
                { status: 403 }
            );
        }

        const url = new URL(request.url);
        const limit = parseInt(url.searchParams.get('limit') || '100');
        const usernameFilter = url.searchParams.get('username') || '';

        const db = await getDb();

        let logs;
        let query = 'SELECT * FROM system_activity_logs';
        let params: any[] = [];

        if (usernameFilter && usernameFilter !== 'all') {
            query += ' WHERE username = ?';
            params.push(usernameFilter);
        }

        query += ' ORDER BY created_at DESC LIMIT ?';
        params.push(limit);

        logs = await db.all(query, params);

        return NextResponse.json({ success: true, logs });

    } catch (error) {
        console.error('Error fetching system logs:', error);
        return NextResponse.json(
            { success: false, message: 'فشل جلب سجلات النظام' },
            { status: 500 }
        );
    }
}

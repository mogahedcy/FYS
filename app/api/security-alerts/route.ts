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
        const usernameFilter = url.searchParams.get('username') || 'all';

        const db = await getDb();

        let queryBasic = `SELECT * FROM system_activity_logs WHERE action_type IN ('LOGIN_SUCCESS', 'LOGOUT', 'TOKEN_REFRESH')`;
        let queryAlerts = `SELECT * FROM system_activity_logs WHERE action_type IN ('LOGIN_FAILED', 'ACCOUNT_LOCKED')`;
        let params: any[] = [];

        if (usernameFilter !== 'all') {
            queryBasic += ' AND username = ?';
            queryAlerts += ' AND username = ?';
            params.push(usernameFilter);
        }

        queryBasic += ' ORDER BY created_at DESC LIMIT 200';
        queryAlerts += ' ORDER BY created_at DESC LIMIT 200';

        const activityLogs = await db.all(queryBasic, params);
        const intrusionAlerts = await db.all(queryAlerts, params);

        return NextResponse.json({ 
            success: true, 
            activity_logs: activityLogs,
            intrusion_alerts: intrusionAlerts 
        });

    } catch (error) {
        console.error('Error fetching security alerts:', error);
        return NextResponse.json(
            { success: false, message: 'فشل جلب تصنيفات التنبيهات الأمنية' },
            { status: 500 }
        );
    }
}

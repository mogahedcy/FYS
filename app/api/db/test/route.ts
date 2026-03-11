import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { host, port, database, user, password } = body;

        if (!host || !port || !database || !user || !password) {
            return NextResponse.json({ success: false, message: 'جميع الحقول مطلوبة.' }, { status: 400 });
        }

        // Try to connect to MySQL
        const connection = await mysql.createConnection({
            host,
            port: Number(port),
            database,
            user,
            password,
        });

        // If successful, close the connection and return success
        await connection.end();

        return NextResponse.json({ success: true, message: 'تم الاتصال بقاعدة البيانات بنجاح!' });
    } catch (error: any) {
        console.error('Database connection error:', error);
        return NextResponse.json(
            { success: false, message: error.message || 'فشل الاتصال بقاعدة البيانات. تأكد من صحة البيانات.' },
            { status: 500 }
        );
    }
}

import { NextResponse } from 'next/server';
import { getDb, hashPassword } from '@/lib/db';
import { createToken } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
    try {
        const { username, password } = await request.json();

        if (!username || !password) {
            return NextResponse.json(
                { success: false, message: 'اسم المستخدم وكلمة المرور مطلوبان' },
                { status: 400 }
            );
        }

        const db = await getDb();

        // Find user in SQLite DB
        const user = await db.get('SELECT * FROM users WHERE username = ?', [username]);

        const ip = request.headers.get('x-forwarded-for') || 'unknown';

        if (!user) {
            // Log failed attempt for non-existent user
            await db.run(
                'INSERT INTO system_activity_logs (username, action_type, details, ip_address) VALUES (?, ?, ?, ?)',
                [username, 'LOGIN_FAILED', 'محاولة الدخول لمستخدم غير موجود', ip]
            );
            return NextResponse.json(
                { success: false, message: 'بيانات الدخول غير صحيحة' },
                { status: 401 }
            );
        }

        // Check if locked
        if (user.locked_until && new Date(user.locked_until) > new Date()) {
            const diffMs = new Date(user.locked_until).getTime() - new Date().getTime();
            const diffMins = Math.ceil(diffMs / 60000);
            return NextResponse.json(
                { success: false, message: `الحساب محظور مؤقتاً. يرجى المحاولة بعد ${diffMins} دقيقة.` },
                { status: 403 }
            );
        }

        // Check password
        if (user.password !== hashPassword(password)) {
            const attempts = (user.failed_login_attempts || 0) + 1;
            let lockedUntil = null;
            let message = 'بيانات الدخول غير صحيحة';

            if (attempts >= 3) {
                // Lock for 10 minutes
                lockedUntil = new Date(Date.now() + 10 * 60000).toISOString();
                message = 'تم تجاوز عدد المحاولات المسموحة. الحساب محظور لمدة 10 دقائق.';
                
                await db.run(
                    'INSERT INTO system_activity_logs (user_id, username, action_type, details, ip_address) VALUES (?, ?, ?, ?, ?)',
                    [user.id, user.username, 'ACCOUNT_LOCKED', 'تم حظر الحساب بسبب تكرار المحاولات الفاشلة', ip]
                );
            }

            await db.run(
                'UPDATE users SET failed_login_attempts = ?, locked_until = ? WHERE id = ?',
                [attempts, lockedUntil, user.id]
            );

            await db.run(
                'INSERT INTO system_activity_logs (user_id, username, action_type, details, ip_address) VALUES (?, ?, ?, ?, ?)',
                [user.id, user.username, 'LOGIN_FAILED', 'كلمة المرور غير صحيحة', ip]
            );

            return NextResponse.json({ success: false, message }, { status: 401 });
        }

        // Reset attempts on successful login
        await db.run(
            'UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?',
            [user.id]
        );

        await db.run(
            'INSERT INTO system_activity_logs (user_id, username, action_type, details, ip_address) VALUES (?, ?, ?, ?, ?)',
            [user.id, user.username, 'LOGIN_SUCCESS', 'تسجيل دخول ناجح إلى النظام', ip]
        );

        // Create JWT Token
        const token = await createToken({
            id: user.id,
            username: user.username,
            role: user.role,
            assigned_db: user.assigned_db
        });

        // Set Cookie
        const cookieStore = await cookies();
        cookieStore.set('auth-token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 60 * 60 * 12, // 12 hours
        });

        return NextResponse.json({
            success: true,
            message: 'تم تسجيل الدخول بنجاح',
            user: { id: user.id, username: user.username, role: user.role, assigned_db: user.assigned_db }
        });

    } catch (error) {
        console.error('Login Error:', error);
        return NextResponse.json(
            { success: false, message: 'حدث خطأ في الخادم' },
            { status: 500 }
        );
    }
}

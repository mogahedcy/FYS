import { NextResponse } from 'next/server';
import { getDb, hashPassword, logSystemActivity } from '@/lib/db';
import { getSession } from '@/lib/auth';

type Session = { id: number; username: string; role: string } | null;

export async function DELETE(request: Request, context: any) {
    try {
        const { params } = context;
        const { id } = await params;

        const session = await getSession() as Session;
        if (!session || session.role !== 'superadmin') {
            return NextResponse.json({ success: false, message: 'غير مصرح لك' }, { status: 403 });
        }

        if (session.id === parseInt(id)) {
            return NextResponse.json({ success: false, message: 'لا يمكنك حذف حسابك الحالي' }, { status: 400 });
        }

        const db = await getDb();

        // Check if it's the default admin
        const userToDel = await db.get('SELECT username FROM users WHERE id = ?', [id]);
        if (userToDel && userToDel.username === 'admin') {
            return NextResponse.json({ success: false, message: 'لا يمكن حذف حساب الإدمن الأساسي' }, { status: 400 });
        }

        await db.run('DELETE FROM users WHERE id = ?', [id]);

        // Audit log
        await logSystemActivity({
            userId: session!.id,
            username: session!.username,
            actionType: 'USER_DELETED',
            details: `حذف مستخدم النظام: "${userToDel?.username}" (معرف ${id})`,
        });

        return NextResponse.json({ success: true, message: 'تم الحذف بنجاح' });
    } catch (error) {
        return NextResponse.json({ success: false, message: 'حدث خطأ أثناء الحذف' }, { status: 500 });
    }
}

export async function PUT(request: Request, context: any) {
    try {
        const { params } = context;
        const { id } = await params;

        const session = await getSession() as Session;
        if (!session || session.role !== 'superadmin') {
            return NextResponse.json({ success: false, message: 'غير مصرح لك' }, { status: 403 });
        }

        const { username, password, role, assigned_db, action } = await request.json();

        const db = await getDb();

        if (action === 'unlock') {
            await db.run('UPDATE users SET locked_until = NULL, failed_login_attempts = 0 WHERE id = ?', [id]);
            const targetUser = await db.get('SELECT username FROM users WHERE id = ?', [id]);
            await logSystemActivity({
                userId: session!.id,
                username: session!.username,
                actionType: 'USER_UNLOCKED',
                details: `فك حظر حساب المستخدم: "${targetUser?.username}" (معرف ${id})`,
            });
            return NextResponse.json({ success: true, message: 'تم فك الحظر عن الحساب بنجاح' });
        }

        if (!username) {
            return NextResponse.json({ success: false, message: 'اسم المستخدم مطلوب' }, { status: 400 });
        }

        const userToEdit = await db.get('SELECT username FROM users WHERE id = ?', [id]);
        if (userToEdit && userToEdit.username === 'admin' && role !== 'superadmin') {
            return NextResponse.json({ success: false, message: 'حساب الأدمن الأساسي يجب أن يبقى superadmin' }, { status: 400 });
        }

        const finalRole = role || 'admin';
        const finalDb = finalRole === 'monitor' ? (assigned_db || null) : null;

        if (password) {
            const hashed = hashPassword(password);
            await db.run('UPDATE users SET username = ?, password = ?, role = ?, assigned_db = ? WHERE id = ?', [username, hashed, finalRole, finalDb, id]);
        } else {
            await db.run('UPDATE users SET username = ?, role = ?, assigned_db = ? WHERE id = ?', [username, finalRole, finalDb, id]);
        }

        // Audit log
        await logSystemActivity({
            userId: session!.id,
            username: session!.username,
            actionType: 'USER_UPDATED',
            details: `عدل بيانات المستخدم (ID: ${id}): اسم "${username}"  دور "${finalRole}"${finalDb ? ` قاعدة: ${finalDb}` : ''}${password ? ' + تحديث كلمة السر' : ''}`,
        });

        return NextResponse.json({ success: true, message: 'تم تحديث بيانات المستخدم' });
    } catch (error) {
        return NextResponse.json({ success: false, message: 'حدث خطأ أثناء التعديل' }, { status: 500 });
    }
}

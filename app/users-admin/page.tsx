'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, UserPlus, Trash2, Edit, Save, X, LogOut, CheckCircle2, LockOpen, Database } from 'lucide-react';

export default function UsersAdminPage() {
    const router = useRouter();
    const [users, setUsers] = useState<any[]>([]);
    const [connections, setConnections] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    // Form states
    const [showAddForm, setShowAddForm] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [formData, setFormData] = useState({ username: '', password: '', role: 'superadmin', assigned_db: '' });

    const fetchUsers = async () => {
        try {
            const res = await fetch('/api/users');
            const data = await res.json();
            if (res.ok && data.success) {
                setUsers(data.users);
            } else {
                setError(data.message || 'حدث خطأ في تحميل المستخدمين');
            }
        } catch {
            setError('فشل الاتصال بالخادم');
        } finally {
            setLoading(false);
        }
    };

    const fetchConnections = async () => {
        try {
            const res = await fetch('/api/db', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'get_connection_history' })
            });
            const data = await res.json();
            if (data.success) {
                // Get unique active databases
                const uniqueDbs = Array.from(new Set(data.history.map((h: any) => h.database_name)));
                setConnections(uniqueDbs);
            }
        } catch (e) {
            console.error('Failed to fetch connections', e);
        }
    };

    useEffect(() => {
        fetchUsers();
        fetchConnections();
    }, []);

    const handleLogout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        router.push('/login');
        router.refresh();
    };

    const showSuccess = (msg: string) => {
        setSuccessMsg(msg);
        setTimeout(() => setSuccessMsg(''), 3000);
    };

    const handleAddSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });
            const data = await res.json();
            if (res.ok && data.success) {
                showSuccess(data.message);
                setShowAddForm(false);
                setFormData({ username: '', password: '', role: 'superadmin', assigned_db: '' });
                fetchUsers();
            } else {
                alert(data.message);
            }
        } catch {
            alert('حدث خطأ غير متوقع');
        }
    };

    const handleUpdate = async (id: number) => {
        try {
            const res = await fetch(`/api/users/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });
            const data = await res.json();
            if (res.ok && data.success) {
                showSuccess(data.message);
                setEditingId(null);
                setFormData({ username: '', password: '', role: 'superadmin', assigned_db: '' });
                fetchUsers();
            } else {
                alert(data.message);
            }
        } catch {
            alert('حدث خطأ');
        }
    };

    const handleUnlock = async (id: number) => {
        try {
            const res = await fetch(`/api/users/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'unlock' }),
            });
            const data = await res.json();
            if (res.ok && data.success) {
                showSuccess(data.message);
                fetchUsers();
            } else {
                alert(data.message);
            }
        } catch {
            alert('حدث خطأ');
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('هل أنت متأكد من حذف هذا المستخدم؟')) return;
        try {
            const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
            const data = await res.json();
            if (res.ok && data.success) {
                showSuccess(data.message);
                fetchUsers();
            } else {
                alert(data.message);
            }
        } catch {
            alert('حدث خطأ');
        }
    };

    const startEdit = (user: any) => {
        setEditingId(user.id);
        setFormData({ username: user.username, password: '', role: user.role, assigned_db: user.assigned_db || '' });
        setShowAddForm(false);
    };

    if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center">جاري التحميل...</div>;

    return (
        <div className="min-h-screen bg-slate-50 p-6" dir="rtl">

            {/* Header */}
            <div className="max-w-5xl mx-auto flex items-center justify-between mb-8 bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                <div className="flex items-center gap-4">
                    <div className="bg-blue-100 p-3 rounded-xl">
                        <Shield className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-slate-800">إدارة مستخدمي نظام FYS</h1>
                        <p className="text-sm text-slate-500">من هنا يمكنك إضافة وإدارة المشرفين على لوحة التحكم</p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => router.push('/')}
                        className="px-4 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors font-medium text-sm"
                    >
                        الرئيسية
                    </button>
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-2 px-4 py-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors font-medium text-sm"
                    >
                        <LogOut className="w-4 h-4" />
                        تسجيل الخروج
                    </button>
                </div>
            </div>

            <div className="max-w-5xl mx-auto space-y-6">

                {/* Success Alert */}
                {successMsg && (
                    <div className="p-4 bg-green-50 text-green-700 border border-green-200 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                        <CheckCircle2 className="w-5 h-5" />
                        {successMsg}
                    </div>
                )}

                {/* Users List Container */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">

                    <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                        <h2 className="font-semibold text-slate-800">قائمة المشرفين</h2>
                        <button
                            onClick={() => {
                                setShowAddForm(!showAddForm);
                                setEditingId(null);
                                setFormData({ username: '', password: '', role: 'superadmin', assigned_db: '' });
                            }}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium"
                        >
                            {showAddForm ? <X className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                            {showAddForm ? 'إلغاء' : 'إضافة مستخدم جديد'}
                        </button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-right align-middle text-sm text-slate-600">
                            <thead className="text-slate-500 bg-slate-50 border-b border-slate-100 text-xs uppercase bg-slate-50/50">
                                <tr>
                                    <th className="px-6 py-4 font-medium">المعرف</th>
                                    <th className="px-6 py-4 font-medium">اسم المستخدم</th>
                                    <th className="px-6 py-4 font-medium">الدور (Role)</th>
                                    <th className="px-6 py-4 text-center font-medium">الإجراءات</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">

                                {/* Add/Edit Row Form */}
                                {showAddForm && !editingId && (
                                    <tr className="bg-blue-50/30">
                                        <td className="px-6 py-4 font-bold text-blue-500">جديد</td>
                                        <td className="px-6 py-3">
                                            <input
                                                type="text"
                                                placeholder="اسم المستخدم"
                                                value={formData.username}
                                                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                                className="w-full px-3 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-right"
                                            />
                                        </td>
                                        <td className="px-6 py-3">
                                            <input
                                                type="password"
                                                placeholder="كلمة المرور"
                                                value={formData.password}
                                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                                className="w-full px-3 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none block mb-2 font-mono text-left"
                                                dir="ltr"
                                            />
                                            <select
                                                value={formData.role}
                                                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                                className="w-full px-3 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none block mb-2"
                                            >
                                                <option value="superadmin">مسؤول أعلى (Super Admin)</option>
                                                <option value="monitor">مراقب قاعدة بيانات (DB Monitor)</option>
                                            </select>
                                            {formData.role === 'monitor' && (
                                                <select
                                                    value={formData.assigned_db}
                                                    onChange={(e) => setFormData({ ...formData, assigned_db: e.target.value })}
                                                    className="w-full px-3 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-blue-600"
                                                >
                                                    <option value="">-- اختر قاعدة البيانات --</option>
                                                    {connections.map((dbName: string) => (
                                                        <option key={dbName} value={dbName}>{dbName}</option>
                                                    ))}
                                                </select>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <button onClick={handleAddSubmit} className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
                                                <Save className="w-4 h-4" /> حفظ
                                            </button>
                                        </td>
                                    </tr>
                                )}

                                {/* Display Users Data */}
                                {users.map((user) => (
                                    <tr key={user.id} className="hover:bg-slate-50/80 transition-colors">
                                        <td className="px-6 py-4 font-medium text-slate-800">#{user.id}</td>
                                        <td className="px-6 py-4">
                                            {editingId === user.id ? (
                                                <input
                                                    type="text"
                                                    value={formData.username}
                                                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                                    className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                                />
                                            ) : (
                                                <span className="font-medium text-slate-800">{user.username}</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            {editingId === user.id ? (
                                                <>
                                                    <input
                                                        type="password"
                                                        placeholder="كلمة مرور جديدة (اختياري)"
                                                        value={formData.password}
                                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                                        className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none block mb-2 text-left"
                                                        dir="ltr"
                                                    />
                                                    <select
                                                        value={formData.role}
                                                        onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                                        className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none block mb-2"
                                                    >
                                                        <option value="superadmin">مسؤول أعلى (Super Admin)</option>
                                                        <option value="monitor">مراقب قاعدة بيانات (DB Monitor)</option>
                                                    </select>
                                                    {formData.role === 'monitor' && (
                                                        <select
                                                            value={formData.assigned_db}
                                                            onChange={(e) => setFormData({ ...formData, assigned_db: e.target.value })}
                                                            className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-blue-600"
                                                        >
                                                            <option value="">-- اختر قاعدة البيانات --</option>
                                                            {connections.map((dbName: string) => (
                                                                <option key={dbName} value={dbName}>{dbName}</option>
                                                            ))}
                                                        </select>
                                                    )}
                                                </>
                                            ) : (
                                                <div className="flex flex-col gap-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${user.role === 'superadmin' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-indigo-50 text-indigo-700 border-indigo-200'}`}>
                                                            {user.role === 'superadmin' ? 'مسؤول أعلى (إدارة كاملة)' : 'مراقب محدد (قراءة وتقارير)'}
                                                        </span>
                                                        {user.locked_until && new Date(user.locked_until) > new Date() && (
                                                            <span className="px-2.5 py-1 rounded-full text-xs font-bold border bg-red-50 text-red-700 border-red-200 animate-pulse">
                                                                محظور أمنياً!
                                                            </span>
                                                        )}
                                                    </div>
                                                    {user.role === 'monitor' && user.assigned_db && (
                                                        <span className="text-xs text-slate-500 font-bold flex items-center gap-1">
                                                            <Database className="w-3 h-3 text-emerald-500" />
                                                            {user.assigned_db}
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            {editingId === user.id ? (
                                                <div className="flex items-center justify-center gap-2">
                                                    <button onClick={() => handleUpdate(user.id)} className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition" title="حفظ">
                                                        <Save className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => setEditingId(null)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg transition" title="إلغاء">
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex items-center justify-center gap-2">
                                                    <button
                                                        onClick={() => startEdit(user)}
                                                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                        title="تعديل"
                                                    >
                                                        <Edit className="w-4 h-4" />
                                                    </button>
                                                    
                                                    {/* Unlock Button */}
                                                    {user.locked_until && new Date(user.locked_until) > new Date() && (
                                                        <button
                                                            onClick={() => handleUnlock(user.id)}
                                                            className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                                            title="فك الحظر الأمني"
                                                        >
                                                            <LockOpen className="w-4 h-4" />
                                                        </button>
                                                    )}

                                                    {user.username !== 'admin' && (
                                                        <button
                                                            onClick={() => handleDelete(user.id)}
                                                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                            title="حذف"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}

                                {users.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-8 text-center text-slate-500">لا يوجد بيانات للمشرفين.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>
        </div>
    );
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Shield, Plus, Trash2, RefreshCw, Loader2, CheckCircle2, XCircle, ChevronDown, Info, Lock, Unlock, AlertTriangle } from 'lucide-react';

type Permission = { id: number; username: string; permission_key: string; granted: number; granted_at: string; notes: string };
type UserOpt = { username: string };

const PRESET_PERMISSIONS = [
    { key: 'view_dashboard', label: 'عرض لوحة التحكم', group: 'عام' },
    { key: 'view_reports', label: 'عرض التقارير', group: 'عام' },
    { key: 'export_reports', label: 'تصدير التقارير', group: 'عام' },
    { key: 'manage_users', label: 'إدارة المستخدمين', group: 'إدارة' },
    { key: 'manage_roles', label: 'إدارة الأدوار', group: 'إدارة' },
    { key: 'system_settings', label: 'إعدادات النظام', group: 'إدارة' },
    { key: 'view_accounts', label: 'عرض الحسابات', group: 'محاسبة' },
    { key: 'edit_accounts', label: 'تعديل الحسابات', group: 'محاسبة' },
    { key: 'delete_records', label: 'حذف السجلات', group: 'محاسبة' },
    { key: 'view_invoices', label: 'عرض الفواتير', group: 'فواتير' },
    { key: 'create_invoices', label: 'إنشاء فواتير', group: 'فواتير' },
    { key: 'approve_invoices', label: 'اعتماد الفواتير', group: 'فواتير' },
];

const GROUPS = [...new Set(PRESET_PERMISSIONS.map(p => p.group))];

export default function AppPermissionsPage() {
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [permissions, setPermissions] = useState<Permission[]>([]);
    const [users, setUsers] = useState<UserOpt[]>([]);
    const [loading, setLoading] = useState(false);
    const [setupLoading, setSetupLoading] = useState(false);
    const [isSetup, setIsSetup] = useState(false);
    const [selectedUser, setSelectedUser] = useState('');
    const [customKey, setCustomKey] = useState('');
    const [saving, setSaving] = useState('');
    const [message, setMessage] = useState({ type: '', text: '' });

    useEffect(() => {
        const sid = localStorage.getItem('dbConnectionSession');
        setSessionId(sid);
        if (sid) { fetchUsers(sid); tryFetchPerms(sid); }
    }, []);

    const fetchUsers = async (sid: string) => {
        try {
            const res = await fetch('/api/db', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'get_tables', sessionId: sid }) });
            const data = await res.json();
            if (data.success) setUsers((data.users || []).map((u: any) => ({ username: u.username })));
        } catch (e) { console.error(e); }
    };

    const tryFetchPerms = async (sid: string) => {
        setLoading(true);
        try {
            const res = await fetch('/api/db', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'get_app_permissions', sessionId: sid }) });
            const data = await res.json();
            if (data.success) { setPermissions(data.permissions || []); setIsSetup(true); }
        } catch { /* table may not exist yet */ }
        finally { setLoading(false); }
    };

    const handleSetup = async () => {
        if (!sessionId) return;
        setSetupLoading(true);
        try {
            const res = await fetch('/api/db', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'setup_app_permissions_table', sessionId }) });
            const data = await res.json();
            if (data.success) { setIsSetup(true); showMsg('success', data.message); }
            else showMsg('error', data.message);
        } catch { showMsg('error', 'فشل الإنشاء'); }
        finally { setSetupLoading(false); }
    };

    const togglePerm = async (username: string, permKey: string, currentGranted: boolean) => {
        if (!sessionId) return;
        const key = `${username}-${permKey}`;
        setSaving(key);
        try {
            const res = await fetch('/api/db', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'set_app_permission', sessionId, targetUser: username, permissionKey: permKey, granted: !currentGranted }) });
            const data = await res.json();
            if (data.success) {
                setPermissions(prev => {
                    const exists = prev.find(p => p.username === username && p.permission_key === permKey);
                    if (exists) return prev.map(p => p.username === username && p.permission_key === permKey ? { ...p, granted: !currentGranted ? 1 : 0 } : p);
                    return [...prev, { id: Date.now(), username, permission_key: permKey, granted: 1, granted_at: new Date().toISOString(), notes: '' }];
                });
                showMsg('success', data.message);
            } else showMsg('error', data.message);
        } catch { showMsg('error', 'فشل الاتصال'); }
        finally { setSaving(''); }
    };

    const showMsg = (type: string, text: string) => { setMessage({ type, text }); setTimeout(() => setMessage({ type: '', text: '' }), 4000); };

    const getUserPerm = (username: string, key: string) => permissions.find(p => p.username === username && p.permission_key === key);
    const isGranted = (username: string, key: string) => { const p = getUserPerm(username, key); return p ? p.granted === 1 : false; };

    const filteredPerms = selectedUser ? permissions.filter(p => p.username === selectedUser) : permissions;
    const displayUsers = selectedUser ? [{ username: selectedUser }] : users.slice(0, 8);

    return (
        <div className="flex flex-col gap-5">
            {/* Setup prompt */}
            {!isSetup && !loading && (
                <div className="bg-purple-900/20 border border-purple-500/30 rounded-2xl p-6 flex flex-col gap-4">
                    <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center border border-purple-500/30 shrink-0">
                            <Shield className="w-6 h-6 text-purple-400" />
                        </div>
                        <div>
                            <h3 className="font-bold text-purple-300 text-base">تفعيل نظام إدارة الصلاحيات</h3>
                            <p className="text-slate-400 text-sm mt-1">يتطلب إنشاء جدول <code className="text-purple-400 bg-purple-500/10 px-1 rounded">_system_app_permissions</code> في قاعدة البيانات المراقبة لتخزين الصلاحيات المخصصة.</p>
                        </div>
                    </div>
                    <button onClick={handleSetup} disabled={setupLoading}
                        className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50">
                        {setupLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                        {setupLoading ? 'جاري الإنشاء...' : 'إنشاء جدول الصلاحيات'}
                    </button>
                </div>
            )}

            {message.text && (
                <div className={`p-3 rounded-xl border text-sm flex items-center gap-2 animate-in fade-in ${message.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
                    {message.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
                    {message.text}
                </div>
            )}

            {isSetup && (
                <>
                    {/* Filter + Refresh */}
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                        <h3 className="font-bold text-white flex items-center gap-2">
                            <Shield className="w-5 h-5 text-purple-400" /> لوحة الصلاحيات
                        </h3>
                        <div className="flex gap-2">
                            <div className="relative">
                                <select value={selectedUser} onChange={e => setSelectedUser(e.target.value)}
                                    className="bg-slate-900/80 border border-slate-700 rounded-xl px-4 py-2 text-sm text-slate-300 outline-none focus:border-purple-500 appearance-none pr-8 min-w-[160px]">
                                    <option value="">كل المستخدمين</option>
                                    {users.map((u, i) => <option key={i} value={u.username}>{u.username}</option>)}
                                </select>
                                <ChevronDown className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
                            </div>
                            <button onClick={() => sessionId && tryFetchPerms(sessionId)}
                                className="p-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-400 hover:text-white transition-all">
                                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                            </button>
                        </div>
                    </div>

                    {loading ? (
                        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-purple-400" /></div>
                    ) : displayUsers.length === 0 ? (
                        <div className="text-center py-16 text-slate-500 bg-slate-800/30 border border-slate-700/40 rounded-2xl">
                            <Shield className="w-12 h-12 mx-auto mb-3 opacity-10" />
                            <p className="text-sm">حدد مستخدماً من القائمة لإدارة صلاحياته</p>
                            <p className="text-xs opacity-60 mt-1">أو اختر "كل المستخدمين" لعرض الكل</p>
                        </div>
                    ) : (
                        /* Permission Matrix */
                        <div className="flex flex-col gap-6">
                            {GROUPS.map(group => (
                                <div key={group} className="bg-slate-800/40 border border-slate-700/50 rounded-2xl overflow-hidden">
                                    <div className="px-5 py-3 border-b border-slate-700/50 bg-slate-800/60">
                                        <h4 className="font-bold text-slate-300 text-sm">{group}</h4>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead className="bg-slate-800/40 text-xs text-slate-500 border-b border-slate-700/30">
                                                <tr>
                                                    <th className="px-4 py-2.5 font-semibold text-right">الصلاحية</th>
                                                    {displayUsers.map((u, i) => (
                                                        <th key={i} className="px-4 py-2.5 font-semibold text-center font-mono text-purple-400">
                                                            {u.username}
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-800/40">
                                                {PRESET_PERMISSIONS.filter(p => p.group === group).map(perm => (
                                                    <tr key={perm.key} className="hover:bg-slate-800/30 transition-colors">
                                                        <td className="px-4 py-3 text-slate-300 text-sm">{perm.label}
                                                            <span className="mr-2 text-[10px] font-mono text-slate-600">{perm.key}</span>
                                                        </td>
                                                        {displayUsers.map((u, i) => {
                                                            const granted = isGranted(u.username, perm.key);
                                                            const isSaving = saving === `${u.username}-${perm.key}`;
                                                            return (
                                                                <td key={i} className="px-4 py-3 text-center">
                                                                    <button onClick={() => togglePerm(u.username, perm.key, granted)} disabled={isSaving}
                                                                        className={`w-10 h-6 rounded-full border-2 flex items-center transition-all duration-300 mx-auto ${granted ? 'bg-purple-600 border-purple-500 justify-end' : 'bg-slate-800 border-slate-600 justify-start'} disabled:opacity-50`}>
                                                                        {isSaving
                                                                            ? <Loader2 className="w-3 h-3 animate-spin mx-auto text-white" />
                                                                            : <span className={`w-4 h-4 rounded-full mx-0.5 transition-all ${granted ? 'bg-white' : 'bg-slate-500'}`} />
                                                                        }
                                                                    </button>
                                                                </td>
                                                            );
                                                        })}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Custom Permissions Summary */}
                    {filteredPerms.length > 0 && (
                        <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl overflow-hidden">
                            <div className="px-5 py-3 border-b border-slate-700/50 flex items-center justify-between">
                                <h4 className="font-bold text-slate-300 text-sm flex items-center gap-2">
                                    <Info className="w-4 h-4 text-purple-400" /> الصلاحيات المحفوظة
                                    <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">{filteredPerms.length}</span>
                                </h4>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs text-right">
                                    <thead className="bg-slate-800/60 text-slate-500 border-b border-slate-700">
                                        <tr>
                                            <th className="px-4 py-2.5 font-semibold">المستخدم</th>
                                            <th className="px-4 py-2.5 font-semibold">الصلاحية</th>
                                            <th className="px-4 py-2.5 font-semibold text-center">الحالة</th>
                                            <th className="px-4 py-2.5 font-semibold">تاريخ التعيين</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/40">
                                        {filteredPerms.map(p => (
                                            <tr key={p.id} className="hover:bg-slate-800/30 transition-colors">
                                                <td className="px-4 py-2.5 font-mono text-purple-300 font-bold">{p.username}</td>
                                                <td className="px-4 py-2.5 text-slate-300">{p.permission_key}</td>
                                                <td className="px-4 py-2.5 text-center">
                                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${p.granted ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                                                        {p.granted ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                                                        {p.granted ? 'ممنوح' : 'مسحوب'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-2.5 text-slate-500">{new Date(p.granted_at).toLocaleDateString('ar-EG')}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

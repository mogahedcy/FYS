'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    Users, Search, RefreshCw, Loader2, ChevronLeft, ChevronRight,
    CheckCircle2, XCircle, KeyRound, Eye, EyeOff, AlertTriangle,
    Settings2, Sparkles, ToggleLeft, ToggleRight, UserCog,
    Shield, Mail, Clock, Hash, Tag, ChevronDown
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
type ColInfo = { name: string; type: string; key: string };
type Mapping = {
    idColumn: string | null;
    usernameColumn: string | null;
    passwordColumn: string | null;
    emailColumn: string | null;
    roleColumn: string | null;
    statusColumn: string | null;
    createdAtColumn: string | null;
    lastLoginColumn: string | null;
};

const MAPPING_LABELS: Record<keyof Mapping, { label: string; icon: any; desc: string }> = {
    idColumn: { label: 'عمود الـ ID', icon: Hash, desc: 'المفتاح الرئيسي' },
    usernameColumn: { label: 'اسم المستخدم', icon: Users, desc: 'الحقل الذي يظهر كهوية المستخدم' },
    passwordColumn: { label: 'كلمة المرور', icon: KeyRound, desc: 'الحقل المُشفَّر أو النصي' },
    emailColumn: { label: 'البريد الإلكتروني', icon: Mail, desc: 'اختياري' },
    roleColumn: { label: 'الدور / الصلاحية', icon: Shield, desc: 'admin, user, مشرف...' },
    statusColumn: { label: 'الحالة', icon: ToggleLeft, desc: '1/0 أو active/blocked' },
    createdAtColumn: { label: 'تاريخ الإنشاء', icon: Clock, desc: 'اختياري' },
    lastLoginColumn: { label: 'آخر تسجيل دخول', icon: Clock, desc: 'اختياري' },
};

const HASH_OPTIONS = [
    { value: 'plain', label: 'نص عادي (بدون تشفير)' },
    { value: 'bcrypt', label: 'bcrypt (الأكثر أماناً)' },
    { value: 'md5', label: 'MD5 (قديم)' },
    { value: 'sha256', label: 'SHA-256' },
    { value: 'sha1', label: 'SHA-1 (قديم)' },
];

// ─── STEP INDICATOR ──────────────────────────────────────────────────────────
function StepBadge({ n, label, active, done }: { n: number; label: string; active: boolean; done: boolean }) {
    return (
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${done ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20' : active ? 'text-indigo-400 bg-indigo-500/10 border border-indigo-500/30' : 'text-slate-600 border border-transparent'}`}>
            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${done ? 'bg-emerald-500 text-white' : active ? 'bg-indigo-600 text-white' : 'bg-slate-800 border border-slate-700'}`}>
                {done ? '✓' : n}
            </div>
            {label}
        </div>
    );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function AppUsersPage() {
    const [sessionId, setSessionId] = useState<string | null>(null);
    // Step control
    const [step, setStep] = useState<1 | 2 | 3>(1);
    // Step 1: table selection
    const [tables, setTables] = useState<string[]>([]);
    const [tablesLoading, setTablesLoading] = useState(false);
    const [selectedTable, setSelectedTable] = useState('');
    // Step 2: column mapping
    const [allColumns, setAllColumns] = useState<ColInfo[]>([]);
    const [mapping, setMapping] = useState<Mapping>({ idColumn: null, usernameColumn: null, passwordColumn: null, emailColumn: null, roleColumn: null, statusColumn: null, createdAtColumn: null, lastLoginColumn: null });
    const [analyzeLoading, setAnalyzeLoading] = useState(false);
    const [sampleRows, setSampleRows] = useState<any[]>([]);
    // Step 3: users list
    const [rows, setRows] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [usersLoading, setUsersLoading] = useState(false);
    const [searchValue, setSearchValue] = useState('');
    // Actions
    const [editingUser, setEditingUser] = useState<any | null>(null);
    const [editField, setEditField] = useState<string>('');
    const [editValue, setEditValue] = useState('');
    const [showEditVal, setShowEditVal] = useState(false);
    const [hashType, setHashType] = useState('bcrypt');
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    const LIMIT = 15;

    useEffect(() => {
        const sid = localStorage.getItem('dbConnectionSession');
        setSessionId(sid);
        if (sid) fetchTables(sid);
    }, []);

    // ── Fetch tables ─────────────────────────────────────────────────────────
    const fetchTables = async (sid: string) => {
        setTablesLoading(true);
        try {
            const res = await fetch('/api/db', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'get_tables', sessionId: sid }) });
            const data = await res.json();
            if (data.success) setTables((data.tables || []).filter((t: string) => !t.startsWith('_system')));
        } catch (e) { console.error(e); }
        finally { setTablesLoading(false); }
    };

    // ── Analyze selected table ────────────────────────────────────────────────
    const analyzeTable = async () => {
        if (!sessionId || !selectedTable) return;
        setAnalyzeLoading(true);
        try {
            const res = await fetch('/api/db', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'analyze_user_table', sessionId, targetTable: selectedTable }) });
            const data = await res.json();
            if (data.success) {
                setAllColumns(data.columns || []);
                setMapping(data.suggestions || {});
                setSampleRows(data.sampleRows || []);
                setStep(2);
            } else {
                setMessage({ type: 'error', text: data.message });
            }
        } catch { setMessage({ type: 'error', text: 'فشل التحليل' }); }
        finally { setAnalyzeLoading(false); }
    };

    // ── Fetch users ───────────────────────────────────────────────────────────
    const fetchUsers = useCallback(async (pg: number = 1, search: string = '') => {
        if (!sessionId || !selectedTable || !mapping.idColumn) return;
        setUsersLoading(true);
        try {
            const res = await fetch('/api/db', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'get_app_table_rows', sessionId, targetTable: selectedTable, page: pg, limit: LIMIT, searchColumn: search && mapping.usernameColumn ? mapping.usernameColumn : undefined, searchValue: search || undefined }),
            });
            const data = await res.json();
            if (data.success) { setRows(data.rows || []); setTotal(data.total || 0); setPage(pg); }
            else setMessage({ type: 'error', text: data.message });
        } catch { setMessage({ type: 'error', text: 'فشل جلب المستخدمين' }); }
        finally { setUsersLoading(false); }
    }, [sessionId, selectedTable, mapping]);

    const handleGoToStep3 = () => {
        localStorage.setItem('appUsersTable', selectedTable);
        if (mapping.usernameColumn) localStorage.setItem('appUsersNameCol', mapping.usernameColumn);
        setStep(3);
        fetchUsers(1, '');
    };

    // ── Save field update ─────────────────────────────────────────────────────
    const handleSave = async () => {
        if (!sessionId || !editingUser || !editField || !mapping.idColumn) return;
        setSaving(true);
        setMessage({ type: '', text: '' });
        try {
            const res = await fetch('/api/db', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'update_app_user_field', sessionId, targetTable: selectedTable, idColumn: mapping.idColumn, rowId: editingUser[mapping.idColumn], fieldName: editField, fieldValue: editValue, hashType: editField === mapping.passwordColumn ? hashType : 'plain' }),
            });
            const data = await res.json();
            setMessage({ type: data.success ? 'success' : 'error', text: data.message });
            if (data.success) { setEditingUser(null); setEditField(''); setEditValue(''); fetchUsers(page, searchValue); }
        } catch { setMessage({ type: 'error', text: 'فشل الاتصال' }); }
        finally { setSaving(false); }
    };

    const totalPages = Math.ceil(total / LIMIT);
    const userDisplayName = (row: any) => {
        if (mapping.usernameColumn && row[mapping.usernameColumn] !== undefined) return String(row[mapping.usernameColumn]);
        if (mapping.emailColumn && row[mapping.emailColumn]) return String(row[mapping.emailColumn]);
        return `#${row[mapping.idColumn!]}`;
    };

    return (
        <div className="flex flex-col gap-6">

            {/* ── Step Progress ── */}
            <div className="flex items-center gap-2 flex-wrap">
                <StepBadge n={1} label="اختيار الجدول" active={step === 1} done={step > 1} />
                <div className="h-px flex-1 bg-slate-700/50 min-w-[20px]" />
                <StepBadge n={2} label="تعيين الأعمدة" active={step === 2} done={step > 2} />
                <div className="h-px flex-1 bg-slate-700/50 min-w-[20px]" />
                <StepBadge n={3} label="إدارة المستخدمين" active={step === 3} done={false} />
            </div>

            {/* ── Message ── */}
            {message.text && (
                <div className={`p-3 rounded-xl border text-sm flex items-center gap-2 animate-in fade-in duration-300 ${message.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
                    {message.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
                    {message.text}
                </div>
            )}

            {/* ══════════════════════════════════════════════════════
                STEP 1: Select Table
            ══════════════════════════════════════════════════════ */}
            {step === 1 && (
                <div className="flex flex-col gap-5 animate-in fade-in slide-in-from-bottom-3 duration-300">
                    <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6">
                        <h3 className="font-bold text-white text-base flex items-center gap-2 mb-2">
                            <UserCog className="w-5 h-5 text-indigo-400" /> اختر جدول مستخدمي التطبيق
                        </h3>
                        <p className="text-slate-400 text-sm mb-6">اختر الجدول الذي يحتوي على مستخدمي نظامك المحاسبي. سيقوم النظام بتحليله وتحديد الأعمدة تلقائياً.</p>

                        {tablesLoading ? (
                            <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-indigo-400" /></div>
                        ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                {tables.map(t => (
                                    <button key={t} onClick={() => setSelectedTable(t)}
                                        className={`p-3 rounded-xl border text-sm font-bold text-right transition-all duration-200 ${selectedTable === t ? 'bg-indigo-600 border-indigo-500 text-white shadow-[0_0_15px_rgba(99,102,241,0.4)]' : 'bg-slate-900/50 border-slate-700/50 text-slate-400 hover:border-indigo-500/30 hover:text-slate-200'}`}>
                                        {t}
                                    </button>
                                ))}
                                {tables.length === 0 && <p className="col-span-4 text-slate-500 text-sm text-center py-8">لا توجد جداول متاحة</p>}
                            </div>
                        )}

                        <button onClick={analyzeTable} disabled={!selectedTable || analyzeLoading}
                            className="mt-6 w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(99,102,241,0.3)] disabled:opacity-40 disabled:cursor-not-allowed">
                            {analyzeLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                            {analyzeLoading ? 'جاري التحليل الذكي...' : selectedTable ? `تحليل جدول "${selectedTable}"` : 'اختر جدولاً أولاً'}
                        </button>
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════════════
                STEP 2: Column Mapping
            ══════════════════════════════════════════════════════ */}
            {step === 2 && (
                <div className="flex flex-col gap-5 animate-in fade-in slide-in-from-bottom-3 duration-300">

                    {/* Auto-detect notice */}
                    <div className="flex items-center gap-3 p-4 bg-indigo-900/20 border border-indigo-500/30 rounded-xl text-indigo-400 text-sm">
                        <Sparkles className="w-4 h-4 shrink-0 animate-pulse" />
                        <span>تم التحليل الذكي للجدول <strong>"{selectedTable}"</strong> — راجع التعيينات أدناه وعدِّل ما يلزم.</span>
                    </div>

                    {/* Mapping Grid */}
                    <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6">
                        <h3 className="font-bold text-white text-sm flex items-center gap-2 mb-5">
                            <Settings2 className="w-4 h-4 text-indigo-400" /> تعيين أعمدة الجدول
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {(Object.keys(MAPPING_LABELS) as (keyof Mapping)[]).map(key => {
                                const { label, icon: Icon, desc } = MAPPING_LABELS[key];
                                const isRequired = key === 'idColumn' || key === 'usernameColumn';
                                return (
                                    <div key={key} className="flex flex-col gap-1.5">
                                        <label className="text-xs text-slate-400 font-semibold flex items-center gap-1.5">
                                            <Icon className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                                            {label}
                                            {isRequired && <span className="text-red-400">*</span>}
                                            <span className="text-slate-600 font-normal">— {desc}</span>
                                        </label>
                                        <div className="relative">
                                            <select
                                                value={mapping[key] || ''}
                                                onChange={e => setMapping(m => ({ ...m, [key]: e.target.value || null }))}
                                                className="w-full bg-slate-900/80 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-indigo-500 transition-colors appearance-none pr-10"
                                            >
                                                <option value="">— غير محدد —</option>
                                                {allColumns.map(c => (
                                                    <option key={c.name} value={c.name}>{c.name} ({c.type})</option>
                                                ))}
                                            </select>
                                            <ChevronDown className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Sample Data Preview */}
                    {sampleRows.length > 0 && (
                        <div className="bg-slate-900/60 border border-slate-700/30 rounded-2xl overflow-hidden">
                            <p className="text-xs text-slate-500 font-semibold px-5 py-3 border-b border-slate-700/30">معاينة بيانات (أول 3 صفوف)</p>
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs text-right">
                                    <thead>
                                        <tr className="bg-slate-800/60 border-b border-slate-700">
                                            {allColumns.map(c => (
                                                <th key={c.name} className={`px-4 py-2.5 font-semibold whitespace-nowrap ${Object.values(mapping).includes(c.name) ? 'text-indigo-400' : 'text-slate-500'}`}>
                                                    {c.name}
                                                    {Object.values(mapping).includes(c.name) && <span className="mr-1 text-[9px] bg-indigo-500/20 text-indigo-400 px-1 rounded">✓</span>}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/50">
                                        {sampleRows.map((row: any, i) => (
                                            <tr key={i} className="hover:bg-slate-800/30">
                                                {allColumns.map(c => (
                                                    <td key={c.name} className="px-4 py-2 text-slate-400 font-mono max-w-[150px] truncate">
                                                        {String(row[c.name] ?? '—')}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    <div className="flex gap-3">
                        <button onClick={() => setStep(1)} className="px-5 py-3 bg-slate-800 border border-slate-700 text-slate-400 rounded-xl text-sm hover:bg-slate-700 transition-all">
                            ← رجوع
                        </button>
                        <button onClick={handleGoToStep3} disabled={!mapping.idColumn}
                            className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(99,102,241,0.3)] disabled:opacity-40">
                            <UserCog className="w-5 h-5" /> عرض وإدارة المستخدمين →
                        </button>
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════════════
                STEP 3: Users Management
            ══════════════════════════════════════════════════════ */}
            {step === 3 && (
                <div className="flex flex-col gap-5 animate-in fade-in slide-in-from-bottom-3 duration-300">

                    {/* Toolbar */}
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-3">
                            <h3 className="font-bold text-white flex items-center gap-2">
                                <Users className="w-5 h-5 text-indigo-400" />
                                مستخدمو النظام
                                <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">{total} مستخدم</span>
                            </h3>
                            <span className="text-xs text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-lg">{selectedTable}</span>
                        </div>
                        <div className="flex gap-2">
                            <div className="flex items-center gap-2 bg-slate-900/60 border border-slate-700 rounded-xl px-3 py-2">
                                <Search className="w-3.5 h-3.5 text-slate-500" />
                                <input type="text" placeholder="بحث..." value={searchValue}
                                    onChange={e => { setSearchValue(e.target.value); fetchUsers(1, e.target.value); }}
                                    className="bg-transparent text-sm text-slate-300 placeholder:text-slate-600 outline-none w-36" />
                            </div>
                            <button onClick={() => fetchUsers(page, searchValue)} className="p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-400 hover:text-white hover:bg-slate-700 transition-all">
                                <RefreshCw className={`w-4 h-4 ${usersLoading ? 'animate-spin' : ''}`} />
                            </button>
                            <button onClick={() => { setStep(2); }}
                                className="px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-400 hover:text-white text-xs font-bold hover:bg-slate-700 transition-all">
                                ✎ تعديل التعيينات
                            </button>
                        </div>
                    </div>

                    {/* Edit Panel */}
                    {editingUser && mapping.idColumn && (
                        <div className="bg-indigo-900/20 border border-indigo-500/30 rounded-2xl p-6 flex flex-col gap-4 animate-in slide-in-from-top-4 duration-300">
                            <div className="flex items-center justify-between">
                                <h4 className="font-bold text-indigo-300 flex items-center gap-2 text-sm">
                                    <Settings2 className="w-4 h-4" />
                                    تعديل: <span className="font-mono text-white">{userDisplayName(editingUser)}</span>
                                </h4>
                                <button onClick={() => { setEditingUser(null); setEditField(''); setEditValue(''); }} className="text-slate-500 hover:text-white transition-colors">✕</button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                {/* Field selector */}
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-xs text-slate-400 font-semibold">الحقل المراد تعديله</label>
                                    <div className="relative">
                                        <select value={editField} onChange={e => { setEditField(e.target.value); setEditValue(''); }}
                                            className="w-full bg-slate-900/80 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-indigo-500 transition-colors appearance-none">
                                            <option value="">— اختر حقلاً —</option>
                                            {allColumns.filter(c => c.name !== mapping.idColumn).map(c => (
                                                <option key={c.name} value={c.name}>
                                                    {c.name === mapping.passwordColumn ? `🔑 ${c.name}` :
                                                        c.name === mapping.statusColumn ? `🔘 ${c.name}` :
                                                            c.name === mapping.roleColumn ? `🏷️ ${c.name}` : c.name}
                                                </option>
                                            ))}
                                        </select>
                                        <ChevronDown className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                                    </div>
                                </div>

                                {/* Value input */}
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-xs text-slate-400 font-semibold">القيمة الجديدة</label>
                                    {editField === mapping.statusColumn ? (
                                        <div className="relative">
                                            <select value={editValue} onChange={e => setEditValue(e.target.value)}
                                                className="w-full bg-slate-900/80 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-indigo-500 appearance-none">
                                                <option value="">— اختر —</option>
                                                <option value="1">✅ مفعّل (1)</option>
                                                <option value="0">❌ معطّل (0)</option>
                                                <option value="active">active</option>
                                                <option value="inactive">inactive</option>
                                                <option value="blocked">blocked</option>
                                            </select>
                                            <ChevronDown className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                                        </div>
                                    ) : (
                                        <div className="relative">
                                            <input type={editField === mapping.passwordColumn && !showEditVal ? 'password' : 'text'}
                                                value={editValue} onChange={e => setEditValue(e.target.value)}
                                                placeholder={editField === mapping.passwordColumn ? 'كلمة المرور الجديدة' : 'القيمة الجديدة'}
                                                dir={editField === mapping.passwordColumn ? 'ltr' : 'rtl'}
                                                className="w-full bg-slate-900/80 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-indigo-500 transition-colors pr-9" />
                                            {editField === mapping.passwordColumn && (
                                                <button onClick={() => setShowEditVal(!showEditVal)} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
                                                    {showEditVal ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Hash type (only for password) */}
                                {editField === mapping.passwordColumn ? (
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-xs text-slate-400 font-semibold">نوع التشفير</label>
                                        <div className="relative">
                                            <select value={hashType} onChange={e => setHashType(e.target.value)}
                                                className="w-full bg-slate-900/80 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-amber-500 appearance-none">
                                                {HASH_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                            </select>
                                            <ChevronDown className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-end">
                                        <button onClick={handleSave} disabled={!editField || !editValue || saving}
                                            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-40">
                                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                                            {saving ? 'جاري الحفظ...' : 'حفظ التعديل'}
                                        </button>
                                    </div>
                                )}
                            </div>

                            {editField === mapping.passwordColumn && (
                                <button onClick={handleSave} disabled={!editField || !editValue || saving}
                                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-40">
                                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                                    {saving ? 'جاري تغيير كلمة المرور...' : 'تغيير كلمة المرور'}
                                </button>
                            )}

                            {editField === mapping.statusColumn && editValue && (
                                <button onClick={handleSave} disabled={saving}
                                    className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-40 ${editValue === '1' || editValue === 'active' ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-red-600 hover:bg-red-500 text-white'}`}>
                                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : (editValue === '1' || editValue === 'active') ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                                    {saving ? 'جاري التحديث...' : (editValue === '1' || editValue === 'active') ? 'تفعيل الحساب' : 'تعطيل الحساب'}
                                </button>
                            )}
                        </div>
                    )}

                    {/* Users Table */}
                    <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl overflow-hidden">
                        {usersLoading ? (
                            <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-indigo-400" /></div>
                        ) : rows.length === 0 ? (
                            <div className="text-center py-16 text-slate-500">
                                <Users className="w-12 h-12 mx-auto mb-3 opacity-10" />
                                <p className="text-sm">لا يوجد مستخدمون في هذا الجدول</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-right">
                                    <thead className="bg-slate-800/80 text-xs text-slate-400 border-b border-slate-700">
                                        <tr>
                                            <th className="px-5 py-3 font-semibold">المستخدم</th>
                                            {mapping.emailColumn && <th className="px-5 py-3 font-semibold">البريد</th>}
                                            {mapping.roleColumn && <th className="px-5 py-3 font-semibold">الدور</th>}
                                            {mapping.statusColumn && <th className="px-5 py-3 font-semibold text-center">الحالة</th>}
                                            {mapping.lastLoginColumn && <th className="px-5 py-3 font-semibold">آخر دخول</th>}
                                            {mapping.createdAtColumn && <th className="px-5 py-3 font-semibold">تاريخ الإنشاء</th>}
                                            <th className="px-5 py-3 font-semibold text-center">إجراءات</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/60">
                                        {rows.map((row, i) => {
                                            const name = userDisplayName(row);
                                            const status = mapping.statusColumn ? row[mapping.statusColumn] : null;
                                            const isActive = status === 1 || status === '1' || status === 'active' || status === true;
                                            const isEditing = editingUser && mapping.idColumn && editingUser[mapping.idColumn] === row[mapping.idColumn!];
                                            return (
                                                <tr key={i} className={`hover:bg-slate-800/50 transition-colors ${isEditing ? 'bg-indigo-900/20' : ''}`}>
                                                    <td className="px-5 py-3">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400 font-black text-xs shrink-0">
                                                                {name.charAt(0).toUpperCase()}
                                                            </div>
                                                            <div>
                                                                <p className="font-bold text-slate-200 text-xs">{name}</p>
                                                                <p className="text-[10px] text-slate-600 font-mono">ID: {mapping.idColumn ? row[mapping.idColumn] : '—'}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    {mapping.emailColumn && <td className="px-5 py-3 text-xs text-slate-400">{row[mapping.emailColumn] || '—'}</td>}
                                                    {mapping.roleColumn && (
                                                        <td className="px-5 py-3">
                                                            <span className="text-xs font-bold px-2 py-1 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
                                                                {String(row[mapping.roleColumn] || '—')}
                                                            </span>
                                                        </td>
                                                    )}
                                                    {mapping.statusColumn && (
                                                        <td className="px-5 py-3 text-center">
                                                            <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg border ${isActive ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                                                                {isActive ? <ToggleRight className="w-3 h-3" /> : <ToggleLeft className="w-3 h-3" />}
                                                                {isActive ? 'نشط' : 'معطّل'}
                                                            </span>
                                                        </td>
                                                    )}
                                                    {mapping.lastLoginColumn && (
                                                        <td className="px-5 py-3 text-xs text-slate-500 whitespace-nowrap">
                                                            {row[mapping.lastLoginColumn] ? new Date(row[mapping.lastLoginColumn]).toLocaleDateString('ar-EG') : '—'}
                                                        </td>
                                                    )}
                                                    {mapping.createdAtColumn && (
                                                        <td className="px-5 py-3 text-xs text-slate-500 whitespace-nowrap">
                                                            {row[mapping.createdAtColumn] ? new Date(row[mapping.createdAtColumn]).toLocaleDateString('ar-EG') : '—'}
                                                        </td>
                                                    )}
                                                    <td className="px-5 py-3 text-center">
                                                        <button onClick={() => { setEditingUser(row); setEditField(''); setEditValue(''); }}
                                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${isEditing ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20 hover:bg-indigo-500/20'}`}>
                                                            {isEditing ? '✎ تحرير' : '✎ تعديل'}
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-slate-500">
                                عرض {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} من {total}
                            </span>
                            <div className="flex items-center gap-2">
                                <button onClick={() => fetchUsers(page - 1, searchValue)} disabled={page === 1}
                                    className="p-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-400 hover:text-white hover:bg-slate-700 transition-all disabled:opacity-30">
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                                <span className="text-xs text-slate-400 font-mono bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-lg">
                                    {page} / {totalPages}
                                </span>
                                <button onClick={() => fetchUsers(page + 1, searchValue)} disabled={page === totalPages}
                                    className="p-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-400 hover:text-white hover:bg-slate-700 transition-all disabled:opacity-30">
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

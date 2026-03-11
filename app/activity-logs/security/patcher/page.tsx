'use client';

import { useState, useEffect } from 'react';
import {
    Terminal, Zap, ChevronDown, ChevronUp, FileScan,
    Loader2, CheckCircle2, XCircle, AlertTriangle
} from 'lucide-react';

const EXAMPLES = [
    { ext: 'PHP', lang: 'Laravel / Pure PHP', path: '/var/www/html/auth/login.php', color: 'blue' },
    { ext: 'TS', lang: 'Next.js API Route', path: '/app/api/auth/login/route.ts', color: 'indigo' },
    { ext: 'JS', lang: 'Express.js', path: '/routes/auth.js', color: 'yellow' },
];

const EXAMPLE_COLORS: Record<string, string> = {
    blue: 'bg-blue-500/5 border-blue-500/20 text-blue-400 hover:bg-blue-500/10',
    indigo: 'bg-indigo-500/5 border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/10',
    yellow: 'bg-yellow-500/5 border-yellow-500/20 text-yellow-400 hover:bg-yellow-500/10',
};

export default function PatcherPage() {
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [filePath, setFilePath] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<{ type: string; text: string } | null>(null);
    const [showInfo, setShowInfo] = useState(false);

    useEffect(() => {
        setSessionId(localStorage.getItem('dbConnectionSession'));
    }, []);

    const handlePatch = async () => {
        if (!sessionId || !filePath.trim()) return;
        setLoading(true);
        setResult(null);
        try {
            const res = await fetch('/api/db', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'patch_login_file', sessionId, filePath: filePath.trim() }),
            });
            const data = await res.json();
            setResult({ type: data.success ? 'success' : 'error', text: data.message || 'استجابة غير معروفة' });
        } catch {
            setResult({ type: 'error', text: 'فشل الاتصال بالخادم' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col gap-6 max-w-3xl">

            {/* ── Hero Card ── */}
            <div className="bg-amber-900/20 border border-amber-500/30 rounded-2xl p-6 relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(245,158,11,0.12),transparent_60%)] pointer-events-none" />
                <div className="flex items-start gap-4 relative z-10">
                    <div className="w-14 h-14 bg-amber-500/20 border border-amber-500/40 rounded-2xl flex items-center justify-center shadow-[0_0_20px_rgba(245,158,11,0.3)] shrink-0">
                        <Zap className="w-7 h-7 text-amber-400" />
                    </div>
                    <div className="flex-1">
                        <h3 className="font-bold text-amber-300 text-lg">الترقيع الذكي للتطبيقات</h3>
                        <p className="text-slate-400 text-sm mt-1.5 leading-relaxed">
                            يُضيف كود تسجيل محاولات الدخول الفاشلة تلقائياً إلى ملف تسجيل الدخول في تطبيقك
                            (PHP · JS · TS) دون أي تعديل يدوي.
                        </p>
                        <button onClick={() => setShowInfo(!showInfo)}
                            className="flex items-center gap-1.5 mt-3 text-xs text-amber-500 hover:text-amber-300 transition-colors font-semibold">
                            {showInfo ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            {showInfo ? 'إخفاء التفاصيل' : 'كيف يعمل؟'}
                        </button>
                    </div>
                </div>

                {showInfo && (
                    <div className="mt-5 bg-slate-900/60 border border-slate-700/50 rounded-xl p-5 animate-in slide-in-from-top-3 duration-300">
                        <ol className="flex flex-col gap-3 text-sm text-slate-400">
                            {[
                                { n: '01', t: 'يقرأ النظام الملف المحدد على السيرفر', c: 'text-amber-400' },
                                { n: '02', t: 'يبحث عن أنماط الدخول الفاشل (password_verify في PHP / status 401 في JS)', c: 'text-amber-400' },
                                { n: '03', t: 'يُضيف كود يُرسل طلب POST إلى /api/db عند كل فشل', c: 'text-amber-400' },
                                { n: '04', t: 'يُحفظ الحدث في جدول _system_security_audit تلقائياً', c: 'text-emerald-400' },
                            ].map(step => (
                                <li key={step.n} className="flex items-start gap-3">
                                    <span className={`font-black font-mono text-xs shrink-0 mt-0.5 ${step.c}`}>{step.n}</span>
                                    <span>{step.t}</span>
                                </li>
                            ))}
                        </ol>
                    </div>
                )}
            </div>

            {/* ── Quick Examples ── */}
            <div>
                <p className="text-xs text-slate-500 font-semibold mb-3">أمثلة سريعة — انقر للتعبئة:</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {EXAMPLES.map((ex, i) => (
                        <button key={i} onClick={() => setFilePath(ex.path)}
                            className={`p-4 rounded-xl border text-right transition-all ${EXAMPLE_COLORS[ex.color]}`}>
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-[10px] font-black font-mono px-2 py-0.5 rounded bg-white/10">{ex.ext}</span>
                                <span className="text-xs font-bold">{ex.lang}</span>
                            </div>
                            <p className="font-mono text-[10px] opacity-50 truncate">{ex.path}</p>
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Patcher Form ── */}
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6 flex flex-col gap-5">
                <h4 className="font-bold text-white text-sm flex items-center gap-2">
                    <FileScan className="w-4 h-4 text-amber-400" /> مسار ملف تسجيل الدخول
                </h4>

                <div className="flex flex-col gap-3">
                    <input type="text" value={filePath} onChange={e => setFilePath(e.target.value)}
                        placeholder="/var/www/html/login.php أو /app/api/auth/route.ts"
                        dir="ltr"
                        className="w-full bg-slate-900/80 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-amber-500 transition-colors font-mono placeholder:text-slate-600" />

                    <button onClick={handlePatch} disabled={loading || !filePath.trim() || !sessionId}
                        className="w-full flex items-center justify-center gap-2 py-3.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-bold text-sm transition-all shadow-[0_0_20px_rgba(245,158,11,0.3)] disabled:opacity-40 disabled:cursor-not-allowed">
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" />}
                        {loading ? 'جاري الترقيع...' : 'ترقيع الملف الآن'}
                    </button>
                </div>

                {/* Result */}
                {result && (
                    <div className={`p-4 rounded-xl border flex items-start gap-3 animate-in fade-in duration-300 ${result.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
                        {result.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" /> : <XCircle className="w-5 h-5 shrink-0 mt-0.5" />}
                        <div>
                            <p className="font-bold text-sm">{result.type === 'success' ? 'تم الترقيع بنجاح! ✅' : 'فشل الترقيع ❌'}</p>
                            <p className="text-xs opacity-80 mt-1">{result.text}</p>
                        </div>
                    </div>
                )}

                {/* Warning */}
                <div className="flex items-start gap-3 p-4 bg-slate-900/60 border border-slate-700/30 rounded-xl">
                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-slate-500 leading-relaxed">
                        <span className="text-amber-500 font-bold">تحذير مهم: </span>
                        يجب أن يكون الملف موجوداً على نفس السيرفر الذي يعمل عليه هذا التطبيق.
                        يُنصح بأخذ نسخة احتياطية قبل الترقيع. لن يُطبَّق الترقيع مرتين على نفس الملف.
                    </p>
                </div>
            </div>

            {/* ── Code Preview (static) ── */}
            <div className="bg-slate-900/80 border border-slate-700/40 rounded-2xl p-5">
                <p className="text-xs text-slate-500 font-semibold mb-3 flex items-center gap-2">
                    <Terminal className="w-3.5 h-3.5 text-amber-400" /> مثال على الكود المُضاف تلقائياً (JS/TS):
                </p>
                <pre className="text-xs text-emerald-400/80 font-mono leading-relaxed overflow-x-auto bg-black/40 p-4 rounded-xl border border-slate-800">
                    {`// SECURITY PATCH BY ANTIGRAVITY
fetch("/api/db", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    action: "log_security_event",
    sessionId: "<your-session-id>",
    targetUser: username,
    eventType: "LOGIN_FAILED",
    details: "Auto-detected failed login attempt"
  })
}).catch(e => console.error("Security logging failed", e));
// END SECURITY PATCH`}
                </pre>
            </div>
        </div>
    );
}

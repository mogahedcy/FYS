'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
    KeyRound, Users, ShieldAlert, Terminal, ArrowLeft,
    Shield, AlertTriangle, CheckCircle2, TrendingUp
} from 'lucide-react';

const cards = [
    {
        href: '/activity-logs/security/permissions',
        icon: KeyRound,
        title: 'مراقبة الصلاحيات',
        desc: 'عرض وتعديل صلاحيات SELECT / INSERT / UPDATE / DELETE لكل مستخدم على كل جدول مباشرةً من الواجهة.',
        color: 'indigo',
        badge: 'إدارة فورية',
        features: ['SHOW GRANTS', 'GRANT / REVOKE', 'جميع المستخدمين'],
    },
    {
        href: '/activity-logs/security/users',
        icon: Users,
        title: 'إدارة مستخدمي قاعدة البيانات',
        desc: 'إنشاء مستخدمين MySQL جدد، حذف الحسابات غير المرغوب فيها، وتغيير كلمات المرور بشكل آمن.',
        color: 'blue',
        badge: 'CREATE / DROP',
        features: ['إنشاء مستخدم', 'حذف مستخدم', 'تغيير كلمة المرور'],
    },
    {
        href: '/activity-logs/security/brute-force',
        icon: ShieldAlert,
        title: 'كشف الهجمات (Brute Force)',
        desc: 'رصد محاولات تسجيل الدخول الفاشلة وإطلاق تنبيهات فورية عند تجاوز 3 محاولات خلال 30 دقيقة.',
        color: 'red',
        badge: 'مراقبة لحظية',
        features: ['تنبيه فوري', 'سجل الأحداث', 'رصد IPs'],
    },
    {
        href: '/activity-logs/security/patcher',
        icon: Terminal,
        title: 'الترقيع الذكي للتطبيقات',
        desc: 'حقن كود تسجيل محاولات الدخول الفاشلة تلقائياً في ملفات PHP أو JavaScript/TypeScript دون تعديل يدوي.',
        color: 'amber',
        badge: 'PHP / JS / TS',
        features: ['كشف الأنماط', 'حقن الكود', 'لا تعديل يدوي'],
    },
];

const colorConfig: Record<string, {
    card: string; icon: string; iconBg: string; badge: string;
    feature: string; arrow: string;
}> = {
    indigo: {
        card: 'hover:border-indigo-500/40 hover:shadow-[0_0_30px_rgba(99,102,241,0.15)]',
        icon: 'text-indigo-400', iconBg: 'bg-indigo-500/20 border-indigo-500/30',
        badge: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
        feature: 'bg-indigo-500/10 text-indigo-400/80',
        arrow: 'group-hover:text-indigo-400',
    },
    blue: {
        card: 'hover:border-blue-500/40 hover:shadow-[0_0_30px_rgba(59,130,246,0.15)]',
        icon: 'text-blue-400', iconBg: 'bg-blue-500/20 border-blue-500/30',
        badge: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
        feature: 'bg-blue-500/10 text-blue-400/80',
        arrow: 'group-hover:text-blue-400',
    },
    red: {
        card: 'hover:border-red-500/40 hover:shadow-[0_0_30px_rgba(239,68,68,0.15)]',
        icon: 'text-red-400', iconBg: 'bg-red-500/20 border-red-500/30',
        badge: 'bg-red-500/20 text-red-400 border-red-500/30',
        feature: 'bg-red-500/10 text-red-400/80',
        arrow: 'group-hover:text-red-400',
    },
    amber: {
        card: 'hover:border-amber-500/40 hover:shadow-[0_0_30px_rgba(245,158,11,0.15)]',
        icon: 'text-amber-400', iconBg: 'bg-amber-500/20 border-amber-500/30',
        badge: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
        feature: 'bg-amber-500/10 text-amber-400/80',
        arrow: 'group-hover:text-amber-400',
    },
};

export default function SecurityOverviewPage() {
    const [sessionId, setSessionId] = useState<string | null>(null);

    useEffect(() => {
        setSessionId(localStorage.getItem('dbConnectionSession'));
    }, []);

    return (
        <div className="flex flex-col gap-8">
            {/* ── Warning if no session ── */}
            {!sessionId && (
                <div className="flex items-center gap-3 p-4 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-2xl text-sm">
                    <AlertTriangle className="w-5 h-5 shrink-0 animate-pulse" />
                    لا توجد جلسة نشطة. تأكد من الاتصال بقاعدة بيانات أولاً.
                </div>
            )}

            {/* ── System Status Bar ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'حالة النظام', value: 'نشط', icon: CheckCircle2, cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
                    { label: 'وحدات الأمان', value: '4 وحدات', icon: Shield, cls: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' },
                    { label: 'مستوى الحماية', value: 'متقدم', icon: TrendingUp, cls: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
                    { label: 'المراقبة', value: 'مستمرة', icon: ShieldAlert, cls: 'text-red-400 bg-red-500/10 border-red-500/20' },
                ].map((s, i) => {
                    const Icon = s.icon;
                    return (
                        <div key={i} className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${s.cls}`}>
                            <Icon className="w-4 h-4 shrink-0" />
                            <div>
                                <p className="text-[10px] opacity-60">{s.label}</p>
                                <p className="font-bold text-sm">{s.value}</p>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* ── Feature Cards Grid ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {cards.map(card => {
                    const Icon = card.icon;
                    const c = colorConfig[card.color];
                    return (
                        <Link
                            key={card.href}
                            href={card.href}
                            className={`group flex flex-col gap-5 p-6 bg-slate-800/40 border border-slate-700/50 rounded-2xl transition-all duration-300 ${c.card}`}
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-4">
                                    <div className={`w-12 h-12 rounded-xl border flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110 ${c.iconBg}`}>
                                        <Icon className={`w-6 h-6 ${c.icon}`} />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-white text-base">{card.title}</h3>
                                        <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-md border mt-1 ${c.badge}`}>
                                            {card.badge}
                                        </span>
                                    </div>
                                </div>
                                <ArrowLeft className={`w-5 h-5 text-slate-600 transition-all duration-300 group-hover:-translate-x-1 ${c.arrow}`} />
                            </div>

                            <p className="text-slate-400 text-sm leading-relaxed">{card.desc}</p>

                            <div className="flex flex-wrap gap-2">
                                {card.features.map((f, i) => (
                                    <span key={i} className={`text-[11px] px-2.5 py-1 rounded-lg font-medium ${c.feature}`}>
                                        {f}
                                    </span>
                                ))}
                            </div>

                            <div className={`h-0.5 w-0 group-hover:w-full rounded-full transition-all duration-500 bg-gradient-to-l ${card.color === 'indigo' ? 'from-indigo-500 to-transparent' :
                                    card.color === 'blue' ? 'from-blue-500 to-transparent' :
                                        card.color === 'red' ? 'from-red-500 to-transparent' :
                                            'from-amber-500 to-transparent'
                                }`} />
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}

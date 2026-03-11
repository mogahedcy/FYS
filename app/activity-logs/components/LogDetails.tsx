'use client';

export const renderLogDetails = (detailsRaw: string) => {
    try {
        const parsed = JSON.parse(detailsRaw);
        if (parsed.old_data || parsed.new_data) {
            return (
                <div className="flex flex-col gap-2 w-full max-w-sm" style={{ fontSize: '10px' }}>
                    {parsed.old_data && (
                        <div className="bg-red-500/10 border border-red-500/30 p-2 rounded">
                            <span className="text-red-400 font-bold block mb-1">البيانات السابقة (OLD):</span>
                            <pre className="text-slate-400 whitespace-pre-wrap overflow-x-auto max-h-32 custom-scrollbar" dir="ltr">{JSON.stringify(parsed.old_data, null, 2)}</pre>
                        </div>
                    )}
                    {parsed.new_data && (
                        <div className="bg-emerald-500/10 border border-emerald-500/30 p-2 rounded">
                            <span className="text-emerald-400 font-bold block mb-1">البيانات الجديدة (NEW):</span>
                            <pre className="text-slate-400 whitespace-pre-wrap overflow-x-auto max-h-32 custom-scrollbar" dir="ltr">{JSON.stringify(parsed.new_data, null, 2)}</pre>
                        </div>
                    )}
                </div>
            );
        }
        return <pre className="text-xs text-slate-400 max-w-xs overflow-auto">{JSON.stringify(parsed, null, 2)}</pre>;
    } catch (e) {
        return <span className="text-slate-400 text-xs">{detailsRaw}</span>;
    }
};

export default function LogDetails({ details }: { details: string }) {
    return renderLogDetails(details);
}

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ── Unique Report ID Generator ──────────────────────────────────────────────
const generateReportId = (prefix: string): string => {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 7).toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
};

// ── Severity Classification ──────────────────────────────────────────────────
const getSeverityLevel = (action: string): string => {
    if (action === 'DELETE') return 'HIGH';
    if (action === 'UPDATE') return 'MEDIUM';
    return 'LOW';
};

// ── Format Field Changes ─────────────────────────────────────────────────────
// ── Helper to format data objects into readable flat text ────────────────────
const formatObjectToText = (obj: any): string => {
    if (!obj || typeof obj !== 'object') return String(obj || '—');
    return Object.entries(obj)
        .filter(([key]) => key !== 'id')
        .map(([key, val]) => `${key}: ${val ?? '—'}`)
        .join('\n');
};

// ── Extract Old & New Data ──────────────────────────────────────────────────
const extractOldNewData = (details: any, action: string): { oldData: string, newData: string } => {
    try {
        const parsed = typeof details === 'string' ? JSON.parse(details) : details;
        if (!parsed) return { oldData: '—', newData: '—' };

        // Support for specific Trigger JSON structure: { db_user: '...', old_data: {...}, new_data: {...} }
        const actualOld = parsed.old_data || parsed.old || null;
        const actualNew = parsed.new_data || parsed.new || parsed.fields || null;

        const filterSystemKeys = (data: any) => {
            if (!data || typeof data !== 'object') return data;
            return Object.fromEntries(
                Object.entries(data).filter(([k]) => !['db_user', 'old_data', 'new_data', 'action_query'].includes(k))
            );
        };

        if (action === 'INSERT') {
            const data = filterSystemKeys(actualNew || parsed);
            return { oldData: '— [New Record]', newData: formatObjectToText(data) };
        }

        if (action === 'UPDATE') {
            return {
                oldData: formatObjectToText(filterSystemKeys(actualOld || {})),
                newData: formatObjectToText(filterSystemKeys(actualNew || {}))
            };
        }

        if (action === 'DELETE') {
            const data = filterSystemKeys(actualOld || parsed);
            return { oldData: formatObjectToText(data), newData: '— [Deleted]' };
        }

        return { oldData: '—', newData: '—' };
    } catch {
        return { oldData: '—', newData: String(details || '—') };
    }
};

// ── Draw Professional Header ─────────────────────────────────────────────────
const drawPageHeader = (
    doc: jsPDF,
    reportId: string,
    reportTitle: string,
    classification: string,
    classColor: [number, number, number],
    pageNum: number,
    totalPages: number
) => {
    const W = doc.internal.pageSize.getWidth();

    // Top classification banner
    doc.setFillColor(...classColor);
    doc.rect(0, 0, W, 8, 'F');
    doc.setFontSize(7);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text(`SECURITY CLASSIFICATION: ${classification}`, W / 2, 5.5, { align: 'center' });

    // Logo / Company name
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 8, W, 28, 'F');

    doc.setFontSize(18);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text('FEDERAL YEMEN SECURITY', 14, 21);

    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.setFont('helvetica', 'normal');
    doc.text('Advanced Database Monitoring & Compliance System', 14, 27);

    // Report title (right side)
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text(reportTitle.toUpperCase(), W - 14, 19, { align: 'right' });

    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.setFont('helvetica', 'normal');
    doc.text(`Report ID: ${reportId}`, W - 14, 25, { align: 'right' });
    doc.text(`Page ${pageNum} of ${totalPages}`, W - 14, 30, { align: 'right' });

    // Separator line
    doc.setDrawColor(...classColor);
    doc.setLineWidth(0.5);
    doc.line(0, 36, W, 36);
};

// ── Draw Professional Footer ─────────────────────────────────────────────────
const drawPageFooter = (doc: jsPDF, reportId: string, generatedAt: string) => {
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();

    doc.setDrawColor(30, 41, 59);
    doc.setLineWidth(0.3);
    doc.line(14, H - 14, W - 14, H - 14);

    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated At: ${generatedAt}  |  Validation ID: ${reportId}  |  FYS SEC-CORE`, 14, H - 8);
    doc.text('This document is for authorized use only. ISO 27001 Audit Trail Compliance.', W - 14, H - 8, { align: 'right' });
};

// ════════════════════════════════════════════════════════════════════════════
// EXPORT 1 — Activity Logs Report
// ════════════════════════════════════════════════════════════════════════════
export const handleGeneratePDF = (
    mode: 'preview' | 'download',
    type: 'quick' | 'detailed',
    logs: any[],
    dbName: string | null,
    user: any,
    targetUser: any,
    startDate: string,
    endDate: string,
    selectedTables: string[]
) => {
    const doc = new jsPDF({ orientation: 'landscape' });
    const reportId = generateReportId('ACT');
    const generatedAt = new Date().toLocaleString('en-US', { timeZoneName: 'short' });
    const W = doc.internal.pageSize.getWidth();

    // ── Summary stats ──
    const totalEvents = logs.length;
    const insertCount = logs.filter(l => l.action_type === 'INSERT').length;
    const updateCount = logs.filter(l => l.action_type === 'UPDATE').length;
    const deleteCount = logs.filter(l => l.action_type === 'DELETE').length;

    const highRisk = deleteCount;
    const medRisk = updateCount;
    const lowRisk = insertCount;

    // ── Table data ──
    const tableData = logs.map(log => {
        const { oldData, newData } = extractOldNewData(log.details, log.action_type);
        return [
            String(log.id),
            log.table_name || '—',
            log.action_type,
            getSeverityLevel(log.action_type),
            String(log.record_id ?? '—'),
            new Date(log.action_timestamp).toLocaleString('en-US'),
            type === 'detailed' ? oldData : 'See Detailed Report',
            type === 'detailed' ? newData : 'See Detailed Report',
        ];
    });

    const head = [['Event ID', 'Table', 'Action', 'Risk', 'Record ID', 'Timestamp', 'Previous Data (OLD)', 'Current Data (NEW)']];

    // We need to know total pages beforehand — approximate with 1 cover + table pages
    // We'll use a 2-pass approach: first run, then count pages
    let totalPages = 1;

    const renderDoc = (finalTotal: number) => {
        const doc2 = new jsPDF({ orientation: 'landscape' });

        // ── PAGE 1: Cover / Summary ──────────────────────────────────────────
        drawPageHeader(doc2, reportId, 'Database Activity Audit Report', 'CONFIDENTIAL', [220, 38, 38], 1, finalTotal);

        // Meta info block
        doc2.setFillColor(248, 250, 252);
        doc2.roundedRect(14, 42, W - 28, 42, 3, 3, 'F');

        const metaY = 52;
        const col2 = W / 2 + 10;

        doc2.setFontSize(8.5);
        doc2.setFont('helvetica', 'bold');
        doc2.setTextColor(30, 41, 59);
        doc2.text('Report Metadata', 20, metaY);
        doc2.setFont('helvetica', 'normal');
        doc2.setFontSize(8);
        doc2.setTextColor(71, 85, 105);
        doc2.text(`Target Database:`, 20, metaY + 8);
        doc2.text(`${dbName || 'All Systems'}`, 65, metaY + 8);
        doc2.text(`Report Level:`, 20, metaY + 15);
        doc2.text(`${type === 'quick' ? 'QUICK SUMMARY' : 'GRANULAR DETAIL'}`, 65, metaY + 15);
        doc2.text(`Time Range:`, 20, metaY + 22);
        doc2.text(`${startDate || 'Historical'} → ${endDate || 'Real-time'}`, 65, metaY + 22);
        if (selectedTables.length > 0) {
            doc2.text(`Scope:`, 20, metaY + 29);
            doc2.text(selectedTables.join(', '), 65, metaY + 29);
        }

        doc2.setFont('helvetica', 'bold');
        doc2.text('Compliance Standard:', col2, metaY + 8);
        doc2.setFont('helvetica', 'normal');
        doc2.text('ISO/IEC 27001 : 2022 | NIST SP 800-92', col2 + 45, metaY + 8);
        doc2.text('Classification:', col2, metaY + 15);
        doc2.text('CONFIDENTIAL — Internal Use Only', col2 + 45, metaY + 15);
        doc2.text('Generated By:', col2, metaY + 22);
        doc2.text('FYS Automated Security Engine', col2 + 45, metaY + 22);
        doc2.text('Retention Policy:', col2, metaY + 29);
        doc2.text('7 Years — Immutable Audit Log', col2 + 45, metaY + 29);

        // ── Summary Stats ────────────────────────────────────────────────────
        const statY = 92;
        doc2.setFontSize(9);
        doc2.setFont('helvetica', 'bold');
        doc2.setTextColor(30, 41, 59);
        doc2.text('Activity Summary', 14, statY);

        const stats = [
            { label: 'Total Events', value: totalEvents, fill: [59, 130, 246] as [number, number, number] },
            { label: 'INSERT (Low Risk)', value: lowRisk, fill: [16, 185, 129] as [number, number, number] },
            { label: 'UPDATE (Medium Risk)', value: medRisk, fill: [99, 102, 241] as [number, number, number] },
            { label: 'DELETE (High Risk)', value: highRisk, fill: [239, 68, 68] as [number, number, number] },
            { label: 'Risk Score', value: `${Math.min(100, Math.round((highRisk * 3 + medRisk) / Math.max(1, totalEvents) * 100))}%`, fill: [245, 158, 11] as [number, number, number] },
        ];

        const boxW = (W - 28 - 16) / 5;
        stats.forEach((s, i) => {
            const bx = 14 + i * (boxW + 4);
            doc2.setFillColor(...s.fill);
            doc2.roundedRect(bx, statY + 4, boxW, 28, 2, 2, 'F');
            doc2.setFontSize(16);
            doc2.setTextColor(255, 255, 255);
            doc2.setFont('helvetica', 'bold');
            doc2.text(String(s.value), bx + boxW / 2, statY + 17, { align: 'center' });
            doc2.setFontSize(6.5);
            doc2.setFont('helvetica', 'normal');
            doc2.text(s.label, bx + boxW / 2, statY + 26, { align: 'center' });
        });

        drawPageFooter(doc2, reportId, generatedAt);

        // ── PAGE 2+: Data Table ──────────────────────────────────────────────
        doc2.addPage('landscape');

        autoTable(doc2, {
            startY: 42,
            head: head,
            body: tableData,
            theme: 'grid',
            headStyles: {
                fillColor: [15, 23, 42],
                textColor: [248, 250, 252],
                fontStyle: 'bold',
                fontSize: 7.5,
                cellPadding: 4,
            },
            bodyStyles: {
                fontSize: 7,
                cellPadding: 3,
                textColor: [30, 41, 59],
            },
            alternateRowStyles: {
                fillColor: [248, 250, 252],
            },
            columnStyles: {
                0: { cellWidth: 16, halign: 'center', fontStyle: 'bold' },
                1: { cellWidth: 28 },
                2: { cellWidth: 18, halign: 'center', fontStyle: 'bold' },
                3: { cellWidth: 16, halign: 'center' },
                4: { cellWidth: 18 },
                5: { cellWidth: 38 },
                6: { cellWidth: 65, fontSize: 6.5 }, // OLD DATA
                7: { cellWidth: 65, fontSize: 6.5 }, // NEW DATA
            },
            didParseCell: (data) => {
                // Colour-code action type
                if (data.column.index === 2 && data.section === 'body') {
                    const v = String(data.cell.text);
                    if (v === 'INSERT') data.cell.styles.textColor = [16, 185, 129];
                    else if (v === 'UPDATE') data.cell.styles.textColor = [99, 102, 241];
                    else if (v === 'DELETE') data.cell.styles.textColor = [239, 68, 68];
                }
                // Colour-code severity
                if (data.column.index === 3 && data.section === 'body') {
                    const v = String(data.cell.text);
                    if (v === 'HIGH') { data.cell.styles.textColor = [239, 68, 68]; data.cell.styles.fontStyle = 'bold'; }
                    else if (v === 'MEDIUM') { data.cell.styles.textColor = [245, 158, 11]; data.cell.styles.fontStyle = 'bold'; }
                    else { data.cell.styles.textColor = [16, 185, 129]; }
                }
            },
            didDrawPage: (hookData) => {
                const pageNum = (doc2.internal as any).getCurrentPageInfo().pageNumber;
                drawPageHeader(doc2, reportId, 'Database Activity Audit Report', 'CONFIDENTIAL', [220, 38, 38], pageNum, finalTotal);
                drawPageFooter(doc2, reportId, generatedAt);
            },
            margin: { top: 42, bottom: 20 },
        });

        return doc2;
    };

    // First pass — count pages
    const firstDoc = renderDoc(99);
    totalPages = (firstDoc.internal as any).getNumberOfPages();

    // Second pass — with correct total
    const finalDoc = renderDoc(totalPages);

    if (mode === 'preview') {
        window.open(finalDoc.output('bloburl'), '_blank');
    } else {
        finalDoc.save(`FYS_ACTIVITY_REPORT_${reportId}.pdf`);
    }
};


// ════════════════════════════════════════════════════════════════════════════
// EXPORT 2 — Connection History Report
// ════════════════════════════════════════════════════════════════════════════
export const handleExportConnectionHistoryPDF = (mode: 'preview' | 'download', history: any[]) => {
    const reportId = generateReportId('CONN');
    const generatedAt = new Date().toLocaleString('en-US', { timeZoneName: 'short' });

    const calcDuration = (start: string, end: string | null): string => {
        if (!start) return '—';
        const from = new Date(start).getTime();
        const to = end ? new Date(end).getTime() : Date.now();
        const mins = Math.floor((to - from) / 60000);
        if (mins < 60) return `${mins} min`;
        const hrs = Math.floor(mins / 60);
        return hrs < 24 ? `${hrs}h ${mins % 60}m` : `${Math.floor(hrs / 24)}d ${hrs % 24}h`;
    };

    const tableData = history.map(item => [
        item.database_name || '—',
        item.host || '—',
        item.username || '—',
        item.status === 'active' ? 'ESTABLISHED' : 'TERMINATED',
        calcDuration(item.first_connected_at, item.disconnected_at),
        new Date(item.first_connected_at).toLocaleString('en-US'),
        new Date(item.last_seen_at).toLocaleString('en-US'),
        item.disconnected_at ? new Date(item.disconnected_at).toLocaleString('en-US') : 'Still Active',
    ]);

    const head = [['Target Database', 'Source Host', 'Operator', 'Status', 'Duration', 'Session Start', 'Last Seen', 'Session End']];

    const renderDoc = (finalTotal: number) => {
        const doc = new jsPDF({ orientation: 'landscape' });
        const W = doc.internal.pageSize.getWidth();

        // ── Cover Page ────────────────────────────────────────────────────────
        drawPageHeader(doc, reportId, 'Connection Access Log', 'CONFIDENTIAL', [16, 185, 129], 1, finalTotal);

        // Meta block
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(14, 42, W - 28, 34, 3, 3, 'F');

        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 41, 59);
        doc.text('Report Metadata', 20, 52);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(71, 85, 105);
        doc.text(`Total Sessions:`, 20, 61); doc.text(String(history.length), 65, 61);
        doc.text(`Active Sessions:`, 20, 68); doc.text(String(history.filter(h => h.status === 'active').length), 65, 68);

        const col2 = W / 2 + 10;
        doc.text('Compliance:', col2, 61); doc.text('ISO/IEC 27001 | NIST AC-17', col2 + 35, 61);
        doc.text('Classification:', col2, 68); doc.text('CONFIDENTIAL — Internal Use Only', col2 + 35, 68);

        // Stats
        const activeCount = history.filter(h => h.status === 'active').length;
        const termCount = history.filter(h => h.status !== 'active').length;
        const statY = 84;

        [
            { label: 'Total Sessions', value: history.length, fill: [99, 102, 241] as [number, number, number] },
            { label: 'Active', value: activeCount, fill: [16, 185, 129] as [number, number, number] },
            { label: 'Terminated', value: termCount, fill: [239, 68, 68] as [number, number, number] },
        ].forEach((s, i) => {
            const boxW = 50;
            const bx = 14 + i * 54;
            doc.setFillColor(...s.fill);
            doc.roundedRect(bx, statY, boxW, 22, 2, 2, 'F');
            doc.setFontSize(14);
            doc.setTextColor(255, 255, 255);
            doc.setFont('helvetica', 'bold');
            doc.text(String(s.value), bx + boxW / 2, statY + 12, { align: 'center' });
            doc.setFontSize(6.5);
            doc.setFont('helvetica', 'normal');
            doc.text(s.label, bx + boxW / 2, statY + 19, { align: 'center' });
        });

        drawPageFooter(doc, reportId, generatedAt);

        // ── Data Table Page ───────────────────────────────────────────────────
        doc.addPage('landscape');

        autoTable(doc, {
            startY: 42,
            head: head,
            body: tableData,
            theme: 'grid',
            headStyles: {
                fillColor: [15, 23, 42],
                textColor: [248, 250, 252],
                fontStyle: 'bold',
                fontSize: 7.5,
                cellPadding: 4,
            },
            bodyStyles: {
                fontSize: 7,
                cellPadding: 3,
                textColor: [30, 41, 59],
            },
            alternateRowStyles: { fillColor: [248, 250, 252] },
            columnStyles: {
                0: { cellWidth: 32, fontStyle: 'bold' },
                1: { cellWidth: 40 },
                2: { cellWidth: 28 },
                3: { cellWidth: 24, halign: 'center', fontStyle: 'bold' },
                4: { cellWidth: 20, halign: 'center' },
                5: { cellWidth: 40 },
                6: { cellWidth: 40 },
                7: { cellWidth: 'auto' },
            },
            didParseCell: (data) => {
                if (data.column.index === 3 && data.section === 'body') {
                    const v = String(data.cell.text);
                    if (v === 'ESTABLISHED') data.cell.styles.textColor = [16, 185, 129];
                    else data.cell.styles.textColor = [239, 68, 68];
                }
            },
            didDrawPage: () => {
                const pageNum = (doc.internal as any).getCurrentPageInfo().pageNumber;
                drawPageHeader(doc, reportId, 'Connection Access Log', 'CONFIDENTIAL', [16, 185, 129], pageNum, finalTotal);
                drawPageFooter(doc, reportId, generatedAt);
            },
            margin: { top: 42, bottom: 20 },
        });

        return doc;
    };

    const first = renderDoc(99);
    const totalPages = (first.internal as any).getNumberOfPages();
    const finalDoc = renderDoc(totalPages);

    if (mode === 'preview') {
        window.open(finalDoc.output('bloburl'), '_blank');
    } else {
        finalDoc.save(`FYS_CONN_HISTORY_${reportId}.pdf`);
    }
};


// ════════════════════════════════════════════════════════════════════════════
// EXPORT 3 — Security / Threat Audit Report
// ════════════════════════════════════════════════════════════════════════════
export const handleExportSecurityPDF = (mode: 'preview' | 'download', securityLogs: any[], securityAlerts: any[]) => {
    const reportId = generateReportId('THRТ');
    const generatedAt = new Date().toLocaleString('en-US', { timeZoneName: 'short' });

    const renderDoc = (finalTotal: number) => {
        const doc = new jsPDF();
        const W = doc.internal.pageSize.getWidth();

        // ── Cover ────────────────────────────────────────────────────────────
        drawPageHeader(doc, reportId, 'Threat & Security Audit', 'TOP SECRET — RESTRICTED', [127, 29, 29], 1, finalTotal);

        doc.setFillColor(254, 242, 242);
        doc.roundedRect(14, 42, W - 28, 28, 3, 3, 'F');
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(153, 27, 27);
        doc.text('⚠  SECURITY INCIDENT REPORT — HANDLE WITH CARE', W / 2, 52, { align: 'center' });
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(71, 85, 105);
        doc.text(`Total Threats Detected: ${securityAlerts.length}`, 20, 61);
        doc.text(`Authentication Events: ${securityLogs.length}`, 20, 67);
        doc.text(`Compliance: ISO/IEC 27035 | NIST SP 800-61`, W - 20, 61, { align: 'right' });
        doc.text(`Classification: TOP SECRET — RESTRICTED`, W - 20, 67, { align: 'right' });

        drawPageFooter(doc, reportId, generatedAt);

        // ── Section 1: Critical Alerts ───────────────────────────────────────
        doc.addPage();
        drawPageHeader(doc, reportId, 'Threat & Security Audit', 'TOP SECRET — RESTRICTED', [127, 29, 29], 2, finalTotal);

        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(153, 27, 27);
        doc.text('SECTION 1 — CRITICAL THREAT DETECTIONS', 14, 44);

        if (securityAlerts.length > 0) {
            const alertData = securityAlerts.map(alert => [
                'Brute Force Threshold Violation',
                alert.target_user || '—',
                `${alert.attempts} Unknown Attempts`,
                'HIGH CRITICAL',
                'Block & Investigate',
            ]);

            autoTable(doc, {
                startY: 48,
                head: [['Incident Type', 'Target Identity', 'Intensity', 'Risk Matrix', 'Recommended Action']],
                body: alertData,
                theme: 'grid',
                headStyles: { fillColor: [127, 29, 29], textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
                bodyStyles: { fontSize: 7.5, textColor: [30, 41, 59] },
                didParseCell: (data) => {
                    if (data.column.index === 3 && data.section === 'body') {
                        data.cell.styles.textColor = [239, 68, 68];
                        data.cell.styles.fontStyle = 'bold';
                    }
                },
                didDrawPage: () => {
                    const pageNum = (doc.internal as any).getCurrentPageInfo().pageNumber;
                    drawPageHeader(doc, reportId, 'Threat & Security Audit', 'TOP SECRET — RESTRICTED', [127, 29, 29], pageNum, finalTotal);
                    drawPageFooter(doc, reportId, generatedAt);
                },
                margin: { top: 42, bottom: 20 },
            });
        } else {
            doc.setFontSize(8);
            doc.setTextColor(100, 116, 139);
            doc.text('✓ No active threat anomalies detected in current monitoring cycle.', 14, 56);
        }

        // ── Section 2: Auth Logs ─────────────────────────────────────────────
        const lastY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 12 : 65;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 41, 59);
        doc.text('SECTION 2 — AUTHENTICATION EVENT LOG', 14, lastY);

        const logData = securityLogs.map(log => [
            new Date(log.attempt_time).toLocaleString('en-US'),
            log.target_user || '—',
            log.event_type || '—',
            log.ip_address || 'Internal Secure Node',
        ]);

        autoTable(doc, {
            startY: lastY + 5,
            head: [['Timestamp', 'Subject / User', 'Event Type', 'Source IP / Node']],
            body: logData,
            theme: 'striped',
            headStyles: { fillColor: [15, 23, 42], textColor: [248, 250, 252], fontSize: 8, fontStyle: 'bold' },
            bodyStyles: { fontSize: 7.5, textColor: [30, 41, 59] },
            didDrawPage: () => {
                const pageNum = (doc.internal as any).getCurrentPageInfo().pageNumber;
                drawPageHeader(doc, reportId, 'Threat & Security Audit', 'TOP SECRET — RESTRICTED', [127, 29, 29], pageNum, finalTotal);
                drawPageFooter(doc, reportId, generatedAt);
            },
            margin: { top: 42, bottom: 20 },
        });

        return doc;
    };

    const first = renderDoc(99);
    const totalPages = (first.internal as any).getNumberOfPages();
    const finalDoc = renderDoc(totalPages);

    if (mode === 'preview') {
        window.open(finalDoc.output('bloburl'), '_blank');
    } else {
        finalDoc.save(`FYS_THREAT_REPORT_${reportId}.pdf`);
    }
};


// ════════════════════════════════════════════════════════════════════════════
// EXPORT 4 — App Users Activity & Permissions Report
// ════════════════════════════════════════════════════════════════════════════
export const handleExportAppUsersPDF = (
    mode: 'preview' | 'download',
    type: 'quick' | 'detailed',
    activityLogs: any[],
    users: any[],
    dbName: string | null,
    targetUsername: string | null,
    tableName: string
) => {
    const reportId = generateReportId('USR');
    const generatedAt = new Date().toLocaleString('en-US', { timeZoneName: 'short' });

    const EVENT_MAP: Record<string, string> = {
        LOGIN_SUCCESS: 'Successful Login',
        LOGIN_FAILED: 'Failed Login',
        LOGOUT: 'Logout',
        BRUTE_FORCE_ALERT: 'Brute Force Detected',
    };

    const failedCount = activityLogs.filter(l => l.event_type === 'LOGIN_FAILED').length;
    const successCount = activityLogs.filter(l => l.event_type === 'LOGIN_SUCCESS').length;
    const bruteCount = activityLogs.filter(l => l.event_type === 'BRUTE_FORCE_ALERT').length;
    const uniqueUsers = new Set(activityLogs.map(l => l.target_user)).size;

    const renderDoc = (finalTotal: number) => {
        const doc = new jsPDF({ orientation: 'landscape' });
        const W = doc.internal.pageSize.getWidth();

        // ── COVER PAGE ────────────────────────────────────────────────────────
        drawPageHeader(doc, reportId, 'App User Activity & Access Report', 'CONFIDENTIAL', [88, 28, 135], 1, finalTotal);

        // Meta block
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(14, 42, W - 28, 44, 3, 3, 'F');

        const col2 = W / 2 + 10;
        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 41, 59);
        doc.text('Report Metadata', 20, 52);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(71, 85, 105);

        doc.text('Target Database:', 20, 61); doc.text(dbName || 'All Systems', 75, 61);
        doc.text('User Table:', 20, 68); doc.text(tableName || '—', 75, 68);
        doc.text('Scope:', 20, 75); doc.text(targetUsername ? `User: ${targetUsername}` : 'All Users', 75, 75);
        doc.text('Report Level:', 20, 82); doc.text(type === 'quick' ? 'QUICK SUMMARY' : 'GRANULAR DETAIL', 75, 82);

        doc.text('Compliance:', col2, 61); doc.text('ISO/IEC 27001 | NIST SP 800-53', col2 + 38, 61);
        doc.text('Classification:', col2, 68); doc.text('CONFIDENTIAL — Internal Use Only', col2 + 38, 68);
        doc.text('Total Events:', col2, 75); doc.text(String(activityLogs.length), col2 + 38, 75);
        doc.text('Unique Users:', col2, 82); doc.text(String(uniqueUsers), col2 + 38, 82);

        // Stats boxes
        const statY = 94;
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 41, 59);
        doc.text('Authentication Summary', 14, statY);

        const stats = [
            { label: 'Total Events', value: activityLogs.length, fill: [99, 102, 241] as [number, number, number] },
            { label: 'Successful Logins', value: successCount, fill: [16, 185, 129] as [number, number, number] },
            { label: 'Failed Attempts', value: failedCount, fill: [239, 68, 68] as [number, number, number] },
            { label: 'Brute Force Events', value: bruteCount, fill: [245, 158, 11] as [number, number, number] },
            { label: 'Active Users', value: uniqueUsers, fill: [88, 28, 135] as [number, number, number] },
        ];

        const boxW = (W - 28 - 16) / 5;
        stats.forEach((s, i) => {
            const bx = 14 + i * (boxW + 4);
            doc.setFillColor(...s.fill);
            doc.roundedRect(bx, statY + 4, boxW, 28, 2, 2, 'F');
            doc.setFontSize(16); doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold');
            doc.text(String(s.value), bx + boxW / 2, statY + 17, { align: 'center' });
            doc.setFontSize(6.5); doc.setFont('helvetica', 'normal');
            doc.text(s.label, bx + boxW / 2, statY + 26, { align: 'center' });
        });

        drawPageFooter(doc, reportId, generatedAt);

        // ── PAGE 2: Users List ────────────────────────────────────────────────
        if (users.length > 0 && type === 'detailed') {
            doc.addPage('landscape');
            drawPageHeader(doc, reportId, 'App User Activity & Access Report', 'CONFIDENTIAL', [88, 28, 135], 2, finalTotal);

            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(30, 41, 59);
            doc.text('SECTION 1 — APPLICATION USERS', 14, 44);

            const userCols = users.length > 0 ? Object.keys(users[0]) : [];
            const userHead = [userCols.map(c => c.toUpperCase())];
            const userData = users.map(u => userCols.map(c => {
                const v = u[c];
                if (typeof v === 'string' && v.length > 40) return v.substring(0, 40) + '...';
                return String(v ?? '—');
            }));

            autoTable(doc, {
                startY: 48,
                head: userHead,
                body: userData,
                theme: 'grid',
                headStyles: { fillColor: [88, 28, 135], textColor: [255, 255, 255], fontSize: 7, fontStyle: 'bold', cellPadding: 3 },
                bodyStyles: { fontSize: 6.5, cellPadding: 2.5, textColor: [30, 41, 59] },
                alternateRowStyles: { fillColor: [248, 250, 252] },
                didDrawPage: () => {
                    const pn = (doc.internal as any).getCurrentPageInfo().pageNumber;
                    drawPageHeader(doc, reportId, 'App User Activity & Access Report', 'CONFIDENTIAL', [88, 28, 135], pn, finalTotal);
                    drawPageFooter(doc, reportId, generatedAt);
                },
                margin: { top: 42, bottom: 20 },
            });
        }

        // ── PAGE 3: Activity Log ──────────────────────────────────────────────
        doc.addPage('landscape');
        const secPg = (doc.internal as any).getCurrentPageInfo().pageNumber;
        drawPageHeader(doc, reportId, 'App User Activity & Access Report', 'CONFIDENTIAL', [88, 28, 135], secPg, finalTotal);

        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 41, 59);
        doc.text(`SECTION ${type === 'detailed' ? '2' : '1'} — AUTHENTICATION EVENT LOG`, 14, 44);

        const logHead = [['Timestamp', 'Username', 'Event Type', 'Risk Level', 'Source IP', 'Details']];
        const logData = activityLogs.map(log => [
            new Date(log.attempt_time).toLocaleString('en-US'),
            log.target_user || '—',
            EVENT_MAP[log.event_type] || log.event_type,
            log.event_type === 'LOGIN_FAILED' || log.event_type === 'BRUTE_FORCE_ALERT' ? 'HIGH' : log.event_type === 'LOGIN_SUCCESS' ? 'LOW' : 'MEDIUM',
            log.ip_address || 'Internal',
            type === 'detailed' ? (log.details || '—') : '—',
        ]);

        autoTable(doc, {
            startY: 48,
            head: logHead,
            body: logData,
            theme: 'grid',
            headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontSize: 7.5, fontStyle: 'bold', cellPadding: 3.5 },
            bodyStyles: { fontSize: 7, cellPadding: 3, textColor: [30, 41, 59] },
            alternateRowStyles: { fillColor: [248, 250, 252] },
            columnStyles: {
                0: { cellWidth: 42 },
                1: { cellWidth: 28, fontStyle: 'bold' },
                2: { cellWidth: 36 },
                3: { cellWidth: 18, halign: 'center', fontStyle: 'bold' },
                4: { cellWidth: 30 },
                5: { cellWidth: 'auto', fontSize: 6.5 },
            },
            didParseCell: (data) => {
                if (data.column.index === 2 && data.section === 'body') {
                    const v = String(data.cell.text);
                    if (v.includes('Failed') || v.includes('Brute')) data.cell.styles.textColor = [239, 68, 68];
                    else if (v.includes('Success')) data.cell.styles.textColor = [16, 185, 129];
                }
                if (data.column.index === 3 && data.section === 'body') {
                    const v = String(data.cell.text);
                    if (v === 'HIGH') { data.cell.styles.textColor = [239, 68, 68]; data.cell.styles.fontStyle = 'bold'; }
                    else if (v === 'MEDIUM') data.cell.styles.textColor = [245, 158, 11];
                    else data.cell.styles.textColor = [16, 185, 129];
                }
            },
            didDrawPage: () => {
                const pn = (doc.internal as any).getCurrentPageInfo().pageNumber;
                drawPageHeader(doc, reportId, 'App User Activity & Access Report', 'CONFIDENTIAL', [88, 28, 135], pn, finalTotal);
                drawPageFooter(doc, reportId, generatedAt);
            },
            margin: { top: 42, bottom: 20 },
        });

        return doc;
    };

    const first = renderDoc(99);
    const totalPages = (first.internal as any).getNumberOfPages();
    const finalDoc = renderDoc(totalPages);

    if (mode === 'preview') {
        window.open(finalDoc.output('bloburl'), '_blank');
    } else {
        finalDoc.save(`FYS_APP_USERS_${reportId}.pdf`);
    }
};

// ════════════════════════════════════════════════════════════════════════════
// EXPORT 5 — System Local Activity Logs (FYS Admins)
// ════════════════════════════════════════════════════════════════════════════
export const handleExportSystemLogsPDF = (mode: 'preview' | 'download', sysLogs: any[], targetUsername: string | null) => {
    const reportId = generateReportId('SYS');
    const generatedAt = new Date().toLocaleString('en-US', { timeZoneName: 'short' });

    const tableData = sysLogs.map(log => [
        String(log.id),
        log.username || '—',
        log.action_type || '—',
        log.ip_address || '—',
        log.details || '—',
        new Date(log.created_at).toLocaleString('en-US')
    ]);

    const head = [['ID', 'Admin / User', 'Action Type', 'IP Address', 'Details', 'Timestamp']];

    const renderDoc = (finalTotal: number) => {
        const doc = new jsPDF({ orientation: 'landscape' });
        const W = doc.internal.pageSize.getWidth();

        // ── Cover Page ────────────────────────────────────────────────────────
        drawPageHeader(doc, reportId, 'FYS System Admin Activity Log', 'RESTRICTED — INTERNAL', [14, 165, 233], 1, finalTotal); // cyan-500

        doc.setFillColor(248, 250, 252);
        doc.roundedRect(14, 42, W - 28, 34, 3, 3, 'F');

        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 41, 59);
        doc.text('Report Metadata', 20, 52);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(71, 85, 105);
        
        doc.text(`Total Records:`, 20, 61); doc.text(String(sysLogs.length), 65, 61);
        doc.text(`Target Filter:`, 20, 68); doc.text(targetUsername || 'All Administrators', 65, 68);

        const col2 = W / 2 + 10;
        doc.text('Compliance:', col2, 61); doc.text('FYS INTERNAL SEC-POLICY', col2 + 35, 61);
        doc.text('Classification:', col2, 68); doc.text('RESTRICTED — INTERNAL', col2 + 35, 68);

        drawPageFooter(doc, reportId, generatedAt);

        // ── Data Table Page ───────────────────────────────────────────────────
        doc.addPage('landscape');

        autoTable(doc, {
            startY: 42,
            head: head,
            body: tableData,
            theme: 'grid',
            headStyles: {
                fillColor: [15, 23, 42],
                textColor: [248, 250, 252],
                fontStyle: 'bold',
                fontSize: 7.5,
                cellPadding: 4,
            },
            bodyStyles: {
                fontSize: 7,
                cellPadding: 3,
                textColor: [30, 41, 59],
            },
            alternateRowStyles: { fillColor: [248, 250, 252] },
            columnStyles: {
                0: { cellWidth: 15, fontStyle: 'bold' },
                1: { cellWidth: 35, fontStyle: 'bold' },
                2: { cellWidth: 35 },
                3: { cellWidth: 30 },
                4: { cellWidth: 'auto' },
                5: { cellWidth: 35 },
            },
            didParseCell: (data) => {
                if (data.column.index === 2 && data.section === 'body') {
                    const v = String(data.cell.text);
                    if (v.includes('SUCCESS')) data.cell.styles.textColor = [16, 185, 129];
                    else if (v.includes('FAILED') || v.includes('LOCKED')) data.cell.styles.textColor = [239, 68, 68];
                    else data.cell.styles.textColor = [59, 130, 246];
                }
            },
            didDrawPage: () => {
                const pageNum = (doc.internal as any).getCurrentPageInfo().pageNumber;
                drawPageHeader(doc, reportId, 'FYS System Admin Activity Log', 'RESTRICTED — INTERNAL', [14, 165, 233], pageNum, finalTotal);
                drawPageFooter(doc, reportId, generatedAt);
            },
            margin: { top: 42, bottom: 20 },
        });

        return doc;
    };

    const first = renderDoc(99);
    const totalPages = (first.internal as any).getNumberOfPages();
    const finalDoc = renderDoc(totalPages);

    if (mode === 'preview') {
        window.open(finalDoc.output('bloburl'), '_blank');
    } else {
        finalDoc.save(`FYS_SYSTEM_LOGS_${reportId}.pdf`);
    }
};

// ════════════════════════════════════════════════════════════════════════════
// EXPORT 6 — Security Alerts (Failed Logins & Lockouts) & Auth Tracking
// ════════════════════════════════════════════════════════════════════════════
export const handleExportSecurityAlertsPDF = (mode: 'preview' | 'download', title: string, alerts: any[], targetUsername: string | 'all') => {
    const reportId = generateReportId('ALT');
    const generatedAt = new Date().toLocaleString('en-US', { timeZoneName: 'short' });

    const tableData = alerts.map(log => [
        String(log.id),
        log.username || '—',
        log.action_type === 'LOGIN_FAILED' ? 'FAILED LOGIN (WRONG CREDENTIALS)' : 
        log.action_type === 'ACCOUNT_LOCKED' ? 'ACCOUNT LOCKED (BRUTE FORCE)' : log.action_type,
        log.ip_address || '—',
        log.details || '—',
        new Date(log.created_at).toLocaleString('en-US')
    ]);

    const head = [['ID', 'User / Target', 'Alert Type / Action', 'Source IP', 'Details', 'Timestamp']];

    const renderDoc = (finalTotal: number) => {
        const doc = new jsPDF({ orientation: 'landscape' });
        const W = doc.internal.pageSize.getWidth();
        const isCritical = title.includes('محاولات الاختراق') || title.includes('Intrusion');
        const themeColor: [number, number, number] = isCritical ? [220, 38, 38] : [59, 130, 246]; // Red if Intrusion, Blue if Tracking
        
        // ── Cover Page ────────────────────────────────────────────────────────
        drawPageHeader(doc, reportId, 'FYS Security Alerts & Tracking', isCritical ? 'TOP SECRET / CRITICAL' : 'RESTRICTED / MONITORING', themeColor, 1, finalTotal);

        doc.setFillColor(248, 250, 252);
        doc.roundedRect(14, 42, W - 28, 34, 3, 3, 'F');

        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 41, 59);
        doc.text('Report Metadata', 20, 52);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(71, 85, 105);
        
        doc.text(`Total Alerts:`, 20, 61); doc.text(String(alerts.length), 65, 61);
        doc.text(`Target Scope:`, 20, 68); doc.text(targetUsername === 'all' ? 'System-Wide (ALL USERS)' : targetUsername, 65, 68);

        const col2 = W / 2 + 10;
        doc.text('Compliance:', col2, 61); doc.text(isCritical ? 'NIST SP 800-61 / INCIDENT' : 'ISO 27001 / TRACKING', col2 + 35, 61);
        doc.text('Classification:', col2, 68); doc.text(isCritical ? 'TOP SECRET CRITICAL' : 'RESTRICTED', col2 + 35, 68);

        drawPageFooter(doc, reportId, generatedAt);

        // ── Data Table Page ───────────────────────────────────────────────────
        doc.addPage('landscape');

        autoTable(doc, {
            startY: 42,
            head: head,
            body: tableData,
            theme: 'grid',
            headStyles: {
                fillColor: themeColor,
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                fontSize: 7.5,
                cellPadding: 4,
            },
            bodyStyles: {
                fontSize: 7,
                cellPadding: 3,
                textColor: [30, 41, 59],
            },
            alternateRowStyles: { fillColor: [248, 250, 252] },
            columnStyles: {
                0: { cellWidth: 15, fontStyle: 'bold' },
                1: { cellWidth: 35, fontStyle: 'bold' },
                2: { cellWidth: 45 },
                3: { cellWidth: 30 },
                4: { cellWidth: 'auto' },
                5: { cellWidth: 35 },
            },
            didParseCell: (data) => {
                if (data.column.index === 2 && data.section === 'body') {
                    const v = String(data.cell.text);
                    if (v.includes('SUCCESS') || v.includes('LOGOUT')) data.cell.styles.textColor = [16, 185, 129];
                    else if (v.includes('FAILED') || v.includes('LOCKED')) {
                        data.cell.styles.textColor = [239, 68, 68];
                        data.cell.styles.fontStyle = 'bold';
                    }
                    else data.cell.styles.textColor = [59, 130, 246];
                }
            },
            didDrawPage: () => {
                const pageNum = (doc.internal as any).getCurrentPageInfo().pageNumber;
                drawPageHeader(doc, reportId, 'FYS Security Alerts & Tracking', isCritical ? 'TOP SECRET / CRITICAL' : 'RESTRICTED / MONITORING', themeColor, pageNum, finalTotal);
                drawPageFooter(doc, reportId, generatedAt);
            },
            margin: { top: 42, bottom: 20 },
        });

        return doc;
    };

    const first = renderDoc(99);
    const totalPages = (first.internal as any).getNumberOfPages();
    const finalDoc = renderDoc(totalPages);

    if (mode === 'preview') {
        window.open(finalDoc.output('bloburl'), '_blank');
    } else {
        finalDoc.save(`FYS_ALERTS_${reportId}.pdf`);
    }
};


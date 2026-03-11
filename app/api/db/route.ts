import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { getDb, logSystemActivity } from '@/lib/db';
import { getSession } from '@/lib/auth';

// In-memory store for demo purposes. 
const globalAny: any = global;
const fs = require('fs');
const path = require('path');
const SESSIONS_FILE = path.join(process.cwd(), '.security_sessions.json');

if (!globalAny.activeDbConnections) {
    globalAny.activeDbConnections = new Map<string, any>();

    // Recovery logic from disk
    try {
        if (fs.existsSync(SESSIONS_FILE)) {
            const data = fs.readFileSync(SESSIONS_FILE, 'utf8');
            const savedSessions = JSON.parse(data);
            Object.keys(savedSessions).forEach(sid => {
                globalAny.activeDbConnections.set(sid, savedSessions[sid]);
            });
            console.log(`[Security System] Recovered ${Object.keys(savedSessions).length} active connections from disk.`);
        }
    } catch (e) {
        console.error("[Security System] Failed to recover sessions:", e);
    }
}
const activeConnections: Map<string, any> = globalAny.activeDbConnections;

async function trackConnection(sessionId: string, config: any) {
    const db = await getDb();
    await db.run(
        `INSERT INTO connection_history (sessionId, host, database_name, username, status) 
         VALUES (?, ?, ?, ?, 'active')
         ON CONFLICT(sessionId) DO UPDATE SET last_seen_at = CURRENT_TIMESTAMP, status = 'active'`,
        [sessionId, config.host, config.database, config.user]
    );
}

async function updateConnectionStatus(sessionId: string, status: string) {
    const db = await getDb();
    if (status === 'disconnected') {
        await db.run(
            `UPDATE connection_history SET status = ?, disconnected_at = CURRENT_TIMESTAMP WHERE sessionId = ?`,
            [status, sessionId]
        );
    } else {
        await db.run(
            `UPDATE connection_history SET status = ?, last_seen_at = CURRENT_TIMESTAMP WHERE sessionId = ?`,
            [status, sessionId]
        );
    }
}

async function cacheLogs(sessionId: string, logs: any[]) {
    const db = await getDb();
    for (const log of logs) {
        await db.run(
            `INSERT OR IGNORE INTO cached_activity_logs 
            (remote_id, sessionId, table_name, action_type, record_id, action_timestamp, details)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [log.id, sessionId, log.table_name, log.action_type, log.record_id, log.action_timestamp, log.details]
        );
    }
}

function persistSessions() {
    try {
        const obj: any = {};
        activeConnections.forEach((val, key) => { obj[key] = val; });
        fs.writeFileSync(SESSIONS_FILE, JSON.stringify(obj), 'utf8');
    } catch (e) { console.error("Failed to persist sessions", e); }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { action, host, port, database, user, password, sessionId } = body;

        // --- LATE RECOVERY LOGIC ---
        // If session is requested but not in memory, try a formal reload from disk
        if (sessionId && !activeConnections.has(sessionId)) {
            try {
                if (fs.existsSync(SESSIONS_FILE)) {
                    const data = fs.readFileSync(SESSIONS_FILE, 'utf8');
                    const savedSessions = JSON.parse(data);
                    if (savedSessions[sessionId]) {
                        activeConnections.set(sessionId, savedSessions[sessionId]);
                        console.log(`[Security System] Late recovery successful for session: ${sessionId}`);
                    }
                }
            } catch (e) {
                console.error("[Security System] Late recovery failed:", e);
            }
        }
        // ---------------------------

        let config: any = null;
        if (sessionId && activeConnections.has(sessionId)) {
            config = activeConnections.get(sessionId);
        }

        // Handle Connection Action
        if (action === 'connect') {
            if (!host || !port || !database || !user || !password) {
                return NextResponse.json({ success: false, message: 'جميع الحقول مطلوبة.' }, { status: 400 });
            }

            const connectionConfig = {
                host,
                port: Number(port),
                database,
                user,
                password,
            };

            // Try to connect
            const connection = await mysql.createConnection(connectionConfig);

            // Store connection config instead of the live connection object to avoid timeouts
            // Generate a simple session ID
            const newSessionId = Math.random().toString(36).substring(2, 15);
            activeConnections.set(newSessionId, connectionConfig);
            persistSessions();

            // Persist in SQLite
            await trackConnection(newSessionId, connectionConfig);

            // Close the test connection immediately
            await connection.end();

            // Audit log: Who connected and to which DB
            const reqSession = await getSession() as { id: number; username: string } | null;
            await logSystemActivity({
                userId: reqSession?.id ?? null,
                username: reqSession?.username ?? user,
                actionType: 'DB_CONNECTED',
                details: `أضاف اتصال جديد بقاعدة "${database}" على الخادم ${host}:${port} (مستخدم MySQL: ${user})`,
            });

            return NextResponse.json({
                success: true,
                message: 'تم الاتصال بقاعدة البيانات بنجاح!',
                sessionId: newSessionId,
                dbName: database
            });
        }

        // Handle Schema Discovery Action
        if (action === 'get_tables') {
            if (!sessionId || !activeConnections.has(sessionId)) {
                return NextResponse.json({ success: false, message: 'الجلسة انتهت أو غير صالحة. الرجاء إعادة الاتصال.' }, { status: 401 });
            }

            const config = activeConnections.get(sessionId);
            const connection = await mysql.createConnection(config);

            // Query to get all tables from the connected database
            const [rows] = await connection.execute(
                `SELECT TABLE_NAME 
         FROM information_schema.tables 
         WHERE TABLE_SCHEMA = ?`,
                [config.database]
            );

            // Query to get tables that already have our monitoring triggers
            const [triggerRows] = await connection.execute(
                `SELECT DISTINCT EVENT_OBJECT_TABLE 
                 FROM information_schema.TRIGGERS 
                 WHERE TRIGGER_SCHEMA = ? AND TRIGGER_NAME LIKE 'log_%'`,
                [config.database]
            );
            const monitoredTables = (triggerRows as any[]).map(row => row.EVENT_OBJECT_TABLE);

            // Get Users to map permissions later
            const [users] = await connection.execute(
                `SELECT User, Host FROM mysql.user WHERE User != 'mysql.session' AND User != 'mysql.sys' AND User != 'mariadb.sys'`
            );

            await connection.end();

            return NextResponse.json({
                success: true,
                tables: (rows as any[]).map(row => row.TABLE_NAME),
                monitoredTables,
                users: (users as any[]).map(r => ({ username: r.User, host: r.Host }))
            });
        }

        // Handle Fetch Permissions Action
        if (action === 'get_permissions') {
            if (!sessionId || !activeConnections.has(sessionId)) {
                return NextResponse.json({ success: false, message: 'الجلسة خطأ' }, { status: 401 });
            }

            const { targetUser, targetHost, targetTable } = body;
            const config = activeConnections.get(sessionId);
            const connection = await mysql.createConnection(config);

            try {
                // We run SHOW GRANTS for the specific user
                const [grants] = await connection.execute(`SHOW GRANTS FOR '${targetUser}'@'${targetHost}'`);

                let permissions = { select: false, insert: false, update: false, delete: false };
                const dbAndTable = `\`${config.database}\`.\`${targetTable}\``;
                const allDbAllTables = `*.*`;
                const currentDbAllTables = `\`${config.database}\`.*`;

                // Parse grant strings (Super edge case handling for MySQL grant string formats)
                (grants as any[]).forEach(row => {
                    const grantStr = Object.values(row)[0] as string;

                    if (grantStr.includes('ALL PRIVILEGES ON *.*') || grantStr.includes(`ALL PRIVILEGES ON \`${config.database}\`.*`)) {
                        permissions = { select: true, insert: true, update: true, delete: true };
                    }
                    else if (grantStr.includes(dbAndTable) || grantStr.includes(currentDbAllTables)) {
                        if (grantStr.includes('SELECT') || grantStr.includes('ALL PRIVILEGES')) permissions.select = true;
                        if (grantStr.includes('INSERT') || grantStr.includes('ALL PRIVILEGES')) permissions.insert = true;
                        if (grantStr.includes('UPDATE') || grantStr.includes('ALL PRIVILEGES')) permissions.update = true;
                        if (grantStr.includes('DELETE') || grantStr.includes('ALL PRIVILEGES')) permissions.delete = true;
                    }
                });

                await connection.end();
                return NextResponse.json({ success: true, permissions });
            } catch (err: any) {
                await connection.end();
                return NextResponse.json({ success: false, message: 'فشل جلب الصلاحيات: ' + err.message }, { status: 500 });
            }
        }

        // Handle Update Permissions Action
        if (action === 'update_permissions') {
            if (!sessionId || !activeConnections.has(sessionId)) {
                return NextResponse.json({ success: false, message: 'الجلسة خطأ' }, { status: 401 });
            }

            const { targetUser, targetHost, targetTable, permissions } = body;
            const config = activeConnections.get(sessionId);
            const connection = await mysql.createConnection(config);

            try {
                const dbName = config.database;
                const tableTarget = `\`${dbName}\`.\`${targetTable}\``;
                const userStr = `'${targetUser}'@'${targetHost}'`;

                // We revoke all first for this specific table to cleanly apply the new ones
                try {
                    await connection.query(`REVOKE ALL PRIVILEGES ON ${tableTarget} FROM ${userStr}`);
                } catch (e) { /* Ignore if no privileges existed to revoke */ }

                const grantsToGive = [];
                if (permissions.select) grantsToGive.push('SELECT');
                if (permissions.insert) grantsToGive.push('INSERT');
                if (permissions.update) grantsToGive.push('UPDATE');
                if (permissions.delete) grantsToGive.push('DELETE');

                if (grantsToGive.length > 0) {
                    const grantQuery = `GRANT ${grantsToGive.join(', ')} ON ${tableTarget} TO ${userStr}`;
                    await connection.query(grantQuery);
                }

                await connection.query('FLUSH PRIVILEGES');

                await connection.end();

                // Audit log
                const s5 = await getSession() as { id: number; username: string } | null;
                const cfg5 = activeConnections.get(sessionId);
                await logSystemActivity({
                    userId: s5?.id ?? null,
                    username: s5?.username ?? 'SYSTEM',
                    actionType: 'DB_PERMISSIONS_UPDATED',
                    details: `عدّل صلاحيات مستخدم DB "${targetUser}@${targetHost}" على جدول "${targetTable}" في قاعدة "${cfg5?.database}"، الصلاحيات: [${grantsToGive.join(', ') || 'لا صلاحيات'}]`,
                });

                return NextResponse.json({ success: true, message: 'تم تحديث الصلاحيات بنجاح' });
            } catch (err: any) {
                await connection.end();
                return NextResponse.json({ success: false, message: 'خطأ أثناء تحديث الصلاحيات: ' + err.message }, { status: 500 });
            }
        }

        // Handle Create DB User
        if (action === 'create_db_user') {
            if (!sessionId || !activeConnections.has(sessionId)) return NextResponse.json({ success: false, message: 'الجلسة خطأ' }, { status: 401 });
            const { targetUser, targetHost, targetPassword } = body;
            const config = activeConnections.get(sessionId);
            const connection = await mysql.createConnection(config);
            try {
                // Ensure strings are safe for literal use (basic defense mapping)
                const safeUser = targetUser.replace(/'/g, "''");
                const safeHost = targetHost.replace(/'/g, "''");
                const safePassword = targetPassword.replace(/'/g, "''");

                await connection.query(`CREATE USER '${safeUser}'@'${safeHost}' IDENTIFIED BY '${safePassword}'`);
                await connection.query('FLUSH PRIVILEGES');
                await connection.end();

                // Audit log
                const s6 = await getSession() as { id: number; username: string } | null;
                const cfg6 = activeConnections.get(sessionId);
                await logSystemActivity({
                    userId: s6?.id ?? null,
                    username: s6?.username ?? 'SYSTEM',
                    actionType: 'DB_USER_CREATED',
                    details: `أنشأ مستخدم DB جديد: "${targetUser}@${targetHost}" في خادم قاعدة "${cfg6?.host}"`,
                });

                return NextResponse.json({ success: true, message: 'تم إنشاء مستخدم قاعدة البيانات بنجاح!' });
            } catch (err: any) {
                await connection.end();
                return NextResponse.json({ success: false, message: 'خطأ أثناء إنشاء المستخدم: ' + err.message }, { status: 500 });
            }
        }

        // Handle Drop DB User
        if (action === 'drop_db_user') {
            if (!sessionId || !activeConnections.has(sessionId)) return NextResponse.json({ success: false, message: 'الجلسة خطأ' }, { status: 401 });
            const { targetUser, targetHost } = body;
            const config = activeConnections.get(sessionId);
            const connection = await mysql.createConnection(config);
            try {
                const safeUser = targetUser.replace(/'/g, "''");
                const safeHost = targetHost.replace(/'/g, "''");

                await connection.query(`DROP USER '${safeUser}'@'${safeHost}'`);
                await connection.query('FLUSH PRIVILEGES');
                await connection.end();

                // Audit log
                const s7 = await getSession() as { id: number; username: string } | null;
                const cfg7 = activeConnections.get(sessionId);
                await logSystemActivity({
                    userId: s7?.id ?? null,
                    username: s7?.username ?? 'SYSTEM',
                    actionType: 'DB_USER_DELETED',
                    details: `حذف مستخدم DB: "${targetUser}@${targetHost}" من خادم قاعدة "${cfg7?.host}"`,
                });

                return NextResponse.json({ success: true, message: 'تم حذف مستخدم قاعدة البيانات بنجاح!' });
            } catch (err: any) {
                await connection.end();
                return NextResponse.json({ success: false, message: 'خطأ أثناء حذف المستخدم: ' + err.message }, { status: 500 });
            }
        }

        // Handle Change DB User Password
        if (action === 'change_db_user_password') {
            if (!sessionId || !activeConnections.has(sessionId)) return NextResponse.json({ success: false, message: 'الجلسة خطأ' }, { status: 401 });
            const { targetUser, targetHost, newPassword } = body;
            const config = activeConnections.get(sessionId);
            const connection = await mysql.createConnection(config);
            try {
                const safeUser = targetUser.replace(/'/g, "''");
                const safeHost = targetHost.replace(/'/g, "''");
                const safePassword = newPassword.replace(/'/g, "''");

                await connection.query(`ALTER USER '${safeUser}'@'${safeHost}' IDENTIFIED BY '${safePassword}'`);
                await connection.query('FLUSH PRIVILEGES');
                await connection.end();

                // Audit log
                const s8 = await getSession() as { id: number; username: string } | null;
                const cfg8 = activeConnections.get(sessionId);
                await logSystemActivity({
                    userId: s8?.id ?? null,
                    username: s8?.username ?? 'SYSTEM',
                    actionType: 'DB_USER_PASSWORD_CHANGED',
                    details: `غيّر كلمة مرور مستخدم DB: "${targetUser}@${targetHost}" في خادم "${cfg8?.host}"`,
                });

                return NextResponse.json({ success: true, message: 'تم تغيير كلمة المرور للمستخدم بنجاح!' });
            } catch (err: any) {
                await connection.end();
                return NextResponse.json({ success: false, message: 'خطأ أثناء تغيير كلمة المرور: ' + err.message }, { status: 500 });
            }
        }

        // --- ACTIVITY LOGS ACTIONS ---

        // Handle Check Logs Setup Action
        if (action === 'check_logs_setup') {
            if (!sessionId || !activeConnections.has(sessionId)) return NextResponse.json({ success: false, message: 'الجلسة خطأ' }, { status: 401 });
            const config = activeConnections.get(sessionId);
            const connection = await mysql.createConnection(config);
            try {
                const [rows] = await connection.execute(`SHOW TABLES LIKE '_system_activity_logs'`);
                await connection.end();
                return NextResponse.json({ success: true, isSetup: (rows as any[]).length > 0 });
            } catch (err: any) {
                await connection.end();
                return NextResponse.json({ success: false, message: err.message }, { status: 500 });
            }
        }

        // Handle Setup Logs Table Action
        if (action === 'setup_logs_table') {
            if (!sessionId || !activeConnections.has(sessionId)) return NextResponse.json({ success: false, message: 'الجلسة خطأ' }, { status: 401 });
            const config = activeConnections.get(sessionId);
            const connection = await mysql.createConnection(config);
            try {
                const createTableSQL = `
                    CREATE TABLE IF NOT EXISTS \`_system_activity_logs\` (
                        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
                        \`table_name\` VARCHAR(255) NOT NULL,
                        \`action_type\` ENUM('INSERT', 'UPDATE', 'DELETE') NOT NULL,
                        \`record_id\` VARCHAR(255),
                        \`action_timestamp\` DATETIME DEFAULT CURRENT_TIMESTAMP,
                        \`details\` TEXT
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
                `;
                await connection.query(createTableSQL);

                // Create Security Audit Table for Login Attempts
                const createSecuritySQL = `
                    CREATE TABLE IF NOT EXISTS \`_system_security_audit\` (
                        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
                        \`target_user\` VARCHAR(255),
                        \`event_type\` ENUM('LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGOUT', 'BRUTE_FORCE_ALERT') NOT NULL,
                        \`ip_address\` VARCHAR(45),
                        \`attempt_time\` DATETIME DEFAULT CURRENT_TIMESTAMP,
                        \`details\` TEXT
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
                `;
                await connection.query(createSecuritySQL);

                // Create Patched Files Tracker Table
                const createPatchesSQL = `
                    CREATE TABLE IF NOT EXISTS \`_system_security_patches\` (
                        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
                        \`file_path\` TEXT NOT NULL,
                        \`patch_time\` DATETIME DEFAULT CURRENT_TIMESTAMP,
                        \`status\` ENUM('ACTIVE', 'INACTIVE', 'REMOVED') DEFAULT 'ACTIVE',
                        \`file_type\` VARCHAR(20)
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
                `;
                await connection.query(createPatchesSQL);

                await connection.end();

                // Audit log
                const s1 = await getSession() as { id: number; username: string } | null;
                const cfg1 = activeConnections.get(sessionId);
                await logSystemActivity({
                    userId: s1?.id ?? null,
                    username: s1?.username ?? 'SYSTEM',
                    actionType: 'MONITORING_SETUP',
                    details: `أعد جداول المراقبة والتدقيق نظام DB لقاعدة: ${cfg1?.database} (خادم: ${cfg1?.host})`,
                });

                return NextResponse.json({ success: true, message: 'تم إنشاء جداول المراقبة والتدقيق الأمني بنجاح!' });
            } catch (err: any) {
                await connection.end();
                return NextResponse.json({ success: false, message: err.message }, { status: 500 });
            }
        }

        // Handle Get Table Columns Action
        if (action === 'get_table_columns') {
            if (!sessionId || !activeConnections.has(sessionId)) return NextResponse.json({ success: false, message: 'الجلسة خطأ' }, { status: 401 });
            const { targetTable } = body;
            const config = activeConnections.get(sessionId);
            const connection = await mysql.createConnection(config);
            try {
                const [rows] = await connection.execute(`SHOW COLUMNS FROM \`${targetTable}\``);
                await connection.end();
                return NextResponse.json({ success: true, columns: (rows as any[]).map(r => r.Field) });
            } catch (err: any) {
                await connection.end();
                return NextResponse.json({ success: false, message: err.message }, { status: 500 });
            }
        }

        // Handle Setup Trigger Action
        if (action === 'setup_table_trigger') {
            if (!sessionId || !activeConnections.has(sessionId)) return NextResponse.json({ success: false, message: 'الجلسة خطأ' }, { status: 401 });
            const { targetTable, primaryKeyColumn } = body;
            const config = activeConnections.get(sessionId);

            // Basic safety check for column/table names (prevent SQL injection through these)
            if (!/^[a-zA-Z0-9_]+$/.test(targetTable) || !/^[a-zA-Z0-9_]+$/.test(primaryKeyColumn)) {
                return NextResponse.json({ success: false, message: 'اسم الجدول أو العمود غير صالح.' }, { status: 400 });
            }

            const connection = await mysql.createConnection(config);
            try {
                // Fetch all columns dynamically to construct JSON objects
                const [columnsRes] = await connection.execute(`SHOW COLUMNS FROM \`${targetTable}\``);
                const columns = (columnsRes as any[]).map(r => r.Field);

                if (columns.length === 0) {
                    throw new Error('الجدول لا يحتوي على أعمدة لاستهدافها.');
                }

                // Construct JSON_OBJECT strings for NEW and OLD values
                // Example: JSON_OBJECT('id', NEW.id, 'name', NEW.name...)
                const newJsonObjParts = columns.map(col => `'${col}', NEW.\`${col}\``).join(', ');
                const oldJsonObjParts = columns.map(col => `'${col}', OLD.\`${col}\``).join(', ');

                const newJsonStr = `JSON_OBJECT(${newJsonObjParts})`;
                const oldJsonStr = `JSON_OBJECT(${oldJsonObjParts})`;

                await connection.query(`DROP TRIGGER IF EXISTS \`log_insert_${targetTable}\``);
                await connection.query(`DROP TRIGGER IF EXISTS \`log_update_${targetTable}\``);
                await connection.query(`DROP TRIGGER IF EXISTS \`log_delete_${targetTable}\``);

                await connection.query(`
                    CREATE TRIGGER \`log_insert_${targetTable}\` AFTER INSERT ON \`${targetTable}\`
                    FOR EACH ROW BEGIN
                        INSERT INTO \`_system_activity_logs\` (\`table_name\`, \`action_type\`, \`record_id\`, \`details\`)
                        VALUES ('${targetTable}', 'INSERT', NEW.\`${primaryKeyColumn}\`, JSON_OBJECT('db_user', USER(), 'new_data', ${newJsonStr}));
                    END;
                `);

                await connection.query(`
                    CREATE TRIGGER \`log_update_${targetTable}\` AFTER UPDATE ON \`${targetTable}\`
                    FOR EACH ROW BEGIN
                        INSERT INTO \`_system_activity_logs\` (\`table_name\`, \`action_type\`, \`record_id\`, \`details\`)
                        VALUES ('${targetTable}', 'UPDATE', NEW.\`${primaryKeyColumn}\`, JSON_OBJECT('db_user', USER(), 'old_data', ${oldJsonStr}, 'new_data', ${newJsonStr}));
                    END;
                `);

                await connection.query(`
                    CREATE TRIGGER \`log_delete_${targetTable}\` AFTER DELETE ON \`${targetTable}\`
                    FOR EACH ROW BEGIN
                        INSERT INTO \`_system_activity_logs\` (\`table_name\`, \`action_type\`, \`record_id\`, \`details\`)
                        VALUES ('${targetTable}', 'DELETE', OLD.\`${primaryKeyColumn}\`, JSON_OBJECT('db_user', USER(), 'old_data', ${oldJsonStr}));
                    END;
                `);

                await connection.end();

                // Audit log
                const s2 = await getSession() as { id: number; username: string } | null;
                const cfg2 = activeConnections.get(sessionId);
                await logSystemActivity({
                    userId: s2?.id ?? null,
                    username: s2?.username ?? 'SYSTEM',
                    actionType: 'TRIGGER_ADDED',
                    details: `أضاف مشغل مراقبة (Trigger) على جدول "${targetTable}" في قاعدة "${cfg2?.database}"`,
                });

                return NextResponse.json({ success: true, message: `تم إضافة المراقب الذكي على جدول (${targetTable}) بنجاح! وسيقوم بتسجيل التفاصيل العميقة.` });
            } catch (err: any) {
                await connection.end();
                return NextResponse.json({ success: false, message: 'خطأ أثناء إنشاء الـ Triggers: ' + err.message }, { status: 500 });
            }
        }

        // Handle Setup All Triggers Action
        if (action === 'setup_all_tables_triggers') {
            if (!sessionId || !activeConnections.has(sessionId)) return NextResponse.json({ success: false, message: 'الجلسة خطأ' }, { status: 401 });
            const config = activeConnections.get(sessionId);
            const connection = await mysql.createConnection(config);

            try {
                // Get all tables
                const [tablesOutput] = await connection.execute(`SHOW TABLES`);
                const tables = (tablesOutput as any[]).map(r => Object.values(r)[0] as string);

                let successCount = 0;
                let errorCount = 0;

                for (const targetTable of tables) {
                    if (targetTable === '_system_activity_logs') continue;

                    try {
                        const [columnsRes] = await connection.execute(`SHOW COLUMNS FROM \`${targetTable}\``);
                        const columnsData = columnsRes as any[];
                        if (columnsData.length === 0) continue;

                        let pkColumn = columnsData.find(c => c.Key === 'PRI')?.Field;
                        if (!pkColumn) pkColumn = columnsData[0].Field; // Fallback to first column

                        const columns = columnsData.map(r => r.Field);

                        const newJsonObjParts = columns.map(col => `'${col}', NEW.\`${col}\``).join(', ');
                        const oldJsonObjParts = columns.map(col => `'${col}', OLD.\`${col}\``).join(', ');

                        const newJsonStr = `JSON_OBJECT(${newJsonObjParts})`;
                        const oldJsonStr = `JSON_OBJECT(${oldJsonObjParts})`;

                        await connection.query(`DROP TRIGGER IF EXISTS \`log_insert_${targetTable}\``);
                        await connection.query(`DROP TRIGGER IF EXISTS \`log_update_${targetTable}\``);
                        await connection.query(`DROP TRIGGER IF EXISTS \`log_delete_${targetTable}\``);

                        await connection.query(`
                            CREATE TRIGGER \`log_insert_${targetTable}\` AFTER INSERT ON \`${targetTable}\`
                            FOR EACH ROW BEGIN
                                INSERT INTO \`_system_activity_logs\` (\`table_name\`, \`action_type\`, \`record_id\`, \`details\`)
                                VALUES ('${targetTable}', 'INSERT', NEW.\`${pkColumn}\`, JSON_OBJECT('db_user', USER(), 'new_data', ${newJsonStr}));
                            END;
                        `);

                        await connection.query(`
                            CREATE TRIGGER \`log_update_${targetTable}\` AFTER UPDATE ON \`${targetTable}\`
                            FOR EACH ROW BEGIN
                                INSERT INTO \`_system_activity_logs\` (\`table_name\`, \`action_type\`, \`record_id\`, \`details\`)
                                VALUES ('${targetTable}', 'UPDATE', NEW.\`${pkColumn}\`, JSON_OBJECT('db_user', USER(), 'old_data', ${oldJsonStr}, 'new_data', ${newJsonStr}));
                            END;
                        `);

                        await connection.query(`
                            CREATE TRIGGER \`log_delete_${targetTable}\` AFTER DELETE ON \`${targetTable}\`
                            FOR EACH ROW BEGIN
                                INSERT INTO \`_system_activity_logs\` (\`table_name\`, \`action_type\`, \`record_id\`, \`details\`)
                                VALUES ('${targetTable}', 'DELETE', OLD.\`${pkColumn}\`, JSON_OBJECT('db_user', USER(), 'old_data', ${oldJsonStr}));
                            END;
                        `);
                        successCount++;
                    } catch (e) {
                        errorCount++;
                    }
                }

                await connection.end();

                // Audit log
                const s3 = await getSession() as { id: number; username: string } | null;
                const cfg3 = activeConnections.get(sessionId);
                await logSystemActivity({
                    userId: s3?.id ?? null,
                    username: s3?.username ?? 'SYSTEM',
                    actionType: 'TRIGGER_BULK_ADDED',
                    details: `فعّل مراقبة شاملة على ${successCount} جدولاً في قاعدة "${cfg3?.database}" (فشل في ${errorCount} جداول)`,
                });

                return NextResponse.json({ success: true, message: `تم تفعيل المراقبة الشاملة على \${successCount} جداول (فشل في \${errorCount}).` });

            } catch (err: any) {
                await connection.end();
                return NextResponse.json({ success: false, message: 'خطأ أثناء الحقن الشامل: ' + err.message }, { status: 500 });
            }
        }

        // Handle Get Logs Action
        if (action === 'get_logs') {
            if (!sessionId || !activeConnections.has(sessionId)) return NextResponse.json({ success: false, message: 'الجلسة خطأ' }, { status: 401 });
            const config = activeConnections.get(sessionId);
            try {
                const { startDate, endDate, tableNames } = body;
                const connection = await mysql.createConnection(config);
                let query = `SELECT * FROM \`_system_activity_logs\``;
                let params: any[] = [];
                let conditions: string[] = [];

                if (startDate) {
                    conditions.push(`action_timestamp >= ?`);
                    params.push(startDate);
                }
                if (endDate) {
                    conditions.push(`action_timestamp <= ?`);
                    params.push(endDate);
                }
                if (tableNames && Array.isArray(tableNames) && tableNames.length > 0) {
                    const placeholders = tableNames.map(() => '?').join(',');
                    conditions.push(`table_name IN (${placeholders})`);
                    params.push(...tableNames);
                }

                if (conditions.length > 0) {
                    query += ` WHERE ` + conditions.join(' AND ');
                }

                query += ` ORDER BY \`action_timestamp\` DESC LIMIT 500`;

                const [rows] = await connection.execute(query, params);

                // Cache results
                await cacheLogs(sessionId, rows as any[]);

                await connection.end();
                return NextResponse.json({ success: true, logs: rows });
            } catch (err: any) {
                console.error("Remote log fetch failed, trying cache...", err);
                const db = await getDb();
                const cached = await db.all(
                    `SELECT remote_id as id, table_name, action_type, record_id, action_timestamp, details 
                     FROM cached_activity_logs WHERE sessionId = ? ORDER BY action_timestamp DESC LIMIT 500`,
                    [sessionId]
                );
                return NextResponse.json({
                    success: true,
                    logs: cached,
                    fromCache: true,
                    message: 'تم استحضار البيانات من الذاكرة المؤقتة لتعذر الوصول لقاعدة البيانات حالياً.'
                });
            }
        }

        // Handle Remove Trigger Action
        if (action === 'remove_table_trigger') {
            if (!sessionId || !activeConnections.has(sessionId)) return NextResponse.json({ success: false, message: 'الجلسة خطأ' }, { status: 401 });
            const { targetTable } = body;
            const config = activeConnections.get(sessionId);
            const connection = await mysql.createConnection(config);
            try {
                await connection.query(`DROP TRIGGER IF EXISTS \`log_insert_${targetTable}\``);
                await connection.query(`DROP TRIGGER IF EXISTS \`log_update_${targetTable}\``);
                await connection.query(`DROP TRIGGER IF EXISTS \`log_delete_${targetTable}\``);

                await connection.end();

                // Audit log
                const s4 = await getSession() as { id: number; username: string } | null;
                const cfg4 = activeConnections.get(sessionId);
                await logSystemActivity({
                    userId: s4?.id ?? null,
                    username: s4?.username ?? 'SYSTEM',
                    actionType: 'TRIGGER_REMOVED',
                    details: `أوقف مراقبة جدول "${targetTable}" في قاعدة "${cfg4?.database}"`,
                });

                return NextResponse.json({ success: true, message: `تم إيقاف المراقبة عن جدول (${targetTable}) بنجاح.` });
            } catch (err: any) {
                await connection.end();
                return NextResponse.json({ success: false, message: 'خطأ أثناء حذف الـ Triggers: ' + err.message }, { status: 500 });
            }
        }

        // Handle Get New Logs (Real-time polling)
        if (action === 'get_new_logs') {
            if (!sessionId || !activeConnections.has(sessionId)) return NextResponse.json({ success: false, message: 'الجلسة خطأ' }, { status: 401 });
            const { lastLogId } = body;
            try {
                const connection = await mysql.createConnection(config);
                const [rows] = await connection.execute(
                    `SELECT * FROM \`_system_activity_logs\` WHERE id > ? ORDER BY \`action_timestamp\` ASC`,
                    [lastLogId || 0]
                );

                // Cache new logs
                await cacheLogs(sessionId, rows as any[]);

                await connection.end();
                return NextResponse.json({ success: true, newLogs: rows });
            } catch (err: any) {
                return NextResponse.json({ success: false, message: 'تعذر جلب البيانات الحية حالياً.' });
            }
        }

        // Handle Get App Users Action (Real user view)
        if (action === 'get_app_users') {
            if (!sessionId || !activeConnections.has(sessionId)) return NextResponse.json({ success: false, message: 'الجلسة خطأ' }, { status: 401 });
            const { targetTable } = body;

            if (!/^[a-zA-Z0-9_]+$/.test(targetTable)) {
                return NextResponse.json({ success: false, message: 'اسم الجدول غير صالح.' }, { status: 400 });
            }

            const config = activeConnections.get(sessionId);
            const connection = await mysql.createConnection(config);
            try {
                // Fetch the actual rows from the user table (Limit to 100 for safety)
                const [rows] = await connection.execute(`SELECT * FROM \`${targetTable}\` LIMIT 100`);
                await connection.end();
                return NextResponse.json({ success: true, users: rows });
            } catch (err: any) {
                await connection.end();
                return NextResponse.json({ success: false, message: err.message }, { status: 500 });
            }
        }

        // Handle Get User Record Logs Action
        if (action === 'get_user_record_logs') {
            if (!sessionId || !activeConnections.has(sessionId)) return NextResponse.json({ success: false, message: 'الجلسة خطأ' }, { status: 401 });
            const { targetTable, recordId } = body;

            if (!/^[a-zA-Z0-9_]+$/.test(targetTable)) {
                return NextResponse.json({ success: false, message: 'اسم الجدول غير صالح.' }, { status: 400 });
            }

            const config = activeConnections.get(sessionId);
            const connection = await mysql.createConnection(config);
            try {
                const [rows] = await connection.execute(
                    `SELECT * FROM \`_system_activity_logs\` WHERE \`table_name\` = ? AND \`record_id\` = ? ORDER BY \`action_timestamp\` DESC`,
                    [targetTable, String(recordId)]
                );
                await connection.end();
                return NextResponse.json({ success: true, logs: rows });
            } catch (err: any) {
                await connection.end();
                return NextResponse.json({ success: false, message: err.message }, { status: 500 });
            }
        }

        // Handle Get Security Alerts
        if (action === 'get_security_alerts') {
            if (!sessionId || !activeConnections.has(sessionId)) return NextResponse.json({ success: false, message: 'الجلسة خطأ' }, { status: 401 });
            const config = activeConnections.get(sessionId);
            const connection = await mysql.createConnection(config);
            try {
                // Fetch failed attempts to calculate brute force
                const [rows] = await connection.execute(
                    `SELECT target_user, COUNT(*) as attempts, MAX(attempt_time) as last_attempt 
                     FROM \`_system_security_audit\` 
                     WHERE event_type = 'LOGIN_FAILED' 
                     AND attempt_time > DATE_SUB(NOW(), INTERVAL 30 MINUTE)
                     GROUP BY target_user HAVING attempts >= 3`
                );

                // Fetch recent logs
                const [logs] = await connection.execute(
                    `SELECT * FROM \`_system_security_audit\` ORDER BY attempt_time DESC LIMIT 50`
                );

                await connection.end();
                return NextResponse.json({ success: true, alerts: rows, logs });
            } catch (err: any) {
                await connection.end();
                return NextResponse.json({ success: false, message: err.message }, { status: 500 });
            }
        }

        // Action to LOG security event
        if (action === 'log_security_event') {
            if (!config) return NextResponse.json({ success: false, message: 'الجلسة خطأ' }, { status: 401 });
            const { targetUser, eventType, ipAddress, details } = body;
            const connection = await mysql.createConnection(config);
            try {
                await connection.execute(
                    `INSERT INTO \`_system_security_audit\` (target_user, event_type, ip_address, details) VALUES (?, ?, ?, ?)`,
                    [targetUser, eventType, ipAddress || 'unknown', details || '']
                );
                await connection.end();
                return NextResponse.json({ success: true });
            } catch (err: any) {
                if (connection) await connection.end();
                return NextResponse.json({ success: false, message: err.message }, { status: 500 });
            }
        }

        // Action: Smart Patcher (Automatic Integration)
        if (action === 'patch_login_file') {
            const { filePath } = body;
            if (!filePath) return NextResponse.json({ success: false, message: 'مسار الملف مطلوب' });

            try {
                const fs = require('fs');
                const path = require('path');

                if (!fs.existsSync(filePath)) {
                    return NextResponse.json({ success: false, message: 'الملف غير موجود في المسار المحدد' });
                }

                let content = fs.readFileSync(filePath, 'utf8');
                const extension = path.extname(filePath).toLowerCase();

                // Determine the correct API host dynamically for the patch
                const hostHeader = request.headers.get('host') || 'localhost:3000';
                const protocol = request.headers.get('x-forwarded-proto') || 'http';
                const apiEndpoint = `${protocol}://${hostHeader}/api/db`;

                let patched = false;
                const securityPayload = (userVar: string) => `
    // SECURITY PATCH BY ANTIGRAVITY
    fetch("${apiEndpoint}", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            action: "log_security_event",
            sessionId: "${sessionId}",
            targetUser: \${${userVar}},
            eventType: "LOGIN_FAILED",
            details: "Auto-detected failed login attempt"
        })
    }).catch(e => console.error("Security logging failed", e));
    // END SECURITY PATCH
`;

                // Logic for PHP
                if (extension === '.php') {
                    const phpLog = (userVar: string) => `
    // SECURITY PATCH BY ANTIGRAVITY
    file_get_contents("${apiEndpoint}", false, stream_context_create([
        "http" => ["method" => "POST", "header" => "Content-Type: application/json", "content" => json_encode([
            "action" => "log_security_event", "sessionId" => "${sessionId}",
            "targetUser" => ${userVar}, "eventType" => "LOGIN_FAILED"
        ])]
    ]));
    // END PATCH`;

                    // Look for common password verification patterns in PHP
                    if (content.includes('password_verify') && !content.includes('SECURITY PATCH')) {
                        content = content.replace(/(if\s*\(!password_verify.*?\)\s*\{|else\s*\{(?=[^}]*?login.*?fail))/g, `$1 ${phpLog('$username')}`);
                        patched = true;
                    }
                }
                // Logic for JS/TS (Next.js/Express)
                else if (['.ts', '.tsx', '.js'].includes(extension)) {
                    if (content.includes('401') && !content.includes('SECURITY PATCH')) {
                        content = content.replace(/(return\s+NextResponse\.json\(\s*\{\s*success:\s*false.*?\}.*?;)/g, `${securityPayload('username')} $1`);
                        patched = true;
                    }
                }

                if (patched) {
                    fs.writeFileSync(filePath, content, 'utf8');

                    // Record the patch in DB
                    const mysql = require('mysql2/promise');
                    const conn = await mysql.createConnection(config);
                    await conn.execute(
                        `INSERT INTO \`_system_security_patches\` (file_path, file_type) VALUES (?, ?)`,
                        [filePath, extension.replace('.', '')]
                    );
                    await conn.end();

                    return NextResponse.json({ success: true, message: 'تم تحليل الملف وحقن كود الحماية بنجاح!' });
                } else {
                    return NextResponse.json({ success: false, message: 'لم نتمكن من العثور على نقطة حقن مناسبة أو الملف محمي بالفعل.' });
                }

            } catch (err: any) {
                return NextResponse.json({ success: false, message: 'خطأ أثناء محاولة التعديل: ' + err.message });
            }
        }

        // Handle Get Connection History
        if (action === 'get_connection_history') {
            const db = await getDb();
            const history = await db.all(`SELECT * FROM connection_history WHERE is_deleted = 0 ORDER BY last_seen_at DESC`);
            return NextResponse.json({ success: true, history });
        }

        // Handle Delete Connection
        if (action === 'delete_connection') {
            const { connectionId, wipeData } = body;
            const db = await getDb();
            try {
                // First get the session ID of the connection being deleted to remove it from memory if active
                const conn = await db.get(`SELECT sessionId, database_name FROM connection_history WHERE id = ?`, [connectionId]);
                
                if (conn && conn.sessionId) {
                    activeConnections.delete(conn.sessionId);
                    persistSessions();
                }

                if (wipeData && conn) {
                    // Hard Delete: Wipe everything relative to this DB
                    await db.run(`DELETE FROM connection_history WHERE id = ?`, [connectionId]);
                    await db.run(`DELETE FROM cached_activity_logs WHERE sessionId = ?`, [conn.sessionId]);
                    // Delete monitor users assigned specifically to this DB
                    await db.run(`DELETE FROM users WHERE assigned_db = ?`, [conn.database_name]);
                } else {
                    // Soft delete: Keep logs and records, just hide the connection
                    await db.run(`UPDATE connection_history SET is_deleted = 1 WHERE id = ?`, [connectionId]);
                }

                // Audit log
                const delSession = await getSession() as { id: number; username: string } | null;
                await logSystemActivity({
                    userId: delSession?.id ?? null,
                    username: delSession?.username ?? 'SYSTEM',
                    actionType: wipeData ? 'DB_HARD_DELETED' : 'DB_DISCONNECTED',
                    details: wipeData
                        ? `حذف جذري نهائي لقاعدة البيانات: "${conn?.database_name}" (مع جميع السجلات والمستخدمين المرتبطين)`
                        : `إزالة اتصال قاعدة البيانات: "${conn?.database_name}" مع الاحتفاظ بالأرشيف`,
                });

                return NextResponse.json({ 
                    success: true, 
                    message: wipeData ? 'تم حذف نظام الحماية وسجلاته عن هذه القاعدة نهائياً.' : 'تم إزالة الاتصال والاحتفاظ بالسجلات التاريخية.' 
                });
            } catch (err: any) {
                return NextResponse.json({ success: false, message: 'فشل عملية إزالة قاعدة البيانات: ' + err.message }, { status: 500 });
            }
        }

        // Handle Ping / Connection Check Status
        if (action === 'check_connection') {
            if (!sessionId || !activeConnections.has(sessionId)) {
                return NextResponse.json({ success: false, connected: false, message: 'لا يوجد اتصال نشط بهذه الجلسة.' });
            }
            const config = activeConnections.get(sessionId);
            try {
                const connection = await mysql.createConnection(config);
                await connection.ping();
                await connection.end();
                await updateConnectionStatus(sessionId, 'active');
                return NextResponse.json({ success: true, connected: true });
            } catch (err) {
                await updateConnectionStatus(sessionId, 'disconnected');
                return NextResponse.json({ success: true, connected: false, message: 'فقدان الاتصال بقاعدة البيانات.' });
            }
        }

        // Handle Refresh All Connections (Heartbeat)
        if (action === 'refresh_all_connections') {
            const db = await getDb();
            const results: any[] = [];
            const activeEntries = Array.from(activeConnections.entries());

            // Get all historical sessions
            const allHistory = await db.all(`SELECT sessionId FROM connection_history`);
            const historySessionIds = new Set(allHistory.map((h: any) => h.sessionId));

            for (const [sId, conf] of activeEntries) {
                // Recover missing history data for older connections
                if (!historySessionIds.has(sId)) {
                    await trackConnection(sId, conf);
                }

                try {
                    const connection = await mysql.createConnection(conf);
                    await connection.ping();
                    await connection.end();
                    await updateConnectionStatus(sId, 'active');
                    results.push({ sessionId: sId, status: 'active' });
                } catch (err) {
                    await updateConnectionStatus(sId, 'disconnected');
                    results.push({ sessionId: sId, status: 'disconnected' });
                }
            }

            // Clean up: Any session in SQLite that is NOT in memory Map should be 'disconnected'
            const memorySessionIds = new Set(activeConnections.keys());
            for (const h of allHistory) {
                if (!memorySessionIds.has(h.sessionId)) {
                    // Update to disconnected if not actively managed
                    await db.run(`UPDATE connection_history SET status = 'disconnected' WHERE sessionId = ?`, [h.sessionId]);
                }
            }

            const history = await db.all(`SELECT * FROM connection_history WHERE is_deleted = 0 ORDER BY last_seen_at DESC`);
            return NextResponse.json({ success: true, history });
        }

        // Handle Get Patched Files
        if (action === 'get_patched_files') {
            if (!config) return NextResponse.json({ success: false, message: 'الجلسة خطأ' }, { status: 401 });
            const connection = await mysql.createConnection(config);
            try {
                const [rows] = await connection.execute(`SELECT * FROM \`_system_security_patches\` ORDER BY patch_time DESC`);
                await connection.end();
                return NextResponse.json({ success: true, patches: rows });
            } catch (err: any) {
                if (connection) await connection.end();
                return NextResponse.json({ success: false, message: err.message }, { status: 500 });
            }
        }

        // ─── APP USERS MANAGEMENT ──────────────────────────────────────────

        if (action === 'analyze_user_table') {
            if (!sessionId || !activeConnections.has(sessionId)) return NextResponse.json({ success: false, message: 'الجلسة خطأ' }, { status: 401 });
            const { targetTable } = body;
            if (!targetTable || !/^[a-zA-Z0-9_]+$/.test(targetTable)) return NextResponse.json({ success: false, message: 'اسم الجدول غير صالح' }, { status: 400 });
            const cfg = activeConnections.get(sessionId);
            const conn2 = await mysql.createConnection(cfg);
            try {
                const [columnsRes] = await conn2.execute(`SHOW COLUMNS FROM \`${targetTable}\``);
                const cols = columnsRes as any[];
                const detect = (kws: string[]) => {
                    for (const kw of kws) {
                        const f = cols.find((c: any) => c.Field.toLowerCase().includes(kw));
                        if (f) return f.Field;
                    }
                    return null;
                };
                const pkCol = cols.find((c: any) => c.Key === 'PRI')?.Field || cols[0]?.Field;
                const suggestions = {
                    idColumn: pkCol,
                    usernameColumn: detect(['username', 'user_name', 'login', 'name', 'email', 'user']),
                    passwordColumn: detect(['password', 'pass', 'pwd', 'hash', 'passwd']),
                    emailColumn: detect(['email', 'mail']),
                    roleColumn: detect(['role', 'type', 'user_type', 'level', 'group']),
                    statusColumn: detect(['active', 'is_active', 'status', 'enabled', 'blocked']),
                    createdAtColumn: detect(['created_at', 'created', 'reg_date', 'join_date']),
                    lastLoginColumn: detect(['last_login', 'last_seen', 'last_activity']),
                };
                const [sampleRows] = await conn2.execute(`SELECT * FROM \`${targetTable}\` LIMIT 3`);
                await conn2.end();
                return NextResponse.json({ success: true, columns: cols.map((c: any) => ({ name: c.Field, type: c.Type, key: c.Key })), suggestions, sampleRows });
            } catch (err: any) { await conn2.end(); return NextResponse.json({ success: false, message: err.message }, { status: 500 }); }
        }

        if (action === 'get_app_table_rows') {
            if (!sessionId || !activeConnections.has(sessionId)) return NextResponse.json({ success: false, message: 'الجلسة خطأ' }, { status: 401 });
            const { targetTable, page = 1, limit = 20, searchColumn, searchValue } = body;
            if (!targetTable || !/^[a-zA-Z0-9_]+$/.test(targetTable)) return NextResponse.json({ success: false, message: 'اسم الجدول غير صالح' }, { status: 400 });
            const cfg = activeConnections.get(sessionId);
            const conn3 = await mysql.createConnection(cfg);
            try {
                const offset = (Number(page) - 1) * Number(limit);
                let where = ''; let params2: any[] = [];
                if (searchColumn && searchValue && /^[a-zA-Z0-9_]+$/.test(searchColumn)) { where = ` WHERE \`${searchColumn}\` LIKE ?`; params2.push(`%${searchValue}%`); }
                const [countRes] = await conn3.execute(`SELECT COUNT(*) as total FROM \`${targetTable}\`` + where, params2);
                const total = (countRes as any[])[0].total;
                const [rows] = await conn3.execute(`SELECT * FROM \`${targetTable}\`` + where + ` LIMIT ${Number(limit)} OFFSET ${offset}`, params2);
                await conn3.end();
                return NextResponse.json({ success: true, rows, total, page: Number(page), limit: Number(limit) });
            } catch (err: any) { await conn3.end(); return NextResponse.json({ success: false, message: err.message }, { status: 500 }); }
        }

        if (action === 'update_app_user_field') {
            if (!sessionId || !activeConnections.has(sessionId)) return NextResponse.json({ success: false, message: 'الجلسة خطأ' }, { status: 401 });
            const { targetTable, idColumn, rowId, fieldName, fieldValue, hashType } = body;
            if (!targetTable || !/^[a-zA-Z0-9_]+$/.test(targetTable)) return NextResponse.json({ success: false, message: 'اسم الجدول غير صالح' }, { status: 400 });
            if (!fieldName || !/^[a-zA-Z0-9_]+$/.test(fieldName)) return NextResponse.json({ success: false, message: 'اسم الحقل غير صالح' }, { status: 400 });
            if (!idColumn || !/^[a-zA-Z0-9_]+$/.test(idColumn)) return NextResponse.json({ success: false, message: 'عمود الـ ID غير صالح' }, { status: 400 });
            const cfg = activeConnections.get(sessionId);
            const conn4 = await mysql.createConnection(cfg);
            try {
                let valueToSet = fieldValue;
                const cryptoMod = require('crypto');
                const bcryptMod = require('bcryptjs');
                if (hashType === 'md5') valueToSet = cryptoMod.createHash('md5').update(fieldValue).digest('hex');
                else if (hashType === 'sha256') valueToSet = cryptoMod.createHash('sha256').update(fieldValue).digest('hex');
                else if (hashType === 'sha1') valueToSet = cryptoMod.createHash('sha1').update(fieldValue).digest('hex');
                else if (hashType === 'bcrypt') valueToSet = await bcryptMod.hash(fieldValue, 10);
                await conn4.execute(`UPDATE \`${targetTable}\` SET \`${fieldName}\` = ? WHERE \`${idColumn}\` = ?`, [valueToSet, rowId]);
                await conn4.end();
                return NextResponse.json({ success: true, message: `تم تحديث "${fieldName}" بنجاح` });
            } catch (err: any) { await conn4.end(); return NextResponse.json({ success: false, message: err.message }, { status: 500 }); }
        }

        // ─── APP USER ACTIVITY & PERMISSIONS ────────────────────────────────────

        if (action === 'get_app_user_activity') {
            if (!sessionId || !activeConnections.has(sessionId)) return NextResponse.json({ success: false, message: 'الجلسة خطأ' }, { status: 401 });
            const { targetUser, page = 1, limit = 50, eventType } = body;
            const cfg = activeConnections.get(sessionId);
            const conn5 = await mysql.createConnection(cfg);
            try {
                const conds: string[] = []; const params5: any[] = [];
                if (targetUser) { conds.push('target_user = ?'); params5.push(targetUser); }
                if (eventType && eventType !== 'ALL') { conds.push('event_type = ?'); params5.push(eventType); }
                const where5 = conds.length > 0 ? ' WHERE ' + conds.join(' AND ') : '';
                const offset5 = (Number(page) - 1) * Number(limit);
                const [countRes] = await conn5.execute(`SELECT COUNT(*) as total FROM \`_system_security_audit\`` + where5, params5);
                const total = (countRes as any[])[0].total;
                const [logs] = await conn5.execute(`SELECT * FROM \`_system_security_audit\`` + where5 + ` ORDER BY attempt_time DESC LIMIT ${Number(limit)} OFFSET ${offset5}`, params5);
                const [statsRes] = await conn5.execute(`SELECT target_user, COUNT(*) as total, SUM(event_type='LOGIN_FAILED') as failed, SUM(event_type='LOGIN_SUCCESS') as success FROM \`_system_security_audit\` GROUP BY target_user ORDER BY total DESC`);
                await conn5.end();
                return NextResponse.json({ success: true, logs, total, stats: statsRes });
            } catch (err: any) { await conn5.end(); return NextResponse.json({ success: false, message: err.message }, { status: 500 }); }
        }

        if (action === 'setup_app_permissions_table') {
            if (!sessionId || !activeConnections.has(sessionId)) return NextResponse.json({ success: false, message: 'الجلسة خطأ' }, { status: 401 });
            const cfg = activeConnections.get(sessionId);
            const conn6 = await mysql.createConnection(cfg);
            try {
                await conn6.execute(`CREATE TABLE IF NOT EXISTS \`_system_app_permissions\` (id INT AUTO_INCREMENT PRIMARY KEY, username VARCHAR(255) NOT NULL, permission_key VARCHAR(100) NOT NULL, granted TINYINT(1) DEFAULT 1, granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, notes TEXT, UNIQUE KEY uq_usr_perm (username, permission_key))`);
                await conn6.end();
                return NextResponse.json({ success: true, message: 'تم إنشاء جدول الصلاحيات' });
            } catch (err: any) { await conn6.end(); return NextResponse.json({ success: false, message: err.message }, { status: 500 }); }
        }

        if (action === 'get_app_permissions') {
            if (!sessionId || !activeConnections.has(sessionId)) return NextResponse.json({ success: false, message: 'الجلسة خطأ' }, { status: 401 });
            const { targetUser } = body;
            const cfg = activeConnections.get(sessionId);
            const conn7 = await mysql.createConnection(cfg);
            try {
                const q = targetUser
                    ? `SELECT * FROM \`_system_app_permissions\` WHERE username = ? ORDER BY permission_key`
                    : `SELECT * FROM \`_system_app_permissions\` ORDER BY username, permission_key`;
                const [rows] = await conn7.execute(q, targetUser ? [targetUser] : []);
                await conn7.end();
                return NextResponse.json({ success: true, permissions: rows });
            } catch (err: any) { await conn7.end(); return NextResponse.json({ success: false, message: err.message }, { status: 500 }); }
        }

        if (action === 'set_app_permission') {
            if (!sessionId || !activeConnections.has(sessionId)) return NextResponse.json({ success: false, message: 'الجلسة خطأ' }, { status: 401 });
            const { targetUser, permissionKey, granted, notes } = body;
            if (!targetUser || !permissionKey) return NextResponse.json({ success: false, message: 'بيانات ناقصة' }, { status: 400 });
            const cfg = activeConnections.get(sessionId);
            const conn8 = await mysql.createConnection(cfg);
            try {
                await conn8.execute(`INSERT INTO \`_system_app_permissions\` (username, permission_key, granted, notes) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE granted = ?, notes = ?, granted_at = CURRENT_TIMESTAMP`, [targetUser, permissionKey, granted ? 1 : 0, notes || null, granted ? 1 : 0, notes || null]);
                await conn8.end();
                return NextResponse.json({ success: true, message: `تم ${granted ? 'منح' : 'سحب'} صلاحية "${permissionKey}" ${granted ? 'لـ' : 'من'} "${targetUser}"` });
            } catch (err: any) { await conn8.end(); return NextResponse.json({ success: false, message: err.message }, { status: 500 }); }
        }

    } catch (error: any) {
        console.error('Database connection error:', error);
        return NextResponse.json(
            { success: false, message: error.message || 'فشل الاتصال بقاعدة البيانات. تأكد من صحة البيانات.' },
            { status: 500 }
        );
    }
}

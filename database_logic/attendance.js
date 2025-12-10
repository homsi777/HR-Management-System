

module.exports = (getDb, { getAll, getById, insert, update, deleteRow }) => ({
    processSyncData: (records) => {
        const db = getDb();
        const employees = getAll('employees');
        const biometricIdToEmployeeId = new Map(employees.filter(e => e.biometricId).map(e => [String(e.biometricId).trim(), e.id]));
        const blockedIds = new Set(db.prepare('SELECT biometric_id FROM blocked_biometric_ids').all().map(r => r.biometric_id));

        const dailyPunches = {};
        const unmatchedPunches = {};
        let skippedRecords = 0;

        console.log(`[DB] Processing ${records.length} sync record(s).`);
        records.forEach((rec, index) => {
            const biometricIdRaw = rec.user_id || rec.biometric_id || rec.UserID || rec.fingerprint_id;
            
            let date, time;
            if (rec.timestamp && typeof rec.timestamp === 'string') {
                const parts = rec.timestamp.split(' ');
                date = parts[0];
                time = parts.length > 1 ? parts[1].substring(0, 5) : '00:00'; // HH:MM:SS -> HH:MM
            } else {
                date = rec.date || rec.Date;
                time = rec.time || rec.Time;
            }

            if (!biometricIdRaw || !date || !time) {
                console.warn(`[DB] Skipping record at index ${index} due to missing fields:`, rec);
                skippedRecords++;
                return;
            }

            const biometricId = String(biometricIdRaw).trim();
            
            // NEW: Check against blocked IDs
            if (blockedIds.has(biometricId)) {
                console.log(`[DB] Skipping record for blocked biometric ID: ${biometricId}`);
                skippedRecords++;
                return;
            }

            const employeeId = biometricIdToEmployeeId.get(biometricId);

            if (employeeId) {
                const key = `${employeeId}-${date}`;
                if (!dailyPunches[key]) dailyPunches[key] = { employeeId, date, punches: [] };
                dailyPunches[key].punches.push(time);
            } else {
                console.warn(`[DB] Unmatched biometric ID: ${biometricId}. Storing for resolution.`);
                const key = `${biometricId}-${date}`;
                if (!unmatchedPunches[key]) unmatchedPunches[key] = { biometricId, date, punches: new Set() };
                unmatchedPunches[key].punches.add(time);
            }
        });

        const attendanceEntries = Object.values(dailyPunches);
        
        if (attendanceEntries.length > 0) {
            const transaction = db.transaction((entries) => {
                for (const entry of entries) {
                    const existing = db.prepare('SELECT id, checkIn, checkOut FROM attendance WHERE employeeId = ? AND date = ?').get(entry.employeeId, entry.date);
                    const newPunches = entry.punches || [];

                    if (existing) {
                        const existingPunches = [];
                        if (existing.checkIn) existingPunches.push(existing.checkIn);
                        if (existing.checkOut && existing.checkOut !== existing.checkIn) existingPunches.push(existing.checkOut);
                        
                        const allPunches = Array.from(new Set([...existingPunches, ...newPunches])).sort();
                        
                        const newCheckIn = allPunches[0] || null;
                        const newCheckOut = allPunches.length > 1 ? allPunches[allPunches.length - 1] : null;

                        // When updating, we reset is_synced_to_cloud to 0 because data has changed
                        db.prepare('UPDATE attendance SET checkIn = ?, checkOut = ?, is_synced_to_cloud = 0 WHERE id = ?')
                        .run(newCheckIn, newCheckOut, existing.id);
                    } else {
                        const allPunches = Array.from(new Set(newPunches)).sort();
                        const newCheckIn = allPunches[0] || null;
                        const newCheckOut = allPunches.length > 1 ? allPunches[allPunches.length - 1] : null;

                        if (newCheckIn) {
                            // Default is_synced_to_cloud is 0
                            db.prepare('INSERT INTO attendance (employeeId, date, checkIn, checkOut) VALUES (?, ?, ?, ?)')
                            .run(entry.employeeId, entry.date, newCheckIn, newCheckOut);
                        }
                    }
                }
            });
            transaction(attendanceEntries);
        }

        if (Object.keys(unmatchedPunches).length > 0) {
            const transaction = db.transaction((entries) => {
                for (const entry of entries) {
                    const existing = db.prepare('SELECT id, punches FROM unmatched_attendance WHERE biometricId = ? AND date = ?').get(entry.biometricId, entry.date);
                    if (existing) {
                        const existingPunches = new Set(JSON.parse(existing.punches));
                        entry.punches.forEach(p => existingPunches.add(p));
                        const allPunches = JSON.stringify(Array.from(existingPunches).sort());
                        db.prepare('UPDATE unmatched_attendance SET punches = ? WHERE id = ?').run(allPunches, existing.id);
                    } else {
                        const allPunches = JSON.stringify(Array.from(entry.punches).sort());
                        db.prepare('INSERT INTO unmatched_attendance (biometricId, date, punches) VALUES (?, ?, ?)')
                        .run(entry.biometricId, entry.date, allPunches);
                    }
                }
            });
            const entriesToProcess = Object.values(unmatchedPunches).map(item => ({...item, punches: Array.from(item.punches)}));
            transaction(entriesToProcess);
        }

        return {
            processedCount: attendanceEntries.length,
            unmatchedCount: Object.keys(unmatchedPunches).length,
            skippedCount: skippedRecords
        };
    },

    resolveUnmatchedRecord: ({ unmatchedId, employeeId }) => {
        const db = getDb();
        try {
            const unmatchedRecord = getById('unmatched_attendance', unmatchedId);
            if (!unmatchedRecord) throw new Error('Unmatched record not found.');
            
            const employee = getById('employees', employeeId);
            if (!employee) throw new Error('Employee not found.');

            db.transaction(() => {
                // Assign biometric ID to the employee
                update('employees', employeeId, { biometricId: unmatchedRecord.biometricId });

                // Process the punches into the attendance table
                const punches = JSON.parse(unmatchedRecord.punches).sort();
                const checkIn = punches[0] || null;
                const checkOut = punches.length > 1 ? punches[punches.length - 1] : null;

                const existingAttendance = db.prepare('SELECT * FROM attendance WHERE employeeId = ? AND date = ?').get(employeeId, unmatchedRecord.date);
                if (existingAttendance) {
                    const existingPunches = [];
                    if (existingAttendance.checkIn) existingPunches.push(existingAttendance.checkIn);
                    if (existingAttendance.checkOut && existingAttendance.checkOut !== existingAttendance.checkIn) existingPunches.push(existingAttendance.checkOut);
                    const allPunches = Array.from(new Set([...existingPunches, ...punches])).sort();
                    const newCheckIn = allPunches[0] || null;
                    const newCheckOut = allPunches.length > 1 ? allPunches[allPunches.length - 1] : null;
                    update('attendance', existingAttendance.id, { checkIn: newCheckIn, checkOut: newCheckOut, is_synced_to_cloud: 0 });
                } else {
                    if (checkIn) {
                        // is_synced_to_cloud defaults to 0
                        insert('attendance', { employeeId, date: unmatchedRecord.date, checkIn, checkOut });
                    }
                }

                // Delete the resolved unmatched record
                deleteRow('unmatched_attendance', unmatchedId);
            })();

            return { success: true, message: 'تم ربط السجل بالموظف بنجاح.' };
        } catch (error) {
            console.error('Failed to resolve unmatched record in DB module:', error);
            return { success: false, message: `فشل: ${error.message}` };
        }
    },

    // --- Cloud Sync Methods ---
    getUnsyncedRecords: () => {
        const db = getDb();
        // Join with employees table to get biometric ID and names
        return db.prepare(`
            SELECT a.id, a.date, a.checkIn, a.checkOut, e.biometricId, e.name as employeeName 
            FROM attendance a
            JOIN employees e ON a.employeeId = e.id
            WHERE a.is_synced_to_cloud = 0 OR a.is_synced_to_cloud IS NULL
        `).all();
    },

    markRecordsAsSynced: (ids) => {
        const db = getDb();
        if (!ids || ids.length === 0) return 0;
        
        const placeholders = ids.map(() => '?').join(',');
        const result = db.prepare(`UPDATE attendance SET is_synced_to_cloud = 1 WHERE id IN (${placeholders})`).run(...ids);
        return result.changes;
    },

    // NEW: Merge records downloaded from cloud
    mergeCloudRecords: (cloudRecords) => {
        const db = getDb();
        if (!cloudRecords || cloudRecords.length === 0) return 0;

        const employees = getAll('employees');
        // Map biometric IDs to local employee IDs
        const biometricIdToEmployeeId = new Map(employees.filter(e => e.biometricId).map(e => [String(e.biometricId).trim(), e.id]));
        
        let mergedCount = 0;

        const transaction = db.transaction((records) => {
            for (const rec of records) {
                // We expect rec to have: { biometricId, date, checkIn, checkOut, ... }
                const employeeId = biometricIdToEmployeeId.get(String(rec.biometricId).trim());
                
                if (employeeId) {
                    // Check if exists
                    const existing = db.prepare('SELECT id FROM attendance WHERE employeeId = ? AND date = ?').get(employeeId, rec.date);
                    
                    if (!existing) {
                        // Insert new record
                        // We mark it as 'cloud' source and already synced (since it came from cloud)
                        db.prepare(`
                            INSERT INTO attendance (employeeId, date, checkIn, checkOut, source, is_synced_to_cloud) 
                            VALUES (?, ?, ?, ?, 'cloud', 1)
                        `).run(employeeId, rec.date, rec.checkIn, rec.checkOut);
                        mergedCount++;
                    } else {
                        // Optional: Update existing if cloud data is "better"? 
                        // For now, we skip duplicates to respect local edits.
                        // Or we could update only if local checkOut is missing and cloud has it.
                    }
                } else {
                    console.log(`[DB Merge] Skipped cloud record for unknown biometric ID: ${rec.biometricId}`);
                }
            }
        });

        transaction(cloudRecords);
        return mergedCount;
    }
});


module.exports = (getDb) => ({
    deleteEmployeeAndRelatedData: (employeeId) => {
        const db = getDb();
        try {
            db.transaction(() => {
                // Check if the employee came from recruitment and update the application status
                const employeeToDelete = db.prepare('SELECT id, source FROM employees WHERE id = ?').get(employeeId);

                if (employeeToDelete && employeeToDelete.source === 'recruitment') {
                    // Find the linked job application and update it.
                    // This "unlinks" the application and sets its status to Rejected.
                    const updateResult = db.prepare(`
                        UPDATE jobApplications 
                        SET status = 'Rejected', createdEmployeeId = NULL 
                        WHERE createdEmployeeId = ?
                    `).run(employeeId);

                    if (updateResult.changes > 0) {
                        console.log(`[DB] Reverted job application status for deleted employee ID: ${employeeId}.`);
                    }
                }

                // Handle manager references: set to NULL as they are not set to CASCADE
                db.prepare('UPDATE branches SET managerId = NULL WHERE managerId = ?').run(employeeId);
                db.prepare('UPDATE departments SET managerId = NULL WHERE managerId = ?').run(employeeId);

                // Finally, delete the employee. ON DELETE CASCADE will handle all related records in other tables.
                const result = db.prepare('DELETE FROM employees WHERE id = ?').run(employeeId);
                if (result.changes === 0) {
                    console.warn(`[DB] Attempted to delete non-existent employee with ID: ${employeeId}.`);
                }
            })();
            return 1; // Return 1 to indicate success, similar to .changes property
        } catch (error) {
            console.error(`[DB] Transaction failed for deleting employee ${employeeId}:`, error);
            throw error; // Re-throw the error so the IPC handler can catch it
        }
    },

    terminateEmployee: (payload) => {
        const db = getDb();
        try {
            const stmt = db.transaction(() => {
                const employeeToTerminate = db.prepare('SELECT biometricId FROM employees WHERE id = ?').get(payload.employeeId);

                const updateResult = db.prepare('UPDATE employees SET status = ? WHERE id = ?').run('inactive', payload.employeeId);
                if (updateResult.changes === 0) {
                    throw new Error('لم يتم العثور على الموظف لتحديث حالته.');
                }
                
                // Block the biometric ID if it exists
                if (employeeToTerminate && employeeToTerminate.biometricId) {
                    db.prepare('INSERT OR IGNORE INTO blocked_biometric_ids (biometric_id, reason) VALUES (?, ?)')
                      .run(employeeToTerminate.biometricId, `Terminated employee ID: ${payload.employeeId}`);
                    console.log(`[DB] Blocked biometric ID ${employeeToTerminate.biometricId} for terminated employee.`);
                }
                
                const financialDataStr = payload.financialData ? JSON.stringify(payload.financialData) : null;
                
                db.prepare('INSERT INTO terminations (employeeId, terminationDate, reason, notes, financialData) VALUES (?, ?, ?, ?, ?)')
                .run(payload.employeeId, payload.terminationDate, payload.reason, payload.notes || null, financialDataStr);
            });
            
            stmt();

            return { success: true, message: 'تم إنهاء خدمة الموظف بنجاح وحظر معرّف البصمة الخاص به.' };
        } catch (error) {
            console.error('[DB] Failed to terminate employee:', error);
            return { success: false, message: `فشل إنهاء الخدمة: ${error.message}` };
        }
    }
});
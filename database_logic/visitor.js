
module.exports = (getDb) => ({
    createVisitorEntry: (visitorName) => {
        const db = getDb();
        try {
            const today = new Date().toISOString().split('T')[0];
            const now = new Date();
            const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

            let queueNumber = 1;
            
            // Transaction to ensure atomic read/increment/insert
            const entry = db.transaction(() => {
                // Find the max queue number for today
                const lastEntry = db.prepare('SELECT MAX(queueNumber) as maxNum FROM visitor_queue WHERE date = ?').get(today);
                
                if (lastEntry && lastEntry.maxNum) {
                    queueNumber = lastEntry.maxNum + 1;
                }

                const result = db.prepare('INSERT INTO visitor_queue (visitorName, queueNumber, date, time) VALUES (?, ?, ?, ?)')
                    .run(visitorName, queueNumber, today, time);
                
                return {
                    id: result.lastInsertRowid,
                    visitorName,
                    queueNumber,
                    date: today,
                    time
                };
            })();

            return { success: true, message: 'تم حجز الدور بنجاح.', data: entry };
        } catch (error) {
            console.error('[DB] Failed to create visitor entry:', error);
            return { success: false, message: `فشل حجز الدور: ${error.message}` };
        }
    }
});

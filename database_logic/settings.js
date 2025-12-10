

module.exports = (getDb) => ({
    /**
     * Retrieves a setting value by its key.
     * @param {string} key The key of the setting.
     * @returns {object|null} The setting row { key, value } or null if not found.
     */
    getSettings: (key) => {
        const db = getDb();
        const row = db.prepare("SELECT * FROM settings WHERE key = ?").get(key);
        return row || null;
    },

    /**
     * Inserts or updates a setting value, always storing it as a JSON string.
     * @param {string} key The key of the setting.
     * @param {*} value The value to store. It will be JSON.stringified.
     * @returns {number} The number of changes made.
     */
    updateSettings: (key, value) => {
        const db = getDb();
        // Always JSON.stringify to ensure consistency.
        // This will store: "Full" (string), true (boolean), 123 (number), [1,2] (array), {"a":1} (object)
        // All are valid JSON literals and can be parsed back correctly.
        const stringValue = JSON.stringify(value);
        const result = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, stringValue);
        return result.changes;
    },
    
    /**
     * Retrieves the local center identifier.
     * DEPRECATED in favor of getSyncKey, but kept for potential legacy use.
     */
    getLocalCenterID: () => {
        const db = getDb();
        try {
            // This now points to the same key as syncKey for unified logic.
            const row = db.prepare("SELECT value FROM settings WHERE key = 'syncKey'").get();
            if (row && row.value) {
                return JSON.parse(row.value);
            }
            return null;
        } catch (error) {
            console.error('[DB] Failed to get local center ID:', error);
            return null;
        }
    },

    /**
     * Retrieves the secret sync key from settings. This key is the 'Full' license activation code.
     */
    getSyncKey: () => {
        const db = getDb();
        try {
            const row = db.prepare("SELECT value FROM settings WHERE key = 'syncKey'").get();
            if (row && row.value) {
                // The value is stored as a JSON string (e.g., "\"RIFF123456\""), so we need to parse it.
                return JSON.parse(row.value);
            }
            return null;
        } catch (error) {
            console.error('[DB] Failed to get sync key:', error);
            return null;
        }
    }
});

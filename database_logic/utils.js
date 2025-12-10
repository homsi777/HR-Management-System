

function parseJsonFields(table, rows) {
    const jsonFields = {
        employees: ['assignedDeviceIds', 'workdays'],
        users: ['permissions'],
        transfers: ['sender', 'receiver'],
        custody: ['items'],
        jobApplications: ['experiences', 'attachments'],
        clients: ['interests'],
        manufacturing_staff: ['tasks', 'production_tasks']
    };
    if (!jsonFields[table] || !Array.isArray(rows)) return rows;
    
    return rows.map(row => {
        const newRow = { ...row };
        jsonFields[table].forEach(field => {
            if (newRow[field] && typeof newRow[field] === 'string') {
                try {
                    newRow[field] = JSON.parse(newRow[field]);
                } catch (e) {
                    newRow[field] = (field === 'sender' || field === 'receiver') ? {} : [];
                }
            } else if (!newRow[field]) {
                 newRow[field] = (field === 'sender' || field === 'receiver' || field === 'permissions') ? (field === 'permissions' ? [] : {}) : [];
            }
        });
        return newRow;
    });
}

function stringifyJsonFields(table, data) {
    const jsonFields = {
        employees: ['assignedDeviceIds', 'workdays'],
        users: ['permissions'],
        transfers: ['sender', 'receiver'],
        custody: ['items'],
        jobApplications: ['experiences', 'attachments'],
        clients: ['interests'],
        manufacturing_staff: ['tasks', 'production_tasks']
    };
    
    // Always create a copy to avoid mutating original data
    const newData = { ...data };

    // Handle JSON stringification for specific fields
    if (jsonFields[table]) {
        jsonFields[table].forEach(field => {
            if (newData[field] && typeof newData[field] !== 'string') {
                newData[field] = JSON.stringify(newData[field]);
            }
        });
    }

    // Convert booleans to integers (SQLite compatibility)
    for (const key in newData) {
        if (typeof newData[key] === 'boolean') {
            newData[key] = newData[key] ? 1 : 0;
        }
    }

    return newData;
}

module.exports = {
    parseJsonFields,
    stringifyJsonFields
};

const http = require('http');
const db = require('../database');

function startApiServer(mainWindow, updateStatusCallback) {
    // Define the request handler function once
    const requestHandler = (req, res) => {
        // Set CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Request-Method', '*');
        res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, POST, GET, PUT, PATCH, DELETE');
        res.setHeader('Access-Control-Allow-Headers', '*');
        
        // Detailed Logging for Debugging
        console.log('------------------------------------------------');
        console.log(`[API Server] Incoming Request: ${req.method} ${req.url}`);
        console.log('[API Server] Headers:', JSON.stringify(req.headers));

        if (req.method === 'OPTIONS') {
            res.writeHead(204);
            res.end();
            return;
        }

        // Use an array of Buffers to handle data chunks robustly
        let chunks = [];
        
        req.on('data', chunk => {
            chunks.push(chunk);
        });

        req.on('end', () => {
            try {
                // Concatenate chunks into a single Buffer, then convert to string
                const buffer = Buffer.concat(chunks);
                const body = buffer.toString('utf8');

                console.log(`[API Server] Raw Payload Size: ${buffer.length} bytes`);
                
                if (!body || body.trim() === '') {
                    console.warn('[API Server] Warning: Received EMPTY body.');
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, message: 'No data received (Empty Body).' }));
                    return;
                }

                console.log('[API Server] Raw Body Preview (first 200 chars):', body.substring(0, 200));
                
                let parsedData;
                try {
                    // Attempt to parse as raw JSON first
                    parsedData = JSON.parse(body);
                } catch (jsonError) {
                    console.log('[API Server] Raw body is not valid JSON, attempting to parse as URL-encoded form data...');
                    // If it fails, try to parse as x-www-form-urlencoded (e.g., payload={...})
                    try {
                        const params = new URLSearchParams(body);
                        // Try to find a parameter that looks like JSON or check common keys
                        let foundData = null;
                        
                        // Check for common keys sent by ZK tools
                        const commonKeys = ['data', 'payload', 'records', 'log'];
                        for (const key of commonKeys) {
                            if (params.has(key)) {
                                foundData = params.get(key);
                                console.log(`[API Server] Found data in form key: '${key}'`);
                                break;
                            }
                        }

                        // If not found in common keys, check the first key if it's a valid JSON string
                        if (!foundData) {
                            const firstKey = params.keys().next().value;
                            if (firstKey) {
                                try {
                                    JSON.parse(firstKey); // Test if the key itself is the JSON
                                    foundData = firstKey;
                                    console.log('[API Server] The form key itself appears to be the JSON data.');
                                } catch (e) {
                                    // Maybe the value of the first key is the JSON
                                    const val = params.get(firstKey);
                                    if (val) foundData = val;
                                }
                            }
                        }

                        if (foundData) {
                            parsedData = typeof foundData === 'string' ? JSON.parse(foundData) : foundData;
                        } else {
                            throw new Error('Body is not valid JSON or a parsable URL-encoded form.');
                        }
                    } catch (formError) {
                        console.error('[API Server] Failed to parse body as either JSON or form data.', formError);
                        throw new Error('Invalid data format received.');
                    }
                }

                let records;

                // Handle nested structure like {"records": [...]} or {"data": [...]}
                if (parsedData.records && Array.isArray(parsedData.records)) {
                    records = parsedData.records;
                } else if (parsedData.data && Array.isArray(parsedData.data)) {
                    records = parsedData.data;
                } else if (Array.isArray(parsedData)) {
                    records = parsedData;
                } else if (typeof parsedData === 'object' && parsedData !== null) {
                    records = [parsedData]; // Handle single record object
                } else {
                    throw new Error('Expected an array of records or a recognizable object structure.');
                }
                
                console.log(`[API Server] Successfully parsed ${records.length} record(s).`);
                
                if (records.length === 0) {
                    console.warn('[API Server] Warning: The array is empty []!');
                }

                // Delegate all DB logic to the database module
                const { processedCount, unmatchedCount, skippedCount } = db.processSyncData(records);

                if (processedCount > 0 || unmatchedCount > 0) {
                    if (mainWindow && !mainWindow.isDestroyed()) {
                        console.log('Sending database-updated event to renderer process.');
                        mainWindow.webContents.send('database-updated');
                    }
                }

                const message = `Processed ${processedCount} entries. Found ${unmatchedCount} daily records for unmatched IDs. Skipped ${skippedCount} records.`;
                console.log(`[API Server] Processing complete. ${message}`);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, message: message }));
                
            } catch (error) {
                console.error('[API Server] Processing Error:', error.message);
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: `Server Error: ${error.message}` }));
            }
        });
    };

    // Create two server instances sharing the same handler
    const server1 = http.createServer(requestHandler);
    const server2 = http.createServer(requestHandler);

    // Track status
    let activePorts = [];
    const updateCombinedStatus = () => {
        if (activePorts.length > 0) {
            updateStatusCallback({ 
                status: 'listening', 
                activity: 'idle', 
                port: activePorts.sort().join(' & '), 
                error: null 
            });
        }
    };

    // Listen on Port 3001
    server1.listen(3001, '0.0.0.0', () => {
        console.log('API Server 1 listening on http://0.0.0.0:3001');
        activePorts.push(3001);
        updateCombinedStatus();
    }).on('error', (err) => {
        console.error('API Server 1 Error:', err.message);
    });

    // Listen on Port 3002
    server2.listen(3002, '0.0.0.0', () => {
        console.log('API Server 2 listening on http://0.0.0.0:3002');
        activePorts.push(3002);
        updateCombinedStatus();
    }).on('error', (err) => {
        console.error('API Server 2 Error:', err.message);
    });
}

module.exports = { startApiServer };

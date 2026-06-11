/**
 * Shared lazy monk DB connection.
 * Returns a cached singleton — callers must NOT close it; the connection
 * lives for the lifetime of the process.
 */

'use strict';

const monk = require('monk');

let _db = null;

function getDb() {
    if (!_db) {
        const mongoUrl = process.env.MONGO_URL || require('config').get('mongo');
        _db = monk(mongoUrl);
    }
    return _db;
}

module.exports = { getDb };

/**
 * @shaxpir/sharedb-storage-node-sqlite
 *
 * Standalone SQLite adapter for Node.js using better-sqlite3.
 * This package provides database adapters only - no storage strategies.
 * For ShareDB storage strategies, use @shaxpir/sharedb-storage-sqlite.
 */

// Export the main adapter
exports.BetterSqliteAdapter = require('./lib/adapters/better-sqlite-adapter');

// Export the attached adapter wrapper
exports.AttachedBetterSqliteAdapter = require('./lib/adapters/attached-better-sqlite-adapter');

// Export utilities if needed by consumers
exports.RetryUtils = require('./lib/utils/retry-utils');

// Default export is the basic adapter for convenience
module.exports = exports.BetterSqliteAdapter;
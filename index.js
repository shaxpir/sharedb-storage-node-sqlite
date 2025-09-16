// Import from upstream shared library
var upstream = require('@shaxpir/sharedb-storage-sqlite');

// Main export is SqliteStorage from upstream
var SqliteStorage = upstream.SqliteStorage;
module.exports = SqliteStorage;

// Re-export everything from upstream for convenience
SqliteStorage.SqliteStorage = SqliteStorage;
SqliteStorage.BaseSchemaStrategy = upstream.BaseSchemaStrategy;
SqliteStorage.DefaultSchemaStrategy = upstream.DefaultSchemaStrategy;
SqliteStorage.CollectionPerTableStrategy = upstream.CollectionPerTableStrategy;
SqliteStorage.AttachedCollectionPerTableStrategy = upstream.AttachedCollectionPerTableStrategy;

// Node.js specific adapters
SqliteStorage.BetterSqliteAdapter = require('./lib/adapters/better-sqlite-adapter');
SqliteStorage.AttachedBetterSqliteAdapter = require('./lib/adapters/attached-better-sqlite-adapter');
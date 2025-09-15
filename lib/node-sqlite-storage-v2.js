/**
 * NodeSqliteStorage v2 - Refactored to use the shared library
 */

const { SqliteStorage, AttachedCollectionPerTableStrategy } = require('@shaxpir/sharedb-storage-sqlite');
const BetterSqlite3Adapter = require('./adapters/BetterSqlite3Adapter');

class NodeSqliteStorage extends SqliteStorage {
  constructor(options = {}) {
    // Extract the database instance
    const db = options.db;
    if (!db) {
      throw new Error('NodeSqliteStorage requires a better-sqlite3 database instance');
    }

    // Create adapter for better-sqlite3
    const adapter = new BetterSqlite3Adapter(db);

    // Create schema strategy
    const schemaStrategy = new AttachedCollectionPerTableStrategy({
      collectionConfig: options.collectionConfig,
      useEncryption: options.useEncryption,
      encryptionCallback: options.encryptionCallback,
      decryptionCallback: options.decryptionCallback,
      debug: options.debug
    });

    // Initialize parent with adapter and strategy
    super(adapter, schemaStrategy);

    this.options = options;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    // Initialize schema
    await this.schemaStrategy.initializeSchema(this.adapter);

    // Initialize inventory if needed
    if (this.options.initializeInventory !== false) {
      await this.schemaStrategy.initializeInventory(this.adapter);
    }

    this.initialized = true;
  }

  // Override close to handle better-sqlite3 specifics
  async close() {
    // Close the database connection
    if (this.adapter && this.adapter.db) {
      this.adapter.db.close();
    }
  }

  // Provide backward compatibility for direct database access
  getDatabase() {
    return this.adapter.db;
  }
}

module.exports = NodeSqliteStorage;
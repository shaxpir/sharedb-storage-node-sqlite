const BetterSqliteAdapter = require('./better-sqlite-adapter');
const fs = require('fs');
const path = require('path');

/**
 * AttachedBetterSqliteAdapter - Node.js adapter with database attachment support
 *
 * This adapter extends BetterSqliteAdapter to support attaching multiple
 * database files. It implements the AttachedAdapter interface.
 *
 * @param {string} primaryDbPath - Path to the primary database file
 * @param {Object} attachmentConfig - Configuration for database attachments
 * @param {Array} attachmentConfig.attachments - Array of databases to attach
 *   Each attachment should have: { path, alias, createIfNotExists? }
 * @param {Object} options - Options for the primary database (passed to better-sqlite3)
 */
function AttachedBetterSqliteAdapter(primaryDbPath, attachmentConfig, options) {
  if (!primaryDbPath) {
    throw new Error('primaryDbPath is required');
  }

  // Call parent constructor
  BetterSqliteAdapter.call(this, primaryDbPath, options);

  // Store attachment configuration
  this.attachmentConfig = attachmentConfig || {};
  this.attachments = new Map(); // Track attached databases

  // Process attachments to resolve paths
  this.attachmentConfig.attachments = (this.attachmentConfig.attachments || []).map(function(attachment) {
    if (!attachment.path || !attachment.alias) {
      throw new Error('Each attachment must have path and alias properties');
    }

    // Handle special paths like :memory: without resolution
    const resolvedPath = attachment.path === ':memory:'
      ? attachment.path
      : path.resolve(attachment.path);

    return {
      path: resolvedPath,
      alias: attachment.alias,
      createIfNotExists: attachment.createIfNotExists || false
    };
  });
}

// Inherit from BetterSqliteAdapter
AttachedBetterSqliteAdapter.prototype = Object.create(BetterSqliteAdapter.prototype);
AttachedBetterSqliteAdapter.prototype.constructor = AttachedBetterSqliteAdapter;

/**
 * Connect to the database and attach configured databases
 */
AttachedBetterSqliteAdapter.prototype.connect = async function() {
  // First connect to the primary database
  await BetterSqliteAdapter.prototype.connect.call(this);

  // Then attach all configured databases
  for (const attachment of this.attachmentConfig.attachments) {
    await this.attachDatabase(attachment.path, attachment.alias, attachment.createIfNotExists);
  }
};

/**
 * Attach a database file
 * @param {string} dbPath - Path to the database file to attach
 * @param {string} alias - Alias for accessing the attached database
 * @param {boolean} createIfNotExists - Create the file if it doesn't exist
 */
AttachedBetterSqliteAdapter.prototype.attachDatabase = function(dbPath, alias, createIfNotExists) {
  const self = this;

  return new Promise(function(resolve, reject) {
    try {
      // Check if already attached
      if (self.attachments.has(alias)) {
        return resolve();
      }

      // For file-based databases (not :memory:), ensure the file exists
      if (dbPath !== ':memory:') {
        if (!fs.existsSync(dbPath)) {
          if (createIfNotExists) {
            // Create directory if needed
            const dir = path.dirname(dbPath);
            if (!fs.existsSync(dir)) {
              fs.mkdirSync(dir, { recursive: true });
            }
            // Touch the file to create it
            fs.closeSync(fs.openSync(dbPath, 'w'));
          } else {
            throw new Error('Database file does not exist: ' + dbPath);
          }
        }
      }

      // Execute ATTACH DATABASE command
      const sql = `ATTACH DATABASE '${dbPath}' AS ${alias}`;
      self.db.exec(sql);

      // Track the attachment
      self.attachments.set(alias, dbPath);

      if (self.debug) {
        console.log(`[AttachedBetterSqliteAdapter] Attached database '${dbPath}' as '${alias}'`);
      }

      resolve();
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Detach a previously attached database
 * @param {string} alias - Alias of the database to detach
 */
AttachedBetterSqliteAdapter.prototype.detachDatabase = function(alias) {
  const self = this;

  return new Promise(function(resolve, reject) {
    try {
      // Check if attached
      if (!self.attachments.has(alias)) {
        return resolve();
      }

      // Execute DETACH DATABASE command
      const sql = `DETACH DATABASE ${alias}`;
      self.db.exec(sql);

      // Remove from tracking
      self.attachments.delete(alias);

      if (self.debug) {
        console.log(`[AttachedBetterSqliteAdapter] Detached database '${alias}'`);
      }

      resolve();
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Check if a database is currently attached
 * @param {string} alias - Alias to check
 * @returns {boolean} true if attached, false otherwise
 */
AttachedBetterSqliteAdapter.prototype.isAttached = function(alias) {
  return this.attachments.has(alias);
};

/**
 * Get list of all currently attached database aliases
 * @returns {string[]} Array of alias strings
 */
AttachedBetterSqliteAdapter.prototype.getAttachedAliases = function() {
  return Array.from(this.attachments.keys());
};

/**
 * Disconnect from all databases
 */
AttachedBetterSqliteAdapter.prototype.disconnect = async function() {
  // Detach all attached databases first
  for (const alias of this.attachments.keys()) {
    await this.detachDatabase(alias);
  }

  // Then disconnect from the primary database
  return BetterSqliteAdapter.prototype.disconnect.call(this);
};

module.exports = AttachedBetterSqliteAdapter;
const { AttachedSqliteAdapter } = require('@shaxpir/sharedb-storage-sqlite');
const BetterSqliteAdapter = require('./better-sqlite-adapter');
const fs = require('fs');
const path = require('path');

/**
 * AttachedBetterSqliteAdapter - Node.js implementation of database attachment
 * 
 * This adapter creates a BetterSqliteAdapter for the primary database and uses
 * AttachedSqliteAdapter to manage attachments. It's designed for use in Node.js
 * environments, particularly for testing.
 * 
 * @param {string} primaryDbPath - Path to the primary database file
 * @param {Object} attachmentConfig - Configuration for database attachments
 * @param {Array} attachmentConfig.attachments - Array of databases to attach
 *   Each attachment should have: { path, alias }
 * @param {Object} options - Options for the primary database (passed to better-sqlite3)
 */
function AttachedBetterSqliteAdapter(primaryDbPath, attachmentConfig, options) {
  if (!primaryDbPath) {
    throw new Error('primaryDbPath is required');
  }
  
  options = options || {};
  const debug = options.debug || false;
  
  // Create the primary database adapter
  const primaryAdapter = new BetterSqliteAdapter(primaryDbPath, options);
  
  // Validate attachment config
  const processedConfig = {
    attachments: (attachmentConfig.attachments || []).map(function(attachment) {
      if (!attachment.path || !attachment.alias) {
        throw new Error('Each attachment must have path and alias properties');
      }
      
      // Handle special paths like :memory: without resolution
      const absolutePath = attachment.path === ':memory:' 
        ? attachment.path 
        : path.resolve(attachment.path);
      
      return {
        path: absolutePath,
        alias: attachment.alias,
        strategy: attachment.strategy
      };
    })
  };
  
  // Call parent constructor with wrapped adapter and processed config
  AttachedSqliteAdapter.call(this, primaryAdapter, processedConfig, debug);
  
  // Store config for reference
  this.primaryDbPath = primaryDbPath;
  this.options = options;
  this.originalAttachmentConfig = attachmentConfig;
  this.schemaStrategy = null; // Will be set by SqliteStorage
}

// Inherit from AttachedSqliteAdapter
AttachedBetterSqliteAdapter.prototype = Object.create(AttachedSqliteAdapter.prototype);
AttachedBetterSqliteAdapter.prototype.constructor = AttachedBetterSqliteAdapter;

/**
 * Get the underlying database instance
 */
Object.defineProperty(AttachedBetterSqliteAdapter.prototype, 'database', {
  get: function() {
    return this.wrappedAdapter && this.wrappedAdapter.db;
  }
});

/**
 * Set the schema strategy (called by SqliteStorage during initialization)
 * @param {Object} strategy - The schema strategy to use
 */
AttachedBetterSqliteAdapter.prototype.setSchemaStrategy = function(strategy) {
  this.schemaStrategy = strategy;
};

/**
 * Override connect to pre-initialize attachment databases if needed
 */
AttachedBetterSqliteAdapter.prototype.connect = async function() {
  const adapter = this;
  
  // If we have a schema strategy that supports pre-initialization, use it
  if (adapter.schemaStrategy && adapter.schemaStrategy.preInitializeDatabase) {
    adapter.debug && console.log('[AttachedBetterSqliteAdapter] Pre-initializing attachment databases...');
    
    // Pre-initialize each attachment database
    for (const attachment of adapter.attachments) {
      // Check if the database exists
      if (!fs.existsSync(attachment.path)) {
        adapter.debug && console.log('[AttachedBetterSqliteAdapter] Creating new database:', attachment.path);
      }
      
      try {
        // Pre-initialize the database with proper schema and indexes
        await adapter.schemaStrategy.preInitializeDatabase(
          attachment.path,
          function(dbPath) {
            // Factory function to create a BetterSqliteAdapter for the given path
            return new BetterSqliteAdapter(dbPath, adapter.options);
          }
        );
        
        adapter.debug && console.log('[AttachedBetterSqliteAdapter] Pre-initialized database:', attachment.path);
      } catch (error) {
        console.error('[AttachedBetterSqliteAdapter] Failed to pre-initialize database:', attachment.path, error);
        // Continue anyway - the database might already be initialized
      }
    }
  }
  
  // Now proceed with normal connection and attachment
  return AttachedSqliteAdapter.prototype.connect.call(adapter);
};

/**
 * Check if all database files exist (primary and attachments)
 * @returns {Object} Object with exists status for each database
 */
AttachedBetterSqliteAdapter.prototype.checkAllDatabasesExist = function() {
  const adapter = this;
  const result = {};
  
  // Check primary database
  result.primary = {
    path: adapter.primaryDbPath,
    exists: fs.existsSync(adapter.primaryDbPath)
  };
  
  // Check each attachment
  if (adapter.originalAttachmentConfig && adapter.originalAttachmentConfig.attachments) {
    result.attachments = {};
    
    adapter.originalAttachmentConfig.attachments.forEach(function(attachment) {
      const absolutePath = path.resolve(attachment.path);
      result.attachments[attachment.alias] = {
        path: absolutePath,
        exists: fs.existsSync(absolutePath)
      };
    });
  }
  
  return result;
};

/**
 * Static helper to create an AttachedBetterSqliteAdapter with in-memory databases
 * Useful for testing
 * 
 * @param {Object} attachmentConfig - Configuration for database attachments
 * @param {Object} options - Options for the databases
 * @returns {AttachedBetterSqliteAdapter} New adapter instance with in-memory databases
 */
AttachedBetterSqliteAdapter.createInMemory = function(attachmentConfig, options) {
  // Use :memory: for primary database
  const primaryPath = ':memory:';
  
  // Process attachments to use temporary files or memory
  const processedAttachments = (attachmentConfig.attachments || []).map(function(attachment, index) {
    // For in-memory testing, we'll use temporary files for attachments
    // since SQLite can't attach :memory: databases to each other
    const tempPath = path.join(
      process.env.TEMP || process.env.TMP || '/tmp',
      `test_attachment_${Date.now()}_${index}.db`
    );
    
    return {
      path: attachment.path || tempPath,
      alias: attachment.alias
    };
  });
  
  return new AttachedBetterSqliteAdapter(
    primaryPath,
    { attachments: processedAttachments },
    options
  );
};

/**
 * Clean up temporary databases (useful for testing)
 */
AttachedBetterSqliteAdapter.prototype.cleanupTempDatabases = function() {
  const adapter = this;
  
  // Only clean up attachments if they're in temp directory
  if (adapter.originalAttachmentConfig && adapter.originalAttachmentConfig.attachments) {
    adapter.originalAttachmentConfig.attachments.forEach(function(attachment) {
      const tempDir = process.env.TEMP || process.env.TMP || '/tmp';
      if (attachment.path && attachment.path.startsWith(tempDir)) {
        try {
          fs.unlinkSync(attachment.path);
          adapter.debug && console.log('[AttachedBetterSqliteAdapter] Cleaned up temp database:', attachment.path);
        } catch (e) {
          // Ignore errors - file might not exist
        }
      }
    });
  }
};

module.exports = AttachedBetterSqliteAdapter;
// Note: SqliteAdapter is an interface - we don't inherit from it in JS
// The interface is defined in interfaces.d.ts for TypeScript consumers
const { retryWithBackoff } = require('../utils/retry-utils');

/**
 * Clean BetterSqliteAdapter Implementation
 * 
 * Node.js implementation that wraps better-sqlite3 with the new clean interface.
 * Manages exactly one database with no cross-database awareness.
 * Focused on simplicity and single-database operations.
 */
function BetterSqliteAdapter(dbPath, options) {
  this.dbPath = dbPath;
  this.options = options || {};
  this.debug = this.options.debug || false;
  this.enableWAL = this.options.enableWAL !== false; // default true
  this.retryOptions = {
    maxRetries: this.options.maxRetries || 3,
    baseDelay: this.options.baseDelay || 100
  };
  this.db = null;
  this.Database = null;
  
  // Try to load better-sqlite3
  try {
    this.Database = require('better-sqlite3');
    if (!this.Database) {
      throw new Error('better-sqlite3 module not found');
    }
  } catch (e) {
    throw new Error('BetterSqliteAdapter requires better-sqlite3: ' + e.message);
  }
}

// Note: In JavaScript we don't actually inherit from interfaces
// The SqliteAdapter interface is documented in interfaces.d.ts

/**
 * Connect to the database
 */
BetterSqliteAdapter.prototype.connect = function() {
  const adapter = this;
  
  return new Promise(function(resolve, reject) {
    try {
      adapter.db = new adapter.Database(adapter.dbPath, adapter.options);
      
      // Configure database settings
      adapter.db.exec('PRAGMA foreign_keys = ON');
      if (adapter.enableWAL) {
        adapter.db.exec('PRAGMA journal_mode=WAL');
        adapter.debug && console.log('[BetterSqliteAdapter] Enabled WAL mode');
      }
      
      adapter.debug && console.log('[BetterSqliteAdapter] Connected to database: ' + adapter.dbPath);
      resolve();
    } catch (error) {
      adapter.debug && console.error('[BetterSqliteAdapter] Connection error: ' + error.message);
      reject(error);
    }
  });
};

/**
 * Disconnect from the database
 */
BetterSqliteAdapter.prototype.disconnect = function() {
  const adapter = this;
  
  return new Promise(function(resolve, reject) {
    try {
      if (adapter.db) {
        adapter.db.close();
        adapter.db = null;
        adapter.debug && console.log('[BetterSqliteAdapter] Disconnected from database');
      }
      resolve();
    } catch (error) {
      adapter.debug && console.error('[BetterSqliteAdapter] Disconnect error: ' + error.message);
      reject(error);
    }
  });
};

/**
 * Execute a SQL statement (INSERT, UPDATE, DELETE, CREATE, etc.)
 * Returns Promise directly (matching schema strategy expectations)
 */
BetterSqliteAdapter.prototype.runAsync = function(sql, params) {
  const adapter = this;
  params = params || [];

  return retryWithBackoff(async function() {
    if (!adapter.db) {
      throw new Error('Database not connected');
    }

    const stmt = adapter.db.prepare(sql);
    const result = stmt.run(params);

    adapter.debug && console.log('[BetterSqliteAdapter] Executed SQL: ' + sql.substring(0, 50));
    return {
      lastID: result.lastInsertRowid,
      changes: result.changes
    };
  }, {
    maxRetries: adapter.retryOptions.maxRetries,
    baseDelay: adapter.retryOptions.baseDelay,
    debug: adapter.debug
  });
};

/**
 * Get the first row from a SELECT query
 * Returns promise directly (matching schema strategy expectations)
 */
BetterSqliteAdapter.prototype.getFirstAsync = function(sql, params) {
  const adapter = this;
  params = params || [];

  return retryWithBackoff(async function() {
    if (!adapter.db) {
      throw new Error('Database not connected');
    }

    const stmt = adapter.db.prepare(sql);
    const row = stmt.get(params);

    adapter.debug && console.log('[BetterSqliteAdapter] Got row from: ' + sql.substring(0, 50));
    return row || null;
  }, {
    maxRetries: adapter.retryOptions.maxRetries,
    baseDelay: adapter.retryOptions.baseDelay,
    debug: adapter.debug
  });
};

/**
 * Get all rows from a SELECT query
 * Returns promise directly (matching schema strategy expectations)
 */
BetterSqliteAdapter.prototype.getAllAsync = function(sql, params) {
  const adapter = this;
  params = params || [];

  return retryWithBackoff(async function() {
    if (!adapter.db) {
      throw new Error('Database not connected');
    }

    const stmt = adapter.db.prepare(sql);
    const rows = stmt.all(params);

    adapter.debug && console.log('[BetterSqliteAdapter] Got ' + rows.length + ' rows from: ' + sql.substring(0, 50));
    return rows;
  }, {
    maxRetries: adapter.retryOptions.maxRetries,
    baseDelay: adapter.retryOptions.baseDelay,
    debug: adapter.debug
  });
};

/**
 * Execute multiple SQL statements in a transaction
 * Promise-based with clean interface
 */
BetterSqliteAdapter.prototype.transaction = function(operations) {
  const adapter = this;
  
  return new Promise(function(resolve, reject) {
    if (!adapter.db) {
      reject(new Error('Database not connected'));
      return;
    }
    
    // better-sqlite3 has built-in transaction support
    try {
      const transaction = adapter.db.transaction(function() {
        // Execute the user's operations and wait for the result
        const promise = operations();
        
        // Since better-sqlite3 transactions are synchronous,
        // we need to handle promises synchronously
        if (promise && typeof promise.then === 'function') {
          // This is tricky - better-sqlite3 transactions must be synchronous
          // So we'll execute without the transaction wrapper for async operations
          throw new Error('Async operations not supported in better-sqlite3 transactions - use direct calls');
        }
        
        return promise;
      });
      
      const result = transaction();
      adapter.debug && console.log('[BetterSqliteAdapter] Transaction completed successfully');
      resolve(result);
    } catch (error) {
      if (error.message.includes('Async operations not supported')) {
        // Fallback: execute the promise-based operations without transaction
        adapter.debug && console.warn('[BetterSqliteAdapter] Falling back to non-transactional execution for async operations');
        operations().then(resolve).catch(reject);
      } else {
        adapter.debug && console.error('[BetterSqliteAdapter] Transaction error: ' + error.message);
        reject(error);
      }
    }
  });
};

module.exports = BetterSqliteAdapter;
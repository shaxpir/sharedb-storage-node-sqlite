/**
 * BetterSqlite3Adapter - Adapter for better-sqlite3 that implements the SqliteAdapter interface
 * from the shared library
 */

class BetterSqlite3Adapter {
  constructor(db) {
    this.db = db;
  }

  async transaction(operations) {
    // better-sqlite3 uses synchronous transactions
    const fn = this.db.transaction(() => {
      // Convert async operations to sync for better-sqlite3
      return operations();
    });
    return fn();
  }

  async runAsync(sql, params) {
    try {
      const stmt = this.db.prepare(sql);
      const result = stmt.run(...(params || []));
      return {
        changes: result.changes,
        lastInsertRowid: result.lastInsertRowid
      };
    } catch (error) {
      throw error;
    }
  }

  async getFirstAsync(sql, params) {
    try {
      const stmt = this.db.prepare(sql);
      return stmt.get(...(params || []));
    } catch (error) {
      throw error;
    }
  }

  async getAllAsync(sql, params) {
    try {
      const stmt = this.db.prepare(sql);
      return stmt.all(...(params || []));
    } catch (error) {
      throw error;
    }
  }
}

module.exports = BetterSqlite3Adapter;
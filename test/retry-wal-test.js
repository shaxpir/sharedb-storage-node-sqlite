const { expect } = require('chai');
const BetterSqliteAdapter = require('../lib/adapters/better-sqlite-adapter');
const { retryWithBackoff, shouldRetry } = require('../lib/utils/retry-utils');
const fs = require('fs');
const path = require('path');

describe('WAL Mode and Retry Logic', function() {
  let testDbPath;
  let adapter;

  beforeEach(function() {
    testDbPath = path.join(__dirname, 'test-retry-wal.sqlite');
    // Clean up any existing test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  afterEach(async function() {
    if (adapter) {
      await adapter.disconnect();
      adapter = null;
    }
    // Clean up test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe('WAL Mode Configuration', function() {
    it('should enable WAL mode by default', async function() {
      adapter = new BetterSqliteAdapter(testDbPath, { debug: false });
      await adapter.connect();

      // Check if WAL mode is enabled
      const result = await adapter.getFirstAsync('PRAGMA journal_mode');
      expect(result.journal_mode.toLowerCase()).to.equal('wal');
    });

    it('should allow disabling WAL mode', async function() {
      adapter = new BetterSqliteAdapter(testDbPath, {
        debug: false,
        enableWAL: false
      });
      await adapter.connect();

      // Check if WAL mode is disabled (should be delete mode)
      const result = await adapter.getFirstAsync('PRAGMA journal_mode');
      expect(result.journal_mode.toLowerCase()).to.not.equal('wal');
    });

    it('should enable foreign keys', async function() {
      adapter = new BetterSqliteAdapter(testDbPath, { debug: false });
      await adapter.connect();

      // Check if foreign keys are enabled
      const result = await adapter.getFirstAsync('PRAGMA foreign_keys');
      expect(result.foreign_keys).to.equal(1);
    });
  });

  describe('Constructor Options', function() {
    it('should accept new options object format', async function() {
      const options = {
        debug: true,
        enableWAL: false,
        maxRetries: 5,
        baseDelay: 200
      };

      adapter = new BetterSqliteAdapter(testDbPath, options);
      expect(adapter.debug).to.be.true;
      expect(adapter.enableWAL).to.be.false;
      expect(adapter.retryOptions.maxRetries).to.equal(5);
      expect(adapter.retryOptions.baseDelay).to.equal(200);
    });

    it('should use default retry options', async function() {
      adapter = new BetterSqliteAdapter(testDbPath, {});
      expect(adapter.retryOptions.maxRetries).to.equal(3);
      expect(adapter.retryOptions.baseDelay).to.equal(100);
      expect(adapter.enableWAL).to.be.true;
    });
  });

  describe('Retry Utility Functions', function() {
    describe('shouldRetry', function() {
      it('should return true for database lock errors', function() {
        const lockError = new Error('database is locked');
        expect(shouldRetry(lockError)).to.be.true;
      });

      it('should return true for database busy errors', function() {
        const busyError = new Error('database is busy');
        expect(shouldRetry(busyError)).to.be.true;
      });

      it('should return true for SQLITE_BUSY errors', function() {
        const sqliteBusyError = new Error('SQLITE_BUSY: database is locked');
        expect(shouldRetry(sqliteBusyError)).to.be.true;
      });

      it('should return false for other errors', function() {
        const otherError = new Error('some other error');
        expect(shouldRetry(otherError)).to.be.false;
      });

      it('should return false for null/undefined errors', function() {
        expect(shouldRetry(null)).to.be.false;
        expect(shouldRetry(undefined)).to.be.false;
        expect(shouldRetry({})).to.be.false;
      });
    });

    describe('retryWithBackoff', function() {
      it('should succeed on first try when operation succeeds', async function() {
        let attempts = 0;
        const operation = async () => {
          attempts++;
          return 'success';
        };

        const result = await retryWithBackoff(operation, { maxRetries: 3 });
        expect(result).to.equal('success');
        expect(attempts).to.equal(1);
      });

      it('should retry on retryable errors', async function() {
        let attempts = 0;
        const operation = async () => {
          attempts++;
          if (attempts < 3) {
            throw new Error('database is locked');
          }
          return 'success';
        };

        const result = await retryWithBackoff(operation, { maxRetries: 3, baseDelay: 10 });
        expect(result).to.equal('success');
        expect(attempts).to.equal(3);
      });

      it('should not retry on non-retryable errors', async function() {
        let attempts = 0;
        const operation = async () => {
          attempts++;
          throw new Error('syntax error');
        };

        try {
          await retryWithBackoff(operation, { maxRetries: 3 });
          expect.fail('Should have thrown error');
        } catch (error) {
          expect(error.message).to.equal('syntax error');
          expect(attempts).to.equal(1);
        }
      });

      it('should give up after max retries', async function() {
        let attempts = 0;
        const operation = async () => {
          attempts++;
          throw new Error('database is locked');
        };

        try {
          await retryWithBackoff(operation, { maxRetries: 2, baseDelay: 10 });
          expect.fail('Should have thrown error');
        } catch (error) {
          expect(error.message).to.equal('database is locked');
          expect(attempts).to.equal(3); // initial attempt + 2 retries
        }
      });
    });
  });

  describe('Database Operations with Retry', function() {
    beforeEach(async function() {
      adapter = new BetterSqliteAdapter(testDbPath, {
        debug: false,
        maxRetries: 2,
        baseDelay: 10
      });
      await adapter.connect();

      // Create a test table
      await adapter.runAsync('CREATE TABLE test_table (id INTEGER PRIMARY KEY, name TEXT)');
    });

    it('should successfully run database operations', async function() {
      // Test runAsync
      const insertResult = await adapter.runAsync('INSERT INTO test_table (name) VALUES (?)', ['test']);
      expect(insertResult.lastID).to.be.a('number');
      expect(insertResult.changes).to.equal(1);

      // Test getFirstAsync
      const row = await adapter.getFirstAsync('SELECT * FROM test_table WHERE id = ?', [insertResult.lastID]);
      expect(row).to.exist;
      expect(row.name).to.equal('test');

      // Test getAllAsync
      const rows = await adapter.getAllAsync('SELECT * FROM test_table');
      expect(rows).to.be.an('array');
      expect(rows.length).to.equal(1);
    });

    it('should handle empty results correctly', async function() {
      const row = await adapter.getFirstAsync('SELECT * FROM test_table WHERE id = ?', [999]);
      expect(row).to.be.null;

      const rows = await adapter.getAllAsync('SELECT * FROM test_table WHERE id = ?', [999]);
      expect(rows).to.be.an('array');
      expect(rows.length).to.equal(0);
    });
  });

  describe('Concurrent Access Simulation', function() {
    it('should handle multiple concurrent operations', async function() {
      adapter = new BetterSqliteAdapter(testDbPath, {
        debug: false,
        maxRetries: 3,
        baseDelay: 10
      });
      await adapter.connect();

      // Create a test table
      await adapter.runAsync('CREATE TABLE concurrent_test (id INTEGER PRIMARY KEY, value TEXT)');

      // Run multiple operations concurrently
      const operations = [];
      for (let i = 0; i < 10; i++) {
        operations.push(
          adapter.runAsync('INSERT INTO concurrent_test (value) VALUES (?)', [`value_${i}`])
        );
      }

      const results = await Promise.all(operations);
      expect(results).to.have.length(10);

      // Verify all inserts succeeded
      for (const result of results) {
        expect(result.lastID).to.be.a('number');
        expect(result.changes).to.equal(1);
      }

      // Verify data integrity
      const rows = await adapter.getAllAsync('SELECT COUNT(*) as count FROM concurrent_test');
      expect(rows[0].count).to.equal(10);
    });
  });
});
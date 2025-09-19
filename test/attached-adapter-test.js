/**
 * Tests for AttachedBetterSqliteAdapter
 * Pure adapter functionality tests only - no storage or strategy tests
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const AttachedBetterSqliteAdapter = require('../lib/adapters/attached-better-sqlite-adapter');
const BetterSqliteAdapter = require('../lib/adapters/better-sqlite-adapter');

describe('AttachedBetterSqliteAdapter', function() {
  const TEST_DIR = path.join(__dirname, 'test-databases');
  const PRIMARY_DB = path.join(TEST_DIR, 'test-primary.db');
  const ATTACHED_DB = path.join(TEST_DIR, 'test-attached.db');

  // Ensure test directory exists
  before(function() {
    if (!fs.existsSync(TEST_DIR)) {
      fs.mkdirSync(TEST_DIR, { recursive: true });
    }
  });

  // Clean up test databases after each test
  afterEach(function() {
    try {
      if (fs.existsSync(PRIMARY_DB)) fs.unlinkSync(PRIMARY_DB);
      if (fs.existsSync(ATTACHED_DB)) fs.unlinkSync(ATTACHED_DB);
      if (fs.existsSync(path.join(TEST_DIR, 'test-attached2.db'))) {
        fs.unlinkSync(path.join(TEST_DIR, 'test-attached2.db'));
      }
      if (fs.existsSync(PRIMARY_DB + '-wal')) fs.unlinkSync(PRIMARY_DB + '-wal');
      if (fs.existsSync(PRIMARY_DB + '-shm')) fs.unlinkSync(PRIMARY_DB + '-shm');
      if (fs.existsSync(ATTACHED_DB + '-wal')) fs.unlinkSync(ATTACHED_DB + '-wal');
      if (fs.existsSync(ATTACHED_DB + '-shm')) fs.unlinkSync(ATTACHED_DB + '-shm');
    } catch (e) {
      // Ignore errors during cleanup
    }
  });

  after(function() {
    // Final cleanup
    try {
      if (fs.existsSync(TEST_DIR)) {
        const files = fs.readdirSync(TEST_DIR);
        files.forEach(file => {
          const filePath = path.join(TEST_DIR, file);
          fs.unlinkSync(filePath);
        });
        fs.rmdirSync(TEST_DIR);
      }
    } catch (e) {
      // Ignore cleanup errors
    }
  });

  describe('Basic Attachment', function() {
    it('should create adapter with attachment config', function() {
      const adapter = new AttachedBetterSqliteAdapter(
        PRIMARY_DB,
        {
          attachments: [
            { path: ATTACHED_DB, alias: 'sharedb' }
          ]
        },
        { debug: false }
      );

      assert(adapter);
      assert.strictEqual(adapter.dbPath, PRIMARY_DB);
      assert.strictEqual(adapter.attachmentConfig.attachments.length, 1);
    });

    it('should connect and attach databases', async function() {
      // Create the attached database first
      const attachedAdapter = new BetterSqliteAdapter(ATTACHED_DB);
      await attachedAdapter.connect();
      await attachedAdapter.runAsync('CREATE TABLE test_table (id INTEGER PRIMARY KEY)');
      await attachedAdapter.disconnect();

      // Now create attached adapter
      const adapter = new AttachedBetterSqliteAdapter(
        PRIMARY_DB,
        {
          attachments: [
            { path: ATTACHED_DB, alias: 'sharedb' }
          ]
        },
        { debug: false }
      );

      await adapter.connect();
      assert(adapter.isAttached('sharedb'));

      // Verify we can query the attached database
      const result = await adapter.getFirstAsync(
        "SELECT name FROM sharedb.sqlite_master WHERE type='table' AND name='test_table'"
      );
      assert(result);
      assert.strictEqual(result.name, 'test_table');

      await adapter.disconnect();
      assert(!adapter.isAttached('sharedb'));
    });

    it('should handle attachment failure gracefully', async function() {
      const adapter = new AttachedBetterSqliteAdapter(
        PRIMARY_DB,
        {
          attachments: [
            { path: '/nonexistent/database.db', alias: 'sharedb' }
          ]
        },
        { debug: false }
      );

      try {
        await adapter.connect();
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert(error.message.includes('does not exist') || error.message.includes('unable to open'));
      }
    });

    it('should create database file if createIfNotExists is true', async function() {
      const NEW_DB = path.join(TEST_DIR, 'new-database.db');

      // Ensure it doesn't exist
      if (fs.existsSync(NEW_DB)) {
        fs.unlinkSync(NEW_DB);
      }

      const adapter = new AttachedBetterSqliteAdapter(
        PRIMARY_DB,
        {
          attachments: [
            { path: NEW_DB, alias: 'newdb', createIfNotExists: true }
          ]
        },
        { debug: false }
      );

      await adapter.connect();

      // Verify the file was created
      assert(fs.existsSync(NEW_DB));
      assert(adapter.isAttached('newdb'));

      // Should be able to create tables in it
      await adapter.runAsync('CREATE TABLE newdb.test_table (id INTEGER PRIMARY KEY)');

      await adapter.disconnect();

      // Cleanup
      if (fs.existsSync(NEW_DB)) {
        fs.unlinkSync(NEW_DB);
      }
    });
  });

  describe('Cross-Database Queries', function() {
    it('should perform cross-database queries', async function() {
      // Setup primary database
      const primaryAdapter = new BetterSqliteAdapter(PRIMARY_DB);
      await primaryAdapter.connect();
      await primaryAdapter.runAsync('CREATE TABLE primary_table (id INTEGER PRIMARY KEY, name TEXT)');
      await primaryAdapter.runAsync("INSERT INTO primary_table (id, name) VALUES (1, 'primary')");
      await primaryAdapter.disconnect();

      // Setup attached database
      const attachedAdapter = new BetterSqliteAdapter(ATTACHED_DB);
      await attachedAdapter.connect();
      await attachedAdapter.runAsync('CREATE TABLE attached_table (id INTEGER PRIMARY KEY, name TEXT)');
      await attachedAdapter.runAsync("INSERT INTO attached_table (id, name) VALUES (1, 'attached')");
      await attachedAdapter.disconnect();

      // Now use attached adapter to query both
      const adapter = new AttachedBetterSqliteAdapter(
        PRIMARY_DB,
        {
          attachments: [
            { path: ATTACHED_DB, alias: 'sharedb' }
          ]
        },
        { debug: false }
      );

      await adapter.connect();

      // Query from primary database
      const primaryResult = await adapter.getFirstAsync('SELECT name FROM primary_table WHERE id = 1');
      assert.strictEqual(primaryResult.name, 'primary');

      // Query from attached database
      const attachedResult = await adapter.getFirstAsync('SELECT name FROM sharedb.attached_table WHERE id = 1');
      assert.strictEqual(attachedResult.name, 'attached');

      // Join across databases
      const joinResult = await adapter.getAllAsync(
        'SELECT p.name as primary_name, a.name as attached_name ' +
        'FROM primary_table p, sharedb.attached_table a ' +
        'WHERE p.id = a.id'
      );
      assert.strictEqual(joinResult[0].primary_name, 'primary');
      assert.strictEqual(joinResult[0].attached_name, 'attached');

      await adapter.disconnect();
    });
  });

  describe('Multiple Attachments', function() {
    it('should support multiple database attachments', async function() {
      const SECOND_ATTACHED_DB = path.join(TEST_DIR, 'test-attached2.db');

      try {
        // Create two attached databases
        const attachedAdapter1 = new BetterSqliteAdapter(ATTACHED_DB);
        await attachedAdapter1.connect();
        await attachedAdapter1.runAsync('CREATE TABLE db1_table (id INTEGER PRIMARY KEY, value TEXT)');
        await attachedAdapter1.runAsync("INSERT INTO db1_table VALUES (1, 'from_db1')");
        await attachedAdapter1.disconnect();

        const attachedAdapter2 = new BetterSqliteAdapter(SECOND_ATTACHED_DB);
        await attachedAdapter2.connect();
        await attachedAdapter2.runAsync('CREATE TABLE db2_table (id INTEGER PRIMARY KEY, value TEXT)');
        await attachedAdapter2.runAsync("INSERT INTO db2_table VALUES (1, 'from_db2')");
        await attachedAdapter2.disconnect();

        // Create adapter with multiple attachments
        const adapter = new AttachedBetterSqliteAdapter(
          PRIMARY_DB,
          {
            attachments: [
              { path: ATTACHED_DB, alias: 'db1' },
              { path: SECOND_ATTACHED_DB, alias: 'db2' }
            ]
          },
          { debug: false }
        );

        await adapter.connect();

        // Verify both are attached
        assert(adapter.isAttached('db1'));
        assert(adapter.isAttached('db2'));

        // Query from both attached databases
        const result1 = await adapter.getFirstAsync('SELECT value FROM db1.db1_table WHERE id = 1');
        assert.strictEqual(result1.value, 'from_db1');

        const result2 = await adapter.getFirstAsync('SELECT value FROM db2.db2_table WHERE id = 1');
        assert.strictEqual(result2.value, 'from_db2');

        // Join across attached databases
        const joinResult = await adapter.getAllAsync(
          'SELECT d1.value as val1, d2.value as val2 ' +
          'FROM db1.db1_table d1, db2.db2_table d2 ' +
          'WHERE d1.id = d2.id'
        );
        assert.strictEqual(joinResult[0].val1, 'from_db1');
        assert.strictEqual(joinResult[0].val2, 'from_db2');

        await adapter.disconnect();
      } finally {
        // Clean up second attached database
        if (fs.existsSync(SECOND_ATTACHED_DB)) {
          fs.unlinkSync(SECOND_ATTACHED_DB);
        }
      }
    });

    it('should detach specific databases', async function() {
      // Create attached database
      const attachedAdapter = new BetterSqliteAdapter(ATTACHED_DB);
      await attachedAdapter.connect();
      await attachedAdapter.runAsync('CREATE TABLE test_table (id INTEGER PRIMARY KEY)');
      await attachedAdapter.disconnect();

      const adapter = new AttachedBetterSqliteAdapter(
        PRIMARY_DB,
        {
          attachments: [
            { path: ATTACHED_DB, alias: 'sharedb' }
          ]
        },
        { debug: false }
      );

      await adapter.connect();
      assert(adapter.isAttached('sharedb'));

      // Detach the database
      await adapter.detachDatabase('sharedb');
      assert(!adapter.isAttached('sharedb'));

      // Should not be able to query it anymore
      try {
        await adapter.getFirstAsync("SELECT * FROM sharedb.test_table");
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert(error.message.includes('no such table'));
      }

      await adapter.disconnect();
    });
  });

  describe('Helper Methods', function() {
    it('should return attached aliases', function() {
      const adapter = new AttachedBetterSqliteAdapter(
        PRIMARY_DB,
        {
          attachments: [
            { path: ATTACHED_DB, alias: 'sharedb' },
            { path: '/path/to/other.db', alias: 'other' }
          ]
        }
      );

      // Before connecting, no databases are attached yet
      const aliases = adapter.getAttachedAliases();
      assert.deepStrictEqual(aliases, []);
    });

    it('should track attached databases after connection', async function() {
      // Create the attached database first
      const attachedAdapter = new BetterSqliteAdapter(ATTACHED_DB);
      await attachedAdapter.connect();
      await attachedAdapter.runAsync('CREATE TABLE test (id INTEGER)');
      await attachedAdapter.disconnect();

      const adapter = new AttachedBetterSqliteAdapter(
        PRIMARY_DB,
        {
          attachments: [
            { path: ATTACHED_DB, alias: 'sharedb' }
          ]
        }
      );

      await adapter.connect();

      const aliases = adapter.getAttachedAliases();
      assert.deepStrictEqual(aliases, ['sharedb']);

      await adapter.disconnect();
    });

    it('should handle :memory: databases', async function() {
      const adapter = new AttachedBetterSqliteAdapter(
        PRIMARY_DB,
        {
          attachments: [
            { path: ':memory:', alias: 'memdb' }
          ]
        },
        { debug: false }
      );

      await adapter.connect();
      assert(adapter.isAttached('memdb'));

      // Should be able to create tables in memory database
      await adapter.runAsync('CREATE TABLE memdb.test_table (id INTEGER PRIMARY KEY, value TEXT)');
      await adapter.runAsync("INSERT INTO memdb.test_table VALUES (1, 'in_memory')");

      const result = await adapter.getFirstAsync('SELECT value FROM memdb.test_table WHERE id = 1');
      assert.strictEqual(result.value, 'in_memory');

      await adapter.disconnect();
    });
  });
});
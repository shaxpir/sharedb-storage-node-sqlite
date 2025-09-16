const assert = require('assert');
const fs = require('fs');
const path = require('path');
const AttachedBetterSqliteAdapter = require('../lib/adapters/attached-better-sqlite-adapter');
const BetterSqliteAdapter = require('../lib/adapters/better-sqlite-adapter');
const AttachedCollectionPerTableStrategy = require('..').AttachedCollectionPerTableStrategy;
const SqliteStorage = require('..');
const { cleanupTestDatabases } = require('./test-cleanup');

describe('AttachedBetterSqliteAdapter', function() {
  const TEST_DIR = path.join(__dirname, 'test-databases');

  after(function() {
    cleanupTestDatabases();
  });
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
    } catch (e) {
      // Ignore errors during cleanup
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
      assert.strictEqual(adapter.primaryDbPath, PRIMARY_DB);
      assert.strictEqual(adapter.attachments.length, 1);
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
      assert(adapter.isAttached());
      
      // Verify we can query the attached database
      const result = await adapter.getFirstAsync(
        "SELECT name FROM sharedb.sqlite_master WHERE type='table' AND name='test_table'"
      );
      assert(result);
      assert.strictEqual(result.name, 'test_table');
      
      await adapter.disconnect();
      assert(!adapter.isAttached());
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
        assert(error.message.includes('unable to open') || error.message.includes('Failed to attach'));
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
      
      // Query primary database (no prefix needed)
      const primaryResult = await adapter.getFirstAsync('SELECT name FROM primary_table WHERE id = 1');
      assert.strictEqual(primaryResult.name, 'primary');
      
      // Query attached database (needs alias prefix)
      const attachedResult = await adapter.getFirstAsync('SELECT name FROM sharedb.attached_table WHERE id = 1');
      assert.strictEqual(attachedResult.name, 'attached');
      
      // Cross-database JOIN query
      const joinResult = await adapter.getFirstAsync(
        'SELECT p.name as primary_name, a.name as attached_name ' +
        'FROM primary_table p, sharedb.attached_table a ' +
        'WHERE p.id = a.id'
      );
      assert.strictEqual(joinResult.primary_name, 'primary');
      assert.strictEqual(joinResult.attached_name, 'attached');
      
      await adapter.disconnect();
    });
  });
  
  describe('AttachedCollectionPerTableStrategy', function() {
    it('should initialize schema in attached database', async function() {
      // Create attached adapter
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
      
      // Create strategy with attachment alias
      const strategy = new AttachedCollectionPerTableStrategy({
        attachmentAlias: 'sharedb',
        collectionConfig: {
          'users': {
            indexes: ['email']
          }
        }
      });
      
      // Initialize schema
      await new Promise((resolve, reject) => {
        strategy.initializeSchema(adapter, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      
      // Verify tables were created in attached database
      const metaTable = await adapter.getFirstAsync(
        "SELECT name FROM sharedb.sqlite_master WHERE type='table' AND name='sharedb_meta'"
      );
      assert(metaTable);
      
      const inventoryTable = await adapter.getFirstAsync(
        "SELECT name FROM sharedb.sqlite_master WHERE type='table' AND name='sharedb_inventory'"
      );
      assert(inventoryTable);
      
      const usersTable = await adapter.getFirstAsync(
        "SELECT name FROM sharedb.sqlite_master WHERE type='table' AND name='users'"
      );
      assert(usersTable);
      
      await adapter.disconnect();
    });
    
    it('should prefix table names correctly', function() {
      const strategy = new AttachedCollectionPerTableStrategy({
        attachmentAlias: 'sharedb'
      });
      
      assert.strictEqual(strategy.getTableName('users'), 'sharedb.users');
      assert.strictEqual(strategy.getTableName('__meta__'), 'sharedb.sharedb_meta');
      assert.strictEqual(strategy.getTableName('__inventory__'), 'sharedb.sharedb_inventory');
    });
    
    it('should work with SqliteStorage', async function() {
      // Create attached adapter
      const adapter = new AttachedBetterSqliteAdapter(
        PRIMARY_DB,
        {
          attachments: [
            { path: ATTACHED_DB, alias: 'sharedb' }
          ]
        },
        { debug: false }
      );
      
      // Create strategy with attachment alias
      const strategy = new AttachedCollectionPerTableStrategy({
        attachmentAlias: 'sharedb',
        collectionConfig: {}
      });
      
      // Create storage with attached adapter and strategy
      const storage = new SqliteStorage({
        adapter: adapter,
        schemaStrategy: strategy
      });
      
      await new Promise((resolve, reject) => {
        storage.initialize((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      
      // Verify that storage is initialized and working
      assert(storage.isReady());
      
      // Test that we can interact with the attached database
      // Simply verify that the tables were created in the attached database
      const tables = await adapter.getAllAsync(
        "SELECT name FROM sharedb.sqlite_master WHERE type='table' ORDER BY name"
      );
      
      // Should have at least the meta and inventory tables
      const tableNames = tables.map(t => t.name);
      assert(tableNames.includes('sharedb_meta'));
      assert(tableNames.includes('sharedb_inventory'));
      
      await new Promise((resolve, reject) => {
        storage.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
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
  });
  
  describe('Automatic Pre-initialization', function() {
    it('should automatically initialize ShareDB database with indexes before attachment', async function() {
      // Create a fresh ShareDB database path (doesn't exist yet)
      const FRESH_SHAREDB_DB = path.join(TEST_DIR, 'fresh-sharedb.db');
      
      try {
        // Ensure it doesn't exist
        if (fs.existsSync(FRESH_SHAREDB_DB)) {
          fs.unlinkSync(FRESH_SHAREDB_DB);
        }
        
        // Create primary database
        const primaryAdapter = new BetterSqliteAdapter(PRIMARY_DB);
        await primaryAdapter.connect();
        await primaryAdapter.runAsync('CREATE TABLE main_table (id INTEGER PRIMARY KEY)');
        await primaryAdapter.disconnect();
        
        // Create attached adapter with a strategy
        const adapter = new AttachedBetterSqliteAdapter(
          PRIMARY_DB,
          {
            attachments: [
              { path: FRESH_SHAREDB_DB, alias: 'sharedb' }
            ]
          },
          { debug: false }
        );
        
        // Create strategy with collection config that includes indexes
        // Using realistic field paths that match actual ShareDB document structure
        const strategy = new AttachedCollectionPerTableStrategy({
          attachmentAlias: 'sharedb',
          collectionConfig: {
            'test_collection': {
              indexes: ['payload.data.field1', 'payload.data.field2', 'payload.data.field3']
            }
          }
        });
        
        // Create storage - this should trigger automatic initialization
        const storage = new SqliteStorage({
          adapter: adapter,
          schemaStrategy: strategy
        });
        
        // Initialize storage
        await new Promise((resolve, reject) => {
          storage.initialize((err) => {
            if (err) reject(err);
            else resolve();
          });
        });
        
        // Verify the ShareDB database was created with indexes
        const indexes = await adapter.getAllAsync(
          "SELECT name FROM sharedb.sqlite_master WHERE type='index' ORDER BY name"
        );
        
        const indexNames = indexes.map(i => i.name);
        
        // Debug output to see what indexes were actually created
        console.log('[Test] Indexes found in attached database:', indexNames);
        
        // Should have inventory indexes
        assert(indexNames.includes('idx_inventory_collection'));
        assert(indexNames.includes('idx_inventory_updated'));
        
        // Should have collection indexes with idx_ prefix and payload.data in the path
        assert(indexNames.includes('idx_test_collection_payload_data_field1'));
        assert(indexNames.includes('idx_test_collection_payload_data_field2'));
        assert(indexNames.includes('idx_test_collection_payload_data_field3'));
        
        // Verify tables were created
        const tables = await adapter.getAllAsync(
          "SELECT name FROM sharedb.sqlite_master WHERE type='table' ORDER BY name"
        );
        
        const tableNames = tables.map(t => t.name);
        console.log('[Test] Tables found in attached database:', tableNames);
        
        assert(tableNames.includes('sharedb_meta'));
        assert(tableNames.includes('sharedb_inventory'));
        assert(tableNames.includes('test_collection'));
        
        await new Promise((resolve, reject) => {
          storage.close((err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      } finally {
        // Cleanup
        if (fs.existsSync(FRESH_SHAREDB_DB)) {
          fs.unlinkSync(FRESH_SHAREDB_DB);
        }
      }
    });
    
    it('should handle pre-existing initialized databases correctly', async function() {
      // First, create and initialize a ShareDB database
      const sharedbAdapter = new BetterSqliteAdapter(ATTACHED_DB);
      await sharedbAdapter.connect();
      await sharedbAdapter.runAsync('CREATE TABLE sharedb_meta (id TEXT PRIMARY KEY, data JSON)');
      await sharedbAdapter.runAsync('CREATE TABLE sharedb_inventory (collection TEXT, doc_id TEXT, version_num REAL, version_str TEXT, has_pending INTEGER, updated_at INTEGER, PRIMARY KEY(collection, doc_id))');
      await sharedbAdapter.runAsync('CREATE INDEX idx_inventory_collection ON sharedb_inventory (collection)');
      await sharedbAdapter.runAsync('CREATE INDEX idx_inventory_updated ON sharedb_inventory (updated_at)');
      await sharedbAdapter.disconnect();
      
      // Create primary database
      const primaryAdapter = new BetterSqliteAdapter(PRIMARY_DB);
      await primaryAdapter.connect();
      await primaryAdapter.runAsync('CREATE TABLE main_table (id INTEGER PRIMARY KEY)');
      await primaryAdapter.disconnect();
      
      // Now use it with attachment mode - it should detect existing indexes
      const adapter = new AttachedBetterSqliteAdapter(
        PRIMARY_DB,
        {
          attachments: [
            { path: ATTACHED_DB, alias: 'sharedb' }
          ]
        },
        { debug: false }
      );
      
      const strategy = new AttachedCollectionPerTableStrategy({
        attachmentAlias: 'sharedb',
        collectionConfig: {}
      });
      
      const storage = new SqliteStorage({
        adapter: adapter,
        schemaStrategy: strategy
      });
      
      // Capture console output to verify it detected existing indexes
      const originalLog = console.log;
      let detectedExistingIndexes = false;
      
      console.log = function() {
        const message = Array.from(arguments).join(' ');
        if (message.includes('All required indexes found')) {
          detectedExistingIndexes = true;
        }
        // Still output for debugging
        originalLog.apply(console, arguments);
      };
      
      try {
        await new Promise((resolve, reject) => {
          storage.initialize((err) => {
            if (err) reject(err);
            else resolve();
          });
        });
        
        // Verify indexes still exist and weren't recreated
        const indexes = await adapter.getAllAsync(
          "SELECT name FROM sharedb.sqlite_master WHERE type='index'"
        );
        
        const indexNames = indexes.map(i => i.name);
        assert(indexNames.includes('idx_inventory_collection'));
        assert(indexNames.includes('idx_inventory_updated'));
        
        await new Promise((resolve, reject) => {
          storage.close((err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      } finally {
        console.log = originalLog;
      }
    });
  });
  
  describe('Helper Methods', function() {
    it('should check if all databases exist', function() {
      // Create the databases
      fs.writeFileSync(PRIMARY_DB, '');
      fs.writeFileSync(ATTACHED_DB, '');
      
      const adapter = new AttachedBetterSqliteAdapter(
        PRIMARY_DB,
        {
          attachments: [
            { path: ATTACHED_DB, alias: 'sharedb' }
          ]
        }
      );
      
      const status = adapter.checkAllDatabasesExist();
      assert(status.primary.exists);
      assert(status.attachments.sharedb.exists);
    });
    
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
      
      const aliases = adapter.getAttachedAliases();
      assert.deepStrictEqual(aliases, ['sharedb', 'other']);
    });
  });
});
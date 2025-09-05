const assert = require('assert');
const fs = require('fs');
const path = require('path');
const BetterSqliteAdapter = require('../lib/adapters/better-sqlite-adapter');
const AttachedBetterSqliteAdapter = require('../lib/adapters/attached-better-sqlite-adapter');
const AttachedCollectionPerTableStrategy = require('../lib/schema/attached-collection-per-table-strategy');
const { initializeShareDBDatabase, verifyShareDBDatabase } = require('../lib/utils/sharedb-initializer');

describe('ShareDB Initializer', function() {
  const TEST_DIR = path.join(__dirname, 'test-databases');
  const SHAREDB_DB = path.join(TEST_DIR, 'test-sharedb-init.db');
  const PRIMARY_DB = path.join(TEST_DIR, 'test-primary-init.db');
  
  // Ensure test directory exists
  before(function() {
    if (!fs.existsSync(TEST_DIR)) {
      fs.mkdirSync(TEST_DIR, { recursive: true });
    }
  });
  
  // Clean up test databases after each test
  afterEach(function() {
    try {
      if (fs.existsSync(SHAREDB_DB)) fs.unlinkSync(SHAREDB_DB);
      if (fs.existsSync(PRIMARY_DB)) fs.unlinkSync(PRIMARY_DB);
    } catch (e) {
      // Ignore errors during cleanup
    }
  });
  
  describe('initializeShareDBDatabase', function() {
    it('should create tables and indexes in ShareDB database', async function() {
      const adapter = new BetterSqliteAdapter(SHAREDB_DB);
      
      const result = await initializeShareDBDatabase(adapter, {
        collectionConfig: {
          'users': {
            indexes: ['email', 'username']
          },
          'posts': {
            indexes: ['authorId', 'createdAt']
          }
        },
        debug: false
      });
      
      assert(result.success);
      
      // Verify tables were created
      assert(result.tables.includes('sharedb_meta'));
      assert(result.tables.includes('sharedb_inventory'));
      assert(result.tables.includes('users'));
      assert(result.tables.includes('posts'));
      
      // Verify indexes were created
      assert(result.indexes.includes('idx_inventory_collection'));
      assert(result.indexes.includes('idx_inventory_updated'));
      assert(result.indexes.includes('users_email_idx'));
      assert(result.indexes.includes('users_username_idx'));
      assert(result.indexes.includes('posts_authorId_idx'));
      assert(result.indexes.includes('posts_createdAt_idx'));
    });
    
    it('should handle empty collectionConfig', async function() {
      const adapter = new BetterSqliteAdapter(SHAREDB_DB);
      
      const result = await initializeShareDBDatabase(adapter, {
        collectionConfig: {},
        debug: false
      });
      
      assert(result.success);
      assert(result.tables.includes('sharedb_meta'));
      assert(result.tables.includes('sharedb_inventory'));
      assert(result.indexes.includes('idx_inventory_collection'));
      assert(result.indexes.includes('idx_inventory_updated'));
    });
  });
  
  describe('verifyShareDBDatabase', function() {
    it('should detect missing tables and indexes', async function() {
      // Create a database with incomplete schema
      const adapter = new BetterSqliteAdapter(SHAREDB_DB);
      await adapter.connect();
      await adapter.runAsync('CREATE TABLE sharedb_meta (id TEXT PRIMARY KEY, data JSON)');
      // Missing: sharedb_inventory, indexes
      await adapter.disconnect();
      
      // Now verify it
      const result = await verifyShareDBDatabase(adapter, {
        collectionConfig: {
          'users': {
            indexes: ['email']
          }
        },
        debug: false
      });
      
      assert(!result.isValid);
      assert(result.missingTables.includes('sharedb_inventory'));
      assert(result.missingTables.includes('users'));
      assert(result.missingIndexes.includes('idx_inventory_collection'));
      assert(result.missingIndexes.includes('idx_inventory_updated'));
      assert(result.missingIndexes.includes('users_email_idx'));
    });
    
    it('should validate a properly initialized database', async function() {
      const adapter = new BetterSqliteAdapter(SHAREDB_DB);
      
      // First initialize it
      await initializeShareDBDatabase(adapter, {
        collectionConfig: {
          'documents': {
            indexes: ['type', 'createdAt']
          }
        },
        debug: false
      });
      
      // Then verify it
      const result = await verifyShareDBDatabase(adapter, {
        collectionConfig: {
          'documents': {
            indexes: ['type', 'createdAt']
          }
        },
        debug: false
      });
      
      assert(result.isValid);
      assert.strictEqual(result.missingTables.length, 0);
      assert.strictEqual(result.missingIndexes.length, 0);
    });
  });
  
  describe('Integration with AttachedCollectionPerTableStrategy', function() {
    it('should work with pre-initialized ShareDB database', async function() {
      // Step 1: Initialize the ShareDB database with indexes
      const sharedbAdapter = new BetterSqliteAdapter(SHAREDB_DB);
      await initializeShareDBDatabase(sharedbAdapter, {
        collectionConfig: {
          'test_collection': {
            indexes: ['field1', 'field2']
          }
        },
        debug: false
      });
      
      // Step 2: Create primary database
      const primaryAdapter = new BetterSqliteAdapter(PRIMARY_DB);
      await primaryAdapter.connect();
      await primaryAdapter.runAsync('CREATE TABLE main_table (id INTEGER PRIMARY KEY)');
      await primaryAdapter.disconnect();
      
      // Step 3: Use AttachedBetterSqliteAdapter with the pre-initialized ShareDB
      const attachedAdapter = new AttachedBetterSqliteAdapter(
        PRIMARY_DB,
        {
          attachments: [
            { path: SHAREDB_DB, alias: 'sharedb' }
          ]
        },
        { debug: false }
      );
      
      await attachedAdapter.connect();
      
      // Step 4: Verify indexes exist in the attached database
      const indexes = await attachedAdapter.getAllAsync(
        "SELECT name FROM sharedb.sqlite_master WHERE type='index' ORDER BY name"
      );
      
      const indexNames = indexes.map(i => i.name);
      assert(indexNames.includes('idx_inventory_collection'));
      assert(indexNames.includes('idx_inventory_updated'));
      assert(indexNames.includes('test_collection_field1_idx'));
      assert(indexNames.includes('test_collection_field2_idx'));
      
      // Step 5: Verify the strategy recognizes the indexes
      const strategy = new AttachedCollectionPerTableStrategy({
        attachmentAlias: 'sharedb',
        collectionConfig: {
          'test_collection': {
            indexes: ['field1', 'field2']
          }
        }
      });
      
      // The strategy's initializeSchema should detect existing indexes
      await new Promise((resolve, reject) => {
        strategy.initializeSchema(attachedAdapter, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      
      await attachedAdapter.disconnect();
    });
    
    it('should automatically create missing indexes during pre-initialization', async function() {
      // Create ShareDB database WITHOUT indexes (simulating a database that wasn't properly initialized)
      const sharedbAdapter = new BetterSqliteAdapter(SHAREDB_DB);
      await sharedbAdapter.connect();
      await sharedbAdapter.runAsync('CREATE TABLE sharedb_meta (id TEXT PRIMARY KEY, data JSON)');
      await sharedbAdapter.runAsync('CREATE TABLE sharedb_inventory (collection TEXT, doc_id TEXT, version_num REAL, version_str TEXT, has_pending INTEGER, updated_at INTEGER, PRIMARY KEY(collection, doc_id))');
      await sharedbAdapter.disconnect();
      
      // Create primary database
      const primaryAdapter = new BetterSqliteAdapter(PRIMARY_DB);
      await primaryAdapter.connect();
      await primaryAdapter.runAsync('CREATE TABLE main_table (id INTEGER PRIMARY KEY)');
      await primaryAdapter.disconnect();
      
      // Create strategy with collection config that requires indexes
      const strategy = new AttachedCollectionPerTableStrategy({
        attachmentAlias: 'sharedb',
        collectionConfig: {
          'test_collection': {
            indexes: ['field1', 'field2']
          }
        },
        createAdapterForPath: function(dbPath) {
          return new BetterSqliteAdapter(dbPath);
        }
      });
      
      // Attach with the strategy set - this should trigger pre-initialization
      const attachedAdapter = new AttachedBetterSqliteAdapter(
        PRIMARY_DB,
        {
          attachments: [
            { path: SHAREDB_DB, alias: 'sharedb' }
          ]
        },
        { debug: false }
      );
      
      // Set the strategy so the adapter can use it for pre-initialization
      attachedAdapter.setSchemaStrategy(strategy);
      
      await attachedAdapter.connect();
      
      try {
        // Verify that indexes were automatically created
        const indexes = await attachedAdapter.getAllAsync(
          "SELECT name FROM sharedb.sqlite_master WHERE type='index'"
        );
        const indexNames = indexes.map(i => i.name);
        
        // Should have automatically created the missing inventory indexes
        assert(indexNames.includes('idx_inventory_collection'), 'Should have created idx_inventory_collection');
        assert(indexNames.includes('idx_inventory_updated'), 'Should have created idx_inventory_updated');
        
        // Should have created indexes for the test collection
        assert(indexNames.includes('test_collection_field1_idx'), 'Should have created test_collection_field1_idx');
        assert(indexNames.includes('test_collection_field2_idx'), 'Should have created test_collection_field2_idx');
        
      } finally {
        await attachedAdapter.disconnect();
      }
    });
  });
});
# Database Attachment Mode

This document describes the database attachment feature that allows ShareDB storage to work with attached SQLite databases, enabling cross-database queries and better separation of concerns.

## Overview

The attachment mode allows you to use SQLite's ATTACH DATABASE feature to connect multiple database files under a single connection. This is useful when you want to:

1. Keep your application's primary data separate from ShareDB's operational data
2. Enable cross-database queries between your app's data and ShareDB documents
3. Maintain different backup/sync strategies for different databases

## Important: Index Creation Requirements

**SQLite does not support creating indexes with `database.table` notation in CREATE INDEX statements.** This means indexes MUST be created directly in the ShareDB database before it's attached. 

To ensure proper performance, you must initialize your ShareDB database with all necessary indexes before using it in attachment mode. We provide the `sharedb-initializer` utility for this purpose.

## Components

### AttachedSqliteAdapter

Base class that wraps any existing adapter and adds attachment functionality:

```javascript
const AttachedSqliteAdapter = require('@shaxpir/sharedb-storage-node-sqlite/lib/adapters/attached-sqlite-adapter');
```

### AttachedBetterSqliteAdapter (Node.js)

Node.js-specific implementation for use with better-sqlite3:

```javascript
const AttachedBetterSqliteAdapter = require('@shaxpir/sharedb-storage-node-sqlite/lib/adapters/attached-better-sqlite-adapter');

// Create adapter with primary database and attachments
const adapter = new AttachedBetterSqliteAdapter(
  '/path/to/primary.db',
  {
    attachments: [
      { path: '/path/to/sharedb.db', alias: 'sharedb' }
    ]
  },
  { debug: true }
);
```

### AttachedExpoSqliteAdapter (React Native)

React Native implementation for use with expo-sqlite:

```javascript
const AttachedExpoSqliteAdapter = require('@shaxpir/sharedb-storage-expo-sqlite/lib/adapters/attached-expo-sqlite-adapter');

// Create adapter with primary database and attachments
const adapter = new AttachedExpoSqliteAdapter(
  'primary.db',
  '/path/to/databases/',
  {
    attachments: [
      { 
        fileName: 'sharedb.db', 
        dirPath: '/path/to/databases/',
        alias: 'sharedb' 
      }
    ]
  },
  true // debug
);

// Or use the helper for document directory
const adapter = AttachedExpoSqliteAdapter.createWithDocumentDirectory(
  'primary.db',
  {
    attachments: [
      { fileName: 'sharedb.db', alias: 'sharedb' }
    ]
  },
  true // debug
);
```

### AttachedCollectionPerTableStrategy

Schema strategy that works with attached databases by prefixing all table operations:

```javascript
const AttachedCollectionPerTableStrategy = require('@shaxpir/sharedb-storage-node-sqlite/lib/schema/attached-collection-per-table-strategy');

const strategy = new AttachedCollectionPerTableStrategy({
  attachmentAlias: 'sharedb', // Must match the alias used in adapter
  collectionConfig: {
    'users': {
      indexes: ['email', 'username']
    },
    'posts': {
      indexes: ['authorId', 'createdAt']
    }
  }
});
```

### ShareDB Initializer

Helper utilities to ensure your ShareDB database has proper schema and indexes before attachment:

```javascript
const { initializeShareDBDatabase, verifyShareDBDatabase } = require('@shaxpir/sharedb-storage-node-sqlite/lib/utils/sharedb-initializer');
```

## Complete Example with Proper Initialization

### Node.js (with better-sqlite3)

```javascript
const BetterSqliteAdapter = require('@shaxpir/sharedb-storage-node-sqlite/lib/adapters/better-sqlite-adapter');
const AttachedBetterSqliteAdapter = require('@shaxpir/sharedb-storage-node-sqlite/lib/adapters/attached-better-sqlite-adapter');
const AttachedCollectionPerTableStrategy = require('@shaxpir/sharedb-storage-node-sqlite/lib/schema/attached-collection-per-table-strategy');
const SqliteStorage = require('@shaxpir/sharedb-storage-node-sqlite');
const { initializeShareDBDatabase, verifyShareDBDatabase } = require('@shaxpir/sharedb-storage-node-sqlite/lib/utils/sharedb-initializer');

// Step 1: Initialize the ShareDB database with indexes (one-time setup)
async function setupShareDBDatabase() {
  const sharedbAdapter = new BetterSqliteAdapter('./data/sharedb.db');
  
  // Define your collection configuration
  const collectionConfig = {
    'documents': {
      indexes: ['type', 'createdAt']
    },
    'users': {
      indexes: ['email', 'username']
    }
  };
  
  // Initialize the database with schema and indexes
  const result = await initializeShareDBDatabase(sharedbAdapter, {
    collectionConfig,
    debug: true
  });
  
  console.log('ShareDB database initialized:', result);
  
  // Optionally verify the database is properly initialized
  const verification = await verifyShareDBDatabase(sharedbAdapter, {
    collectionConfig,
    debug: true
  });
  
  if (!verification.isValid) {
    throw new Error('ShareDB database initialization failed: ' + 
      JSON.stringify(verification.missingIndexes));
  }
}

// Step 2: Use the initialized ShareDB database with attachment
async function useAttachedDatabase() {
  // Create the attached adapter
  const adapter = new AttachedBetterSqliteAdapter(
    './data/app.db',  // Primary database
    {
      attachments: [
        { path: './data/sharedb.db', alias: 'sharedb' }
      ]
    },
    { debug: true }
  );

  // Create the strategy for the attached database
  const strategy = new AttachedCollectionPerTableStrategy({
    attachmentAlias: 'sharedb',
    collectionConfig: {
      'documents': {
        indexes: ['type', 'createdAt']
      },
      'users': {
        indexes: ['email', 'username']
      }
    }
  });

  // Create the storage instance
  const storage = new SqliteStorage({
    adapter: adapter,
    schemaStrategy: strategy
  });

  // Initialize and use
  await new Promise((resolve, reject) => {
    storage.initialize((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
  
  // Now you can query across databases with proper indexes
  const results = await adapter.getAllAsync(`
    SELECT 
      p.id, 
      p.name,
      d.data
    FROM primary_table p
    LEFT JOIN sharedb.documents d ON p.doc_id = d.id
    WHERE json_extract(d.data, '$.type') = 'article'
  `);
  
  console.log('Cross-database query results:', results);
  
  return storage;
}

// Main usage
(async () => {
  try {
    // Initialize ShareDB database (only needed once)
    await setupShareDBDatabase();
    
    // Use the attached database
    const storage = await useAttachedDatabase();
    
    // ... your application logic ...
    
  } catch (error) {
    console.error('Error:', error);
  }
})();
```

### React Native (with expo-sqlite)

```javascript
const AttachedExpoSqliteAdapter = require('@shaxpir/sharedb-storage-expo-sqlite/lib/adapters/attached-expo-sqlite-adapter');
const AttachedCollectionPerTableStrategy = require('@shaxpir/sharedb-storage-expo-sqlite/lib/schema/attached-collection-per-table-strategy');
const SqliteStorage = require('@shaxpir/sharedb-storage-expo-sqlite');

// Create the attached adapter using document directory
const adapter = AttachedExpoSqliteAdapter.createWithDocumentDirectory(
  'app.db',  // Primary database
  {
    attachments: [
      { fileName: 'sharedb.db', alias: 'sharedb' }
    ]
  },
  true // debug
);

// Create the strategy for the attached database
const strategy = new AttachedCollectionPerTableStrategy({
  attachmentAlias: 'sharedb',
  collectionConfig: {
    'documents': {
      indexes: ['type', 'createdAt']
    }
  }
});

// Create and use storage
const storage = new SqliteStorage({
  adapter: adapter,
  schemaStrategy: strategy
});

storage.initialize((err) => {
  if (err) {
    console.error('Failed to initialize:', err);
    return;
  }
  
  // Ready to use
  console.log('ShareDB storage initialized with attached database');
});
```

## Multiple Attachments

You can attach multiple databases:

```javascript
const adapter = new AttachedBetterSqliteAdapter(
  './primary.db',
  {
    attachments: [
      { path: './sharedb.db', alias: 'sharedb' },
      { path: './analytics.db', alias: 'analytics' },
      { path: './cache.db', alias: 'cache' }
    ]
  }
);

// Query across all attached databases
adapter.getAllAsync(`
  SELECT 
    s.data as sharedb_data,
    a.metrics as analytics_data,
    c.value as cached_value
  FROM sharedb.documents s
  JOIN analytics.events a ON s.id = a.doc_id
  LEFT JOIN cache.entries c ON s.id = c.key
`);
```

## Important Notes

1. **Indexes**: SQLite doesn't support the `database.table` notation in CREATE INDEX statements. **You MUST initialize your ShareDB database with indexes BEFORE using it in attachment mode.** Use the `sharedb-initializer` utility for this purpose.

2. **Table Prefixing**: The AttachedCollectionPerTableStrategy automatically prefixes all table references with the attachment alias. You don't need to worry about this in your application code.

3. **Connection Lifecycle**: Databases are attached when the adapter connects and automatically detached when it disconnects.

4. **Error Handling**: If attachment fails (e.g., database file doesn't exist), the connection will fail with a clear error message.

5. **Testing**: The attachment mode is fully tested in both Node.js and React Native environments. See the test files for more examples.

## Checking Database Existence

Both adapters provide methods to check if database files exist:

```javascript
// Node.js
const status = adapter.checkAllDatabasesExist();
console.log(status);
// {
//   primary: { path: './primary.db', exists: true },
//   attachments: {
//     sharedb: { path: './sharedb.db', exists: true }
//   }
// }

// React Native (async)
const status = await adapter.checkAllDatabasesExist();
console.log(status);
// {
//   primary: { fileName: 'primary.db', exists: true },
//   attachments: {
//     sharedb: { fileName: 'sharedb.db', exists: true }
//   }
// }
```

## Limitations

1. SQLite's ATTACH has a limit on the number of attached databases (typically 10, but can be configured at compile time)
2. Cross-database foreign keys are not supported by SQLite
3. Transactions across attached databases have some limitations (see SQLite documentation)
4. Indexes cannot be created using the database.table syntax - they must be created in the database's own context

## Performance Considerations

1. Each attached database maintains its own page cache
2. Cross-database queries may be slower than single-database queries
3. Consider co-locating frequently joined data in the same database when possible
4. Use appropriate indexes (created manually if needed) for join columns

## Migration from Standard Mode

If you're currently using standard SqliteAdapter, migration is straightforward:

```javascript
// Before:
const adapter = new BetterSqliteAdapter('./sharedb.db');
const strategy = new CollectionPerTableStrategy({ /* config */ });

// After:
const adapter = new AttachedBetterSqliteAdapter(
  './app.db',
  {
    attachments: [
      { path: './sharedb.db', alias: 'sharedb' }
    ]
  }
);
const strategy = new AttachedCollectionPerTableStrategy({
  attachmentAlias: 'sharedb',
  /* same config as before */
});
```

The ShareDB data remains in the same database file; it's just accessed through the attachment mechanism now.
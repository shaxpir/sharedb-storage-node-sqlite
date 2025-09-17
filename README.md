# @shaxpir/sharedb-storage-node-sqlite

Node.js SQLite storage adapter for [ShareDB](https://github.com/share/sharedb) using better-sqlite3.

## Overview

This package provides a Node.js implementation of ShareDB's DurableStorage interface using SQLite. It builds on the shared `@shaxpir/sharedb-storage-sqlite` library and adds Node.js-specific adapters for better-sqlite3.

## Features

- ✅ **ShareDB DurableStorage** - Implements ShareDB's offline storage interface
- ✅ **Better-SQLite3** - High-performance synchronous SQLite for Node.js
- ✅ **Multiple Schema Strategies** - Choose how documents are organized in SQLite
- ✅ **Database Attachments** - Support for multi-database architectures
- ✅ **Projection Support** - Automatic materialization of arrays into relational tables
- ✅ **Field Encryption** - Encrypt specific document fields
- ✅ **Production Ready** - Comprehensive error handling and testing

## Installation

```bash
npm install @shaxpir/sharedb-storage-node-sqlite
```

**Peer Dependencies**:
- `@shaxpir/sharedb >= 6.0.0`
- `better-sqlite3 >= 8.0.0`

## Quick Start

### Basic Usage

```javascript
const SqliteStorage = require('@shaxpir/sharedb-storage-node-sqlite');
const { BetterSqliteAdapter } = SqliteStorage;

// Create adapter for your SQLite database
const adapter = new BetterSqliteAdapter('./myapp.db');

// Create storage with schema strategy
const storage = new SqliteStorage({
  adapter: adapter,
  schemaStrategy: new SqliteStorage.CollectionPerTableStrategy()
});

// Initialize and use with ShareDB
await storage.initialize();
```

### With ShareDB Connection

```javascript
const { Connection } = require('@shaxpir/sharedb/lib/client');
const SqliteStorage = require('@shaxpir/sharedb-storage-node-sqlite');

// Create storage
const storage = new SqliteStorage({
  adapter: new SqliteStorage.BetterSqliteAdapter('./sharedb.db')
});

// Create ShareDB connection
const connection = new Connection(websocket);

// Enable offline-first DurableStore
connection.useDurableStore({ storage });
```

### Database Attachments

For multi-database architectures (e.g., read-only reference data + user data):

```javascript
const { AttachedBetterSqliteAdapter } = SqliteStorage;

const adapter = new AttachedBetterSqliteAdapter(
  './user-data.db',  // Primary database
  {
    attachments: [
      { path: './reference-data.db', alias: 'ref' }
    ]
  }
);

// Now you can query across both databases
// Tables in attached database are prefixed with alias (e.g., ref.products)
```

## Schema Strategies

### CollectionPerTableStrategy (Recommended)

Creates separate tables for each collection with optimized indexes:

```javascript
const strategy = new SqliteStorage.CollectionPerTableStrategy({
  collectionConfig: {
    products: {
      indexes: ['payload.name', 'payload.category'],
      encryptedFields: ['payload.price']
    }
  }
});
```

### DefaultSchemaStrategy

Simple strategy using two tables (docs and meta):

```javascript
const strategy = new SqliteStorage.DefaultSchemaStrategy();
```

### AttachedCollectionPerTableStrategy

For use with attached databases:

```javascript
const strategy = new SqliteStorage.AttachedCollectionPerTableStrategy({
  attachmentAlias: 'ref'
});
```

## API Reference

### BetterSqliteAdapter

```javascript
const adapter = new BetterSqliteAdapter(dbPath, options);
```

Options:
- `readonly` (boolean): Open database in read-only mode
- `verbose` (function): Log all SQL queries
- `fileMustExist` (boolean): Fail if database doesn't exist

### AttachedBetterSqliteAdapter

```javascript
const adapter = new AttachedBetterSqliteAdapter(primaryDbPath, {
  attachments: [
    { path: './other.db', alias: 'other' }
  ]
});
```

## Testing

```bash
npm test
```

## License

MIT

## See Also

- [@shaxpir/sharedb-storage-sqlite](https://www.npmjs.com/package/@shaxpir/sharedb-storage-sqlite) - Shared components
- [@shaxpir/sharedb-storage-expo-sqlite](https://www.npmjs.com/package/@shaxpir/sharedb-storage-expo-sqlite) - React Native implementation
- [@shaxpir/sharedb](https://github.com/shaxpir/sharedb) - ShareDB with DurableStore support
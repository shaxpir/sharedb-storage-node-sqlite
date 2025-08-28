# ShareDB Node.js SQLite Storage

A Node.js SQLite storage adapter for [ShareDB's DurableStore](https://github.com/shaxpir/sharedb) using better-sqlite3, with support for dual-database architectures and connection pooling.

This package provides offline-first storage for the **DurableStore** system - a Shaxpir fork enhancement that enables client-side document persistence and offline operation queuing, not available in the original upstream ShareDB.

## Features

- ✅ **DurableStore Integration** - Purpose-built for ShareDB's offline-first DurableStore system
- ✅ **Better-SQLite3 Integration** - High-performance synchronous SQLite for Node.js
- ✅ **Dual-Database Support** - Pre-initialized database connections with schema prefixes
- ✅ **Connection Pooling** - Optional connection pooling for improved performance
- ✅ **Cross-Database Queries** - JOIN operations between multiple databases
- ✅ **Collection Mapping** - Flexible collection-to-table mapping
- ✅ **Offline Operation Queuing** - Stores pending operations while offline for later sync
- ✅ **Zero Migration** - Works with existing table schemas
- ✅ **Production Ready** - Comprehensive error handling and monitoring
- ✅ **CLI Support** - Perfect for command-line tools and server-side applications

## Installation

```bash
npm install @shaxpir/sharedb-storage-node-sqlite
```

**Peer Dependencies**:
- `@shaxpir/sharedb >= 5.4.0` (Shaxpir fork with DurableStore support)
- `better-sqlite3 >= 12.0.0`

## Quick Start

### Basic Usage

```javascript
const { Connection } = require('@shaxpir/sharedb/lib/client');
const SqliteStorage = require('@shaxpir/sharedb-storage-node-sqlite');

// Create ShareDB connection
const connection = new Connection(websocket);

// Create storage for DurableStore
const storage = new SqliteStorage({
  namespace: 'myapp'  // Creates 'sharedb_myapp.sqlite'
});

// Enable offline-first DurableStore with SQLite persistence
connection.useDurableStore({ storage });
```

### Dual-Database Architecture

Perfect for CLI tools and applications with both read-only reference data and user-specific writable data:

```javascript
const SqliteStorage = require('@shaxpir/sharedb-storage-node-sqlite');
const { BetterSqliteAdapter } = SqliteStorage;
const path = require('path');

// Initialize dictionary database (read-only)
const dictDbPath = path.join(process.env.HOME, '.myapp', 'databases', 'dictionary.sqlite');
const dictAdapter = new BetterSqliteAdapter(dictDbPath, { readonly: true });
await dictAdapter.connect();

// Initialize user database (read-write)
const userDbPath = path.join(process.env.HOME, '.myapp', 'databases', `user_${userId}.sqlite`);
const userAdapter = new BetterSqliteAdapter(userDbPath, { readonly: false });
await userAdapter.connect();

// Create storage with dual-database support
const storage = new SqliteStorage({
  adapter: userAdapter,  // Primary adapter for ShareDB data
  
  // Route ShareDB collections to appropriate tables
  collectionMapping: (collection) => `${collection}`,
  
  // Enable cross-database analytics queries
  enableCrossDbQueries: true
});
```

### CLI Tool Example

```javascript
const SqliteStorage = require('@shaxpir/sharedb-storage-node-sqlite');
const { BetterSqliteAdapter } = SqliteStorage;

class CLIDatabaseService {
  async initialize(userId) {
    // Dictionary database in CLI databases directory
    const dbDir = path.join(process.env.HOME, '.duiduidui-cli', 'databases');
    const dictDbPath = path.join(dbDir, 'duiduidui-20250824a.sqlite');
    
    this.dictionaryAdapter = new BetterSqliteAdapter(dictDbPath, { 
      readonly: true 
    });
    await this.dictionaryAdapter.connect();
    
    // User-specific database for ShareDB data
    const userDbPath = path.join(dbDir, `sharedb_${userId}.sqlite`);
    this.userDataAdapter = new BetterSqliteAdapter(userDbPath, { 
      readonly: false 
    });
    await this.userDataAdapter.connect();
    
    console.log('✓ Dictionary database connected');
    console.log('✓ User data database connected');
  }
}
```

## API Reference

### BetterSqliteAdapter

The Node.js-specific SQLite adapter using better-sqlite3:

```javascript
const { BetterSqliteAdapter } = require('@shaxpir/sharedb-storage-node-sqlite');

const adapter = new BetterSqliteAdapter(dbPath, options);
```

#### Constructor Options

```javascript
new BetterSqliteAdapter(dbPath, {
  readonly?: boolean,     // Open database in read-only mode
  verbose?: boolean,      // Enable verbose logging
  timeout?: number,       // Query timeout in milliseconds
  fileMustExist?: boolean // Fail if database doesn't exist
})
```

#### Methods

```javascript
// Lifecycle
await adapter.connect();
await adapter.disconnect();

// Query execution
await adapter.runAsync(sql, params);
await adapter.getFirstAsync(sql, params);
await adapter.getAllAsync(sql, params);

// Transactions
adapter.transaction((adapter, callback) => {
  // Transaction operations
}, callback);
```

### SqliteStorage

#### Constructor Options

```javascript
new SqliteStorage({
  // Database options
  adapter?: SqliteAdapter,          // Pre-initialized adapter
  namespace?: string,               // Database namespace for file-based DBs
  dbFileName?: string,              // Custom database filename
  dbFileDir?: string,               // Custom database directory
  
  // Dual-database options
  schemaPrefix?: string,            // Schema prefix
  collectionMapping?: (collection: string) => string,  // Collection mapping function
  enableCrossDbQueries?: boolean,   // Enable cross-DB queries (default: true)
  
  // Connection pooling
  connectionPool?: ConnectionPool,  // Injected connection pool
  
  // Storage options
  schemaStrategy?: SchemaStrategy,  // Custom schema strategy
  useEncryption?: boolean,          // Enable encryption
  encryptionCallback?: Function,    // Encryption function
  decryptionCallback?: Function,    // Decryption function
  debug?: boolean                   // Enable debug logging
})
```

## Usage Patterns

### Pattern 1: Simple File-Based Storage

```javascript
const storage = new SqliteStorage({
  namespace: 'myapp',
  dbFileDir: path.join(process.env.HOME, '.myapp', 'data')
});
```

### Pattern 2: Server-Side with Authentication

```javascript
class ServerDatabaseService {
  async createUserStorage(userId, jwtToken) {
    const dbPath = path.join(this.userDbDir, `user_${userId}.sqlite`);
    
    const adapter = new BetterSqliteAdapter(dbPath);
    await adapter.connect();
    
    return new SqliteStorage({
      adapter,
      collectionMapping: (collection) => {
        // Map ShareDB collections to your schema
        if (collection === 'documents') return 'user_documents';
        if (collection === 'settings') return 'user_settings';
        return collection;
      }
    });
  }
}
```

### Pattern 3: Testing and Development

```javascript
const Database = require('better-sqlite3');

// In-memory database for testing
const testDb = new Database(':memory:');
const adapter = new BetterSqliteAdapter(':memory:');

const storage = new SqliteStorage({
  adapter,
  debug: true
});

// Run tests...
```

## Migration from React Native Package

If you're migrating from the React Native package to Node.js:

### Before (React Native)
```javascript
import { ExpoSqliteStorage } from '@shaxpir/sharedb-storage-expo-sqlite';
import * as SQLite from 'expo-sqlite';
```

### After (Node.js)
```javascript
const SqliteStorage = require('@shaxpir/sharedb-storage-node-sqlite');
const { BetterSqliteAdapter } = SqliteStorage;
```

Key differences:
- Uses `better-sqlite3` instead of `expo-sqlite`
- Synchronous API instead of async (better-sqlite3 is synchronous)
- File-based databases instead of app-sandboxed storage
- Can access any file path on the system

## Testing

```bash
# Run tests
npm test

# Run with coverage
npm run test-cover

# Run specific test
npm test -- --grep "BetterSqliteAdapter"
```

## Performance Considerations

- **Synchronous API**: better-sqlite3 is synchronous, which simplifies code but blocks the event loop
- **WAL Mode**: Enable Write-Ahead Logging for better concurrency
- **Connection Pooling**: Consider pooling for multi-user server applications
- **Prepared Statements**: Use prepared statements for repeated queries

Example optimization:

```javascript
const adapter = new BetterSqliteAdapter(dbPath);
await adapter.connect();

// Enable WAL mode for better performance
adapter.db.pragma('journal_mode = WAL');

// Use prepared statements
const stmt = adapter.db.prepare('SELECT * FROM users WHERE id = ?');
const user = stmt.get(userId);
```

## Requirements

- Node.js >= 14.0.0
- ShareDB >= 5.4.0
- better-sqlite3 >= 12.0.0

## Contributing

1. Fork the repository
2. Create a feature branch
3. Run tests: `npm test`
4. Submit a pull request

## License

MIT © [Shaxpir Inc](https://shaxpir.com)

---

**Related Projects:**
- [@shaxpir/sharedb-storage-expo-sqlite](https://github.com/shaxpir/sharedb-storage-expo-sqlite) - React Native/Expo companion package
- [Shaxpir ShareDB Fork](https://github.com/shaxpir/sharedb) - Enhanced ShareDB with DurableStore support
- [Original ShareDB](https://github.com/share/sharedb) - Upstream ShareDB project

**Package Relationship:**
This package provides Node.js/CLI storage for the **DurableStore** system in `@shaxpir/sharedb`. It was separated from the React Native package to avoid bundling conflicts and provide optimized Node.js support with better-sqlite3.
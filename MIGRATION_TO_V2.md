# Migration Guide: Using the Shared Library

## Overview

Version 2.0.0 of `@shaxpir/sharedb-storage-node-sqlite` has been refactored to use the new `@shaxpir/sharedb-storage-sqlite` shared library. This provides:

1. **Code Reuse**: Share schema strategies between Node.js and React Native
2. **Projection Support**: Built-in support for relational projections
3. **Better Architecture**: Cleaner separation of concerns

## What's Changed

### Internal Architecture
- Schema strategies moved to `@shaxpir/sharedb-storage-sqlite`
- BetterSqlite3Adapter wraps better-sqlite3 for the shared library
- Core logic now shared with React Native implementation

### API Changes
- The public API remains largely unchanged
- New `collectionConfig` option for defining projections
- Automatic projection table management

## Migration Steps

### 1. Update Dependencies

```bash
npm install @shaxpir/sharedb-storage-node-sqlite@^2.0.0
```

### 2. Update Configuration (if using projections)

```javascript
const storage = new NodeSqliteStorage({
  db: database,
  collectionConfig: {
    terms: {
      indexes: ['payload.term'],
      projections: [
        {
          type: 'array_expansion',
          targetTable: 'term_tag',
          mapping: {
            'term_id': 'id',
            'tag': ''
          },
          arrayPath: 'payload.tags',
          primaryKey: ['term_id', 'tag']
        }
      ]
    }
  }
});
```

### 3. Remove Manual Projection Code

If you were manually maintaining projection tables (like term_tag), you can now remove that code. The library handles it automatically.

## Benefits

1. **Performance**: 180x improvement for tag-filtered queries (23s → 107ms)
2. **Automatic Maintenance**: Projection tables stay in sync automatically
3. **Shared Code**: Same schema strategies work in Node.js and React Native
4. **Type Safety**: Full TypeScript support in the shared library

## Backward Compatibility

The v2 adapter maintains backward compatibility with existing code. If you're not using projections, no changes are required beyond updating the package version.
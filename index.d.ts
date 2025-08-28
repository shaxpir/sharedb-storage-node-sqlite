// Type definitions for @shaxpir/sharedb-storage-node-sqlite
// Project: https://github.com/shaxpir/sharedb-storage-node-sqlite
// Definitions by: Claude Code <https://claude.ai/code>

/// <reference types="node" />

import { EventEmitter } from 'events';
import { Types as ShareDBStorageTypes } from '@shaxpir/sharedb/lib/client/storage';

declare namespace ShareDBSQLiteStorage {
  // ===============================
  // Core Types - Using Centralized ShareDB Types
  // ===============================

  // Use centralized types from main ShareDB package
  type Storage = ShareDBStorageTypes.Storage;
  type StorageRecord = ShareDBStorageTypes.StorageRecord;
  type StorageRecords = ShareDBStorageTypes.StorageRecords;
  type Callback<T = any> = ShareDBStorageTypes.Callback<T>;

  // Database connection types (platform-specific)
  type SqlParameters = (string | number | boolean | null | Buffer)[];
  
  interface DatabaseConnection {
    runAsync(sql: string, params?: SqlParameters): Promise<any>;
    getFirstAsync(sql: string, params?: SqlParameters): Promise<any>;
    getAllAsync(sql: string, params?: SqlParameters): Promise<any[]>;
  }

  // ===============================
  // SQLite Storage System
  // ===============================

  interface SqliteStorageOptions {
    adapter: SqliteAdapter;
    schemaStrategy?: SchemaStrategy;
    debug?: boolean;
  }

  interface SqliteStorage extends Storage {
    readonly adapter: SqliteAdapter;
    readonly schemaStrategy: SchemaStrategy;
    readonly ready: boolean;

    updateInventory(collection: string, docId: string, version: number, operation: string, callback: Callback): void;
    readInventory(callback: Callback): void;
    deleteDatabase(callback: Callback): void;
  }

  interface SqliteStorageStatic {
    new (options: SqliteStorageOptions): SqliteStorage;
  }

  // ===============================
  // SQLite Adapters
  // ===============================

  interface SqliteAdapter {
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    runAsync(sql: string, params?: SqlParameters): Promise<{ lastID?: number; changes?: number }>;
    getFirstAsync(sql: string, params?: SqlParameters): Promise<any>;
    getAllAsync(sql: string, params?: SqlParameters): Promise<any[]>;
    transaction<T>(operations: () => Promise<T>): Promise<T>;
  }


  // ===============================
  // Adapter Implementations
  // ===============================

  interface ExpoSqliteAdapter extends SqliteAdapter {
    readonly dirPath: string;
    readonly fileName: string;
    readonly debug: boolean;
  }

  interface ExpoSqliteAdapterStatic {
    new (fileName: string, dirPath: string, debug?: boolean): ExpoSqliteAdapter;
    
    // Convenient static factory method
    createWithDocumentDirectory(fileName: string, debug?: boolean): ExpoSqliteAdapter;
    checkDatabaseExists(fileName: string, dirPath?: string): Promise<boolean>;
    copyDatabase(fromPath: string, fileName: string, dirPath?: string): Promise<void>;
  }

  interface BetterSqliteAdapter extends SqliteAdapter {
    readonly dbPath: string;
    readonly options: any;
    readonly debug: boolean;
  }

  interface BetterSqliteAdapterStatic {
    new (dbPath: string, options?: any): BetterSqliteAdapter;
  }




  // ===============================
  // Schema Strategies
  // ===============================

  interface CollectionConfig {
    indexes: string[];
    encryptedFields: string[];
  }

  interface SchemaStrategyOptions {
    useEncryption?: boolean;
    encryptionCallback?: (text: string) => string;
    decryptionCallback?: (encrypted: string) => string;
    debug?: boolean;
  }

  interface SchemaStrategy {
    initializeSchema(db: DatabaseConnection, callback: Callback): void;
    validateSchema(db: DatabaseConnection, callback: Callback<boolean>): void;
    writeRecords(db: DatabaseConnection, records: StorageRecords, callback: Callback): void;
    readRecord(db: DatabaseConnection, type: string, id: string, collection?: string, callback?: Callback<StorageRecord | null>): void;
    readAllRecords(db: DatabaseConnection, type: string, collection?: string, callback?: Callback<StorageRecord[]>): void;
    readRecordsBulk?(db: DatabaseConnection, type: string, collection: string, ids: string[], callback: Callback<StorageRecord[]>): void;
    deleteRecord(db: DatabaseConnection, type: string, id: string, collection?: string, callback?: Callback): void;
    clearStore(db: DatabaseConnection, storeName: string, callback: Callback): void;
    clearAll(db: DatabaseConnection, callback: Callback): void;
    updateInventoryItem(db: DatabaseConnection, collection: string, docId: string, version: number | string, operation: string, callback: Callback): void;
    readInventory(db: DatabaseConnection, callback: Callback<StorageRecord>): void;
    initializeInventory(db: DatabaseConnection, callback: Callback<StorageRecord>): void;
    getInventoryType(): string;
    deleteAllTables(db: DatabaseConnection, callback: Callback): void;
  }


  interface DefaultSchemaStrategyOptions extends SchemaStrategyOptions {}

  interface DefaultSchemaStrategy extends SchemaStrategy {}

  interface DefaultSchemaStrategyStatic {
    new (options?: DefaultSchemaStrategyOptions): DefaultSchemaStrategy;
  }

  interface CollectionPerTableStrategyOptions extends SchemaStrategyOptions {
    collectionConfig: { [collection: string]: CollectionConfig };
  }

  interface CollectionPerTableStrategy extends SchemaStrategy {
    readonly collectionConfig: { [collection: string]: CollectionConfig };
    
    getTableName(collection: string): string;
    ensureCollectionTable(db: DatabaseConnection, collection: string, callback: Callback): void;
  }

  interface CollectionPerTableStrategyStatic {
    new (options: CollectionPerTableStrategyOptions): CollectionPerTableStrategy;
  }

}

// ===============================
// Main Export & Named Exports
// ===============================

// Default export is SqliteStorage with attached properties
export default SqliteStorage;
declare const SqliteStorage: ShareDBSQLiteStorage.SqliteStorageStatic & {
  SqliteStorage: ShareDBSQLiteStorage.SqliteStorageStatic;
  ExpoSqliteAdapter: ShareDBSQLiteStorage.ExpoSqliteAdapterStatic;
  BetterSqliteAdapter: ShareDBSQLiteStorage.BetterSqliteAdapterStatic;
  DefaultSchemaStrategy: ShareDBSQLiteStorage.DefaultSchemaStrategyStatic;
  CollectionPerTableStrategy: ShareDBSQLiteStorage.CollectionPerTableStrategyStatic;
};


// Direct type exports for better ergonomics - using centralized ShareDB types
export type ShareDBStorage = ShareDBStorageTypes.Storage;
export type StorageRecord = ShareDBSQLiteStorage.StorageRecord;
export type StorageRecords = ShareDBSQLiteStorage.StorageRecords;
export type SqliteAdapter = ShareDBSQLiteStorage.SqliteAdapter;
export type SqliteSchemaStrategy = ShareDBSQLiteStorage.SchemaStrategy;
export type CollectionConfig = ShareDBSQLiteStorage.CollectionConfig;
export type StorageCallback<T = void> = ShareDBSQLiteStorage.Callback<T>;

// Legacy namespace for backwards compatibility
export namespace Types {
  export type Storage = ShareDBSQLiteStorage.Storage;
  export type StorageRecord = ShareDBSQLiteStorage.StorageRecord;
  export type StorageRecords = ShareDBSQLiteStorage.StorageRecords;
  export type SqliteAdapter = ShareDBSQLiteStorage.SqliteAdapter;
  export type SchemaStrategy = ShareDBSQLiteStorage.SchemaStrategy;
  export type CollectionConfig = ShareDBSQLiteStorage.CollectionConfig;
  export type Callback<T = void> = ShareDBSQLiteStorage.Callback<T>;
}
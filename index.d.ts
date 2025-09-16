// Type definitions for @shaxpir/sharedb-storage-node-sqlite
// Project: https://github.com/shaxpir/sharedb-storage-node-sqlite
// Definitions by: Claude Code <https://claude.ai/code>

/// <reference types="node" />

import { EventEmitter } from 'events';
import { 
  DurableStorage, 
  DurableStorageRecord, 
  DurableStorageRecords, 
  DurableStorageCallback 
} from '@shaxpir/sharedb';

declare namespace ShareDBSQLiteStorage {
  // ===============================
  // Core Types - Re-exported from ShareDB
  // ===============================

  // Clean re-exports with no renaming needed
  type Storage = DurableStorage;
  type StorageRecord = DurableStorageRecord;
  type StorageRecords = DurableStorageRecords;
  type Callback<T = any> = DurableStorageCallback<T>;

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

  // Node.js SQLite Adapter
  interface NodeSqliteAdapter extends SqliteAdapter {
    readonly dbPath: string;
    readonly options: any;
    readonly debug: boolean;
  }

  interface NodeSqliteAdapterStatic {
    new (dbPath: string, options?: any): NodeSqliteAdapter;
  }




  // ===============================
  // Schema Strategies
  // ===============================

  interface ProjectionColumnMapping {
    source: string | '@element';  // JSON path or '@element' for the array element itself
    dataType?: 'TEXT' | 'INTEGER' | 'REAL' | 'BLOB';  // SQLite datatype (default: TEXT)
  }

  interface ProjectionIndexConfig {
    columns: string[];  // Column(s) to index
    unique?: boolean;   // Create a unique index
    name?: string;      // Optional custom index name
  }

  interface ArrayProjectionConfig {
    type: 'array_expansion';
    targetTable: string;
    mapping: {
      [targetColumn: string]: string | ProjectionColumnMapping;  // Backwards compatible
    };
    arrayPath: string;
    primaryKey: string[];
    indexes?: ProjectionIndexConfig[];  // Additional indexes
  }

  interface CollectionConfig {
    indexes: string[];
    encryptedFields: string[];
    projections?: ArrayProjectionConfig[];
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
    readonly projectionsByCollection: { [collection: string]: ArrayProjectionConfig[] };

    getTableName(collection: string): string;
    ensureCollectionTable(db: DatabaseConnection, collection: string, callback: Callback): void;
    parseProjections(collectionConfig: { [collection: string]: CollectionConfig }): { [collection: string]: ArrayProjectionConfig[] };
    createProjectionTables(db: DatabaseConnection, collection: string): Promise<void>;
    updateProjections(db: DatabaseConnection, collection: string, newRecord: any, oldRecord: any): Promise<void>;
    updateArrayExpansionProjection(db: DatabaseConnection, projection: ArrayProjectionConfig, newRecord: any, oldRecord: any): Promise<void>;
    deleteProjections(db: DatabaseConnection, collection: string, recordId: string): Promise<void>;
  }

  interface CollectionPerTableStrategyStatic {
    new (options: CollectionPerTableStrategyOptions): CollectionPerTableStrategy;
  }

  // ===============================
  // Attachment Support
  // ===============================

  interface DatabaseAttachment {
    path?: string;
    fileName?: string;
    dirPath?: string;
    alias: string;
    strategy?: SchemaStrategy;
  }

  interface AttachedSqliteAdapter extends SqliteAdapter {
    readonly attachments: DatabaseAttachment[];
    readonly attached: boolean;
    attachSingleDatabase(attachment: DatabaseAttachment): Promise<void>;
    preInitializeDatabase(attachment: DatabaseAttachment): Promise<void>;
  }

  interface AttachmentConfig {
    path: string;
    alias: string;
    strategy?: SchemaStrategy;
  }

  interface AttachedBetterSqliteAdapterOptions {
    attachments: AttachmentConfig[];
  }

  interface AttachedBetterSqliteAdapter extends AttachedSqliteAdapter {
    readonly database: any;
  }

  interface AttachedBetterSqliteAdapterStatic {
    new (dbPath: string, options?: AttachedBetterSqliteAdapterOptions, readonly?: boolean): AttachedBetterSqliteAdapter;
  }

  interface AttachedCollectionPerTableStrategy extends CollectionPerTableStrategy {
    attachmentAlias: string | null;
    preInitializeDatabase(db: any, strategy: AttachedCollectionPerTableStrategy, callback?: Callback): Promise<void>;
    createProjectionTablesAttached(db: DatabaseConnection, collection: string): Promise<void>;
    updateArrayExpansionProjection(db: DatabaseConnection, projection: ArrayProjectionConfig, newRecord: any, oldRecord: any): Promise<void>;
    deleteProjections(db: DatabaseConnection, collection: string, recordId: string): Promise<void>;
  }

  interface AttachedCollectionPerTableStrategyStatic {
    new (attachmentAlias?: string): AttachedCollectionPerTableStrategy;
    preInitializeDatabase(db: any, strategy: AttachedCollectionPerTableStrategy, callback?: Callback): Promise<void>;
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
  NodeSqliteAdapter: ShareDBSQLiteStorage.NodeSqliteAdapterStatic;
  AttachedBetterSqliteAdapter: ShareDBSQLiteStorage.AttachedBetterSqliteAdapterStatic;
  AttachedCollectionPerTableStrategy: ShareDBSQLiteStorage.AttachedCollectionPerTableStrategyStatic;
  DefaultSchemaStrategy: ShareDBSQLiteStorage.DefaultSchemaStrategyStatic;
  CollectionPerTableStrategy: ShareDBSQLiteStorage.CollectionPerTableStrategyStatic;
};


// ===============================
// Main Interface Exports - Clean Names
// ===============================

// Core ShareDB interfaces (re-exported, no renaming)
export type { DurableStorage, DurableStorageRecord, DurableStorageRecords, DurableStorageCallback };

// Platform-specific SQLite interfaces
export type SqliteAdapter = ShareDBSQLiteStorage.SqliteAdapter;
export type SqliteSchemaStrategy = ShareDBSQLiteStorage.SchemaStrategy;
export type CollectionConfig = ShareDBSQLiteStorage.CollectionConfig;
export type ProjectionColumnMapping = ShareDBSQLiteStorage.ProjectionColumnMapping;
export type ProjectionIndexConfig = ShareDBSQLiteStorage.ProjectionIndexConfig;
export type ArrayProjectionConfig = ShareDBSQLiteStorage.ArrayProjectionConfig;

// Attachment support exports
export type AttachedSqliteAdapter = ShareDBSQLiteStorage.AttachedSqliteAdapter;
export type AttachedBetterSqliteAdapter = ShareDBSQLiteStorage.AttachedBetterSqliteAdapter;
export type AttachedCollectionPerTableStrategy = ShareDBSQLiteStorage.AttachedCollectionPerTableStrategy;
export type DatabaseAttachment = ShareDBSQLiteStorage.DatabaseAttachment;
export type AttachmentConfig = ShareDBSQLiteStorage.AttachmentConfig;


import { BetterSqliteAdapter } from './better-sqlite-adapter';
import { AttachedSqliteAdapter } from './attached-sqlite-adapter';
import { SchemaStrategy } from '../schema/base-schema-strategy';

export interface AttachmentConfig {
  path: string;
  alias: string;
  strategy?: SchemaStrategy;
}

export interface AttachedBetterSqliteAdapterOptions {
  attachments: AttachmentConfig[];
}

/**
 * BetterSqlite3 adapter with database attachment support.
 * Extends AttachedSqliteAdapter to provide attachment functionality for better-sqlite3.
 */
export class AttachedBetterSqliteAdapter extends AttachedSqliteAdapter {
  constructor(dbPath: string, options?: AttachedBetterSqliteAdapterOptions, readonly?: boolean);
  
  /**
   * The underlying better-sqlite3 database instance
   */
  database: any; // better-sqlite3 Database type
  
  /**
   * Connect to the database and attach configured databases
   */
  connect(): Promise<void>;
  
  /**
   * Close the database connection
   */
  close(callback?: (error?: Error) => void): void;
}
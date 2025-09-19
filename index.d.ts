/**
 * @shaxpir/sharedb-storage-node-sqlite
 *
 * TypeScript definitions for Node.js SQLite adapters using better-sqlite3.
 * This is a standalone package providing database adapters only.
 */

// Import the interfaces (these are defined in lib/interfaces.d.ts)
import {
  SqliteAdapter,
  AttachedAdapter,
  AttachmentConfig,
  AttachedAdapterOptions
} from './lib/interfaces';

// Re-export the interfaces
export {
  SqliteAdapter,
  AttachedAdapter,
  AttachmentConfig,
  AttachedAdapterOptions
};

/**
 * Node.js SQLite adapter using better-sqlite3
 * Implements the SqliteAdapter interface
 */
export class BetterSqliteAdapter implements SqliteAdapter {
  constructor(dbPath: string, options?: {
    readonly?: boolean;
    fileMustExist?: boolean;
    timeout?: number;
    verbose?: (message?: any, ...args: any[]) => void;
    debug?: boolean;
    enableWAL?: boolean;
    maxRetries?: number;
    baseDelay?: number;
  });

  dbPath: string;
  options: any;
  debug: boolean;
  db: any; // better-sqlite3 Database instance

  connect(): Promise<void>;
  disconnect(): Promise<void>;
  runAsync(sql: string, params?: any[]): Promise<{ changes: number; lastInsertRowid?: number }>;
  getFirstAsync(sql: string, params?: any[]): Promise<any | null>;
  getAllAsync(sql: string, params?: any[]): Promise<any[]>;
  transaction<T>(fn: () => T): T;
}

/**
 * Node.js SQLite adapter with database attachment support
 * Extends BetterSqliteAdapter and implements AttachedAdapter interface
 */
export class AttachedBetterSqliteAdapter extends BetterSqliteAdapter implements AttachedAdapter {
  constructor(
    primaryDbPath: string,
    attachmentConfig: AttachedAdapterOptions,
    options?: any
  );

  attachmentConfig: AttachedAdapterOptions;
  attachments: Map<string, string>;

  attachDatabase(path: string, alias: string, createIfNotExists?: boolean): Promise<void>;
  detachDatabase(alias: string): Promise<void>;
  isAttached(alias: string): boolean;
  getAttachedAliases(): string[];
}

/**
 * Retry utilities for database operations
 */
export namespace RetryUtils {
  export function retryWithBackoff<T>(
    fn: () => T | Promise<T>,
    options?: {
      maxRetries?: number;
      baseDelay?: number;
      maxDelay?: number;
    }
  ): Promise<T>;
}

// Default export is BetterSqliteAdapter for convenience
export default BetterSqliteAdapter;
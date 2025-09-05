import { SqliteAdapter } from './sqlite-adapter';
import { SchemaStrategy } from '../schema/base-schema-strategy';

export interface DatabaseAttachment {
  path?: string;
  fileName?: string;
  dirPath?: string;
  alias: string;
  strategy?: SchemaStrategy;
}

/**
 * Base class for SQLite adapters with database attachment support.
 * Wraps an existing SqliteAdapter and adds ATTACH DATABASE functionality.
 */
export class AttachedSqliteAdapter extends SqliteAdapter {
  protected wrappedAdapter: SqliteAdapter;
  protected attachments: DatabaseAttachment[];
  protected attached: boolean;
  
  constructor(wrappedAdapter: SqliteAdapter, attachments: DatabaseAttachment[]);
  
  /**
   * Connect to the main database and attach additional databases
   */
  connect(): Promise<void>;
  
  /**
   * Attach a single database
   */
  protected attachSingleDatabase(attachment: DatabaseAttachment): Promise<void>;
  
  /**
   * Pre-initialize a database before attachment (creates tables and indexes)
   */
  protected preInitializeDatabase(attachment: DatabaseAttachment): Promise<void>;
  
  /**
   * Close the database connection
   */
  close(callback?: (error?: Error) => void): void;
  
  /**
   * Get a document
   */
  getDoc(collection: string, docId: string, callback: (error: Error | null, doc?: any) => void): void;
  
  /**
   * Save a document
   */
  saveDoc(collection: string, docId: string, data: any, callback: (error?: Error) => void): void;
  
  /**
   * Get documents in bulk
   */
  getBulkDocs(collection: string, docIds: string[], callback: (error: Error | null, docs?: any[]) => void): void;
  
  /**
   * Save documents in bulk
   */
  saveBulkDocs(collection: string, docs: any[], callback: (error?: Error) => void): void;
}
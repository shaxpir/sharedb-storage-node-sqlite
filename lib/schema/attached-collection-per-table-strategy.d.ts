import { CollectionPerTableStrategy } from './collection-per-table-strategy';

/**
 * Schema strategy that prefixes table names with an attachment alias.
 * Used for managing ShareDB collections in attached databases.
 */
export class AttachedCollectionPerTableStrategy extends CollectionPerTableStrategy {
  attachmentAlias: string | null;
  
  constructor(attachmentAlias?: string);
  
  /**
   * Get the table name for a collection, with optional attachment prefix
   */
  getTableName(collection: string): string;
  
  /**
   * Pre-initialize database with tables and indexes before attachment
   */
  static preInitializeDatabase(
    db: any,
    strategy: AttachedCollectionPerTableStrategy,
    callback?: (error?: Error) => void
  ): Promise<void>;
  
  /**
   * Create a table for a specific collection
   */
  createCollectionTable(db: any, collection: string): Promise<void>;
}
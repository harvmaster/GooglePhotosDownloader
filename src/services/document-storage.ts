import SQLite from 'better-sqlite3';
import {
  type JSONColumnType,
  Kysely,
  SqliteDialect,
  UpdateObject,
  Insertable,
} from 'kysely';

import type { ConfigService } from './config';

// For each key on T, we will create a column. If the key is an Object, it will be converted to a JSON column recursively.
export type ToDatabaseDocument<T> = {
  [K in keyof T]: T[K] extends object 
    ? T[K] extends Date 
      ? T[K] 
      : T[K] extends Array<infer U>
        ? JSONColumnType<Array<ToDatabaseDocument<U>>>
        : JSONColumnType<ToDatabaseDocument<T[K]>>
    : T[K];
};

// Convert a schema type into a Kysely database type by applying ToDatabaseDocument to each table
export type DatabaseSchema<T> = {
  [K in keyof T]: ToDatabaseDocument<T[K]>
};

export type StorageServiceDependencies = {
  configService: ConfigService;
}

export class DocumentStorageService<Schema extends Record<string, unknown>> {
  constructor(private readonly db: Kysely<DatabaseSchema<Schema>>) {}

  static create<Schema extends Record<string, unknown>>(dependencies: StorageServiceDependencies): DocumentStorageService<Schema> {
    const dialect = new SqliteDialect({
      database: new SQLite(dependencies.configService.config.STORAGE_PATH),
    })

    // Database interface is passed to Kysely's constructor, and from now on, Kysely 
    // knows your database structure.
    // Dialect is passed to Kysely's constructor, and from now on, Kysely knows how 
    // to communicate with your database.
    const db = new Kysely<DatabaseSchema<Schema>>({
      dialect,
    })

    return new DocumentStorageService<Schema>(db);
  }

  createTable<T extends keyof Schema & string>(
    table: T,
  ) {
    return this.db.schema.createTable(table)
      .addColumn('id', 'text', (column) => column.primaryKey())
  }

  /**
   * Save a record to the specified table
   * @template T - The table name
   * @param {T} table - The name of the table
   * @param {Insertable<DatabaseSchema<Schema>[T]>} record - The record to save
   */
  async save<T extends keyof Schema & string>(
    table: T,
    record: Insertable<DatabaseSchema<Schema>[T]>
  ) {
    await this.db.insertInto(table).values(record).onConflict((oc) => oc.doNothing()).execute();
  }

  /**
   * Update a record in the specified table
   * @template T - The table name
   * @param {T} table - The name of the table
   * @param {string} id - The ID of the record to update
   * @param {Partial<Schema[T]>} record - The record data to update
   */
  async update<T extends keyof Schema & string>(
    table: T,
    id: string,
    record: UpdateObject<DatabaseSchema<Schema>, T>
  ) {
    await (this.db.updateTable(table) as any)
      .set(record)
      .where('id', '=', id)
      .execute();
  }

  /**
   * Find a record by ID in the specified table
   * @template T - The table name
   * @param {T} table - The name of the table
   * @param {string} id - The ID of the record to find
   * @returns {Promise<Schema[T] | undefined>}
   */
  async findById<T extends keyof Schema & string>(
    table: T,
    id: string
  ): Promise<Schema[T] | undefined> {
    return await (this.db.selectFrom(table) as any)
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
  }

  async findAll<T extends keyof Schema & string>(
    table: T
  ): Promise<Schema[T][]> {
    return await (this.db.selectFrom(table) as any)
      .selectAll()
      .execute();
  }
}
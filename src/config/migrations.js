import { fileURLToPath } from 'node:url'

export const MIGRATIONS_DIR = fileURLToPath(
  new URL('../../migrations/', import.meta.url),
)

// Which migrations have run, one document per file.
export const MIGRATIONS_CHANGELOG_COLLECTION = 'migrations'

// Held while `up` or `down` runs; see scripts/migrate.js.
export const MIGRATIONS_LOCK_COLLECTION = 'migrations_lock'
export const MIGRATIONS_LOCK_TTL_SECONDS = 600

/**
 * Settings for migrate-mongo, built from the same environment as the API
 * rather than from its own config file, so a migration always runs against
 * the database the API uses.
 */
export function createMigrationConfig({ mongodbUri, mongodbDbName }) {
  return {
    mongodb: { url: mongodbUri, databaseName: mongodbDbName, options: {} },
    migrationsDir: MIGRATIONS_DIR,
    changelogCollectionName: MIGRATIONS_CHANGELOG_COLLECTION,
    // migrate-mongo's own lock starts an index build it never waits for,
    // which the closing connection then cuts off; scripts/migrate.js locks
    // instead.
    lockCollectionName: null,
    lockTtl: 0,
    migrationFileExtension: '.js',
    useFileHash: false,
    moduleSystem: 'esm',
  }
}

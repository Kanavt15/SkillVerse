/**
 * Every table in the database, exported from one place.
 * drizzle-kit reads this file to generate migrations; the API passes it to `drizzle()`.
 * New table files must be re-exported here or they will silently be skipped.
 */
export * from './identity';
export * from './platform';

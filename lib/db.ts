import { neon } from '@neondatabase/serverless';

// Retrieve the database URL from environment variables
const connectionString = process.env.DATABASE_URL || '';

/**
 * Safety flag to check if we have a valid connection string
 */
export const isDbConnected = connectionString.startsWith('postgres://') || connectionString.startsWith('postgresql://');

/**
 * SQL client instance for communicating with Vercel Postgres / Neon.
 * Falls back to a dummy function if the connection string is missing to prevent total app crash.
 */
export const sql = isDbConnected 
  ? neon(connectionString) 
  : async (...args: any[]) => {
      console.warn("Database connection skipped: DATABASE_URL is missing or invalid.");
      return [] as any[];
    };

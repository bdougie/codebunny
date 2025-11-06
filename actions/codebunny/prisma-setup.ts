import * as core from '@actions/core';
import { exec } from '@actions/exec';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface PrismaConfig {
  apiKey: string; // Kept for future use, not currently used
  connectionString: string;
  directUrl?: string; // Optional - will fall back to connectionString if not provided
}

/**
 * Setup Prisma database for review storage
 * Generates Prisma Client and pushes schema to database
 */
export class PrismaSetup {
  constructor(private config: PrismaConfig) {}

  /**
   * Initialize Prisma database and generate client
   * Returns connection string for use in PrismaStorage
   */
  async initialize(): Promise<{ connectionString: string; directUrl: string }> {
    try {
      core.info('🔧 Initializing Prisma database...');
      core.info('📝 Using provided connection strings');

      // Generate Prisma Client and push schema
      await this.generatePrismaClient(this.config.connectionString, this.config.directUrl);

      const resolvedDirectUrl = this.config.directUrl || this.config.connectionString;

      core.info('✅ Prisma database initialized successfully');
      return {
        connectionString: this.config.connectionString,
        directUrl: resolvedDirectUrl,
      };
    } catch (error) {
      core.error(`Failed to initialize Prisma database: ${error}`);
      throw error;
    }
  }

  /**
   * Generate Prisma Client and push schema to database
   */
  private async generatePrismaClient(connectionString: string, directUrl?: string): Promise<void> {
    try {
      core.info('📦 Generating Prisma Client...');

      // Set environment variables for Prisma
      process.env.DATABASE_URL = connectionString;
      process.env.DIRECT_DATABASE_URL = directUrl || connectionString;

      // Run prisma generate
      const prismaDir = path.join(__dirname, 'prisma');
      await exec('npx', ['prisma', 'generate', '--schema', path.join(prismaDir, 'schema.prisma')]);

      core.info('✅ Prisma Client generated');

      // Push schema to database (better for ephemeral GitHub Actions databases)
      core.info('🔄 Pushing schema to database...');
      await exec('npx', [
        'prisma',
        'db',
        'push',
        '--schema',
        path.join(prismaDir, 'schema.prisma'),
        '--accept-data-loss', // Safe for ephemeral databases
        '--skip-generate', // Already generated above
      ]);

      core.info('✅ Database schema pushed successfully');
    } catch (error) {
      core.error(`Failed to generate Prisma Client: ${error}`);
      throw error;
    }
  }

}

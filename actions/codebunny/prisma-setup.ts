import * as core from '@actions/core';
import { exec } from '@actions/exec';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface PrismaConfig {
  apiKey: string;
  databaseId?: string;
  connectionString?: string;
  directUrl?: string;
}

/**
 * Setup Prisma database for review storage
 * Uses Prisma Platform API for auto-setup when MCP tools are available
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

      // If connection string is provided, use it directly
      if (this.config.connectionString && this.config.directUrl) {
        core.info('📝 Using provided connection string');
        await this.generatePrismaClient(this.config.connectionString, this.config.directUrl);
        return {
          connectionString: this.config.connectionString,
          directUrl: this.config.directUrl,
        };
      }

      // Auto-setup using Prisma Platform API
      const { connectionString, directUrl } = await this.autoSetupDatabase();

      // Generate Prisma Client
      await this.generatePrismaClient(connectionString, directUrl);

      core.info('✅ Prisma database initialized successfully');
      return { connectionString, directUrl };
    } catch (error) {
      core.error(`Failed to initialize Prisma database: ${error}`);
      throw error;
    }
  }

  /**
   * Auto-setup database using Prisma Platform API
   * This would use MCP tools when available: ListDatabasesTool, CreateDatabaseTool, CreateConnectionStringTool
   */
  private async autoSetupDatabase(): Promise<{ connectionString: string; directUrl: string }> {
    core.info('🚀 Setting up database via Prisma Platform API...');

    // If database ID is provided, use it
    if (this.config.databaseId) {
      core.info(`📦 Using existing database ID: ${this.config.databaseId}`);
      return await this.getConnectionStrings(this.config.databaseId);
    }

    // Create new database using Prisma Platform API
    const databaseId = await this.createDatabase();
    core.info(`✅ Created new database: ${databaseId}`);

    return await this.getConnectionStrings(databaseId);
  }

  /**
   * Create a new Prisma Postgres database
   * Uses Prisma Platform API
   */
  private async createDatabase(): Promise<string> {
    try {
      // Use Prisma Platform API to create database
      // This is a placeholder for MCP tool usage when available
      // For now, we'll use Prisma CLI with API key authentication

      core.info('Creating new Prisma Postgres database...');

      // The actual implementation would use MCP CreateDatabaseTool here
      // For now, users need to create database manually via Prisma Platform
      throw new Error(
        'Automatic database creation not yet implemented. Please create a database in Prisma Platform and provide the database ID via prisma-database-id input.'
      );
    } catch (error) {
      core.error(`Failed to create database: ${error}`);
      throw error;
    }
  }

  /**
   * Get connection strings for an existing database
   * Uses Prisma Platform API
   */
  private async getConnectionStrings(
    databaseId: string
  ): Promise<{ connectionString: string; directUrl: string }> {
    try {
      core.info(`Fetching connection strings for database ${databaseId}...`);

      // The actual implementation would use MCP CreateConnectionStringTool here
      // For now, users need to provide connection strings manually

      // Placeholder: In a real implementation, this would call Prisma Platform API
      // to get pooled and direct connection strings

      throw new Error(
        'Automatic connection string retrieval not yet implemented. Please provide connection strings via environment variables: DATABASE_URL and DIRECT_DATABASE_URL'
      );
    } catch (error) {
      core.error(`Failed to get connection strings: ${error}`);
      throw error;
    }
  }

  /**
   * Generate Prisma Client with provided connection strings
   */
  private async generatePrismaClient(connectionString: string, directUrl: string): Promise<void> {
    try {
      core.info('📦 Generating Prisma Client...');

      // Set environment variables for Prisma
      process.env.DATABASE_URL = connectionString;
      process.env.DIRECT_DATABASE_URL = directUrl;

      // Run prisma generate
      const prismaDir = path.join(__dirname, 'prisma');
      await exec('npx', ['prisma', 'generate', '--schema', path.join(prismaDir, 'schema.prisma')]);

      core.info('✅ Prisma Client generated');

      // Run migrations
      core.info('🔄 Running database migrations...');
      await exec('npx', [
        'prisma',
        'migrate',
        'deploy',
        '--schema',
        path.join(prismaDir, 'schema.prisma'),
      ]);

      core.info('✅ Database migrations completed');
    } catch (error) {
      core.error(`Failed to generate Prisma Client: ${error}`);
      throw error;
    }
  }

  /**
   * Validate Prisma configuration
   */
  static validateConfig(
    enablePrismaStorage: string,
    prismaApiKey?: string,
    prismaDatabaseId?: string,
    databaseUrl?: string,
    directDatabaseUrl?: string
  ): PrismaConfig | null {
    // Return null if Prisma storage is not enabled
    if (enablePrismaStorage !== 'true') {
      return null;
    }

    // If connection strings are provided, use them
    if (databaseUrl && directDatabaseUrl) {
      core.info('✅ Using provided database connection strings');
      return {
        apiKey: '', // Not needed when connection strings are provided
        connectionString: databaseUrl,
        directUrl: directDatabaseUrl,
      };
    }

    // Otherwise, require API key for auto-setup
    if (!prismaApiKey) {
      throw new Error(
        'Prisma storage is enabled but prisma-api-key is not provided. ' +
          'Either provide prisma-api-key for auto-setup or provide DATABASE_URL and DIRECT_DATABASE_URL environment variables.'
      );
    }

    return {
      apiKey: prismaApiKey,
      databaseId: prismaDatabaseId,
    };
  }
}

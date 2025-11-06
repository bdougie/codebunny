/**
 * Turso setup and initialization
 * 
 * This module handles the setup and configuration of Turso storage.
 * It supports three modes:
 * 1. Local-only: Embedded SQLite database in .contributor/reviews.db
 * 2. Embedded replica: Local database with remote sync to Turso cloud
 * 3. Remote-only: Direct connection to Turso cloud
 */

import * as core from '@actions/core';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  TursoStorage,
  createLocalTursoStorage,
  createSyncedTursoStorage,
  createRemoteTursoStorage,
} from './storage/turso-storage';

export interface TursoSetupConfig {
  mode: 'local' | 'synced' | 'remote';
  url?: string;
  authToken?: string;
}

/**
 * Validate Turso configuration from environment
 */
export function validateTursoConfig(): TursoSetupConfig | null {
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoAuthToken = process.env.TURSO_AUTH_TOKEN;

  // If no Turso config, return null (will use file storage)
  if (!tursoUrl && !tursoAuthToken) {
    return null;
  }

  // Determine mode based on URL
  if (tursoUrl && tursoUrl.startsWith('libsql://')) {
    // Remote or synced mode
    if (!tursoAuthToken) {
      core.warning('TURSO_DATABASE_URL is set but TURSO_AUTH_TOKEN is missing');
      return null;
    }

    return {
      mode: 'synced', // Use embedded replica by default for better performance
      url: tursoUrl,
      authToken: tursoAuthToken,
    };
  }

  // Default to local-only mode
  return {
    mode: 'local',
  };
}

/**
 * Initialize Turso storage based on configuration
 */
export async function initializeTursoStorage(config: TursoSetupConfig): Promise<TursoStorage> {
  core.info(`🔧 Initializing Turso storage (mode: ${config.mode})...`);

  let storage: TursoStorage;

  switch (config.mode) {
    case 'local':
      core.info('📦 Using local-only Turso storage (.contributor/reviews.db)');
      storage = createLocalTursoStorage();
      break;

    case 'synced':
      if (!config.url || !config.authToken) {
        throw new Error('Synced mode requires both url and authToken');
      }
      core.info('🔄 Using synced Turso storage (local + remote sync)');
      storage = createSyncedTursoStorage(config.url, config.authToken);
      break;

    case 'remote':
      if (!config.url || !config.authToken) {
        throw new Error('Remote mode requires both url and authToken');
      }
      core.info('☁️ Using remote-only Turso storage');
      storage = createRemoteTursoStorage(config.url, config.authToken);
      break;

    default:
      throw new Error(`Unknown Turso mode: ${config.mode}`);
  }

  // Initialize the storage
  await storage.initialize();

  // Run health check
  const healthy = await storage.healthCheck();
  if (!healthy) {
    throw new Error('Turso storage health check failed');
  }

  core.info('✅ Turso storage initialized and healthy');
  return storage;
}

/**
 * Display Turso setup instructions
 */
export function displayTursoSetupInstructions(): void {
  core.info(`
╔════════════════════════════════════════════════════════════════════╗
║                   Turso Storage Setup Guide                        ║
╚════════════════════════════════════════════════════════════════════╝

Turso provides SQLite at the edge with optional cloud sync.

┌────────────────────────────────────────────────────────────────────┐
│ Option 1: Local-Only Mode (Zero Setup)                            │
└────────────────────────────────────────────────────────────────────┘
No environment variables needed! Turso will automatically use a local
SQLite database at .contributor/reviews.db

✅ Unlimited review history
✅ Zero cost
✅ No cloud dependencies
✅ Perfect for single-repo use

┌────────────────────────────────────────────────────────────────────┐
│ Option 2: Synced Mode (Local + Cloud) - Recommended               │
└────────────────────────────────────────────────────────────────────┘

1. Install Turso CLI:
   curl -sSfL https://get.tur.so/install.sh | bash

2. Create a Turso account:
   turso auth signup

3. Create a database:
   turso db create codebunny-reviews

4. Get your database URL:
   turso db show codebunny-reviews --url

5. Create an auth token:
   turso db tokens create codebunny-reviews

6. Add to GitHub Secrets:
   - TURSO_DATABASE_URL: libsql://your-db.turso.io
   - TURSO_AUTH_TOKEN: your-auth-token

7. Enable in workflow:
   with:
     enable-turso-storage: 'true'
   env:
     TURSO_DATABASE_URL: \${{ secrets.TURSO_DATABASE_URL }}
     TURSO_AUTH_TOKEN: \${{ secrets.TURSO_AUTH_TOKEN }}

✅ Local-first performance
✅ Automatic cloud sync
✅ Team collaboration
✅ Cross-repo analytics
✅ Generous free tier (500 databases, 9 GB total)

┌────────────────────────────────────────────────────────────────────┐
│ More Information                                                   │
└────────────────────────────────────────────────────────────────────┘

Turso Docs: https://docs.turso.tech
Pricing: https://turso.tech/pricing (Free tier available)
  `);
}

/**
 * Check if .contributor directory exists and is writable
 */
export async function checkContributorDirectory(): Promise<boolean> {
  try {
    const contributorDir = path.join(process.cwd(), '.contributor');
    await fs.mkdir(contributorDir, { recursive: true });
    
    // Test write access
    const testFile = path.join(contributorDir, '.turso-test');
    await fs.writeFile(testFile, 'test');
    await fs.unlink(testFile);
    
    return true;
  } catch (error) {
    core.error(`Failed to access .contributor directory: ${error}`);
    return false;
  }
}

/**
 * Migrate from file storage to Turso (if needed)
 */
export async function migrateFromFileStorage(storage: TursoStorage): Promise<void> {
  try {
    const fileStoragePath = path.join(process.cwd(), '.contributor', 'review-data.json');
    
    // Check if file storage exists
    try {
      await fs.access(fileStoragePath);
    } catch {
      // No file storage to migrate
      return;
    }

    core.info('📦 Found existing file storage, migrating to Turso...');

    const content = await fs.readFile(fileStoragePath, 'utf-8');
    const fileData = JSON.parse(content) as Record<string, any>;

    let migratedCount = 0;

    for (const [repository, data] of Object.entries(fileData)) {
      const reviews = data.reviews || [];
      
      for (const review of reviews) {
        try {
          await storage.saveReview(repository, review);
          migratedCount++;
        } catch (error) {
          core.warning(`Failed to migrate review: ${error}`);
        }
      }
    }

    core.info(`✅ Migrated ${migratedCount} reviews from file storage to Turso`);

    // Backup old file storage
    const backupPath = `${fileStoragePath}.backup`;
    await fs.rename(fileStoragePath, backupPath);
    core.info(`📦 Backed up file storage to ${backupPath}`);

  } catch (error) {
    core.warning(`Failed to migrate from file storage: ${error}`);
  }
}

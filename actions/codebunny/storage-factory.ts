/**
 * Storage factory for creating storage instances
 * 
 * This module provides a factory pattern for creating storage instances
 * based on configuration. It handles graceful fallback to file storage
 * if Turso initialization fails.
 */

import * as core from '@actions/core';
import { IReviewStorage } from './storage/storage-interface';
import { FileStorage } from './storage/file-storage';
import { TursoStorage, createLocalTursoStorage } from './storage/turso-storage';
import {
  validateTursoConfig,
  initializeTursoStorage,
  checkContributorDirectory,
  migrateFromFileStorage,
} from './turso-setup';

/**
 * Create a storage instance based on configuration
 * 
 * Priority:
 * 1. Turso storage (if enabled and configured)
 * 2. File storage (default fallback)
 */
export async function createStorage(): Promise<IReviewStorage> {
  const enableTursoStorage = 
    process.env.INPUT_ENABLE_TURSO_STORAGE === 'true' || 
    core.getInput('enable-turso-storage') === 'true';

  // Check if .contributor directory is accessible
  const dirAccessible = await checkContributorDirectory();
  if (!dirAccessible) {
    core.warning('⚠️ .contributor directory is not accessible, falling back to file storage');
    return createFileStorage();
  }

  // Try Turso storage if enabled
  if (enableTursoStorage) {
    core.info('📊 Turso storage is enabled, initializing...');

    try {
      // Validate Turso configuration
      const tursoConfig = validateTursoConfig();

      if (tursoConfig) {
        // Initialize Turso storage
        const storage = await initializeTursoStorage(tursoConfig);

        // Migrate from file storage if needed
        await migrateFromFileStorage(storage);

        core.info('✅ Using Turso storage for unlimited review history');
        return storage;
      } else {
        // No Turso config provided, use local-only mode
        core.info('📦 No Turso credentials provided, using local SQLite mode');
        const storage = createLocalTursoStorage();
        await storage.initialize();

        // Migrate from file storage if needed
        await migrateFromFileStorage(storage);

        core.info('✅ Using local Turso storage (.contributor/reviews.db)');
        return storage;
      }
    } catch (error) {
      core.warning(`⚠️ Failed to initialize Turso storage: ${error}`);
      core.warning('Falling back to file storage');
    }
  }

  // Default: Use file storage
  return createFileStorage();
}

/**
 * Create file storage instance
 */
async function createFileStorage(): Promise<IReviewStorage> {
  const storage = new FileStorage();
  await storage.initialize();
  core.info('✅ Using file storage (.contributor/review-data.json)');
  core.info('💡 Tip: Enable Turso storage for unlimited review history!');
  return storage;
}

/**
 * Get storage mode description for logging
 */
export function getStorageDescription(storage: IReviewStorage): string {
  if (storage instanceof TursoStorage) {
    return 'Turso SQLite (unlimited history)';
  } else if (storage instanceof FileStorage) {
    return 'File storage (100 reviews limit)';
  } else {
    return 'Unknown storage';
  }
}

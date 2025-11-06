/**
 * Turso (libSQL) storage implementation
 * 
 * Stores review data in Turso database (SQLite-compatible edge database).
 * Turso can run as an embedded database (local .contributor/reviews.db file)
 * or sync to a remote Turso instance for team collaboration.
 * 
 * Benefits:
 * - Unlimited review history (no 100-review cap)
 * - SQLite reliability and performance
 * - Local-first with optional cloud sync
 * - Team analytics and cross-PR insights
 * - Zero-cost local mode
 */

import * as core from '@actions/core';
import { createClient, Client } from '@libsql/client';
import * as path from 'path';
import {
  IReviewStorage,
  ReviewSnapshot,
  ApprovalTransition,
  StorageStats,
} from './storage-interface';

export interface TursoConfig {
  url: string;
  authToken?: string;
  syncUrl?: string;
  syncInterval?: number;
}

export class TursoStorage implements IReviewStorage {
  private client: Client | null = null;
  private config: TursoConfig;
  private initialized = false;

  constructor(config: TursoConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    try {
      core.info('🔧 Initializing Turso storage...');

      // Create Turso client
      const clientConfig: any = {
        url: this.config.url,
      };

      // Add auth token if provided (for remote sync)
      if (this.config.authToken) {
        clientConfig.authToken = this.config.authToken;
        core.info('🔐 Using authenticated connection to Turso');
      }

      // Add sync URL for embedded replicas
      if (this.config.syncUrl) {
        clientConfig.syncUrl = this.config.syncUrl;
        clientConfig.syncInterval = this.config.syncInterval || 60;
        core.info(`🔄 Embedded replica sync enabled: ${this.config.syncUrl}`);
      }

      this.client = createClient(clientConfig);

      // Create tables if they don't exist
      await this.createTables();

      this.initialized = true;
      core.info('✅ Turso storage initialized successfully');
    } catch (error) {
      core.error(`Failed to initialize Turso storage: ${error}`);
      throw error;
    }
  }

  private async createTables(): Promise<void> {
    if (!this.client) {
      throw new Error('Turso client not initialized');
    }

    // Create ReviewSnapshot table
    await this.client.execute(`
      CREATE TABLE IF NOT EXISTS ReviewSnapshot (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        repository TEXT NOT NULL,
        prNumber INTEGER NOT NULL,
        prTitle TEXT NOT NULL,
        prAuthor TEXT NOT NULL,
        filesChanged INTEGER NOT NULL,
        reviewState TEXT NOT NULL,
        reviewText TEXT NOT NULL,
        processingTime INTEGER NOT NULL,
        issuesHigh INTEGER NOT NULL,
        issuesMedium INTEGER NOT NULL,
        issuesLow INTEGER NOT NULL,
        rulesApplied INTEGER NOT NULL,
        patternsDetected INTEGER NOT NULL,
        codebunnyMentioned INTEGER NOT NULL,
        commentId INTEGER,
        createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes for common queries
    await this.client.execute(`
      CREATE INDEX IF NOT EXISTS idx_review_repo_pr 
      ON ReviewSnapshot(repository, prNumber)
    `);

    await this.client.execute(`
      CREATE INDEX IF NOT EXISTS idx_review_timestamp 
      ON ReviewSnapshot(timestamp)
    `);

    // Create ApprovalTransition table
    await this.client.execute(`
      CREATE TABLE IF NOT EXISTS ApprovalTransition (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        repository TEXT NOT NULL,
        prNumber INTEGER NOT NULL,
        fromState TEXT NOT NULL,
        toState TEXT NOT NULL,
        triggerType TEXT NOT NULL,
        createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create index for transitions
    await this.client.execute(`
      CREATE INDEX IF NOT EXISTS idx_transition_repo_pr 
      ON ApprovalTransition(repository, prNumber)
    `);

    core.info('📊 Database tables created/verified');
  }

  async saveReview(repository: string, snapshot: ReviewSnapshot): Promise<void> {
    if (!this.client) {
      throw new Error('Turso storage not initialized');
    }

    try {
      await this.client.execute({
        sql: `
          INSERT INTO ReviewSnapshot (
            timestamp, repository, prNumber, prTitle, prAuthor, filesChanged,
            reviewState, reviewText, processingTime, issuesHigh, issuesMedium,
            issuesLow, rulesApplied, patternsDetected, codebunnyMentioned, commentId
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        args: [
          snapshot.timestamp,
          repository,
          snapshot.prNumber,
          snapshot.prTitle,
          snapshot.prAuthor,
          snapshot.filesChanged,
          snapshot.reviewState,
          snapshot.reviewText,
          snapshot.metrics.processingTime,
          snapshot.metrics.issuesFound.high,
          snapshot.metrics.issuesFound.medium,
          snapshot.metrics.issuesFound.low,
          snapshot.metrics.rulesApplied,
          snapshot.metrics.patternsDetected,
          snapshot.codebunnyMentioned ? 1 : 0,
          snapshot.commentId || null,
        ],
      });

      // Sync if using embedded replica
      if (this.config.syncUrl && 'sync' in this.client) {
        await (this.client as any).sync();
        core.info('🔄 Synced to remote Turso instance');
      }

      core.info(`✅ Saved review for PR #${snapshot.prNumber} to Turso`);
    } catch (error) {
      core.error(`Failed to save review to Turso: ${error}`);
      throw error;
    }
  }

  async getReviewHistory(repository: string, prNumber: number): Promise<ReviewSnapshot[]> {
    if (!this.client) {
      throw new Error('Turso storage not initialized');
    }

    try {
      const result = await this.client.execute({
        sql: `
          SELECT * FROM ReviewSnapshot 
          WHERE repository = ? AND prNumber = ?
          ORDER BY timestamp ASC
        `,
        args: [repository, prNumber],
      });

      return result.rows.map((row: any) => this.rowToSnapshot(row));
    } catch (error) {
      core.error(`Failed to get review history from Turso: ${error}`);
      return [];
    }
  }

  async saveApprovalTransition(transition: ApprovalTransition): Promise<void> {
    if (!this.client) {
      throw new Error('Turso storage not initialized');
    }

    try {
      await this.client.execute({
        sql: `
          INSERT INTO ApprovalTransition (
            timestamp, repository, prNumber, fromState, toState, triggerType
          ) VALUES (?, ?, ?, ?, ?, ?)
        `,
        args: [
          transition.timestamp,
          transition.repository,
          transition.prNumber,
          transition.fromState,
          transition.toState,
          transition.triggerType,
        ],
      });

      // Sync if using embedded replica
      if (this.config.syncUrl && 'sync' in this.client) {
        await (this.client as any).sync();
      }
    } catch (error) {
      core.warning(`Failed to save approval transition to Turso: ${error}`);
    }
  }

  async getApprovalTransitions(repository: string, prNumber: number): Promise<ApprovalTransition[]> {
    if (!this.client) {
      throw new Error('Turso storage not initialized');
    }

    try {
      const result = await this.client.execute({
        sql: `
          SELECT * FROM ApprovalTransition 
          WHERE repository = ? AND prNumber = ?
          ORDER BY timestamp ASC
        `,
        args: [repository, prNumber],
      });

      return result.rows.map((row: any) => ({
        timestamp: row.timestamp as string,
        repository: row.repository as string,
        prNumber: row.prNumber as number,
        fromState: row.fromState as string,
        toState: row.toState as string,
        triggerType: row.triggerType as 'REVIEW' | 'MENTION' | 'COMMIT',
      }));
    } catch (error) {
      core.warning(`Failed to get approval transitions from Turso: ${error}`);
      return [];
    }
  }

  async getStats(repository: string): Promise<StorageStats> {
    if (!this.client) {
      throw new Error('Turso storage not initialized');
    }

    try {
      // Get total reviews
      const countResult = await this.client.execute({
        sql: 'SELECT COUNT(*) as total FROM ReviewSnapshot WHERE repository = ?',
        args: [repository],
      });
      const totalReviews = countResult.rows[0]?.total as number || 0;

      // Get date range
      const dateResult = await this.client.execute({
        sql: `
          SELECT 
            MIN(timestamp) as oldest,
            MAX(timestamp) as newest
          FROM ReviewSnapshot 
          WHERE repository = ?
        `,
        args: [repository],
      });

      // Get approval rate
      const approvalResult = await this.client.execute({
        sql: `
          SELECT 
            COUNT(CASE WHEN reviewState = 'MERGE' THEN 1 END) as approved,
            COUNT(*) as total
          FROM ReviewSnapshot 
          WHERE repository = ?
        `,
        args: [repository],
      });

      const approvedCount = approvalResult.rows[0]?.approved as number || 0;
      const totalCount = approvalResult.rows[0]?.total as number || 0;

      return {
        totalReviews,
        totalRepositories: 1,
        oldestReview: dateResult.rows[0]?.oldest as string || null,
        newestReview: dateResult.rows[0]?.newest as string || null,
        approvalRate: totalCount > 0 ? approvedCount / totalCount : 0,
      };
    } catch (error) {
      core.warning(`Failed to get stats from Turso: ${error}`);
      return {
        totalReviews: 0,
        totalRepositories: 1,
        oldestReview: null,
        newestReview: null,
        approvalRate: 0,
      };
    }
  }

  async getAllReviews(repository: string, limit?: number): Promise<ReviewSnapshot[]> {
    if (!this.client) {
      throw new Error('Turso storage not initialized');
    }

    try {
      const sql = limit
        ? `SELECT * FROM ReviewSnapshot WHERE repository = ? ORDER BY timestamp DESC LIMIT ?`
        : `SELECT * FROM ReviewSnapshot WHERE repository = ? ORDER BY timestamp DESC`;

      const args = limit ? [repository, limit] : [repository];

      const result = await this.client.execute({ sql, args });

      return result.rows.map((row: any) => this.rowToSnapshot(row));
    } catch (error) {
      core.warning(`Failed to get all reviews from Turso: ${error}`);
      return [];
    }
  }

  async healthCheck(): Promise<boolean> {
    if (!this.client) {
      return false;
    }

    try {
      await this.client.execute('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Run a set of operations in a transaction for atomicity
   */
  async runInTransaction<T>(fn: () => Promise<T>): Promise<T> {
    if (!this.client) {
      throw new Error('Turso storage not initialized');
    }
    // Use explicit BEGIN/COMMIT/ROLLBACK to avoid relying on client-specific APIs
    await this.client.execute('BEGIN');
    try {
      const result = await fn();
      await this.client.execute('COMMIT');
      // If using embedded replica with sync, sync after commit
      if (this.config.syncUrl && 'sync' in this.client) {
        await (this.client as any).sync();
      }
      return result;
    } catch (err) {
      try { await this.client.execute('ROLLBACK'); } catch {}
      throw err;
    }
  }

  private rowToSnapshot(row: any): ReviewSnapshot {
    return {
      timestamp: row.timestamp as string,
      prNumber: row.prNumber as number,
      prTitle: row.prTitle as string,
      prAuthor: row.prAuthor as string,
      filesChanged: row.filesChanged as number,
      reviewState: row.reviewState as ReviewSnapshot['reviewState'],
      reviewText: row.reviewText as string,
      metrics: {
        processingTime: row.processingTime as number,
        issuesFound: {
          high: row.issuesHigh as number,
          medium: row.issuesMedium as number,
          low: row.issuesLow as number,
        },
        rulesApplied: row.rulesApplied as number,
        patternsDetected: row.patternsDetected as number,
      },
      codebunnyMentioned: row.codebunnyMentioned === 1,
      commentId: row.commentId as number | undefined,
    };
  }

  /**
   * Close the database connection
   */
  async close(): Promise<void> {
    if (this.client) {
      // libSQL client doesn't have explicit close, but we can null it out
      this.client = null;
      this.initialized = false;
    }
  }
}

/**
 * Create a local-first Turso storage (embedded database in .contributor folder)
 */
export function createLocalTursoStorage(): TursoStorage {
  const dbPath = path.join(process.cwd(), '.contributor', 'reviews.db');
  return new TursoStorage({
    url: `file:${dbPath}`,
  });
}

/**
 * Create a Turso storage with remote sync (embedded replica)
 */
export function createSyncedTursoStorage(syncUrl: string, authToken: string): TursoStorage {
  const dbPath = path.join(process.cwd(), '.contributor', 'reviews.db');
  return new TursoStorage({
    url: `file:${dbPath}`,
    authToken,
    syncUrl,
    syncInterval: 60, // Sync every 60 seconds
  });
}

/**
 * Create a remote-only Turso storage
 */
export function createRemoteTursoStorage(url: string, authToken: string): TursoStorage {
  return new TursoStorage({
    url,
    authToken,
  });
}

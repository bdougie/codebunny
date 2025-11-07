/**
 * Storage abstraction interface for review data
 * 
 * This interface allows CodeBunny to support multiple storage backends:
 * - File storage (default, local .contributor folder)
 * - Turso storage (opt-in, unlimited history with SQLite)
 */

export interface ReviewSnapshot {
  timestamp: string;
  prNumber: number;
  prTitle: string;
  prAuthor: string;
  filesChanged: number;
  reviewState: 'MERGE' | 'DONT_MERGE' | 'MERGE_AFTER_CHANGES' | 'UNKNOWN';
  reviewText: string;
  metrics: {
    processingTime: number;
    issuesFound: { high: number; medium: number; low: number };
    rulesApplied: number;
    patternsDetected: number;
  };
  codebunnyMentioned: boolean;
  commentId?: number;
}

export interface ApprovalTransition {
  timestamp: string;
  prNumber: number;
  repository: string;
  fromState: string;
  toState: string;
  triggerType: 'REVIEW' | 'MENTION' | 'COMMIT';
}

export interface ReviewHistory {
  prNumber: number;
  prTitle: string;
  prAuthor: string;
  firstReviewAt: string;
  lastReviewAt: string;
  snapshots: ReviewSnapshot[];
  approvalChanges: number;
  codebunnyMentions: number;
}

export interface StorageStats {
  totalReviews: number;
  totalRepositories: number;
  oldestReview: string | null;
  newestReview: string | null;
  approvalRate: number;
}

/**
 * Abstract storage interface that all storage implementations must follow
 */
export interface IReviewStorage {
  /**
   * Initialize the storage backend
   */
  initialize(): Promise<void>;

  /**
   * Save a review snapshot
   */
  saveReview(repository: string, snapshot: ReviewSnapshot): Promise<void>;

  /**
   * Get review history for a specific PR
   */
  getReviewHistory(repository: string, prNumber: number): Promise<ReviewSnapshot[]>;

  /**
   * Save an approval state transition
   */
  saveApprovalTransition(transition: ApprovalTransition): Promise<void>;

  /**
   * Get approval transitions for a PR
   */
  getApprovalTransitions(repository: string, prNumber: number): Promise<ApprovalTransition[]>;

  /**
   * Get storage statistics
   */
  getStats(repository: string): Promise<StorageStats>;

  /**
   * Get all reviews for a repository (with optional limit)
   */
  getAllReviews(repository: string, limit?: number): Promise<ReviewSnapshot[]>;

  /**
   * Cleanup old reviews (for storage implementations with limits)
   */
  cleanup?(repository: string, keepLast: number): Promise<void>;

  /**
   * Health check for storage backend
   */
  healthCheck(): Promise<boolean>;
}

/**
 * Storage mode configuration
 */
export type StorageMode = 'file' | 'turso';

export interface StorageConfig {
  mode: StorageMode;
  turso?: {
    url: string;
    authToken: string;
    syncUrl?: string;
  };
}

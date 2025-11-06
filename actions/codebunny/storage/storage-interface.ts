/**
 * Unified ReviewSnapshot interface combining ReviewMetrics and ReviewSnapshot
 * This is the canonical data structure for all storage providers
 */
export interface ReviewSnapshot {
  // Identification
  timestamp: string;
  repository: string;
  prNumber: number;
  prTitle: string;
  prAuthor: string;
  filesChanged: number;
  reviewerId: string; // Continue assistant identifier

  // Review state tracking
  reviewState: 'MERGE' | 'DONT_MERGE' | 'MERGE_AFTER_CHANGES' | 'UNKNOWN';
  reviewText: string;
  codebunnyMentioned: boolean;
  commentId?: number;

  // Metrics
  metrics: {
    promptLength: number;
    responseLength: number;
    processingTime: number;
    rulesApplied: number;
    patternsDetected: number;
    issuesFound: {
      high: number;
      medium: number;
      low: number;
    };
  };

  // Context
  context: {
    hasCustomCommand: boolean;
    projectType: string;
    mainLanguages: string[];
  };
}

/**
 * Review quality tracking with effectiveness data
 */
export interface ReviewQualityTracking {
  reviewId: string;
  snapshot: ReviewSnapshot;
  effectiveness?: {
    implementedSuggestions: number;
    totalSuggestions: number;
    developerFeedback?: 'positive' | 'negative' | 'neutral';
    followUpRequired: boolean;
  };
}

/**
 * Insights data aggregated from review history
 */
export interface InsightsData {
  totalReviews: number;
  averageProcessingTime: number;
  averageIssuesFound: number;
  effectivenessRate: number;
  commonPatterns: string[];
}

/**
 * Approval state transition record
 */
export interface ApprovalTransition {
  timestamp: string;
  repository: string;
  prNumber: number;
  fromState: ReviewSnapshot['reviewState'];
  toState: ReviewSnapshot['reviewState'];
  reviewId: string;
}

/**
 * Abstract storage interface for review data
 * Implementations: FileStorage, PrismaStorage
 */
export interface IReviewStorage {
  /**
   * Record a new review snapshot
   * @returns reviewId - Unique identifier for the review
   */
  recordReviewMetrics(snapshot: ReviewSnapshot): Promise<string>;

  /**
   * Update the effectiveness data for an existing review
   */
  updateReviewEffectiveness(
    reviewId: string,
    effectiveness: ReviewQualityTracking['effectiveness']
  ): Promise<void>;

  /**
   * Get aggregated insights from review history
   */
  getReviewInsights(repository?: string): Promise<InsightsData>;

  /**
   * Load all review metrics (optionally filtered by repository)
   */
  loadMetrics(repository?: string): Promise<ReviewQualityTracking[]>;

  /**
   * Get review history for a specific PR
   */
  getPRHistory(repository: string, prNumber: number): Promise<ReviewSnapshot[]>;

  /**
   * Get approval transitions for a specific PR
   */
  getApprovalTransitions(repository: string, prNumber: number): Promise<ApprovalTransition[]>;

  /**
   * Record an approval state transition
   */
  recordApprovalTransition(transition: ApprovalTransition): Promise<void>;
}

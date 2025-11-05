import * as core from '@actions/core';
import { PrismaClient } from '@prisma/client';
import {
  IReviewStorage,
  ReviewSnapshot,
  ReviewQualityTracking,
  InsightsData,
  ApprovalTransition,
} from './storage-interface';

/**
 * Prisma-based storage implementation using Postgres
 * Provides unlimited review history with advanced analytics capabilities
 */
export class PrismaStorage implements IReviewStorage {
  private prisma: PrismaClient;

  constructor(connectionString: string, directUrl: string) {
    // Initialize Prisma Client with connection pooling for serverless
    this.prisma = new PrismaClient({
      datasources: {
        db: {
          url: connectionString,
        },
      },
    });

    core.info('✅ Prisma storage initialized with connection pooling');
  }

  async recordReviewMetrics(snapshot: ReviewSnapshot): Promise<string> {
    try {
      const reviewId = this.generateReviewId(snapshot);

      // Store review snapshot in database
      await this.prisma.reviewSnapshot.create({
        data: {
          timestamp: snapshot.timestamp,
          repository: snapshot.repository,
          prNumber: snapshot.prNumber,
          prTitle: snapshot.prTitle,
          prAuthor: snapshot.prAuthor,
          filesChanged: snapshot.filesChanged,
          reviewerId: snapshot.reviewerId,
          reviewState: snapshot.reviewState,
          reviewText: snapshot.reviewText,
          codebunnyMentioned: snapshot.codebunnyMentioned,
          commentId: snapshot.commentId,
          promptLength: snapshot.metrics.promptLength,
          responseLength: snapshot.metrics.responseLength,
          processingTime: snapshot.metrics.processingTime,
          rulesApplied: snapshot.metrics.rulesApplied,
          patternsDetected: snapshot.metrics.patternsDetected,
          issuesHigh: snapshot.metrics.issuesFound.high,
          issuesMedium: snapshot.metrics.issuesFound.medium,
          issuesLow: snapshot.metrics.issuesFound.low,
          hasCustomCommand: snapshot.context.hasCustomCommand,
          projectType: snapshot.context.projectType,
          mainLanguages: snapshot.context.mainLanguages,
        },
      });

      // Check for approval state transition
      await this.checkAndRecordApprovalTransition(snapshot, reviewId);

      core.info(`💾 Recorded review to Prisma database with ID: ${reviewId}`);
      return reviewId;
    } catch (error) {
      core.error(`Failed to record review to Prisma: ${error}`);
      throw error;
    }
  }

  async updateReviewEffectiveness(
    reviewId: string,
    effectiveness: ReviewQualityTracking['effectiveness']
  ): Promise<void> {
    try {
      if (!effectiveness) return;

      // Find review by timestamp pattern (reviewId contains timestamp)
      // This is a simplified approach - in production you might want to store reviewId
      const reviews = await this.prisma.reviewSnapshot.findMany({
        where: {
          timestamp: {
            contains: reviewId.split('-').pop() || '',
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 1,
      });

      if (reviews.length > 0) {
        await this.prisma.reviewSnapshot.update({
          where: {
            id: reviews[0].id,
          },
          data: {
            implementedSuggestions: effectiveness.implementedSuggestions,
            totalSuggestions: effectiveness.totalSuggestions,
            developerFeedback: effectiveness.developerFeedback,
            followUpRequired: effectiveness.followUpRequired,
          },
        });

        core.info(`✅ Updated effectiveness for review ${reviewId}`);
      }
    } catch (error) {
      core.warning(`Failed to update review effectiveness: ${error}`);
    }
  }

  async getReviewInsights(repository?: string): Promise<InsightsData> {
    try {
      const where = repository ? { repository } : {};

      // Get total count
      const totalReviews = await this.prisma.reviewSnapshot.count({ where });

      if (totalReviews === 0) {
        return {
          totalReviews: 0,
          averageProcessingTime: 0,
          averageIssuesFound: 0,
          effectivenessRate: 0,
          commonPatterns: [],
        };
      }

      // Get aggregated metrics
      const aggregated = await this.prisma.reviewSnapshot.aggregate({
        where,
        _avg: {
          processingTime: true,
          issuesHigh: true,
          issuesMedium: true,
          issuesLow: true,
        },
      });

      // Calculate average issues found
      const avgHigh = aggregated._avg.issuesHigh || 0;
      const avgMedium = aggregated._avg.issuesMedium || 0;
      const avgLow = aggregated._avg.issuesLow || 0;
      const averageIssuesFound = avgHigh + avgMedium + avgLow;

      // Calculate effectiveness rate
      const reviewsWithEffectiveness = await this.prisma.reviewSnapshot.findMany({
        where: {
          ...where,
          implementedSuggestions: { not: null },
          totalSuggestions: { not: null },
        },
        select: {
          implementedSuggestions: true,
          totalSuggestions: true,
        },
      });

      const effectivenessRate =
        reviewsWithEffectiveness.length > 0
          ? reviewsWithEffectiveness.reduce((sum: number, r: { implementedSuggestions: number | null; totalSuggestions: number | null }) => {
              const rate = r.implementedSuggestions! / Math.max(r.totalSuggestions!, 1);
              return sum + rate;
            }, 0) / reviewsWithEffectiveness.length
          : 0;

      // Get common project types
      const projectTypeCounts = await this.prisma.reviewSnapshot.groupBy({
        by: ['projectType'],
        where,
        _count: {
          projectType: true,
        },
        orderBy: {
          _count: {
            projectType: 'desc',
          },
        },
        take: 5,
      });

      const commonPatterns = projectTypeCounts.map((p: { projectType: string }) => p.projectType);

      return {
        totalReviews,
        averageProcessingTime: Math.round(aggregated._avg.processingTime || 0),
        averageIssuesFound: Math.round(averageIssuesFound * 10) / 10,
        effectivenessRate: Math.round(effectivenessRate * 100) / 100,
        commonPatterns,
      };
    } catch (error) {
      core.error(`Failed to generate review insights: ${error}`);
      return {
        totalReviews: 0,
        averageProcessingTime: 0,
        averageIssuesFound: 0,
        effectivenessRate: 0,
        commonPatterns: [],
      };
    }
  }

  async loadMetrics(repository?: string): Promise<ReviewQualityTracking[]> {
    try {
      const where = repository ? { repository } : {};

      const snapshots = await this.prisma.reviewSnapshot.findMany({
        where,
        orderBy: {
          createdAt: 'desc',
        },
      });

      return snapshots.map((s: {
        id: string;
        timestamp: string;
        repository: string;
        prNumber: number;
        prTitle: string;
        prAuthor: string;
        filesChanged: number;
        reviewerId: string;
        reviewState: string;
        reviewText: string;
        codebunnyMentioned: boolean;
        commentId: number | null;
        promptLength: number;
        responseLength: number;
        processingTime: number;
        rulesApplied: number;
        patternsDetected: number;
        issuesHigh: number;
        issuesMedium: number;
        issuesLow: number;
        hasCustomCommand: boolean;
        projectType: string;
        mainLanguages: string[];
        implementedSuggestions: number | null;
        totalSuggestions: number | null;
        developerFeedback: string | null;
        followUpRequired: boolean;
      }) => this.convertToReviewQualityTracking(s));
    } catch (error) {
      core.error(`Failed to load metrics from Prisma: ${error}`);
      return [];
    }
  }

  async getPRHistory(repository: string, prNumber: number): Promise<ReviewSnapshot[]> {
    try {
      const snapshots = await this.prisma.reviewSnapshot.findMany({
        where: {
          repository,
          prNumber,
        },
        orderBy: {
          timestamp: 'asc',
        },
      });

      return snapshots.map((s: {
        id: string;
        timestamp: string;
        repository: string;
        prNumber: number;
        prTitle: string;
        prAuthor: string;
        filesChanged: number;
        reviewerId: string;
        reviewState: string;
        reviewText: string;
        codebunnyMentioned: boolean;
        commentId: number | null;
        promptLength: number;
        responseLength: number;
        processingTime: number;
        rulesApplied: number;
        patternsDetected: number;
        issuesHigh: number;
        issuesMedium: number;
        issuesLow: number;
        hasCustomCommand: boolean;
        projectType: string;
        mainLanguages: string[];
      }) => this.convertToReviewSnapshot(s));
    } catch (error) {
      core.error(`Failed to get PR history: ${error}`);
      return [];
    }
  }

  async getApprovalTransitions(repository: string, prNumber: number): Promise<ApprovalTransition[]> {
    try {
      const transitions = await this.prisma.approvalTransition.findMany({
        where: {
          repository,
          prNumber,
        },
        orderBy: {
          timestamp: 'asc',
        },
      });

      return transitions.map((t: {
        timestamp: string;
        repository: string;
        prNumber: number;
        fromState: string;
        toState: string;
        reviewId: string;
      }) => ({
        timestamp: t.timestamp,
        repository: t.repository,
        prNumber: t.prNumber,
        fromState: t.fromState as ReviewSnapshot['reviewState'],
        toState: t.toState as ReviewSnapshot['reviewState'],
        reviewId: t.reviewId,
      }));
    } catch (error) {
      core.error(`Failed to get approval transitions: ${error}`);
      return [];
    }
  }

  async recordApprovalTransition(transition: ApprovalTransition): Promise<void> {
    try {
      await this.prisma.approvalTransition.create({
        data: {
          timestamp: transition.timestamp,
          repository: transition.repository,
          prNumber: transition.prNumber,
          fromState: transition.fromState,
          toState: transition.toState,
          reviewId: transition.reviewId,
        },
      });

      core.info(`✅ Recorded approval transition: ${transition.fromState} → ${transition.toState}`);
    } catch (error) {
      core.warning(`Failed to record approval transition: ${error}`);
    }
  }

  /**
   * Check for approval state transition and record it
   */
  private async checkAndRecordApprovalTransition(
    currentSnapshot: ReviewSnapshot,
    reviewId: string
  ): Promise<void> {
    try {
      // Get the most recent previous review for this PR
      const previousReviews = await this.prisma.reviewSnapshot.findMany({
        where: {
          repository: currentSnapshot.repository,
          prNumber: currentSnapshot.prNumber,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 2, // Current + previous
      });

      // If there's a previous review, check for state change
      if (previousReviews.length >= 2) {
        const previous = previousReviews[1]; // Second most recent (first is current)
        const current = currentSnapshot;

        if (previous.reviewState !== current.reviewState) {
          await this.recordApprovalTransition({
            timestamp: current.timestamp,
            repository: current.repository,
            prNumber: current.prNumber,
            fromState: previous.reviewState as ReviewSnapshot['reviewState'],
            toState: current.reviewState,
            reviewId,
          });
        }
      }
    } catch (error) {
      core.warning(`Failed to check approval transition: ${error}`);
    }
  }

  /**
   * Convert Prisma model to ReviewSnapshot interface
   */
  private convertToReviewSnapshot(prismaSnapshot: {
    id: string;
    timestamp: string;
    repository: string;
    prNumber: number;
    prTitle: string;
    prAuthor: string;
    filesChanged: number;
    reviewerId: string;
    reviewState: string;
    reviewText: string;
    codebunnyMentioned: boolean;
    commentId: number | null;
    promptLength: number;
    responseLength: number;
    processingTime: number;
    rulesApplied: number;
    patternsDetected: number;
    issuesHigh: number;
    issuesMedium: number;
    issuesLow: number;
    hasCustomCommand: boolean;
    projectType: string;
    mainLanguages: string[];
  }): ReviewSnapshot {
    return {
      timestamp: prismaSnapshot.timestamp,
      repository: prismaSnapshot.repository,
      prNumber: prismaSnapshot.prNumber,
      prTitle: prismaSnapshot.prTitle,
      prAuthor: prismaSnapshot.prAuthor,
      filesChanged: prismaSnapshot.filesChanged,
      reviewerId: prismaSnapshot.reviewerId,
      reviewState: prismaSnapshot.reviewState as ReviewSnapshot['reviewState'],
      reviewText: prismaSnapshot.reviewText,
      codebunnyMentioned: prismaSnapshot.codebunnyMentioned,
      commentId: prismaSnapshot.commentId || undefined,
      metrics: {
        promptLength: prismaSnapshot.promptLength,
        responseLength: prismaSnapshot.responseLength,
        processingTime: prismaSnapshot.processingTime,
        rulesApplied: prismaSnapshot.rulesApplied,
        patternsDetected: prismaSnapshot.patternsDetected,
        issuesFound: {
          high: prismaSnapshot.issuesHigh,
          medium: prismaSnapshot.issuesMedium,
          low: prismaSnapshot.issuesLow,
        },
      },
      context: {
        hasCustomCommand: prismaSnapshot.hasCustomCommand,
        projectType: prismaSnapshot.projectType,
        mainLanguages: prismaSnapshot.mainLanguages,
      },
    };
  }

  /**
   * Convert Prisma model to ReviewQualityTracking interface
   */
  private convertToReviewQualityTracking(prismaSnapshot: {
    id: string;
    timestamp: string;
    repository: string;
    prNumber: number;
    prTitle: string;
    prAuthor: string;
    filesChanged: number;
    reviewerId: string;
    reviewState: string;
    reviewText: string;
    codebunnyMentioned: boolean;
    commentId: number | null;
    promptLength: number;
    responseLength: number;
    processingTime: number;
    rulesApplied: number;
    patternsDetected: number;
    issuesHigh: number;
    issuesMedium: number;
    issuesLow: number;
    hasCustomCommand: boolean;
    projectType: string;
    mainLanguages: string[];
    implementedSuggestions: number | null;
    totalSuggestions: number | null;
    developerFeedback: string | null;
    followUpRequired: boolean;
  }): ReviewQualityTracking {
    const snapshot = this.convertToReviewSnapshot(prismaSnapshot);

    const effectiveness =
      prismaSnapshot.implementedSuggestions !== null && prismaSnapshot.totalSuggestions !== null
        ? {
            implementedSuggestions: prismaSnapshot.implementedSuggestions,
            totalSuggestions: prismaSnapshot.totalSuggestions,
            developerFeedback: prismaSnapshot.developerFeedback as 'positive' | 'negative' | 'neutral' | undefined,
            followUpRequired: prismaSnapshot.followUpRequired,
          }
        : undefined;

    return {
      reviewId: this.generateReviewId(snapshot),
      snapshot,
      effectiveness,
    };
  }

  private generateReviewId(snapshot: ReviewSnapshot): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '');
    return `${snapshot.repository.replace('/', '-')}-${snapshot.prNumber}-${timestamp}`;
  }

  /**
   * Disconnect Prisma Client
   * Should be called when shutting down
   */
  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }
}

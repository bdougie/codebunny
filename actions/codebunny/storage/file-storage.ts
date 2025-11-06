import * as core from '@actions/core';
import * as fs from 'fs/promises';
import {
  IReviewStorage,
  ReviewSnapshot,
  ReviewQualityTracking,
  InsightsData,
  ApprovalTransition,
} from './storage-interface';

/**
 * File-based storage implementation using .continue/review-metrics.json
 * Maintains backward compatibility with existing file format
 */
export class FileStorage implements IReviewStorage {
  private metricsFile = '.continue/review-metrics.json';
  private transitionsFile = '.continue/approval-transitions.json';

  async recordReviewMetrics(snapshot: ReviewSnapshot): Promise<string> {
    const reviewId = this.generateReviewId(snapshot);

    try {
      // Ensure .continue directory exists
      await fs.mkdir('.continue', { recursive: true });

      // Load existing metrics
      const existingMetrics = await this.loadMetrics();

      // Add new review
      const reviewRecord: ReviewQualityTracking = {
        reviewId,
        snapshot,
      };

      existingMetrics.push(reviewRecord);

      // Keep only last 100 reviews to prevent file bloat
      if (existingMetrics.length > 100) {
        existingMetrics.splice(0, existingMetrics.length - 100);
      }

      // Save updated metrics
      await fs.writeFile(this.metricsFile, JSON.stringify(existingMetrics, null, 2));

      core.info(`📝 Recorded review metrics to file with ID: ${reviewId}`);
      return reviewId;
    } catch (error) {
      core.warning(`Failed to record review metrics: ${error}`);
      return reviewId;
    }
  }

  async updateReviewEffectiveness(
    reviewId: string,
    effectiveness: ReviewQualityTracking['effectiveness']
  ): Promise<void> {
    try {
      const metrics = await this.loadMetrics();
      const review = metrics.find((r) => r.reviewId === reviewId);

      if (review) {
        review.effectiveness = effectiveness;
        await fs.writeFile(this.metricsFile, JSON.stringify(metrics, null, 2));
        core.info(`Updated effectiveness for review ${reviewId}`);
      }
    } catch (error) {
      core.warning(`Failed to update review effectiveness: ${error}`);
    }
  }

  async getReviewInsights(repository?: string): Promise<InsightsData> {
    try {
      let metrics = await this.loadMetrics();

      // Filter by repository if provided
      if (repository) {
        metrics = metrics.filter((m) => m.snapshot.repository === repository);
      }

      if (metrics.length === 0) {
        return {
          totalReviews: 0,
          averageProcessingTime: 0,
          averageIssuesFound: 0,
          effectivenessRate: 0,
          commonPatterns: [],
        };
      }

      const totalReviews = metrics.length;
      const averageProcessingTime =
        metrics.reduce((sum, m) => sum + m.snapshot.metrics.processingTime, 0) / totalReviews;

      const averageIssuesFound =
        metrics.reduce((sum, m) => {
          const issues = m.snapshot.metrics.issuesFound;
          return sum + issues.high + issues.medium + issues.low;
        }, 0) / totalReviews;

      const reviewsWithEffectiveness = metrics.filter((m) => m.effectiveness);
      const effectivenessRate =
        reviewsWithEffectiveness.length > 0
          ? reviewsWithEffectiveness.reduce((sum, m) => {
              const rate =
                m.effectiveness!.implementedSuggestions / Math.max(m.effectiveness!.totalSuggestions, 1);
              return sum + rate;
            }, 0) / reviewsWithEffectiveness.length
          : 0;

      const projectTypes = metrics.map((m) => m.snapshot.context.projectType);
      const commonPatterns = this.getMostCommon(projectTypes, 5);

      return {
        totalReviews,
        averageProcessingTime: Math.round(averageProcessingTime),
        averageIssuesFound: Math.round(averageIssuesFound * 10) / 10,
        effectivenessRate: Math.round(effectivenessRate * 100) / 100,
        commonPatterns,
      };
    } catch (error) {
      core.warning(`Failed to generate review insights: ${error}`);
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
      const content = await fs.readFile(this.metricsFile, 'utf-8');
      let metrics: ReviewQualityTracking[] = JSON.parse(content);

      // Filter by repository if provided
      if (repository) {
        metrics = metrics.filter((m) => m.snapshot.repository === repository);
      }

      return metrics;
    } catch (error) {
      // File doesn't exist or is invalid, return empty array
      return [];
    }
  }

  async getPRHistory(repository: string, prNumber: number): Promise<ReviewSnapshot[]> {
    try {
      const metrics = await this.loadMetrics(repository);
      const snapshots = metrics
        .filter((m) => m.snapshot.prNumber === prNumber)
        .map((m) => m.snapshot)
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      return snapshots;
    } catch (error) {
      core.warning(`Failed to get PR history: ${error}`);
      return [];
    }
  }

  async getApprovalTransitions(repository: string, prNumber: number): Promise<ApprovalTransition[]> {
    try {
      const content = await fs.readFile(this.transitionsFile, 'utf-8');
      const transitions: ApprovalTransition[] = JSON.parse(content);

      return transitions
        .filter((t) => t.repository === repository && t.prNumber === prNumber)
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    } catch (error) {
      // File doesn't exist or is invalid, return empty array
      return [];
    }
  }

  async recordApprovalTransition(transition: ApprovalTransition): Promise<void> {
    try {
      // Ensure .continue directory exists
      await fs.mkdir('.continue', { recursive: true });

      // Load existing transitions
      let transitions: ApprovalTransition[] = [];
      try {
        const content = await fs.readFile(this.transitionsFile, 'utf-8');
        transitions = JSON.parse(content);
      } catch {
        // File doesn't exist yet, start with empty array
      }

      // Add new transition
      transitions.push(transition);

      // Keep only last 1000 transitions
      if (transitions.length > 1000) {
        transitions.splice(0, transitions.length - 1000);
      }

      // Save updated transitions
      await fs.writeFile(this.transitionsFile, JSON.stringify(transitions, null, 2));

      core.info(`Recorded approval transition: ${transition.fromState} → ${transition.toState}`);
    } catch (error) {
      core.warning(`Failed to record approval transition: ${error}`);
    }
  }

  private generateReviewId(snapshot: ReviewSnapshot): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '');
    return `${snapshot.repository.replace('/', '-')}-${snapshot.prNumber}-${timestamp}`;
  }

  private getMostCommon(arr: string[], limit: number): string[] {
    const counts = arr.reduce(
      (acc, item) => {
        acc[item] = (acc[item] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([item]) => item);
  }
}

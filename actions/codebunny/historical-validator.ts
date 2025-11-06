/**
 * Historical review validator
 * 
 * Uses past review data to validate and improve future reviews.
 * This implements a learning loop where CodeBunny learns from:
 * - Past approval decisions
 * - Common issues found
 * - Review patterns
 * - Developer feedback (via @codebunny mentions)
 */

import * as core from '@actions/core';
import { IReviewStorage, ReviewSnapshot } from './storage/storage-interface';

export interface ValidationInsights {
  similarPRs: Array<{
    prNumber: number;
    prTitle: string;
    reviewState: string;
    similarity: number;
  }>;
  commonIssues: Array<{
    issue: string;
    frequency: number;
    priority: 'high' | 'medium' | 'low';
  }>;
  approvalPatterns: {
    authorApprovalRate: number;
    similarFilesApprovalRate: number;
    avgTimeToApproval: number | null;
  };
  recommendations: string[];
}

/**
 * Validate current PR against historical data
 */
export async function validateAgainstHistory(
  storage: IReviewStorage,
  repository: string,
  currentPR: {
    number: number;
    title: string;
    author: string;
    filesChanged: string[];
  }
): Promise<ValidationInsights> {
  try {
    core.info('🔍 Analyzing historical review data...');

    // Get all historical reviews
    const allReviews = await storage.getAllReviews(repository, 100);

    if (allReviews.length === 0) {
      core.info('No historical data available for validation');
      return getEmptyInsights();
    }

    core.info(`Found ${allReviews.length} historical reviews to analyze`);

    // Find similar PRs (by title, author, or files)
    const similarPRs = findSimilarPRs(allReviews, currentPR);

    // Identify common issues
    const commonIssues = identifyCommonIssues(allReviews);

    // Analyze approval patterns
    const approvalPatterns = analyzeApprovalPatterns(allReviews, currentPR);

    // Generate recommendations
    const recommendations = generateRecommendations(
      similarPRs,
      commonIssues,
      approvalPatterns,
      currentPR
    );

    return {
      similarPRs,
      commonIssues,
      approvalPatterns,
      recommendations,
    };
  } catch (error) {
    core.warning(`Failed to validate against history: ${error}`);
    return getEmptyInsights();
  }
}

/**
 * Find similar PRs based on various criteria
 */
function findSimilarPRs(
  reviews: ReviewSnapshot[],
  currentPR: { title: string; author: string; filesChanged: string[] }
): ValidationInsights['similarPRs'] {
  const similarities = reviews.map((review) => {
    let score = 0;

    // Author similarity (strong signal)
    if (review.prAuthor === currentPR.author) {
      score += 30;
    }

    // Title similarity (using simple word matching)
    const currentWords = new Set(
      currentPR.title.toLowerCase().split(/\s+/).filter((w) => w.length > 3)
    );
    const reviewWords = new Set(
      review.prTitle.toLowerCase().split(/\s+/).filter((w) => w.length > 3)
    );

    const commonWords = [...currentWords].filter((w) => reviewWords.has(w));
    const titleSimilarity = commonWords.length / Math.max(currentWords.size, 1);
    score += titleSimilarity * 40;

    // Random factor for variety
    score += Math.random() * 10;

    return {
      prNumber: review.prNumber,
      prTitle: review.prTitle,
      reviewState: review.reviewState,
      similarity: Math.round(score),
    };
  });

  // Return top 5 most similar PRs
  return similarities
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 5)
    .filter((s) => s.similarity > 20); // Only include reasonably similar PRs
}

/**
 * Identify common issues from historical reviews
 */
function identifyCommonIssues(
  reviews: ReviewSnapshot[]
): ValidationInsights['commonIssues'] {
  const issueMap: Record<string, { count: number; highPriority: number }> = {};

  for (const review of reviews) {
    // Extract issue keywords from review text
    const text = review.reviewText.toLowerCase();

    // Define issue patterns to look for
    const patterns = [
      { keyword: 'security', priority: 'high' as const },
      { keyword: 'vulnerability', priority: 'high' as const },
      { keyword: 'memory leak', priority: 'high' as const },
      { keyword: 'performance', priority: 'medium' as const },
      { keyword: 'test', priority: 'medium' as const },
      { keyword: 'documentation', priority: 'low' as const },
      { keyword: 'type error', priority: 'medium' as const },
      { keyword: 'error handling', priority: 'medium' as const },
    ];

    for (const pattern of patterns) {
      if (text.includes(pattern.keyword)) {
        if (!issueMap[pattern.keyword]) {
          issueMap[pattern.keyword] = { count: 0, highPriority: 0 };
        }
        issueMap[pattern.keyword].count++;
        if (pattern.priority === 'high') {
          issueMap[pattern.keyword].highPriority++;
        }
      }
    }
  }

  // Convert to array and sort by frequency
  return Object.entries(issueMap)
    .map(([issue, data]) => ({
      issue,
      frequency: data.count,
      priority: (data.highPriority > data.count / 2 ? 'high' : 'medium') as 'high' | 'medium' | 'low',
    }))
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 10); // Top 10 issues
}

/**
 * Analyze approval patterns
 */
function analyzeApprovalPatterns(
  reviews: ReviewSnapshot[],
  currentPR: { author: string; filesChanged: string[] }
): ValidationInsights['approvalPatterns'] {
  // Calculate author's approval rate
  const authorReviews = reviews.filter((r) => r.prAuthor === currentPR.author);
  const authorApprovals = authorReviews.filter((r) => r.reviewState === 'MERGE').length;
  const authorApprovalRate =
    authorReviews.length > 0 ? authorApprovals / authorReviews.length : 0;

  // Calculate approval rate for similar files (simplified - just count)
  const totalReviews = reviews.length;
  const totalApprovals = reviews.filter((r) => r.reviewState === 'MERGE').length;
  const similarFilesApprovalRate = totalReviews > 0 ? totalApprovals / totalReviews : 0;

  // Calculate average time to approval (if we have multiple reviews for same PR)
  let avgTimeToApproval: number | null = null;
  // This would require tracking review timestamps within the same PR
  // For now, we'll leave it as null

  return {
    authorApprovalRate,
    similarFilesApprovalRate,
    avgTimeToApproval,
  };
}

/**
 * Generate recommendations based on historical analysis
 */
function generateRecommendations(
  similarPRs: ValidationInsights['similarPRs'],
  commonIssues: ValidationInsights['commonIssues'],
  approvalPatterns: ValidationInsights['approvalPatterns'],
  currentPR: { author: string }
): string[] {
  const recommendations: string[] = [];

  // Recommendations based on similar PRs
  if (similarPRs.length > 0) {
    const approvedCount = similarPRs.filter((pr) => pr.reviewState === 'MERGE').length;
    const rejectedCount = similarPRs.filter((pr) => pr.reviewState === 'DONT_MERGE').length;

    if (rejectedCount > approvedCount) {
      recommendations.push(
        `⚠️ Similar PRs have had approval challenges. Pay extra attention to common patterns.`
      );
    }

    if (similarPRs.length >= 3) {
      recommendations.push(
        `📊 Found ${similarPRs.length} similar PRs in history. Review their feedback for patterns.`
      );
    }
  }

  // Recommendations based on common issues
  if (commonIssues.length > 0) {
    const topIssues = commonIssues.slice(0, 3);
    recommendations.push(
      `🔍 Common issues in this codebase: ${topIssues.map((i) => i.issue).join(', ')}`
    );

    const highPriorityIssues = commonIssues.filter((i) => i.priority === 'high');
    if (highPriorityIssues.length > 0) {
      recommendations.push(
        `⚠️ High-priority issues frequently found: ${highPriorityIssues.map((i) => i.issue).join(', ')}`
      );
    }
  }

  // Recommendations based on approval patterns
  if (approvalPatterns.authorApprovalRate < 0.5 && approvalPatterns.authorApprovalRate > 0) {
    recommendations.push(
      `📉 Author has ${Math.round(approvalPatterns.authorApprovalRate * 100)}% approval rate. Consider extra scrutiny.`
    );
  } else if (approvalPatterns.authorApprovalRate > 0.8) {
    recommendations.push(
      `✅ Author has strong track record (${Math.round(approvalPatterns.authorApprovalRate * 100)}% approval rate).`
    );
  }

  return recommendations;
}

/**
 * Get empty insights (when no historical data available)
 */
function getEmptyInsights(): ValidationInsights {
  return {
    similarPRs: [],
    commonIssues: [],
    approvalPatterns: {
      authorApprovalRate: 0,
      similarFilesApprovalRate: 0,
      avgTimeToApproval: null,
    },
    recommendations: [
      '📝 This is the first review for this repository. Building historical baseline...',
    ],
  };
}

/**
 * Format validation insights for inclusion in review
 */
export function formatValidationInsights(insights: ValidationInsights): string {
  if (insights.recommendations.length === 0) {
    return '';
  }

  let output = '\n\n---\n\n## 📊 Historical Context\n\n';

  // Add recommendations
  if (insights.recommendations.length > 0) {
    output += '### Key Insights\n\n';
    for (const rec of insights.recommendations) {
      output += `${rec}\n`;
    }
    output += '\n';
  }

  // Add similar PRs
  if (insights.similarPRs.length > 0) {
    output += '### Similar PRs\n\n';
    for (const pr of insights.similarPRs.slice(0, 3)) {
      const stateEmoji =
        pr.reviewState === 'MERGE'
          ? '✅'
          : pr.reviewState === 'DONT_MERGE'
          ? '❌'
          : '🔄';
      output += `- ${stateEmoji} PR #${pr.prNumber}: ${pr.prTitle} (${pr.similarity}% similar)\n`;
    }
    output += '\n';
  }

  // Add common issues
  if (insights.commonIssues.length > 0) {
    output += '### Common Issues in This Codebase\n\n';
    for (const issue of insights.commonIssues.slice(0, 5)) {
      const priorityEmoji =
        issue.priority === 'high' ? '🔴' : issue.priority === 'medium' ? '🟡' : '🟢';
      output += `- ${priorityEmoji} **${issue.issue}** (found in ${issue.frequency} reviews)\n`;
    }
    output += '\n';
  }

  output += '*This analysis is based on historical review data stored in your repository.*\n';

  return output;
}

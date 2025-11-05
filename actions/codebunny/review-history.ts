import * as core from '@actions/core';
import * as fs from 'fs/promises';
import * as path from 'path';
import { DefaultArtifactClient } from '@actions/artifact';

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

/**
 * Extract review state from review text
 */
export function extractReviewState(reviewText: string): ReviewSnapshot['reviewState'] {
  const tldrSection = reviewText.match(/##\s*🎯\s*TLDR[\s\S]*?\*\*Recommendation\*\*:\s*([^\n]+)/i);
  
  if (!tldrSection) {
    return 'UNKNOWN';
  }

  const recommendation = tldrSection[1].toLowerCase().trim();
  
  // Check for emojis first as they're more reliable
  if (recommendation.includes('✅')) return 'MERGE';
  if (recommendation.includes('❌')) return 'DONT_MERGE';
  if (recommendation.includes('🔄')) return 'MERGE_AFTER_CHANGES';
  
  // Fallback to text matching
  if (recommendation.match(/\bmerge\b/) && !recommendation.match(/don'?t|after/)) {
    return 'MERGE';
  }
  
  if (recommendation.match(/don'?t\s+merge/)) {
    return 'DONT_MERGE';
  }
  
  if (recommendation.match(/merge\s+after\s+changes/)) {
    return 'MERGE_AFTER_CHANGES';
  }
  
  return 'UNKNOWN';
}

/**
 * Count approval state transitions
 */
export function countApprovalChanges(snapshots: ReviewSnapshot[]): number {
  if (snapshots.length < 2) {
    return 0;
  }

  let changes = 0;
  let previousApprovalState = snapshots[0].reviewState === 'MERGE';

  for (let i = 1; i < snapshots.length; i++) {
    const currentApprovalState = snapshots[i].reviewState === 'MERGE';
    
    if (currentApprovalState !== previousApprovalState) {
      changes++;
      previousApprovalState = currentApprovalState;
    }
  }

  return changes;
}

/**
 * Upload review snapshot as GitHub Actions artifact
 */
export async function uploadReviewSnapshot(snapshot: ReviewSnapshot): Promise<boolean> {
  try {
    const artifactName = `codebunny-review-pr-${snapshot.prNumber}-${Date.now()}`;
    const artifactPath = path.join('/tmp', `${artifactName}.json`);

    // Write snapshot to temp file
    await fs.writeFile(artifactPath, JSON.stringify(snapshot, null, 2));

    // Upload artifact
    const artifactClient = new DefaultArtifactClient();
    const uploadResponse = await artifactClient.uploadArtifact(
      artifactName,
      [artifactPath],
      '/tmp'
    );

    core.info(`✅ Uploaded review snapshot artifact: ${artifactName}`);
    core.info(`   Artifact ID: ${uploadResponse.id || artifactName}`);
    
    // Clean up temp file
    await fs.unlink(artifactPath).catch(() => {});
    
    return uploadResponse.id !== undefined;
  } catch (error) {
    core.warning(`Failed to upload review snapshot: ${error}`);
    // Don't fail the action if artifact upload fails
    return false;
  }
}

/**
 * Download previous review artifacts for a PR
 */
export async function downloadPreviousReviews(
  prNumber: number,
  workflowRunId?: number
): Promise<ReviewSnapshot[]> {
  const snapshots: ReviewSnapshot[] = [];

  try {
    // List all artifacts for this workflow
    // Note: This requires workflow_run permission or GitHub token with artifact access
    core.info(`Searching for previous review artifacts for PR #${prNumber}...`);

    // Download artifacts matching our naming pattern
    const artifactPattern = `codebunny-review-pr-${prNumber}-`;
    
    // Check if there are any artifacts in the download directory
    // This works when artifacts are restored by the workflow
    const downloadDir = path.join('/tmp', 'review-artifacts');
    await fs.mkdir(downloadDir, { recursive: true });

    // For now, we'll check if there are any artifacts in the download directory
    // This works when artifacts are restored by the workflow
    try {
      const files = await fs.readdir(downloadDir);
      
      for (const file of files) {
        // Validate file is JSON before processing
        if (file.startsWith(artifactPattern) && file.endsWith('.json')) {
          const filePath = path.join(downloadDir, file);
          try {
            const content = await fs.readFile(filePath, 'utf-8');
            // Validate JSON structure before parsing
            const snapshot = JSON.parse(content) as ReviewSnapshot;
            // Validate required fields exist
            if (snapshot.timestamp && snapshot.prNumber && snapshot.reviewState) {
              snapshots.push(snapshot);
            } else {
              core.warning(`Artifact ${file} is missing required fields`);
            }
          } catch (error) {
            core.warning(`Failed to parse artifact ${file}: ${error}`);
          }
        }
      }
    } catch (error) {
      core.info('No previous artifacts found in download directory');
    }

    // Sort by timestamp
    snapshots.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    core.info(`Found ${snapshots.length} previous review snapshots`);
  } catch (error) {
    core.warning(`Error downloading previous reviews: ${error}`);
  }

  return snapshots;
}

/**
 * Generate review history from snapshots
 */
export function buildReviewHistory(snapshots: ReviewSnapshot[]): ReviewHistory | null {
  if (snapshots.length === 0) {
    return null;
  }

  const first = snapshots[0];
  const last = snapshots[snapshots.length - 1];

  return {
    prNumber: first.prNumber,
    prTitle: first.prTitle,
    prAuthor: first.prAuthor,
    firstReviewAt: first.timestamp,
    lastReviewAt: last.timestamp,
    snapshots,
    approvalChanges: countApprovalChanges(snapshots),
    codebunnyMentions: snapshots.filter(s => s.codebunnyMentioned).length,
  };
}

/**
 * Format review state as emoji + text
 */
function formatReviewState(state: ReviewSnapshot['reviewState']): string {
  switch (state) {
    case 'MERGE':
      return '✅ MERGE';
    case 'DONT_MERGE':
      return '❌ DON\'T MERGE';
    case 'MERGE_AFTER_CHANGES':
      return '🔄 MERGE AFTER CHANGES';
    default:
      return '❓ UNKNOWN';
  }
}

/**
 * Generate markdown summary for review history
 */
export function generateReviewSummaryMarkdown(history: ReviewHistory): string {
  const { prNumber, prTitle, prAuthor, firstReviewAt, lastReviewAt, snapshots, approvalChanges, codebunnyMentions } = history;

  let markdown = `# PR #${prNumber}: ${prTitle}\n\n`;
  markdown += `**Author**: @${prAuthor}\n`;
  markdown += `**Files Changed**: ${snapshots[0]?.filesChanged || 0}\n`;
  markdown += `**First Review**: ${new Date(firstReviewAt).toLocaleString()}\n`;
  markdown += `**Last Review**: ${new Date(lastReviewAt).toLocaleString()}\n\n`;

  // Approval History Summary
  markdown += `## Approval History\n`;
  markdown += `- 📊 Total Reviews: ${snapshots.length}\n`;
  markdown += `- 🔄 Approval Changes: ${approvalChanges} time${approvalChanges !== 1 ? 's' : ''}\n`;
  markdown += `- 💬 @codebunny Mentions: ${codebunnyMentions}\n\n`;

  // Review Log
  markdown += `## Review Log\n\n`;

  for (let i = 0; i < snapshots.length; i++) {
    const snapshot = snapshots[i];
    const reviewNum = i + 1;
    const date = new Date(snapshot.timestamp).toLocaleString();

    markdown += `### ${date} - Review #${reviewNum}\n`;
    markdown += `**State**: ${formatReviewState(snapshot.reviewState)}\n`;
    
    if (snapshot.codebunnyMentioned) {
      markdown += `**💬 @codebunny mentioned** - Developer requested additional feedback\n`;
    }

    // Add metrics summary
    const { issuesFound } = snapshot.metrics;
    const totalIssues = issuesFound.high + issuesFound.medium + issuesFound.low;
    
    if (totalIssues > 0) {
      markdown += `**Issues Found**: ${totalIssues} (`;
      const parts = [];
      if (issuesFound.high > 0) parts.push(`${issuesFound.high} high`);
      if (issuesFound.medium > 0) parts.push(`${issuesFound.medium} medium`);
      if (issuesFound.low > 0) parts.push(`${issuesFound.low} low`);
      markdown += parts.join(', ') + ')\n';
    }

    markdown += `**Processing Time**: ${snapshot.metrics.processingTime}s\n`;
    markdown += `**Rules Applied**: ${snapshot.metrics.rulesApplied}\n`;
    markdown += `**Patterns Detected**: ${snapshot.metrics.patternsDetected}\n\n`;

    // Add expandable section with full review
    markdown += `<details>\n`;
    markdown += `<summary>📝 Full Review Details</summary>\n\n`;
    markdown += snapshot.reviewText;
    markdown += `\n</details>\n\n`;

    markdown += `---\n\n`;
  }

  // Add footer
  markdown += `\n*Generated by CodeBunny • Powered by [Continue](https://continue.dev)*\n`;

  return markdown;
}

/**
 * Save review summary to .contributor/reviews/
 */
export async function saveReviewSummary(history: ReviewHistory): Promise<void> {
  try {
    const contributorDir = path.join(process.cwd(), '.contributor');
    const reviewsDir = path.join(contributorDir, 'reviews');
    
    // Create directory with error handling
    try {
      await fs.mkdir(reviewsDir, { recursive: true });
    } catch (error) {
      core.warning(`Failed to create contributor directory: ${error}`);
      throw error;
    }

    const filename = `pr-${history.prNumber}.md`;
    const filepath = path.join(reviewsDir, filename);

    const markdown = generateReviewSummaryMarkdown(history);
    
    // Always write the file to ensure updates are saved
    await fs.writeFile(filepath, markdown, 'utf-8');
    core.info(`✅ Saved review summary to ${filepath}`);
  } catch (error) {
    core.warning(`Failed to save review summary: ${error}`);
  }
}

/**
 * Load existing review summary if it exists
 */
export async function loadExistingReviewSummary(prNumber: number): Promise<ReviewHistory | null> {
  try {
    const filepath = path.join(process.cwd(), '.contributor', 'reviews', `pr-${prNumber}.md`);
    
    // Check if file exists
    await fs.access(filepath);
    
    // File exists, but we can't easily parse markdown back to history
    // So we'll rely on artifacts as the source of truth
    core.info(`Found existing review summary for PR #${prNumber}`);
    return null;
  } catch (error) {
    // File doesn't exist, which is fine
    return null;
  }
}

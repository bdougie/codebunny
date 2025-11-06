/**
 * Review data committer
 * 
 * This module handles committing review data to the repository after each review.
 * It commits:
 * - Review summaries (.contributor/reviews/*.md)
 * - File storage data (.contributor/review-data.json)
 * 
 * It does NOT commit:
 * - Turso database files (.contributor/reviews.db) - ignored by .gitignore
 * - These should be synced via Turso cloud or backed up separately
 */

import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface CommitOptions {
  repository: string;
  prNumber: number;
  prTitle: string;
  branchName?: string;
  skipIfNoChanges?: boolean;
}

/**
 * Commit review data to repository
 */
export async function commitReviewData(options: CommitOptions): Promise<boolean> {
  const {
    repository,
    prNumber,
    prTitle,
    branchName = 'main',
    skipIfNoChanges = true,
  } = options;

  try {
    core.info('📝 Checking for review data to commit...');

    // Configure git
    await exec.exec('git', ['config', 'user.name', 'CodeBunny']);
    await exec.exec('git', ['config', 'user.email', 'codebunny@continue.dev']);

    // Add review data files
    const contributorDir = path.join(process.cwd(), '.contributor');
    
    // Check if contributor directory exists
    try {
      await fs.access(contributorDir);
    } catch {
      core.info('No .contributor directory found, skipping commit');
      return false;
    }

    // Stage review summaries (markdown files)
    const reviewsDir = path.join(contributorDir, 'reviews');
    try {
      await fs.access(reviewsDir);
      await exec.exec('git', ['add', `${reviewsDir}/*.md`]);
      core.info('✅ Staged review summaries');
    } catch {
      core.info('No review summaries to stage');
    }

    // Stage file storage data (if exists)
    const fileStoragePath = path.join(contributorDir, 'review-data.json');
    try {
      await fs.access(fileStoragePath);
      await exec.exec('git', ['add', fileStoragePath]);
      core.info('✅ Staged file storage data');
    } catch {
      core.info('No file storage data to stage');
    }

    // Check if there are changes to commit
    let hasChanges = false;
    await exec.exec('git', ['diff', '--cached', '--quiet'], {
      ignoreReturnCode: true,
      listeners: {
        stdout: () => {},
        stderr: () => {},
      },
    }).then(
      () => { hasChanges = false; },
      () => { hasChanges = true; }
    );

    if (!hasChanges) {
      if (skipIfNoChanges) {
        core.info('No review data changes to commit');
        return false;
      }
    }

    // Create commit message
    const shortTitle = prTitle.length > 50 
      ? `${prTitle.substring(0, 47)}...` 
      : prTitle;
    
    const commitMessage = `Update review data for PR #${prNumber}: ${shortTitle}

Review data updated by CodeBunny for ${repository}#${prNumber}

This commit includes:
- Review summaries in .contributor/reviews/
- Historical review metrics (if using file storage)

The Turso database (.contributor/reviews.db) is not committed and
should be synced via Turso cloud or backed up separately.

Generated with [Continue](https://continue.dev)

Co-Authored-By: Continue <noreply@continue.dev>
Co-authored-by: bdougieyo <brian@continue.dev>`;

    // Commit the changes
    await exec.exec('git', ['commit', '-m', commitMessage]);
    core.info('✅ Committed review data');

    // Push to remote (if on a PR branch, push to that branch)
    const currentBranch = await getCurrentBranch();
    if (currentBranch) {
      try {
        await exec.exec('git', ['push', 'origin', currentBranch]);
        core.info(`✅ Pushed review data to ${currentBranch}`);
      } catch (error) {
        core.warning(`Failed to push review data: ${error}`);
        core.info('This may be expected if the action does not have write permissions');
      }
    }

    return true;
  } catch (error) {
    core.warning(`Failed to commit review data: ${error}`);
    return false;
  }
}

/**
 * Get current git branch
 */
async function getCurrentBranch(): Promise<string | null> {
  try {
    let branch = '';
    await exec.exec('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      listeners: {
        stdout: (data: Buffer) => {
          branch += data.toString().trim();
        },
      },
    });
    return branch || null;
  } catch {
    return null;
  }
}

/**
 * Check if git repository is clean (no uncommitted changes)
 */
export async function isGitClean(): Promise<boolean> {
  try {
    let isClean = true;
    await exec.exec('git', ['status', '--porcelain'], {
      listeners: {
        stdout: (data: Buffer) => {
          const output = data.toString().trim();
          if (output.length > 0) {
            isClean = false;
          }
        },
      },
    });
    return isClean;
  } catch {
    return false;
  }
}

/**
 * Get list of files that have changed in the contributor directory
 */
export async function getChangedReviewFiles(): Promise<string[]> {
  try {
    const files: string[] = [];
    await exec.exec('git', ['diff', '--name-only', '.contributor/'], {
      listeners: {
        stdout: (data: Buffer) => {
          const output = data.toString().trim();
          if (output) {
            files.push(...output.split('\n'));
          }
        },
      },
    });
    return files;
  } catch {
    return [];
  }
}

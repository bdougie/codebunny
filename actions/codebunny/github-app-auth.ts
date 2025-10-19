import * as core from '@actions/core';
import * as github from '@actions/github';

/**
 * Get authenticated Octokit instance
 * Falls back to GITHUB_TOKEN if no token is provided
 */
export async function getAuthenticatedOctokit(
  githubToken?: string
): Promise<ReturnType<typeof github.getOctokit>> {
  // Use provided token or fall back to GITHUB_TOKEN
  const token = githubToken || process.env.GITHUB_TOKEN || '';
  
  if (!token) {
    throw new Error(
      'GitHub token is required. Either provide github-token input or ensure GITHUB_TOKEN is available'
    );
  }

  if (githubToken) {
    core.info('Using provided GitHub token for API calls');
  } else {
    core.info('Using default GITHUB_TOKEN for API calls');
  }

  return github.getOctokit(token);
}

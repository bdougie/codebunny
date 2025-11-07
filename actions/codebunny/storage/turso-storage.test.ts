import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createLocalTursoStorage } from './storage/turso-storage'

// Basic smoke tests for Turso storage in local mode
// These tests run against a local file DB under .contributor/reviews.db

describe('TursoStorage (local)', () => {
  const storage = createLocalTursoStorage()
  const repo = 'owner/repo'

  beforeAll(async () => {
    await storage.initialize()
  })

  afterAll(async () => {
    await storage.close()
  })

  it('healthCheck should pass after initialize', async () => {
    expect(await storage.healthCheck()).toBe(true)
  })

  it('saveReview and getReviewHistory should round-trip', async () => {
    const snapshot = {
      timestamp: new Date().toISOString(),
      prNumber: 123,
      prTitle: 'Test PR',
      prAuthor: 'tester',
      filesChanged: 1,
      reviewState: 'MERGE' as const,
      reviewText: 'Looks good',
      metrics: {
        processingTime: 2,
        issuesFound: { high: 0, medium: 0, low: 0 },
        rulesApplied: 0,
        patternsDetected: 0,
      },
      codebunnyMentioned: false,
    }

    await storage.saveReview(repo, snapshot)

    const history = await storage.getReviewHistory(repo, snapshot.prNumber)
    expect(history.length).toBeGreaterThan(0)
    const last = history[history.length - 1]
    expect(last.prTitle).toBe('Test PR')
    expect(last.reviewState).toBe('MERGE')
  })

  it('saveApprovalTransition and getApprovalTransitions work', async () => {
    const transition = {
      timestamp: new Date().toISOString(),
      repository: repo,
      prNumber: 123,
      fromState: 'UNKNOWN',
      toState: 'MERGE',
      triggerType: 'REVIEW' as const,
    }

    await storage.saveApprovalTransition(transition)
    const transitions = await storage.getApprovalTransitions(repo, 123)
    expect(transitions.length).toBeGreaterThan(0)
    const last = transitions[transitions.length - 1]
    expect(last.toState).toBe('MERGE')
  })

  it('getStats returns reasonable values', async () => {
    const stats = await storage.getStats(repo)
    expect(stats.totalRepositories).toBe(1)
    expect(stats.totalReviews).toBeGreaterThan(0)
  })
})

/**
 * File-based storage implementation
 * 
 * Stores review data locally in the .contributor folder as JSON files.
 * This is the default storage mode with a 100-review limit per repository.
 */

import * as core from '@actions/core';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  IReviewStorage,
  ReviewSnapshot,
  ApprovalTransition,
  StorageStats,
} from './storage-interface';

interface FileReviewData {
  repository: string;
  reviews: ReviewSnapshot[];
  transitions: ApprovalTransition[];
  lastUpdated: string;
}

export class FileStorage implements IReviewStorage {
  private readonly contributorDir: string;
  private readonly reviewsDir: string;
  private readonly dataFile: string;
  private readonly maxReviews = 100;

  constructor() {
    this.contributorDir = path.join(process.cwd(), '.contributor');
    this.reviewsDir = path.join(this.contributorDir, 'reviews');
    this.dataFile = path.join(this.contributorDir, 'review-data.json');
  }

  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.reviewsDir, { recursive: true });
      core.info('✅ File storage initialized in .contributor/reviews/');
    } catch (error) {
      core.error(`Failed to initialize file storage: ${error}`);
      throw error;
    }
  }

  async saveReview(repository: string, snapshot: ReviewSnapshot): Promise<void> {
    try {
      const data = await this.loadData(repository);
      
      // Add the new review
      data.reviews.push(snapshot);
      
      // Keep only the last maxReviews reviews
      if (data.reviews.length > this.maxReviews) {
        const removed = data.reviews.length - this.maxReviews;
        data.reviews = data.reviews.slice(-this.maxReviews);
        core.info(`🗑️ Removed ${removed} old review(s) to maintain ${this.maxReviews} review limit`);
      }
      
      data.lastUpdated = new Date().toISOString();
      
      await this.saveData(repository, data);
      core.info(`✅ Saved review for PR #${snapshot.prNumber} (${data.reviews.length}/${this.maxReviews} reviews stored)`);
    } catch (error) {
      core.error(`Failed to save review: ${error}`);
      throw error;
    }
  }

  async getReviewHistory(repository: string, prNumber: number): Promise<ReviewSnapshot[]> {
    try {
      const data = await this.loadData(repository);
      return data.reviews.filter(r => r.prNumber === prNumber);
    } catch (error) {
      core.warning(`Failed to load review history: ${error}`);
      return [];
    }
  }

  async saveApprovalTransition(transition: ApprovalTransition): Promise<void> {
    try {
      const data = await this.loadData(transition.repository);
      data.transitions.push(transition);
      
      // Keep only last 500 transitions
      if (data.transitions.length > 500) {
        data.transitions = data.transitions.slice(-500);
      }
      
      data.lastUpdated = new Date().toISOString();
      await this.saveData(transition.repository, data);
    } catch (error) {
      core.warning(`Failed to save approval transition: ${error}`);
    }
  }

  async getApprovalTransitions(repository: string, prNumber: number): Promise<ApprovalTransition[]> {
    try {
      const data = await this.loadData(repository);
      return data.transitions.filter(t => t.prNumber === prNumber);
    } catch (error) {
      core.warning(`Failed to load approval transitions: ${error}`);
      return [];
    }
  }

  async getStats(repository: string): Promise<StorageStats> {
    try {
      const data = await this.loadData(repository);
      const reviews = data.reviews;
      
      if (reviews.length === 0) {
        return {
          totalReviews: 0,
          totalRepositories: 1,
          oldestReview: null,
          newestReview: null,
          approvalRate: 0,
        };
      }
      
      const sortedByDate = [...reviews].sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      
      const approvedCount = reviews.filter(r => r.reviewState === 'MERGE').length;
      
      return {
        totalReviews: reviews.length,
        totalRepositories: 1,
        oldestReview: sortedByDate[0].timestamp,
        newestReview: sortedByDate[sortedByDate.length - 1].timestamp,
        approvalRate: reviews.length > 0 ? approvedCount / reviews.length : 0,
      };
    } catch (error) {
      core.warning(`Failed to get stats: ${error}`);
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
    try {
      const data = await this.loadData(repository);
      const reviews = data.reviews.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      
      return limit ? reviews.slice(0, limit) : reviews;
    } catch (error) {
      core.warning(`Failed to get all reviews: ${error}`);
      return [];
    }
  }

  async cleanup(repository: string, keepLast: number): Promise<void> {
    try {
      const data = await this.loadData(repository);
      
      if (data.reviews.length > keepLast) {
        const removed = data.reviews.length - keepLast;
        data.reviews = data.reviews.slice(-keepLast);
        data.lastUpdated = new Date().toISOString();
        
        await this.saveData(repository, data);
        core.info(`🗑️ Cleaned up ${removed} old review(s), kept last ${keepLast}`);
      }
    } catch (error) {
      core.warning(`Failed to cleanup reviews: ${error}`);
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await fs.access(this.contributorDir);
      return true;
    } catch {
      return false;
    }
  }

  private async loadData(repository: string): Promise<FileReviewData> {
    try {
      const content = await fs.readFile(this.dataFile, 'utf-8');
      const allData = JSON.parse(content) as Record<string, FileReviewData>;
      
      return allData[repository] || {
        repository,
        reviews: [],
        transitions: [],
        lastUpdated: new Date().toISOString(),
      };
    } catch (error) {
      // File doesn't exist yet, return empty data
      return {
        repository,
        reviews: [],
        transitions: [],
        lastUpdated: new Date().toISOString(),
      };
    }
  }

  private async saveData(repository: string, data: FileReviewData): Promise<void> {
    try {
      // Load all data
      let allData: Record<string, FileReviewData> = {};
      try {
        const content = await fs.readFile(this.dataFile, 'utf-8');
        allData = JSON.parse(content);
      } catch {
        // File doesn't exist, start fresh
      }
      
      // Update this repository's data
      allData[repository] = data;
      
      // Save back to file
      await fs.writeFile(this.dataFile, JSON.stringify(allData, null, 2), 'utf-8');
    } catch (error) {
      core.error(`Failed to save data file: ${error}`);
      throw error;
    }
  }
}

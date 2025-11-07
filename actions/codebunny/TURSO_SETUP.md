# Turso Storage Setup Guide

CodeBunny can optionally use [Turso](https://turso.tech) (powered by libSQL) for unlimited review history with SQLite reliability and performance.

## Why Turso?

- **Unlimited History** - No 100-review cap like file storage
- **SQLite Reliability** - Battle-tested database engine
- **Local-First** - Works offline, syncs when online
- **Zero Cost Option** - Local-only mode requires no setup
- **Team Collaboration** - Optional cloud sync for team analytics
- **Edge Performance** - libSQL is optimized for edge computing

## Storage Modes

### 🎯 Local-Only Mode (Recommended for Single Repos)

**Zero setup required!** Just enable Turso storage and CodeBunny will automatically create a local SQLite database in `.contributor/reviews.db`.

```yaml
- name: CodeBunny Review
  uses: bdougie/codebunny/actions/codebunny@main
  with:
    continue-api-key: ${{ secrets.CONTINUE_API_KEY }}
    continue-org: ${{ vars.CONTINUE_ORG }}
    continue-config: ${{ vars.CONTINUE_CONFIG }}
    enable-turso-storage: 'true'
```

**Benefits:**
- ✅ Unlimited review history
- ✅ Zero cost
- ✅ No cloud dependencies
- ✅ SQLite reliability
- ✅ Fast local queries

**Perfect for:**
- Personal projects
- Single repository use
- Privacy-conscious teams
- Offline-first workflows

### 🔄 Synced Mode (Recommended for Teams)

**Local database with automatic cloud sync** - Best of both worlds! Fast local queries with team collaboration via Turso cloud.

#### Step 1: Install Turso CLI

```bash
# macOS/Linux
curl -sSfL https://get.tur.so/install.sh | bash

# Or use Homebrew
brew install tursodatabase/tap/turso
```

#### Step 2: Create Turso Account

```bash
turso auth signup
```

#### Step 3: Create Database

```bash
turso db create codebunny-reviews

# Get database URL
turso db show codebunny-reviews --url
# Output: libsql://codebunny-reviews-[your-org].turso.io

# Create auth token
turso db tokens create codebunny-reviews
# Output: eyJhb... (save this token)
```

#### Step 4: Configure GitHub Secrets

Add to Settings → Secrets and variables → Actions:

- `TURSO_DATABASE_URL`: `libsql://codebunny-reviews-[your-org].turso.io`
- `TURSO_AUTH_TOKEN`: Your auth token from step 3

#### Step 5: Update Workflow

```yaml
- name: CodeBunny Review
  uses: bdougie/codebunny/actions/codebunny@main
  with:
    continue-api-key: ${{ secrets.CONTINUE_API_KEY }}
    continue-org: ${{ vars.CONTINUE_ORG }}
    continue-config: ${{ vars.CONTINUE_CONFIG }}
    enable-turso-storage: 'true'
  env:
    TURSO_DATABASE_URL: ${{ secrets.TURSO_DATABASE_URL }}
    TURSO_AUTH_TOKEN: ${{ secrets.TURSO_AUTH_TOKEN }}
```

**Benefits:**
- ✅ Local-first performance
- ✅ Automatic cloud sync
- ✅ Team collaboration
- ✅ Cross-repo analytics
- ✅ Data persistence
- ✅ Generous free tier

**Turso Free Tier:**
- 500 databases
- 9 GB total storage
- Unlimited requests
- 3 locations

**Perfect for:**
- Team projects
- Multiple repositories
- Cross-PR analytics
- Code quality trends

## Migration from File Storage

If you're already using CodeBunny with file storage, Turso will automatically migrate your existing reviews on first run:

1. Enable Turso storage in your workflow
2. CodeBunny detects existing `.contributor/review-data.json`
3. All reviews are migrated to Turso
4. Original file is backed up to `.contributor/review-data.json.backup`

No manual migration needed! ✨

## Querying Review Data

### Using Turso CLI

```bash
# Connect to your database
turso db shell codebunny-reviews

# Get all reviews for a repository
SELECT prNumber, prTitle, reviewState, timestamp 
FROM ReviewSnapshot 
WHERE repository = 'owner/repo'
ORDER BY timestamp DESC
LIMIT 10;

# Get approval state transitions
SELECT * FROM ApprovalTransition
WHERE repository = 'owner/repo' AND prNumber = 123
ORDER BY timestamp ASC;

# Calculate approval rate
SELECT 
  COUNT(CASE WHEN reviewState = 'MERGE' THEN 1 END) * 100.0 / COUNT(*) as approvalRate
FROM ReviewSnapshot
WHERE repository = 'owner/repo';

# Find PRs with most reviews
SELECT prNumber, prTitle, COUNT(*) as reviewCount
FROM ReviewSnapshot
WHERE repository = 'owner/repo'
GROUP BY prNumber, prTitle
ORDER BY reviewCount DESC
LIMIT 5;
```

### Using libSQL Client

```typescript
import { createClient } from '@libsql/client';

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

// Get team analytics
const result = await client.execute(`
  SELECT 
    strftime('%Y-%m', timestamp) as month,
    COUNT(*) as totalReviews,
    AVG(issuesHigh) as avgHighIssues,
    AVG(processingTime) as avgProcessingTime
  FROM ReviewSnapshot
  WHERE repository = 'owner/repo'
  GROUP BY month
  ORDER BY month DESC
  LIMIT 12
`);

console.log(result.rows);
```

## Database Schema

### ReviewSnapshot Table

Stores individual code reviews.

```sql
CREATE TABLE ReviewSnapshot (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL,
  repository TEXT NOT NULL,
  prNumber INTEGER NOT NULL,
  prTitle TEXT NOT NULL,
  prAuthor TEXT NOT NULL,
  filesChanged INTEGER NOT NULL,
  reviewState TEXT NOT NULL,  -- MERGE, DONT_MERGE, MERGE_AFTER_CHANGES, UNKNOWN
  reviewText TEXT NOT NULL,
  processingTime INTEGER NOT NULL,
  issuesHigh INTEGER NOT NULL,
  issuesMedium INTEGER NOT NULL,
  issuesLow INTEGER NOT NULL,
  rulesApplied INTEGER NOT NULL,
  patternsDetected INTEGER NOT NULL,
  codebunnyMentioned INTEGER NOT NULL,
  commentId INTEGER,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### ApprovalTransition Table

Tracks changes in approval states over time.

```sql
CREATE TABLE ApprovalTransition (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL,
  repository TEXT NOT NULL,
  prNumber INTEGER NOT NULL,
  fromState TEXT NOT NULL,
  toState TEXT NOT NULL,
  triggerType TEXT NOT NULL,  -- REVIEW, MENTION, COMMIT
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

## Troubleshooting

### "Failed to initialize Turso storage"

**Solution:** CodeBunny will automatically fall back to file storage. Check:

1. Environment variables are correctly set
2. Database URL starts with `libsql://` or `file:`
3. Auth token is valid (not expired)

### Local database file is growing large

**Solution:** Turso uses SQLite, which is very efficient. However, you can:

1. Use synced mode to move data to cloud
2. Archive old data using SQL queries
3. Set up periodic cleanup

```bash
# Remove reviews older than 1 year
turso db shell codebunny-reviews
> DELETE FROM ReviewSnapshot WHERE timestamp < date('now', '-1 year');
> VACUUM;
```

### Want to backup local database

```bash
# Copy the database file
cp .contributor/reviews.db .contributor/reviews.db.backup

# Or export to SQL
turso db shell file:.contributor/reviews.db ".dump" > backup.sql
```

## Example Analytics Queries

### Code Quality Trends

```sql
-- Average issues over time
SELECT 
  date(timestamp) as date,
  AVG(issuesHigh) as avgHigh,
  AVG(issuesMedium) as avgMedium,
  AVG(issuesLow) as avgLow
FROM ReviewSnapshot
WHERE repository = 'owner/repo'
  AND timestamp > date('now', '-30 days')
GROUP BY date
ORDER BY date ASC;
```

### Most Active Contributors

```sql
-- PRs reviewed per author
SELECT 
  prAuthor,
  COUNT(*) as prCount,
  AVG(filesChanged) as avgFilesChanged,
  SUM(CASE WHEN reviewState = 'MERGE' THEN 1 ELSE 0 END) as approvedCount
FROM ReviewSnapshot
WHERE repository = 'owner/repo'
GROUP BY prAuthor
ORDER BY prCount DESC;
```

### Review Response Times

```sql
-- Time between reviews for same PR
WITH ReviewTimes AS (
  SELECT 
    prNumber,
    timestamp,
    LAG(timestamp) OVER (PARTITION BY prNumber ORDER BY timestamp) as prevTimestamp
  FROM ReviewSnapshot
  WHERE repository = 'owner/repo'
)
SELECT 
  AVG(CAST((julianday(timestamp) - julianday(prevTimestamp)) * 24 AS INTEGER)) as avgHoursBetweenReviews
FROM ReviewTimes
WHERE prevTimestamp IS NOT NULL;
```

## Cost Comparison

| Storage Mode | Cost | Reviews Limit | Team Sync | Analytics |
|--------------|------|---------------|-----------|-----------|
| File Storage | $0 | 100 reviews | ❌ No | ❌ Limited |
| Turso Local  | $0 | ♾️ Unlimited | ❌ No | ✅ Full SQL |
| Turso Synced | $0* | ♾️ Unlimited | ✅ Yes | ✅ Full SQL |

\* Free tier: 500 databases, 9 GB storage, unlimited requests

## Learn More

- [Turso Documentation](https://docs.turso.tech)
- [libSQL GitHub](https://github.com/tursodatabase/libsql)
- [Turso Pricing](https://turso.tech/pricing)
- [libSQL Client Docs](https://docs.turso.tech/libsql/client-access)

## Support

Need help? Open an issue or ask in discussions!

#!/bin/bash
# Script to create a new release for CodeBunny
# Usage: ./scripts/create-release.sh v1.0.0

set -e

VERSION=$1

if [ -z "$VERSION" ]; then
  echo "Usage: ./scripts/create-release.sh <version>"
  echo "Example: ./scripts/create-release.sh v1.0.0"
  exit 1
fi

# Validate version format
if [[ ! $VERSION =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Error: Version must be in format v1.0.0"
  exit 1
fi

echo "Creating release $VERSION..."

# Ensure we're on main and up to date
git checkout main
git pull origin main

# Build the action
echo "Building action..."
cd actions/codebunny
npm ci
npm run build
cd ../..

# Check if there are any uncommitted changes
if [ -n "$(git status --porcelain)" ]; then
  echo "Error: Working directory not clean. Commit or stash changes first."
  exit 1
fi

# Create and push tag
echo "Creating tag $VERSION..."
git tag -a "$VERSION" -m "Release $VERSION"

echo ""
echo "Tag created successfully!"
echo ""
echo "To push the tag and trigger the release workflow, run:"
echo "  git push origin $VERSION"
echo ""
echo "After the release workflow completes, the following will be available:"
echo "  - Release $VERSION on GitHub"
echo "  - Major version tag (e.g., v1) pointing to $VERSION"
echo "  - Users can reference: bdougie/codebunny@v1 or bdougie/codebunny@$VERSION"

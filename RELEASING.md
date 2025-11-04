# Release Process

This document describes how to create new releases for CodeBunny.

## Semantic Versioning

CodeBunny follows [Semantic Versioning](https://semver.org/):

- **MAJOR** (v1.0.0 → v2.0.0): Breaking changes that require user action
  - Changes to workflow configuration format
  - Removed or renamed inputs
  - Incompatible API updates
  
- **MINOR** (v1.0.0 → v1.1.0): New features, backward compatible
  - New review capabilities
  - Additional language support
  - New configuration options
  
- **PATCH** (v1.0.0 → v1.0.1): Bug fixes and improvements
  - Bug fixes
  - Documentation updates
  - Dependency updates

## Release Checklist

Before creating a release:

- [ ] All tests pass
- [ ] Action builds successfully (`cd actions/codebunny && npm run build`)
- [ ] CHANGELOG.md is updated with changes
- [ ] Documentation is up to date
- [ ] Breaking changes are clearly documented (for major releases)
- [ ] Migration guide is provided (for major releases)

## Creating a Release

### Option 1: Using the Helper Script (Recommended)

```bash
# Create and tag the release
./scripts/create-release.sh v1.0.0

# Review the changes
git show v1.0.0

# Push the tag to trigger the release workflow
git push origin v1.0.0
```

### Option 2: Manual Process

```bash
# Ensure you're on main and up to date
git checkout main
git pull origin main

# Build the action
cd actions/codebunny
npm ci
npm run build
cd ../..

# Create annotated tag
git tag -a v1.0.0 -m "Release v1.0.0"

# Push the tag
git push origin v1.0.0
```

## What Happens After Pushing a Tag

1. The `.github/workflows/release.yml` workflow triggers automatically
2. The action is built and bundled
3. A GitHub Release is created with auto-generated release notes
4. The major version tag (e.g., `v1`) is updated to point to the new release

This means users can reference:
- `bdougie/codebunny@v1` - Always gets latest v1.x.x
- `bdougie/codebunny@v1.0.0` - Pinned to specific version
- `bdougie/codebunny@main` - Always latest (not recommended)

## Updating CHANGELOG

Before each release, update `CHANGELOG.md`:

```markdown
## [1.1.0] - 2024-01-15

### Added
- New feature description

### Changed
- Changed feature description

### Fixed
- Bug fix description

### Deprecated
- Deprecated feature description

### Removed
- Removed feature description

### Security
- Security fix description
```

## Post-Release Tasks

After creating a release:

- [ ] Verify the GitHub Release was created successfully
- [ ] Check that the major version tag was updated (e.g., `v1` → latest v1.x.x)
- [ ] Test the new version in a test repository
- [ ] Announce the release (if significant)
- [ ] Close any related issues/PRs

## Hotfix Releases

For urgent bug fixes:

1. Create a branch from the tag: `git checkout -b hotfix/v1.0.1 v1.0.0`
2. Make the fix and commit
3. Create a new patch version tag: `git tag -a v1.0.1 -m "Hotfix: description"`
4. Push the tag: `git push origin v1.0.1`
5. Merge the fix back to main if needed

## Rolling Back a Release

If a release has critical issues:

```bash
# Delete the GitHub release (via web UI or GitHub CLI)
gh release delete v1.0.0

# Delete remote tag
git push --delete origin v1.0.0

# Delete local tag
git tag -d v1.0.0

# If the major version tag was updated, revert it
git tag -fa v1 <previous-good-commit> -m "Revert to previous version"
git push origin v1 --force
```

## Version Support Policy

- **Current Major Version**: Receives all updates (features, fixes, security)
- **Previous Major Version**: Receives security fixes for 6 months after new major release
- **Older Versions**: No longer supported

## Questions?

If you have questions about the release process, please:
- Open an issue for discussion
- Review existing releases for examples
- Check the GitHub Actions logs for release workflow details

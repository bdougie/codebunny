# Changelog

All notable changes to CodeBunny will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Turso Storage Support** - Optional unlimited review history with SQLite/libSQL
  - Local-only mode (zero setup, stores in `.contributor/reviews.db`)
  - Synced mode (embedded replica with Turso cloud sync)
  - Storage abstraction layer with interface
  - Automatic migration from file storage
  - Full SQL query capabilities for analytics
  - Approval transition tracking
  - Storage factory pattern with graceful fallback
- Storage interface (`storage/storage-interface.ts`)
- File storage implementation (`storage/file-storage.ts`)
- Turso storage implementation (`storage/turso-storage.ts`)
- Turso setup utilities (`turso-setup.ts`)
- Storage factory (`storage-factory.ts`)
- Comprehensive Turso documentation (`TURSO_SETUP.md`)
- `@libsql/client` dependency for Turso support
- `enable-turso-storage` workflow input
- Release workflow for automated versioning
- CHANGELOG.md for tracking changes
- Semantic versioning strategy

### Changed
- Review storage now uses abstraction layer
- Approval transitions are now tracked in storage backend
- Index.ts refactored to use storage factory pattern

### Fixed
- Sticky comments now properly update existing comments within 1 hour window
- Improved comment age tracking and logging for better debugging

## [1.0.0] - TBD

### Added
- AI-powered code reviews using Continue Agent
- Codebase pattern analysis
- Custom rules support via `.continue/rules/`
- Interactive commands with `@codebunny` mentions
- Sticky progress comments
- GitHub App authentication support
- BYOK (Bring Your Own Key) support
- Review metrics tracking
- Security, testing, and TypeScript rule examples
- Comprehensive documentation and setup guides

### Features
- Automated reviews on PR creation and updates
- Context-aware feedback based on project patterns
- Privacy-first design (runs in GitHub Actions)
- Support for JavaScript/TypeScript projects
- Integration with Continue Hub or self-hosted Continue instances

---

## Release Types

### Major Version (x.0.0)
Breaking changes that require user action:
- Changes to workflow configuration format
- Removed or renamed inputs
- Changes to authentication requirements
- Incompatible API updates

### Minor Version (0.x.0)
New features, backward compatible:
- New review capabilities
- Additional language support
- Enhanced metrics
- New configuration options

### Patch Version (0.0.x)
Bug fixes and minor improvements:
- Bug fixes
- Documentation updates
- Performance improvements
- Dependency updates

---

[Unreleased]: https://github.com/bdougie/codebunny/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/bdougie/codebunny/releases/tag/v1.0.0

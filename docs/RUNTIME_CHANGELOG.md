> This file is automatically synced from the runtime repository `CHANGELOG.md`.
>
> Runtime releases are identified by the CI build number (e.g. `YYYYMMDD.N`).
# Runtime Changelog

This project follows the principles of [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

Runtime images are released using the CI build number (Azure Pipelines `Build.BuildNumber`) in the form `YYYYMMDD.N`.

## [Unreleased]

### Added

- Runtime circuit breaker tuning via `DCDR_CB_*` env vars.

### Changed

- Circuit breaker now uses half-open probes and capped exponential backoff (default cap: 60s).
- Cache hits are served even when the circuit is OPEN.

### Fixed

- Upstream provider 401/403 is mapped to `INVALID_CREDENTIALS` (HTTP 401) instead of `502`.



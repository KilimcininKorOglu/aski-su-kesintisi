# Changelog

All notable changes to this project will be documented in this file.

## [1.1.0] - 2026-07-26

### Added
- Gemini AI tweet shortening module with two-stage strategy: shorten the affected-areas
  list first while preserving the tweet template, then fall back to full-text shortening
- Gemini client initialization in the entry point and integration into the Twitter module
- `npm run dry` command for testing without posting tweets, including character counts
- Centralized logging module integrated across all modules, writing to `data/run.log`
  with 7-day retention
- Docker support: multi-stage `Dockerfile`, `docker-compose.yml`, and `.dockerignore`
- Retry mechanism for tweets, configurable via `MAX_TWEET_RETRIES` and
  `TWEET_RETRY_DELAY_MS`
- Dynamic ct0 token retrieval through the `getCt0` endpoint

### Changed
- Migrated the Twitter integration from `twitter-api-v2` to RapidAPI
  (`twitter-api-v1-1-enterprise`)
- Switched the Gemini model to `gemini-2.5-flash-lite` for a higher request-per-minute
  allowance
- Reworked the GitHub Actions workflow: added write permission, Gemini and RapidAPI
  secrets, retry configuration, and a timestamp in the auto-commit message
- Set a deterministic Compose project name and documented the outbound-only,
  no-published-port design
- Aligned `.env.example` numeric defaults with the code fallbacks
- Disabled reply tweets; the code remains in place but is commented out
- Rewrote and expanded the project documentation

### Fixed
- Persist an outage only after its tweet is posted successfully
- Write `kesintiler.json` atomically through a temporary file and rename
- Throw on a corrupted `kesintiler.json` instead of silently returning an empty list
- Prevent overlapping check cycles in periodic mode with an `isChecking` guard
- Refresh the ct0 token inside the retry loop instead of reusing a stale one
- Remove the infinite-loop risk in the Gemini shortening path and wait out HTTP 429
  rate limits with automatic retry
- Skip the Gemini API call in dry run mode and distinguish dry run from a genuine
  Twitter initialization failure in the logs
- Correct the scraper regex boundary and increase the tweet character buffer
- Add error handling to `--once` mode
- Log API error responses in full detail, including response body and HTTP status
- Keep `data/run.log` out of the gitignore exclusion
- Fix the cron comment in the workflow

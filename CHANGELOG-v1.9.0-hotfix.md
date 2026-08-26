# MR One v1.9.0 Render Freshness Hotfix

- Changed service-worker strategy for navigation and runtime-critical JS/CSS from cache-first to network-first with offline cached fallback.
- Keeps icons/manifest and other static assets cache-first.
- Uses `cache: no-store` for critical online fetches so new Render deployments are not masked by the browser HTTP cache.
- New cache namespace removes previous shell caches during activation.
- Precache is resilient: one failed optional asset no longer prevents service-worker installation.

## Story 8-1-file-storage-foundation-private-bucket-metadata-links-rls-and-signed-access-command
- [Phase 2 â€” epic test design] 8.1 is THE single Phase A file model (6.1 attachment metadata + 6.3 PDF storage consume it); no competing model â€” standing contract + STOP condition R-814
- [Phase 2 â€” epic test design] Epic 8 adds a new test class: storage-plane negative matrix (storage.objects RLS, cross-tenant list/read/sign, path spoof, expired URL) â€” no H4-style auto gate exists; runner needs a storage-service-reachability probe or storage suites false-green skip locally

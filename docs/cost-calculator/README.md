# MiMuse Cost Calculator

## truefetch pricing (per video — not per batch)

| Mode | Price | 50 videos |
|------|-------|-----------|
| **MP4 download** | **$0.25 / video** | **$12.50** |
| **Metadata only** | **$0.05 / video** | **$2.50** |

Source: [truefetch/tiktok-video-downloader](https://apify.com/truefetch/tiktok-video-downloader) — pay-per-video, not per run.

**Not $2.50 per video** — that was a mistaken batch estimate. **$0.25 per download.**

Monitoring (`clockworks~tiktok-profile-scraper`) already returns links + views/likes/captions — you usually **don’t need** separate metadata rows.

## Per run (other actors)

| # | Actor | Est. $/run |
|---|-------|------------|
| 1 | Listup | ~$4–6 per UI click |
| 2 | Monitoring | ~$0.8–1.2 per UI click |

## Listup — 1000 pool (one-time)

10–20 runs × ~$5 ≈ **$50–100**

## Monthly example (50 matched review videos)

| Item | Calc | Total |
|------|------|-------|
| Monitoring | 10 clicks × ~$1 | ~$10 |
| Video download | 50 × $0.25 | ~$12.50 |
| **Monthly Apify** | | **~$23** |
| + Supabase + 17track | | **~$52/mo** |

More videos = linear cost: `videos × $0.25` (download) or `videos × $0.05` (metadata).

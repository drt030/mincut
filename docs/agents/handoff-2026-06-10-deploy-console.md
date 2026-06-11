# Handoff: Deploy Console Setup (Vercel + drt030.com + Buttondown)

**Date:** 2026-06-10 · **Owner:** wth · **For:** a console/browser agent session. Scope: dashboards and DNS only — no code changes, no commits, no secrets in chat.

## Mission

1. Vercel project linked to this repo, **preview** deploy working.
2. `drt030.com` (+ `www`) attached to the project with DNS configured at the registrar.
3. Buttondown account created; embed-subscribe endpoint reported back.
4. Report results and update the lane-5 row in `docs/plans/MASTER-PLAN.md`.

## Hard rules

- **Do NOT promote/deploy to production.** The API write-guard (launch plan Task 2) is not merged yet; production exposure waits for the infra lane's green light. Preview deploys only (`npx vercel deploy` without `--prod`).
- Never paste API keys, tokens, or registrar credentials into chat, files, or commits. Owner stays logged in to dashboards in the browser; if `npx vercel login` is needed, the OWNER clicks the email confirmation.
- Touch nothing else in the repo except the MASTER-PLAN status cell at the end.

## Steps

### A. Vercel

1. In the repo root: `npx vercel link` — create a new project (framework auto-detects Next.js). Note org/project name.
2. `npx vercel deploy` → preview URL. Smoke: `/`, `/graph`, `/gate` render; `curl -X POST <preview>/api/research-tasks -d '{"targetNodeId":"x"}'` (expected today: NOT 403 yet — record actual status; the guard lands in the infra lane).
3. Dashboard → Project → Settings → Domains: add `drt030.com` and `www.drt030.com` (www → redirect to apex). Vercel shows the required DNS records.
4. At the registrar for drt030.com: set the records Vercel displays (typically apex `A 76.76.21.21`, `www CNAME cname.vercel-dns.com` — **copy exactly what the dashboard shows**, don't trust this doc). Delete conflicting parking records.
5. Wait for verification in the Vercel domains panel (propagation can take minutes–hours). HTTPS cert issues automatically on verify. Domain will 404/show latest preview until a production deploy exists — expected, fine.

### B. Buttondown

1. Create account at buttondown.com (free tier). Suggested username: `drt030` (or closest available — it becomes the public embed handle).
2. Settings: enable double opt-in; set sender name "Capability Graph Explorer".
3. Capture the embed endpoint: `https://buttondown.com/api/emails/embed-subscribe/<USERNAME>`.
4. Send nothing; no import.

### C. Report back (end of session)

Reply to owner with: Vercel org/project name · preview URL · POST status code observed · domain verification state (verified / pending DNS) · Buttondown username + embed endpoint URL · any blockers. Then edit `docs/plans/MASTER-PLAN.md` lane-5 row status cell to reflect what's done (one line, no secrets) — this file is the cross-session sync point.

## Context pointers (read-only)

- Global state: `docs/plans/MASTER-PLAN.md` (read first).
- Why preview-only: launch plan Task 2 (`docs/plans/2026-06-09-commercial-launch-week.md`) — the public write endpoint must be guarded before prod.
- Do not read `.eval/` (held-out evaluation workspace; not your lane).

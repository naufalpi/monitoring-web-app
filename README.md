# Monitoring Web App - Banjarnegara Watch

Web-based monitoring for public-facing sites to detect defacement and negative content (judol, porn, etc.) using outside-in HTTP checks and rendered page snapshots. Backend runs on Express + Prisma; frontend is Vue 3 + Vite.

## Prerequisites
- Docker Desktop (with Docker Compose)
- Node.js (optional, only if you want to run tests locally)

## Quick Start
1) Copy the environment file:
```bash
copy .env.example .env
```
2) Start services:
```bash
docker compose up -d --build
```
3) Run migrations:
```bash
docker compose exec web npx prisma migrate deploy
```
4) Seed the default SUPER_ADMIN user:
```bash
docker compose exec web node prisma/seed.js
```
5) Open the UI:
- http://localhost:3000
- UI is a single-page app with client-side routing (e.g., `/login`, `/targets`).

## Dev Workflow (No Rebuild On Every Change)
This repo includes `docker-compose.override.yml` to mount source code and run nodemon + Vite inside containers.

1) Build once:
```bash
docker compose build web worker
```
2) Start dev mode:
```bash
docker compose up -d
```
3) Open the SPA dev server:
- http://localhost:5173
4) Edit files in `src/` (backend) or `frontend/` (UI) - containers auto-reload.

## Add Your First Target
- Go to **Targets**
- Add a name, URL, group/OPD, and interval
- The worker will begin polling within the interval and push updates to the dashboard

## Telegram Configuration
Set these in `.env`:
```
TELEGRAM_BOT_TOKEN=your_token
TELEGRAM_CHAT_ID=your_chat_id
```
Restart services:
```bash
docker compose restart web worker
```

When an incident opens, Telegram will receive:
- Target name + URL
- Status / severity
- Top reasons + confidence
- Timestamp (Asia/Jakarta)
- Link to incident detail
- Optional ACK link (short-lived)

## Status & Incident Logic
- **HEALTHY**: normal content + no anomalies
- **DOWN**: HTTP >= 400 or timeout
- **REDIRECT**: suspicious redirect to different host/path
- **CHANGED**: significant HTML/text or screenshot hash change
- **SUSPECTED_DEFACEMENT**: negative content or defacement phrases detected

Incident is created when:
- Negative score >= threshold, or
- Defacement phrase found, or
- Suspicious redirect + content mismatch, or
- Large layout change with defacement signals

Incident auto-closes after N consecutive clean checks (configurable), otherwise manual close.

## Security Notes
- **SSRF protection**: blocks localhost and private IP ranges, validates DNS resolution before fetch/render, disallows non-http(s) schemes.
- **Timeouts**: strict timeouts for HTTP fetches and Playwright rendering.
- **Worker sandboxing**: Playwright runs in isolated container, request interception blocks local hosts.
- **Safe rendering**: HTML snapshots are sanitized and served via safe download links; scripts are never executed.
- **Secure cookies**: HttpOnly + SameSite, Secure in production.

## Image Classifier
This project includes an optional NSFW image classifier (nsfwjs). You can choose a built-in model with
`IMAGE_CLASSIFIER_MODEL` (default: `MobileNetV2`; alternatives: `MobileNetV2Mid`, `InceptionV3`).
Tune sensitivity with:
- `ENABLE_IMAGE_CLASSIFIER`
- `IMAGE_CLASSIFIER_MIN_CONFIDENCE`
- `IMAGE_CLASSIFIER_INPUT_SIZE`

## Scripts
- `npm run dev` - `docker compose up`
- `npm run dev:ui` - start Vite dev server (use with backend running)
- `npm run build:ui` - build SPA into `frontend/dist`
- `npm run preview:ui` - preview Vite build locally
- `npm run compose:up` - start containers in background
- `npm run compose:down` - stop and remove containers/volumes
- `npm run logs` - follow container logs
- `npm run prisma:migrate` - run migrations
- `npm run prisma:seed` - seed SUPER_ADMIN
- `npm run test` - run unit tests

## Project Structure
```
frontend/  Vue 3 + Vite SPA (source + build output)
src/
  server/      Express app, routes, auth, SSE
  monitoring/  Scheduler, queue, checkers, detector, evidence
  services/    Telegram, event bus, ack tokens
  db/          Prisma client
prisma/        Schema + migrations + seed
```

## Environment Reference
See `.env.example` for all options including:
- intervals and concurrency
- negative content thresholds
- ACK token TTL
- OCR feature flag
- image detection heuristics (skin-tone ratio)
- NSFW image classifier (nsfwjs model)
- body and HTML size limits for checks

## How to Run Tests (optional)
```bash
npm install
npm test
```

## Notes
- This system is outside-in only (no server agents).
- Playwright is used only for deeper checks when anomalies are detected.
- All dependencies are open-source.


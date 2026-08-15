# MedQueue Tashkent

Raqamli tibbiyot va elektron navbat ekotizimi — Toshkent shifoxonalari, poliklinikalari va xususiy klinikalari uchun. (Digital medicine & queue ecosystem for Tashkent. / Цифровая медицина и электронные очереди Ташкента.)

## Stack

- **Frontend**: React 19, Vite 8, Tailwind CSS v4, framer-motion, three.js (@react-three/fiber)
- **Backend**: zero-dependency Node HTTP server (`server/index.js`) — in-memory demo data
- **Telegram bot**: long polling / webhook (`server/telegram.js`), sharing the same AI service as the website
- **AI**: OpenAI-compatible chat completions + optional web search (duckduckgo by default; tavily / brave / serpapi supported)

## Features

- AI assistant (`/ai`) — markdown rendering, copy, regenerate, web-search sources, image & file analysis
- Clinics (`/clinics`) and doctors (`/doctors`) search with live queue info
- Live queue tracking (`/queue`) with SSE updates and cancellation
- Laboratory results (`/laboratory`), personal cabinet (`/cabinet`), statistics (`/stats`)
- Dark/light themes, Uzbek / Russian / English, Telegram Mini App support

## Getting started

```bash
npm install
cp .env.example .env   # fill in TELEGRAM_BOT_TOKEN, AI_API_KEY, ...
npm run server         # backend on :3001
npm run dev            # frontend on :5173
```

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run server` | Backend API + Telegram bot |
| `npm run server:dev` | Backend with `--watch` |
| `npm run lint` | Oxlint |
| `npm run build` | Production build |
| `npm run preview` | Preview the production build |

## Security notes

- `.env` is gitignored — never commit real tokens. `.env.example` documents the variables.
- API keys are only used server-side; the React app talks exclusively to `/api/*` (Vite proxies `/api` → `http://localhost:3001`).
- The web reader (`server/webreader.js`) and search results are SSRF-filtered and time-limited.

# HandyRabbit Mini App (secure Telegram auth + Supabase RLS)

## 1) Apply DB schema
1. Open Supabase SQL Editor.
2. Run `SUPABASE_SCHEMA.sql`.

## 2) Configure backend
1. Copy `.env.example` to `.env` and fill values.
2. Start backend:

```bash
npm start
```

Server exposes `POST /api/auth/telegram`.

## 3) Configure frontend
Set global variables before `app.js`:

- `window.SUPABASE_URL`
- `window.SUPABASE_ANON_KEY`
- `window.AUTH_ENDPOINT` (optional, default `/api/auth/telegram`)

The frontend sends raw Telegram `initData` to backend and uses returned JWT as Supabase Authorization header.

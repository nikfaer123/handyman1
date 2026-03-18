# HandyRabbit Mini App (production hardening)

## Stack
- Frontend: `index.html` + `styles.css` + `app.js`
- Backend: `server.js` (Node.js, no heavy framework)
- Data/Auth: Supabase

## 1) Run SQL migration
Execute `SUPABASE_SCHEMA.sql` in Supabase SQL Editor.

## 2) Configure backend
Copy `.env.example` -> `.env` and fill values.

Start:

```bash
npm start
```

Backend endpoints:
- `POST /api/auth/telegram`
- `GET /api/me`
- `POST /api/notify`
- `POST /api/admin/block-user`
- `POST /api/admin/order-action`

## 3) Configure frontend
Set globals before loading `app.js`:
- `window.SUPABASE_URL`
- `window.SUPABASE_ANON_KEY`
- `window.AUTH_ENDPOINT` (optional, default `/api/auth/telegram`)

## 4) Deploy
### Render (backend)
- redeploy `server.js`
- add new envs: `ADMIN_TELEGRAM_IDS`, `MINI_APP_URL`

### Netlify (frontend)
- redeploy `index.html`, `styles.css`, `app.js`
- ensure frontend can call backend domain (CORS allowed by backend)

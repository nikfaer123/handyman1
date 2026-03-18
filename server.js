require('dotenv').config();

const http = require('http');
const crypto = require('crypto');
const { URL } = require('url');

const PORT = Number(process.env.PORT || 3000);
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET;
const JWT_TTL_SECONDS = Number(process.env.JWT_TTL_SECONDS || 60 * 60 * 8);
const INIT_DATA_MAX_AGE_SECONDS = Number(process.env.INIT_DATA_MAX_AGE_SECONDS || 60 * 15);

if (!TELEGRAM_BOT_TOKEN || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_JWT_SECRET) {
  throw new Error('Missing env vars: TELEGRAM_BOT_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_JWT_SECRET');
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) {
        reject(new Error('Payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

function parseInitData(rawInitData) {
  const params = new URLSearchParams(rawInitData);
  const hash = params.get('hash');
  if (!hash) throw new Error('initData has no hash');

  const fields = [];
  for (const [key, value] of params.entries()) {
    if (key !== 'hash') fields.push(`${key}=${value}`);
  }
  fields.sort();

  const secret = crypto.createHmac('sha256', 'WebAppData').update(TELEGRAM_BOT_TOKEN).digest();
  const check = crypto.createHmac('sha256', secret).update(fields.join('\n')).digest('hex');

  if (check !== hash) throw new Error('initData hash mismatch');

  const authDate = Number(params.get('auth_date') || 0);
  if (!authDate) throw new Error('initData missing auth_date');
  if (Math.abs(Math.floor(Date.now() / 1000) - authDate) > INIT_DATA_MAX_AGE_SECONDS) {
    throw new Error('initData is expired');
  }

  const userRaw = params.get('user');
  if (!userRaw) throw new Error('initData missing user');

  const user = JSON.parse(userRaw);
  if (!user?.id) throw new Error('Telegram user id missing');
  return user;
}

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

function signSupabaseJwt(payload) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));
  const data = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto.createHmac('sha256', SUPABASE_JWT_SECRET).update(data).digest('base64url');
  return `${data}.${signature}`;
}

async function upsertProfileFromTelegram(user) {
  const body = [{
    telegram_id: String(user.id),
    first_name: user.first_name || '',
    last_name: user.last_name || '',
    username: user.username || `tg_${user.id}`
  }];

  const response = await fetch(`${SUPABASE_URL}/rest/v1/profiles?on_conflict=telegram_id`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      Prefer: 'resolution=merge-duplicates,return=representation'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase profile upsert failed: ${text}`);
  }

  const rows = await response.json();
  return rows[0] || body[0];
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(payload));
}

const server = http.createServer(async (req, res) => {
  const reqUrl = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'OPTIONS') {
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === 'POST' && reqUrl.pathname === '/api/auth/telegram') {
    try {
      const body = await readJsonBody(req);
      const initData = String(body.initData || '');
      if (!initData) return sendJson(res, 400, { error: 'initData is required' });

      const telegramUser = parseInitData(initData);
      const profile = await upsertProfileFromTelegram(telegramUser);
      const now = Math.floor(Date.now() / 1000);
      const accessToken = signSupabaseJwt({
        aud: 'authenticated',
        iss: 'handyrabbit-auth',
        sub: String(telegramUser.id),
        role: 'authenticated',
        telegram_id: String(telegramUser.id),
        app_role: profile.role || null,
        iat: now,
        exp: now + JWT_TTL_SECONDS
      });

      return sendJson(res, 200, {
        accessToken,
        expiresIn: JWT_TTL_SECONDS,
        user: {
          id: telegramUser.id,
          username: telegramUser.username || '',
          first_name: telegramUser.first_name || '',
          last_name: telegramUser.last_name || ''
        }
      });
    } catch (error) {
      return sendJson(res, 401, { error: error.message || 'Unauthorized' });
    }
  }

  return sendJson(res, 404, { error: 'Not found' });
});

server.listen(PORT, () => {
  console.log(`Telegram auth server listening on :${PORT}`);
});

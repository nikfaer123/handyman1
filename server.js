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
const ADMIN_TELEGRAM_IDS = new Set((process.env.ADMIN_TELEGRAM_IDS || '').split(',').map((v) => v.trim()).filter(Boolean));
const MINI_APP_URL = process.env.MINI_APP_URL || '';

if (!TELEGRAM_BOT_TOKEN || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_JWT_SECRET) {
  throw new Error('Missing env vars: TELEGRAM_BOT_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_JWT_SECRET');
}

const dedupeMap = new Map();
function dedupeKey(key, ttlMs = 10_000) {
  const now = Date.now();
  const prev = dedupeMap.get(key) || 0;
  if (prev > now) return true;
  dedupeMap.set(key, now + ttlMs);
  return false;
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

function decodeAndVerifyJwt(token) {
  const [header, payload, signature] = String(token || '').split('.');
  if (!header || !payload || !signature) throw new Error('Invalid token format');
  const data = `${header}.${payload}`;
  const expected = crypto.createHmac('sha256', SUPABASE_JWT_SECRET).update(data).digest('base64url');
  if (expected !== signature) throw new Error('Invalid token signature');
  const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  const now = Math.floor(Date.now() / 1000);
  if (!parsed.exp || parsed.exp < now) throw new Error('Token expired');
  return parsed;
}

function getBearerToken(req) {
  const header = req.headers.authorization || '';
  const [type, token] = header.split(' ');
  if (type !== 'Bearer' || !token) throw new Error('Missing bearer token');
  return token;
}

function isAdmin(telegramId) {
  return ADMIN_TELEGRAM_IDS.has(String(telegramId));
}

async function sbRequest(path, { method = 'GET', body, query = '' } = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${path}${query}`;
  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      Prefer: 'return=representation'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!response.ok) {
    throw new Error(`Supabase ${method} ${path} failed: ${await response.text()}`);
  }
  if (response.status === 204) return null;
  return response.json();
}

async function upsertProfileFromTelegram(user) {
  const telegramId = String(user.id);
  const payload = {
    telegram_id: telegramId,
    first_name: user.first_name || '',
    last_name: user.last_name || '',
    username: user.username || `tg_${user.id}`
  };

  const existingRows = await sbRequest(
    `profiles?telegram_id=eq.${encodeURIComponent(telegramId)}&select=*`
  );

  if (existingRows?.length) {
    const rows = await sbRequest(
      `profiles?telegram_id=eq.${encodeURIComponent(telegramId)}`,
      {
        method: 'PATCH',
        body: payload
      }
    );
    return rows?.[0] || { ...existingRows[0], ...payload };
  }

  const rows = await sbRequest('profiles', {
    method: 'POST',
    body: [payload]
  });

  return rows?.[0] || payload;
}

async function getProfile(telegramId) {
  const rows = await sbRequest(`profiles?telegram_id=eq.${encodeURIComponent(String(telegramId))}&select=*`);
  return rows?.[0] || null;
}

async function requireAuth(req) {
  const token = getBearerToken(req);
  const claims = decodeAndVerifyJwt(token);
  const telegramId = String(claims.telegram_id || claims.sub || '');
  if (!telegramId) throw new Error('No telegram id in token');
  const profile = await getProfile(telegramId);
  return { telegramId, claims, profile };
}

function requireNotBlocked(profile) {
  if (profile?.is_blocked) throw new Error('Ваш аккаунт заблокирован');
}

function requireAdminRole(telegramId) {
  if (!isAdmin(telegramId)) throw new Error('Admin only endpoint');
}

async function requireOrderParticipant(orderId, telegramId) {
  const rows = await sbRequest(`orders?id=eq.${orderId}&select=*`);
  const order = rows?.[0];
  if (!order) throw new Error('Order not found');
  const allowed = String(order.customer_telegram_id) === String(telegramId) || String(order.assigned_tasker_telegram_id || '') === String(telegramId);
  if (!allowed) throw new Error('Not order participant');
  return order;
}

async function sendTelegramMessage(chatId, text, options = {}) {
  try {
    const payload = {
      chat_id: String(chatId),
      text,
      disable_web_page_preview: true
    };

    if (options.withMiniAppButton && MINI_APP_URL) {
      payload.reply_markup = {
        inline_keyboard: [[{ text: 'Открыть HandyRabbit', web_app: { url: MINI_APP_URL } }]]
      };
    }

    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      console.error('[telegram/sendMessage]', await response.text());
    }
  } catch (error) {
    console.error('[sendTelegramMessage error]', error);
  }
}

async function notifyOrderParticipants(orderId, text, actorTelegramId) {
  const rows = await sbRequest(`orders?id=eq.${orderId}&select=*`);
  const order = rows?.[0];
  if (!order) return;

  const recipients = new Set([
    String(order.customer_telegram_id || ''),
    String(order.assigned_tasker_telegram_id || '')
  ]);

  recipients.delete('');
  recipients.delete(String(actorTelegramId || ''));

  for (const receiver of recipients) {
    await sendTelegramMessage(receiver, text, { withMiniAppButton: true });
  }
}

async function handleNotifyEvent(auth, payload) {
  const { type, orderId, chatId, taskerTelegramId } = payload;
  const actorId = auth.telegramId;

  if (!type) throw new Error('type is required');
  const key = `${type}:${orderId || ''}:${chatId || ''}:${taskerTelegramId || ''}:${actorId}`;
  if (dedupeKey(key)) return { ok: true, deduped: true };

  if (type === 'new_response' && orderId) {
    const rows = await sbRequest(`orders?id=eq.${orderId}&select=customer_telegram_id,title`);
    const order = rows?.[0];
    if (order && String(order.customer_telegram_id) !== String(actorId)) {
      await sendTelegramMessage(order.customer_telegram_id, `Новый отклик на заказ: ${order.title}`, { withMiniAppButton: true });
    }
  }

  if (type === 'tasker_assigned' && orderId && taskerTelegramId && String(taskerTelegramId) !== String(actorId)) {
    await sendTelegramMessage(taskerTelegramId, `Вас выбрали исполнителем по заказу #${orderId.slice(0, 8)}`, { withMiniAppButton: true });
  }

  if (type === 'new_message' && chatId) {
    const rows = await sbRequest(`chats?id=eq.${chatId}&select=*`);
    const chat = rows?.[0];
    if (chat) {
      const other = String(chat.customer_telegram_id) === String(actorId) ? chat.tasker_telegram_id : chat.customer_telegram_id;
      if (other && String(other) !== String(actorId)) {
        await sendTelegramMessage(other, 'Новое сообщение в чате HandyRabbit', { withMiniAppButton: true });
      }
    }
  }

  if (type === 'order_done' && orderId) {
    await notifyOrderParticipants(orderId, 'Заказ завершён', actorId);
  }

  if (type === 'order_canceled' && orderId) {
    await notifyOrderParticipants(orderId, 'Заказ отменён', actorId);
  }

  return { ok: true };
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization'
  });
  res.end(JSON.stringify(payload));
}

const server = http.createServer(async (req, res) => {
  const reqUrl = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'OPTIONS') {
    return sendJson(res, 200, { ok: true });
  }

  try {
    if (req.method === 'POST' && reqUrl.pathname === '/api/auth/telegram') {
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
    }

    if (req.method === 'GET' && reqUrl.pathname === '/api/me') {
      const auth = await requireAuth(req);
      return sendJson(res, 200, { ok: true, telegramId: auth.telegramId, isAdmin: isAdmin(auth.telegramId), isBlocked: Boolean(auth.profile?.is_blocked) });
    }

    if (req.method === 'POST' && reqUrl.pathname === '/api/notify') {
      const auth = await requireAuth(req);
      requireNotBlocked(auth.profile);
      const body = await readJsonBody(req);
      const result = await handleNotifyEvent(auth, body);
      return sendJson(res, 200, result);
    }

    if (req.method === 'POST' && reqUrl.pathname === '/api/orders/complete-action') {
      const auth = await requireAuth(req);
      requireNotBlocked(auth.profile);
      const body = await readJsonBody(req);
      const orderId = String(body.orderId || '');
      const action = String(body.action || '');
      if (!orderId || !action) return sendJson(res, 400, { error: 'orderId and action are required' });

      const order = await requireOrderParticipant(orderId, auth.telegramId);
      const nowIso = new Date().toISOString();

      if (action === 'request_by_tasker') {
        if (String(order.assigned_tasker_telegram_id || '') !== String(auth.telegramId)) {
          return sendJson(res, 403, { error: 'Only assigned tasker can request completion' });
        }
        if (order.status !== 'in_progress') {
          return sendJson(res, 400, { error: 'Completion request allowed only in in_progress' });
        }

        await sbRequest(`orders?id=eq.${orderId}`, {
          method: 'PATCH',
          body: {
            status: 'awaiting_customer_confirmation',
            completion_requested_by_tasker_id: auth.telegramId,
            completion_requested_by_tasker_at: nowIso,
            updated_at: nowIso
          }
        });
        await notifyOrderParticipants(orderId, 'Исполнитель запросил завершение заказа', auth.telegramId);
        return sendJson(res, 200, { ok: true, status: 'awaiting_customer_confirmation' });
      }

      if (action === 'confirm_by_customer' || action === 'direct_by_customer') {
        if (String(order.customer_telegram_id || '') !== String(auth.telegramId)) {
          return sendJson(res, 403, { error: 'Only customer can complete order' });
        }

        if (action === 'confirm_by_customer' && order.status !== 'awaiting_customer_confirmation') {
          return sendJson(res, 400, { error: 'Order is not waiting for customer confirmation' });
        }

        if (action === 'direct_by_customer' && !['assigned', 'in_progress', 'awaiting_customer_confirmation'].includes(order.status)) {
          return sendJson(res, 400, { error: 'Direct completion is not allowed for current status' });
        }

        await sbRequest(`orders?id=eq.${orderId}`, {
          method: 'PATCH',
          body: {
            status: 'done',
            updated_at: nowIso
          }
        });
        await notifyOrderParticipants(orderId, 'Заказ завершён', auth.telegramId);
        return sendJson(res, 200, { ok: true, status: 'done' });
      }

      return sendJson(res, 400, { error: 'Unknown completion action' });
    }

    if (req.method === 'POST' && reqUrl.pathname === '/api/admin/block-user') {
      const auth = await requireAuth(req);
      requireAdminRole(auth.telegramId);
      const body = await readJsonBody(req);
      const targetTelegramId = String(body.targetTelegramId || '').trim();
      const reason = String(body.reason || 'Заблокирован администратором').slice(0, 280);
      if (!targetTelegramId) return sendJson(res, 400, { error: 'targetTelegramId is required' });

      await sbRequest(`profiles?telegram_id=eq.${encodeURIComponent(targetTelegramId)}`, {
        method: 'PATCH',
        body: {
          is_blocked: true,
          blocked_reason: reason,
          blocked_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      });

      await sendTelegramMessage(targetTelegramId, `Ваш аккаунт заблокирован. Причина: ${reason}`, { withMiniAppButton: true });
      return sendJson(res, 200, { ok: true });
    }

    if (req.method === 'POST' && reqUrl.pathname === '/api/admin/order-action') {
      const auth = await requireAuth(req);
      requireAdminRole(auth.telegramId);
      const body = await readJsonBody(req);
      const { orderId, action } = body;
      const reason = String(body.reason || '').slice(0, 300);
      if (!orderId || !action) return sendJson(res, 400, { error: 'orderId and action are required' });

      const patch = { updated_at: new Date().toISOString() };
      if (action === 'hide') {
        patch.status = 'hidden';
        patch.hidden_reason = reason || 'Скрыт администратором';
        patch.hidden_by_admin = auth.telegramId;
        patch.hidden_at = new Date().toISOString();
      } else if (action === 'force_done') {
        patch.status = 'done';
      } else if (action === 'force_canceled') {
        patch.status = 'canceled';
      } else {
        return sendJson(res, 400, { error: 'Unknown action' });
      }

      await sbRequest(`orders?id=eq.${orderId}`, { method: 'PATCH', body: patch });
      await notifyOrderParticipants(orderId, 'Статус заказа обновлён администратором', auth.telegramId);
      return sendJson(res, 200, { ok: true });
    }

    return sendJson(res, 404, { error: 'Not found' });
  } catch (error) {
    console.error('[server error]', error);
    return sendJson(res, 401, { error: error.message || 'Unauthorized' });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Telegram auth server listening on :${PORT}`);
});
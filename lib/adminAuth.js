import crypto from 'crypto';

const COOKIE_NAME = 'license_admin_session';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

function getSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) {
    throw new Error('ADMIN_SESSION_SECRET is not set');
  }
  return secret;
}

function sign(payload) {
  const json = JSON.stringify(payload);
  const body = Buffer.from(json, 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', getSecret()).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function verify(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;

  const expectedSig = crypto.createHmac('sha256', getSecret()).update(body).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch (e) {
    return null;
  }
}

// Vercel terminates TLS in front of the function, so `req` itself always
// looks like plain HTTP — process.env.NODE_ENV is a reasonable proxy for
// "are we deployed" most of the time, but it's not what the browser
// actually checks. What the browser checks is the connection it made, so
// we ask the platform via the standard forwarded-proto header (set by
// Vercel, and by `next start` behind any other reverse proxy) with
// NODE_ENV as a fallback for the rare case a proxy doesn't set it. This
// matters because a cookie set with `Secure` over what the browser sees
// as a plain http:// origin is silently dropped — never stored at all —
// which looks exactly like "asks to log in again every time".
function isHttpsRequest(req) {
  const proto = req?.headers?.['x-forwarded-proto'];
  if (proto) return proto.split(',')[0].trim() === 'https';
  return process.env.NODE_ENV === 'production';
}

function buildCookie(token, req, maxAgeSeconds) {
  const parts = [
    `${COOKIE_NAME}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAgeSeconds}`,
  ];
  if (isHttpsRequest(req)) parts.push('Secure');
  return parts.join('; ');
}

export function createSessionCookie(admin, req) {
  const token = sign({ id: admin.id, username: admin.username, iat: Date.now() });
  return buildCookie(token, req, MAX_AGE_SECONDS);
}

export function clearSessionCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function getSessionFromReq(req) {
  const cookieHeader = req.headers?.cookie || '';
  const match = cookieHeader
    .split(';')
    .map((s) => s.trim())
    .find((s) => s.startsWith(`${COOKIE_NAME}=`));
  if (!match) return null;
  const token = match.slice(COOKIE_NAME.length + 1);
  return verify(token);
}

// Sliding expiration: every authenticated request re-issues the cookie
// with a fresh 30-day Max-Age, instead of only setting it once at login.
// Without this, an admin who logs in and comes back daily still gets
// logged out the moment 30 days have passed since that one login — the
// cookie's clock never resets just because it's being used. Call this
// wherever a valid session was found and `res` is available to write a
// new Set-Cookie header.
function touchSession(session, req, res) {
  const token = sign({ id: session.id, username: session.username, iat: Date.now() });
  res.setHeader('Set-Cookie', buildCookie(token, req, MAX_AGE_SECONDS));
}

// For pages/api/* routes: returns the session or writes a 401 and returns null.
export function requireAdminApi(req, res) {
  const session = getSessionFromReq(req);
  if (!session) {
    res.status(401).json({ ok: false, error: 'unauthorized' });
    return null;
  }
  touchSession(session, req, res);
  return session;
}

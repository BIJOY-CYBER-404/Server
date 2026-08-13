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

export function createSessionCookie(admin, req) {
  const token = sign({ id: admin.id, username: admin.username, iat: Date.now() });
  // NODE_ENV alone can be unreliable across some deploy configurations —
  // also check the proxy-set header Vercel adds on every HTTPS request,
  // so we don't accidentally skip the Secure flag (and end up with a
  // cookie the browser is more willing to drop) in production.
  const isHttps = process.env.NODE_ENV === 'production' || req?.headers?.['x-forwarded-proto'] === 'https';
  const parts = [
    `${COOKIE_NAME}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${MAX_AGE_SECONDS}`,
  ];
  if (isHttps) parts.push('Secure');
  return parts.join('; ');
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

// For pages/api/* routes: returns the session or writes a 401 and returns null.
export function requireAdminApi(req, res) {
  const session = getSessionFromReq(req);
  if (!session) {
    res.status(401).json({ ok: false, error: 'unauthorized' });
    return null;
  }
  return session;
}

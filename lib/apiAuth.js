// Every client-facing endpoint (status/check/trial/activate) requires this
// header, matching config.php's require_api_secret() in the PHP version.
export function requireApiSecret(req, res) {
  const secret = req.headers['x-api-secret'];
  if (!secret || secret !== process.env.API_SECRET) {
    res.status(401).json({ ok: false, error: 'unauthorized' });
    return false;
  }
  return true;
}

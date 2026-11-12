export class HttpError extends Error {
  constructor(status, message, details = undefined) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string' && req.body.trim()) {
    try { return JSON.parse(req.body); } catch { throw new HttpError(400, 'Request body must be JSON.'); }
  }
  return {};
}

export function sendError(res, err) {
  const status = err.status || 500;
  if (status >= 500) console.error('[email-api]', err);
  res.status(status).json({
    error: err.message || 'Unexpected error',
    ...(err.missing ? { missing: err.missing } : {}),
    ...(err.details ? { details: err.details } : {}),
  });
}

export const requireString = (value, name, { max = 5000, required = true } = {}) => {
  const s = typeof value === 'string' ? value.trim() : '';
  if (required && !s) throw new HttpError(400, `${name} is required.`);
  if (s.length > max) throw new HttpError(400, `${name} is too long (max ${max} characters).`);
  return s;
};

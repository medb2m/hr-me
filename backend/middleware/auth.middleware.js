import jwt from 'jsonwebtoken';
import { User } from '../models/user.model.js';
import { getJwtSecret } from '../utils/jwt.js';

/**
 * `Authorization: Bearer <access_token>` — same JWT as `/api/auth/login`.
 * Sets `req.user` = `{ id, email, role }`.
 */
export async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authorization required.' });
    }
    const token = authHeader.slice(7).trim();
    if (!token) {
      return res.status(401).json({ message: 'Authorization required.' });
    }

    let payload;
    try {
      payload = jwt.verify(token, getJwtSecret());
    } catch {
      return res.status(401).json({ message: 'Invalid or expired token.' });
    }

    const sub = payload.sub;
    if (!sub) {
      return res.status(401).json({ message: 'Invalid token payload.' });
    }

    const user = await User.findById(sub).select('email role name');
    if (!user) {
      return res.status(401).json({ message: 'User no longer exists.' });
    }

    req.user = {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      name: user.name || '',
    };
    next();
  } catch (err) {
    if (err.message?.includes('JWT_SECRET')) {
      console.error('[requireAuth]', err.message);
      return res.status(500).json({ message: 'Server auth misconfiguration.' });
    }
    console.error('[requireAuth]', err);
    return res.status(500).json({ message: 'Authorization failed.' });
  }
}

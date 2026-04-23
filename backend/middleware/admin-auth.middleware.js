import jwt from 'jsonwebtoken';
import { User } from '../models/user.model.js';
import { getJwtSecret } from '../utils/jwt.js';

/**
 * Verifies `Authorization: Bearer <token>`, ensures the user exists and has role `admin`.
 * Sets `req.admin` = `{ id, email, role }`.
 */
export async function requireAdmin(req, res, next) {
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

    const user = await User.findById(sub).select('email role');
    if (!user) {
      return res.status(401).json({ message: 'User no longer exists.' });
    }
    if (user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required.' });
    }

    req.admin = {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
    };
    next();
  } catch (err) {
    if (err.message?.includes('JWT_SECRET')) {
      console.error('[requireAdmin]', err.message);
      return res.status(500).json({ message: 'Server auth misconfiguration.' });
    }
    console.error('[requireAdmin]', err);
    return res.status(500).json({ message: 'Authorization failed.' });
  }
}

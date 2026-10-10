import jwt from 'jsonwebtoken';
import { User } from '../models/user.model.js';
import { getJwtSecret } from '../utils/jwt.js';

/**
 * Auth optionnelle — si un Bearer token valide est présent, remplit `req.user`
 * ({ id, email, role, name }) ; sinon continue anonymement.
 */
export async function optionalAuth(req, _res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return next();
    const token = authHeader.slice(7).trim();
    if (!token) return next();

    const payload = jwt.verify(token, getJwtSecret());
    if (!payload?.sub) return next();
    const user = await User.findById(payload.sub).select('email role name');
    if (user) {
      req.user = {
        id: user._id.toString(),
        email: user.email,
        role: user.role,
        name: user.name || '',
      };
    }
  } catch {
    /* token invalide → on reste anonyme */
  }
  next();
}

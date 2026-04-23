import jwt from 'jsonwebtoken';

export function getJwtSecret() {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 16) {
    throw new Error('JWT_SECRET is missing or too short.');
  }
  return s;
}

/**
 * @param {string} token
 * @returns {{ sub?: string; email?: string; role?: string; typ?: string; meetingId?: string; roomId?: string; meetingRole?: string }}
 */
export function verifyAccessToken(token) {
  return jwt.verify(token, getJwtSecret());
}

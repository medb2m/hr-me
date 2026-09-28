/**
 * À chaîner après `requireAuth` : réservé aux comptes `client`.
 */
export function requireClientRole(req, res, next) {
  if (req.user?.role !== 'client') {
    return res.status(403).json({ message: 'Espace réservé aux comptes candidat.' });
  }
  next();
}

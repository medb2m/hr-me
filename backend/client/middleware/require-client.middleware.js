/**
 * À chaîner après `requireAuth` : réservé aux comptes `client` et `candidate`.
 * Le dossier (`ClientProfile`, photos, CV) est partagé : un client promu
 * candidat par l'agence conserve l'accès à ses données existantes.
 */
export function requireClientRole(req, res, next) {
  const role = req.user?.role;
  if (role !== 'client' && role !== 'candidate') {
    return res.status(403).json({ message: 'Espace réservé aux comptes client et candidat.' });
  }
  next();
}

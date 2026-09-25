export const environment = {
  production: false,
  /**
   * Avec `ng serve`, `proxy.conf.json` envoie `/api` et `/uploads` vers le backend (port 5000).
   * En prod derrière nginx : même origine, `/api` → Node.
   */
  apiUrl: '/api',
  /** Vide = origine courante (Socket.io via Nginx). */
  wsUrl: '',
  /** If server sets ADMIN_BOOTSTRAP_SECRET, set the same value here so first admin creation works (keep out of public repos in production). */
  adminBootstrapSecret: '' as string,
};

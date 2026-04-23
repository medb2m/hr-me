export const environment = {
  production: false,
  apiUrl: 'http://localhost:5000/api',
  /** Socket.io origin (no `/api` suffix). */
  wsUrl: 'http://localhost:5000',
  /** If server sets ADMIN_BOOTSTRAP_SECRET, set the same value here so first admin creation works (keep out of public repos in production). */
  adminBootstrapSecret: '' as string,
};

export const environment = {
  production: true,
  /** Même origine que le front : nginx proxy `/api` → backend. */
  apiUrl: '/api',
  /** Vide = origine courante (navigateur) pour Socket.io. */
  wsUrl: '',
  adminBootstrapSecret: '' as string,
};

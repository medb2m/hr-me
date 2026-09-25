/** PM2 — HR-Me : API seule. Le front est servi en statique par nginx (dist/hr-me/browser). */
module.exports = {
  apps: [
    {
      name: 'hr-me-backend',
      cwd: '/var/www/hr-me/backend',
      script: 'server.js',
      interpreter: 'node',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};

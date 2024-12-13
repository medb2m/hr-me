import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

// Disable SSR: Serve static files directly
export function app(): express.Express {
  const server = express();
  const serverDistFolder = dirname(fileURLToPath(import.meta.url));
  const browserDistFolder = resolve(serverDistFolder, '../browser');

  // Serve static files from the browser build directory
  server.use(express.static(browserDistFolder, { maxAge: '1y' }));

  // Fallback to index.html for all other routes
  server.get('*', (req, res) => {
    res.sendFile(join(browserDistFolder, 'index.html'));
  });

  return server;
}

function run(): void {
  const port = process.env['PORT'] || 4000;

  // Start up the Node server
  const server = app();
  server.listen(port, () => {
    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

run();
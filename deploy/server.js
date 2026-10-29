// Serveur statique du portfolio (service systemd portfolio, derrière Nginx). Aucune dépendance.
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT) || 3007;
const ROOT = path.resolve(process.env.ROOT || path.join(__dirname, '..', 'public'));

// URL propres vers les pages HTML
const ROUTES = {
  '/': '/portfolio.html',
  '/projects-academiques': '/projects-academiques.html',
  '/projects-academiques/': '/projects-academiques.html'
};

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  '.mp4': 'video/mp4',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8'
};

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(body);
}

http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return send(res, 405, 'Method Not Allowed');
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    return send(res, 400, 'Bad Request');
  }
  pathname = ROUTES[pathname] || pathname;

  let file = path.join(ROOT, pathname);
  if (!file.startsWith(ROOT + path.sep)) {
    return send(res, 403, 'Forbidden');
  }

  fs.stat(file, (err, stat) => {
    if (!err && stat.isDirectory()) {
      file = path.join(file, 'index.html');
    }
    fs.stat(file, (err2, stat2) => {
      if (err2 || !stat2.isFile()) {
        return send(res, 404, 'Not Found');
      }
      res.writeHead(200, {
        'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
        'Content-Length': stat2.size
      });
      if (req.method === 'HEAD') {
        return res.end();
      }
      fs.createReadStream(file).pipe(res);
    });
  });
}).listen(PORT, '127.0.0.1', () => {
  console.log(`Portfolio servi depuis ${ROOT} sur http://127.0.0.1:${PORT}`);
});

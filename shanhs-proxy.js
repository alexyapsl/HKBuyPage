// shanhs-proxy.js
// Local/dev proxy for the ShanHS trade-in quote flow.
// Keeps the ShanHS appSecret server-side and adds CORS headers for browser testing.
//
// Setup:
//   1. Create .env.shanhs.local (not committed):
//        SHANHS_APP_ID=57
//        SHANHS_APP_SECRET=<toko.shs.app.secret.hk value>
//   2. node shanhs-proxy.js
//
// The page calls: POST http://localhost:8787/sapi/... with the raw bizContent object.

const http = require('http');
const https = require('https');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Minimal local env loader; real env vars take precedence.
const envFile = path.join(__dirname, '.env.shanhs.local');
if (fs.existsSync(envFile)) {
  fs.readFileSync(envFile, 'utf8').split(/\r?\n/).forEach(line => {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  });
}

const PORT = Number(process.env.SHANHS_PROXY_PORT || 8787);
const APP_ID = process.env.SHANHS_APP_ID || '57';
const SECRET = process.env.SHANHS_APP_SECRET || '';
const UPSTREAM = process.env.SHANHS_UPSTREAM || 'test.m.shanhs.com.cn';

const corsJson = () => ({ 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });

function signAndForward(pathname, bizContentObj, res) {
  if (!SECRET) {
    res.writeHead(500, corsJson());
    return res.end(JSON.stringify({ error: 'Missing SHANHS_APP_SECRET. Create .env.shanhs.local or set the env var.' }));
  }

  const bizContent = JSON.stringify(bizContentObj);
  const timestamp = Date.now();
  const signInput = `appId=${APP_ID}&bizContent=${bizContent}&timestamp=${timestamp}`;
  const sign = crypto.createHmac('sha256', Buffer.from(SECRET, 'utf8')).update(signInput, 'utf8').digest('hex');
  const body = JSON.stringify({ appId: APP_ID, bizContent, timestamp, sign, signType: 'HS256' });

  const req = https.request({
    hostname: UPSTREAM,
    path: pathname,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    timeout: 30000
  }, (up) => {
    let data = '';
    up.on('data', c => data += c);
    up.on('end', () => {
      res.writeHead(up.statusCode, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(data);
    });
  });
  req.on('timeout', () => { req.destroy(); res.writeHead(504, corsJson()); res.end('{"error":"upstream timeout"}'); });
  req.on('error', (e) => { res.writeHead(502, corsJson()); res.end(JSON.stringify({ error: e.message })); });
  req.write(body);
  req.end();
}

http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }
  if (req.method !== 'POST' || !req.url.startsWith('/sapi/')) {
    res.writeHead(404, corsJson());
    return res.end('{"error":"not found"}');
  }
  let body = '';
  req.on('data', c => body += c);
  req.on('end', () => {
    let biz;
    try { biz = JSON.parse(body || '{}'); }
    catch { res.writeHead(400, corsJson()); return res.end('{"error":"bad json body"}'); }
    signAndForward(req.url, biz, res);
  });
}).listen(PORT, () => console.log(`ShanHS proxy listening on http://localhost:${PORT} -> ${UPSTREAM}`));

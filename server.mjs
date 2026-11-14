// ENI Tutor: local server.
// Serves site/ and forwards POST /api/v1/chat/completions to an OpenAI-compatible
// API (DeepSeek by default). The API key lives in .env and never reaches the page.
// No dependencies; needs Node.js 20.12 or newer.

import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SITE = path.join(ROOT, 'site');

try { process.loadEnvFile(path.join(ROOT, '.env')); } catch { /* no .env: fall back to environment variables */ }

const PORT = Number(process.env.PORT) || 8000;
const API_KEY = (process.env.API_KEY || process.env.DEEPSEEK_API_KEY || '').trim();
const UPSTREAM = (process.env.UPSTREAM_BASE_URL || 'https://api.deepseek.com').replace(/\/+$/, '');
const MODEL = (process.env.MODEL || 'deepseek-chat').trim();

const TYPES = { '.html': 'text/html; charset=utf-8', '.ico': 'image/x-icon', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };

function sendJson(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks).toString('utf8');
}

async function proxyChat(req, res) {
  if (!API_KEY) {
    return sendJson(res, 500, { error: { message: 'No API key: create a .env file next to server.mjs (copy .env.example), add your key and restart the server.' } });
  }
  let body;
  try { body = JSON.parse(await readBody(req)); } catch {
    return sendJson(res, 400, { error: { message: 'Invalid JSON in request.' } });
  }
  body.model = MODEL; // the server picks the model, like the original hosted build

  const ac = new AbortController();
  res.on('close', () => { if (!res.writableEnded) ac.abort(); });

  let up;
  try {
    up = await fetch(UPSTREAM + '/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + API_KEY },
      body: JSON.stringify(body),
      signal: ac.signal,
    });
  } catch (e) {
    return sendJson(res, 502, { error: { message: 'Could not reach the API: ' + e.message } });
  }

  res.writeHead(up.status, {
    'Content-Type': up.headers.get('content-type') || 'application/json',
    'Cache-Control': 'no-cache',
  });
  if (!up.body) return res.end();
  try {
    for await (const chunk of up.body) res.write(chunk);
  } catch { /* the browser closed the request */ }
  res.end();
}

async function serveStatic(req, res) {
  let rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.join(SITE, path.normalize(rel));
  if (!file.startsWith(SITE + path.sep)) { res.writeHead(403); return res.end(); }
  try {
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  }
}

http.createServer(async (req, res) => {
  try {
    const { pathname } = new URL(req.url, 'http://x');
    if (pathname === '/api/v1/chat/completions') {
      if (req.method !== 'POST') return sendJson(res, 405, { error: { message: 'POST only.' } });
      return await proxyChat(req, res);
    }
    if (req.method === 'GET' || req.method === 'HEAD') return await serveStatic(req, res);
    res.writeHead(405); res.end();
  } catch (e) {
    if (!res.headersSent) sendJson(res, 500, { error: { message: String(e && e.message || e) } });
    else res.end();
  }
}).listen(PORT, '127.0.0.1', () => {
  console.log(`ENI Tutor running at http://localhost:${PORT}  (API: ${UPSTREAM}, model: ${MODEL}, key: ${API_KEY ? 'set' : 'MISSING'})`);
});

import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { ROOT } from './lib/data.mjs';
const T = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.xml': 'application/xml', '.txt': 'text/plain' };
createServer((q, r) => {
  let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  const f = join(ROOT, 'dist', p);
  if (!f.startsWith(join(ROOT, 'dist')) || !existsSync(f) || statSync(f).isDirectory()) { r.writeHead(404); return r.end('not found'); }
  r.writeHead(200, { 'content-type': T[extname(f)] || 'application/octet-stream' }); r.end(readFileSync(f));
}).listen(process.env.PORT || 8080, () => console.log('http://localhost:' + (process.env.PORT || 8080)));

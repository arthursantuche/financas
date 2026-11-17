// Bateria de layout: roda testes/checar-layout.js (regras do Diretório - Identidade Visual - Apple,
// seção 13) nas rotas do portal, em celular em pé e deitado, iPad e computador, nos dois temas.
// Uso: node testes/layout.mjs   (sai com código 1 se houver problema; avisos só são listados)
import http from 'node:http';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const RAIZ = join(fileURLToPath(import.meta.url), '..', '..');
const require = createRequire(import.meta.url);
const { chromium } = require(join(execSync('npm root -g').toString().trim(), '@playwright/cli/node_modules/playwright-core'));
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.md': 'text/markdown; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const codigo = await readFile(join(RAIZ, 'testes', 'checar-layout.js'), 'utf8');
const site = http.createServer(async (req, res) => {
  const c = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (c === '/__checar-layout.js') { res.writeHead(200, { 'Content-Type': 'text/javascript' }); return res.end(codigo); }
  try { const d = await readFile(join(RAIZ, 'Portal', c === '/' ? 'index.html' : c)); res.writeHead(200, { 'Content-Type': TIPOS[extname(c)] || 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(d); }
  catch { res.writeHead(404); res.end(); }
});
await new Promise((ok) => site.listen(0, '127.0.0.1', ok));
const BASE = `http://127.0.0.1:${site.address().port}`;
const ROTAS = ['#inicio', '#aprender', '#aprender/renda-fixa', '#artigo/opcoes', '#indicadores', '#simuladores', '#simuladores/juros-compostos', '#sobre', '#saude', '#entrar',
  '?amostra#carteira', '?amostra#ativo/a-demo-1', '?amostra#lancar', '?amostra#analise', '?amostra#analise/PETR4', '?amostra#alertas', '?amostra#agente', '?amostra#ajustes'];
const TELAS = [[320, 640, true], [390, 844, true], [844, 390, true], [1024, 768, false], [1440, 900, false]];
const navegador = await chromium.launch({ channel: 'chrome', headless: true }).catch(() => chromium.launch({ headless: true }));
const problemas = new Map(), avisos = new Map();
for (const [w, h, toque] of TELAS) for (const tema of ['light', 'dark']) {
  const ctx = await navegador.newContext({ viewport: { width: w, height: h }, colorScheme: tema, hasTouch: toque, isMobile: toque, reducedMotion: 'reduce' });
  const p = await ctx.newPage();
  for (const rota of ROTAS) {
    await p.goto(`${BASE}/${rota}`);
    const alvo = decodeURIComponent(rota.split('#')[1] || 'inicio');
    await p.waitForFunction((a) => document.querySelector('#pagina')?.dataset.rota === a && document.querySelector('#pagina h1'), alvo, { timeout: 15000 }).catch(() => { console.log(`  rota não desenhou: ${rota} ${w}×${h}`); });
    await p.waitForTimeout(500);
    const r = await p.evaluate(async () => (await import('/__checar-layout.js')).checarLayout());
    for (const x of r.problemas) (problemas.get(x) || problemas.set(x, new Set()).get(x)).add(`${rota} ${w}×${h} ${tema}`);
    for (const x of r.avisos) (avisos.get(x) || avisos.set(x, new Set()).get(x)).add(`${rota} ${w}×${h}`);
  }
  await ctx.close();
}
await navegador.close(); site.close();
const mostrar = (m, rotulo) => { console.log(`\n${rotulo}: ${m.size}`); for (const [x, onde] of m) console.log(`- ${x}\n    ${[...onde].slice(0, 4).join(' | ')}${onde.size > 4 ? ` (+${onde.size - 4})` : ''}`); };
mostrar(problemas, 'Problemas'); mostrar(avisos, 'Avisos');
process.exit(problemas.size ? 1 : 0);

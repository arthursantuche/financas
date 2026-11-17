// Estados de interação e alinhamento de números (DESIGN.md, "Interação" e "Números").
// Prova, pelo estilo calculado no navegador, que cada tipo de componente reage como o padrão diz:
// destino (título azul com o cursor, borda inalterada, recuo no toque), escolha (título azul e seta
// que desliza), linha de lista (só o título da linha), rodapé (cinza e sublinhado, sem azul),
// informação (nada muda), foco (anel azul de 2 px) e números (valor sempre abaixo do rótulo, alinhados).
// Roda nos dois temas. Uso: node testes/estados.mjs   (sai com 1 se algo falhar)
import http from 'node:http';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const RAIZ = join(fileURLToPath(import.meta.url), '..', '..');
const require = createRequire(import.meta.url);
const { chromium } = require(join(execSync('npm root -g').toString().trim(), '@playwright/cli/node_modules/playwright-core'));
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.md': 'text/markdown; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png' };
const site = http.createServer(async (req, res) => {
  const c = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  try { const d = await readFile(join(RAIZ, 'Portal', c === '/' ? 'index.html' : c)); res.writeHead(200, { 'Content-Type': TIPOS[extname(c)] || 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(d); }
  catch { res.writeHead(404); res.end(); }
});
await new Promise((ok) => site.listen(0, '127.0.0.1', ok));
const BASE = `http://127.0.0.1:${site.address().port}`;

const falhas = [], certas = [];
const conferir = (cond, nome, detalhe = '') => { (cond ? certas : falhas).push(nome); if (!cond) console.log(`  ✖ ${nome}${detalhe ? `: ${detalhe}` : ''}`); };
const navegador = await chromium.launch({ channel: 'chrome', headless: true }).catch(() => chromium.launch({ headless: true }));

for (const tema of ['light', 'dark']) {
  console.log(`Tema ${tema}`);
  const ctx = await navegador.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: tema });
  const p = await ctx.newPage();
  const ir = async (rota) => {
    await p.goto(`${BASE}/${rota}`);
    const alvo = decodeURIComponent(rota.split('#')[1] || 'inicio');
    await p.waitForFunction((a) => document.querySelector('#pagina')?.dataset.rota === a, alvo, { timeout: 20000 });
    await p.waitForTimeout(900);
    await p.mouse.move(1, 1);
  };
  const cor = (nome) => p.evaluate((n) => { const d = document.createElement('div'); d.style.color = `var(${n})`; document.body.append(d); const c = getComputedStyle(d).color; d.remove(); return c; }, nome);
  let LINK, TEXTO, TEXTO2; // cores de referência, lidas depois que a folha de estilo carrega
  const estilo = (sel, prop, pseudo = null) => p.$eval(sel, (e, [pr, ps]) => getComputedStyle(e, ps)[pr], [prop, pseudo]);
  const sobre = async (sel) => { const e = await p.$(sel); await e.scrollIntoViewIfNeeded(); await e.hover(); await p.waitForTimeout(800); };
  const fora = async () => { await p.mouse.move(1, 1); await p.waitForTimeout(800); };

  // Destino: cartão de trilha e cartão de artigo.
  await ir('#inicio');
  [LINK, TEXTO, TEXTO2] = [await cor('--cor-link'), await cor('--cor-texto'), await cor('--cor-texto-2')];
  for (const [sel, tit] of [['a.card--trilha', '.card__titulo'], ['a.card--artigo', '.kicker']]) {
    const t = `${sel} ${tit}`;
    const antes = { cor: await estilo(t, 'color'), sombra: await estilo(sel, 'boxShadow') };
    await sobre(sel);
    conferir(antes.cor !== LINK && (await estilo(t, 'color')) === LINK, `${sel}: título azul só com o cursor (${tema})`, antes.cor);
    conferir((await estilo(sel, 'boxShadow')) === antes.sombra, `${sel}: borda não muda com o cursor (${tema})`);
    await fora();
  }
  conferir(!(await p.$('a.card .cor-link')), `nenhum "Abrir"/"Ler" azul dentro de cartão clicável (${tema})`);
  // Toque: recuo do cartão e da pílula.
  for (const [sel, escala] of [['a.card--artigo', '0.985'], ['.hero .pill', '0.97']]) {
    const e = await p.$(sel); await e.scrollIntoViewIfNeeded(); const b = await e.boundingBox();
    await p.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await p.mouse.down(); await p.waitForTimeout(350);
    // Solta fora do elemento: o toque não vira clique e a página não muda.
    const m = await estilo(sel, 'transform'); await p.mouse.move(1, 1); await p.mouse.up(); await fora();
    conferir(m.startsWith(`matrix(${escala}`), `${sel}: recua para ${escala}× no toque (${tema})`, m);
  }
  // Escolha: título azul e seta que desliza.
  const esc = 'a.escolha';
  await sobre(esc);
  conferir((await estilo(`${esc} .escolha__nome`, 'color')) === LINK, `escolha: título azul com o cursor (${tema})`);
  conferir((await estilo(esc, 'transform', '::after')).includes('4'), `escolha: seta desliza 4 px (${tema})`, await estilo(esc, 'transform', '::after'));
  await fora();
  // Informação: nada muda.
  const info = '.card--info';
  const props = ['color', 'backgroundColor', 'boxShadow', 'transform'];
  const antesInfo = await Promise.all(props.map((x) => estilo(info, x)));
  await sobre(info);
  const depoisInfo = await Promise.all(props.map((x) => estilo(info, x)));
  conferir(JSON.stringify(antesInfo) === JSON.stringify(depoisInfo), `cartão informativo não reage ao cursor (${tema})`);
  conferir((await estilo(info, 'boxShadow')) === 'none', `cartão informativo sem contorno de cartão clicável (${tema})`);
  // Rodapé: cinza, sublinha com o cursor, nunca azul.
  const rod = '.rodape__links a[href="#sobre"]';
  conferir((await estilo(rod, 'color')) === TEXTO2, `rodapé: link em cinza (${tema})`);
  await sobre(rod);
  conferir((await estilo(rod, 'textDecorationLine')).includes('underline') && (await estilo(rod, 'color')) !== LINK, `rodapé: sublinha e não fica azul (${tema})`);
  await fora();
  // Foco por teclado: anel azul de 2 px.
  await p.focus('a.card--trilha'); await p.keyboard.press('Shift+Tab'); await p.keyboard.press('Tab'); await p.waitForTimeout(200);
  const anel = await p.evaluate(() => { const e = document.activeElement; const s = getComputedStyle(e); return { w: s.outlineWidth, c: s.outlineColor, st: s.outlineStyle }; });
  conferir(anel.st === 'solid' && anel.w === '2px' && anel.c === LINK, `foco: anel azul de 2 px (${tema})`, JSON.stringify(anel));

  // Linha de lista: texto normal, só o título da linha sob o cursor fica azul.
  await ir('#aprender/renda-fixa');
  const linhas = await p.$$('.lista > li > a');
  const cores = await Promise.all(linhas.map((l) => l.evaluate((e) => getComputedStyle(e.querySelector('.kicker')).color)));
  conferir(cores.every((c) => c === TEXTO), `trilha: títulos da lista em tinta, não em azul (${tema})`, cores.join(' | '));
  conferir(await p.$eval('.lista > li > a', (e) => getComputedStyle(e).textDecorationLine === 'none'), `trilha: lista sem sublinhado (${tema})`);
  await linhas[1].hover(); await p.waitForTimeout(800);
  const sob = await Promise.all(linhas.map((l) => l.evaluate((e) => getComputedStyle(e.querySelector('.kicker')).color)));
  conferir(sob[1] === LINK && sob.filter((c) => c === LINK).length === 1, `trilha: só a linha sob o cursor fica azul (${tema})`, sob.join(' | '));
  conferir(await p.$eval('.lista > li:nth-child(2) > a', (e) => getComputedStyle(e).textDecorationLine === 'none'), `trilha: linha sob o cursor sem sublinhado (${tema})`);

  // Linha de lista em outra página (histórico de lançamentos): o primeiro texto da linha é o título.
  await ir('?amostra#lancar/historico');
  const lh = '.lista > li > a';
  const tituloLh = `${lh} > .empilha > :first-child`;
  conferir((await estilo(tituloLh, 'color')) !== LINK, `histórico: linha parada sem azul (${tema})`);
  await sobre(lh);
  conferir((await estilo(tituloLh, 'color')) === LINK, `histórico: título da linha azul com o cursor (${tema})`);
  await fora();
  // Desativado não reage: seta "anterior" do carrossel no primeiro cartão.
  await ir('#inicio');
  const seta = '.carrossel__seta:disabled';
  const fundo = await estilo(seta, 'backgroundColor');
  await sobre(seta);
  conferir((await estilo(seta, 'backgroundColor')) === fundo, `seta desativada não reage ao cursor (${tema})`);
  await fora();

  // Números: valor sempre abaixo do rótulo, alinhado à esquerda dele; valores da mesma linha da grade alinhados.
  await ir('?amostra#analise/PETR4');
  const pares = await p.$$eval('.estatisticas > div', (ds) => ds.filter((d) => d.offsetParent).map((d) => { const t = d.querySelector('dt').getBoundingClientRect(), v = d.querySelector('dd').getBoundingClientRect(), c = d.getBoundingClientRect(); return { abaixo: v.top >= t.bottom - 1, esquerda: Math.abs(v.left - t.left) < 1.5, topo: Math.round(c.top), base: Math.round(v.bottom) }; }));
  conferir(pares.length > 10 && pares.every((x) => x.abaixo && x.esquerda), `números: valor abaixo do rótulo em todos os pares (${pares.length})`);
  const porLinha = {};
  for (const x of pares) (porLinha[x.topo] ||= []).push(x.base);
  const desalinhadas = Object.values(porLinha).filter((b) => Math.max(...b) - Math.min(...b) > 2);
  conferir(!desalinhadas.length, `números: valores da mesma linha na mesma altura (${tema})`, JSON.stringify(desalinhadas));
  // Introdução de seção: 32 px até o conteúdo.
  const intro = await p.$$eval('.conteudo > .introducao + :not(.introducao)', (es) => es.map((e) => Math.round(e.getBoundingClientRect().top - e.previousElementSibling.getBoundingClientRect().bottom)));
  conferir(intro.length && intro.every((d) => d >= 30), `introdução de seção a 32 px do conteúdo (${intro.join(', ')})`);
  await ctx.close();
}
await navegador.close(); site.close();
console.log(`\n${certas.length} verificações certas, ${falhas.length} com problema`);
process.exit(falhas.length ? 1 : 0);

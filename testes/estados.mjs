// Estados de interação e alinhamento de números (DESIGN.md, "Interação" e "Números").
// Prova, pelo estilo calculado no navegador, que cada tipo de componente reage como a identidade Apple diz:
// destino (cartão cresce a 1,015× com o cursor; título não muda de cor; borda inalterada; sem recuo),
// escolha (seta fixa), linha de lista (só o título sublinha), rodapé (só sublinha, cor igual),
// informação (nada muda), foco (anel de 2 px) e números (valor sempre abaixo do rótulo, alinhados).
// As medidas numéricas da identidade estão em testes/apple.mjs.
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
    await p.waitForFunction((a) => document.querySelector('#pagina')?.dataset.rota === a, alvo, { timeout: 20000, polling: 100 });
    await p.waitForTimeout(900);
    await p.mouse.move(1, 1);
  };
  const cor = (nome) => p.evaluate((n) => { const d = document.createElement('div'); d.style.color = `var(${n})`; document.body.append(d); const c = getComputedStyle(d).color; d.remove(); return c; }, nome);
  let LINK, TEXTO, RODAPE, FOCO; // cores de referência, lidas depois que a folha de estilo carrega
  const estilo = (sel, prop, pseudo = null) => p.$eval(sel, (e, [pr, ps]) => getComputedStyle(e, ps)[pr], [prop, pseudo]);
  const sobre = async (sel) => { const e = await p.$(sel); await e.scrollIntoViewIfNeeded(); await e.hover(); await p.waitForTimeout(800); };
  const fora = async () => { await p.mouse.move(1, 1); await p.waitForTimeout(800); };

  // Destino: cartão de trilha e cartão de artigo.
  await ir('#inicio');
  [LINK, TEXTO, RODAPE, FOCO] = [await cor('--cor-link'), await cor('--cor-texto'), await cor('--cor-rodape-link'), await cor('--cor-foco')];
  for (const [sel, tit] of [['a.card--trilha', '.card__titulo'], ['a.card--artigo', '.kicker']]) {
    const t = `${sel} ${tit}`;
    const antes = { cor: await estilo(t, 'color'), sombra: await estilo(sel, 'boxShadow'), esc: await estilo(sel, 'scale') };
    await sobre(sel);
    conferir((await estilo(t, 'color')) === antes.cor && (await estilo(t, 'textDecorationLine')) === 'none', `${sel}: o título não muda de cor nem sublinha com o cursor (${tema})`, antes.cor);
    conferir((await estilo(sel, 'boxShadow')) === antes.sombra, `${sel}: borda não muda com o cursor (${tema})`);
    conferir(antes.esc === 'none' && parseFloat(await estilo(sel, 'scale')) > 1.014, `${sel}: cresce a 1,015× só com o cursor (${tema})`, await estilo(sel, 'scale'));
    await fora();
  }
  conferir(!(await p.$('a.card .cor-link')), `nenhum "Abrir"/"Ler" azul dentro de cartão clicável (${tema})`);
  // Toque: nada recua (a Apple não tem estado de toque no cartão-link nem no botão); o botão azul escurece.
  for (const sel of ['a.card--artigo', '.hero .pill--azul']) {
    const e = await p.$(sel); await e.scrollIntoViewIfNeeded(); const b = await e.boundingBox();
    await p.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await p.mouse.down(); await p.waitForTimeout(350);
    // Solta fora do elemento: o toque não vira clique e a página não muda.
    const m = await estilo(sel, 'transform'); await p.mouse.move(1, 1); await p.mouse.up(); await fora();
    conferir(m === 'none', `${sel}: sem recuo no toque (${tema})`, m);
  }
  // Escolha: seta fixa e título sem azul.
  const esc = 'a.escolha';
  await sobre(esc);
  conferir((await estilo(`${esc} .escolha__nome`, 'color')) === TEXTO, `escolha: título não fica azul com o cursor (${tema})`);
  conferir((await estilo(esc, 'transform', '::after')) === 'none', `escolha: a seta não se move (${tema})`, await estilo(esc, 'transform', '::after'));
  await fora();
  // Informação: nada muda.
  const info = '.card--info';
  const props = ['color', 'backgroundColor', 'boxShadow', 'transform', 'scale'];
  const antesInfo = await Promise.all(props.map((x) => estilo(info, x)));
  await sobre(info);
  const depoisInfo = await Promise.all(props.map((x) => estilo(info, x)));
  conferir(JSON.stringify(antesInfo) === JSON.stringify(depoisInfo), `cartão informativo não reage ao cursor (${tema})`);
  conferir((await estilo(info, 'boxShadow')) === 'none', `cartão informativo sem contorno de cartão clicável (${tema})`);
  // Rodapé: 72% do texto; com o cursor só sublinha (a cor não muda); nunca azul.
  const rod = '.rodape__links a[href="#sobre"]';
  conferir((await estilo(rod, 'color')) === RODAPE && RODAPE !== LINK, `rodapé: link no tom do rodapé (${tema})`);
  await sobre(rod);
  conferir((await estilo(rod, 'textDecorationLine')).includes('underline') && (await estilo(rod, 'color')) === RODAPE, `rodapé: sublinha e a cor não muda (${tema})`);
  await fora();
  // Foco por teclado: anel de 2 px.
  await p.focus('a.card--trilha'); await p.keyboard.press('Shift+Tab'); await p.keyboard.press('Tab'); await p.waitForTimeout(200);
  const anel = await p.evaluate(() => { const e = document.activeElement; const s = getComputedStyle(e); return { w: s.outlineWidth, c: s.outlineColor, st: s.outlineStyle }; });
  conferir(anel.st === 'solid' && anel.w === '2px' && anel.c === FOCO, `foco: anel de 2 px (${tema})`, JSON.stringify(anel));

  // Linha de lista: texto normal, só o título da linha sob o cursor fica azul.
  await ir('#aprender/renda-fixa');
  const linhas = await p.$$('.lista > li > a');
  const cores = await Promise.all(linhas.map((l) => l.evaluate((e) => getComputedStyle(e.querySelector('.kicker')).color)));
  conferir(cores.every((c) => c === TEXTO), `trilha: títulos da lista em tinta, não em azul (${tema})`, cores.join(' | '));
  conferir(await p.$eval('.lista > li > a', (e) => getComputedStyle(e).textDecorationLine === 'none'), `trilha: lista sem sublinhado (${tema})`);
  await linhas[1].hover(); await p.waitForTimeout(800);
  const sob = await Promise.all(linhas.map((l) => l.evaluate((e) => { const k = e.querySelector('.kicker'); return [getComputedStyle(k).color, getComputedStyle(k).textDecorationLine]; })));
  conferir(sob.every(([c]) => c === TEXTO) && sob.filter(([, d]) => d.includes('underline')).length === 1 && sob[1][1].includes('underline'), `trilha: só o título da linha sob o cursor sublinha, a cor não muda (${tema})`, JSON.stringify(sob));
  conferir(await p.$eval('.lista > li:nth-child(2) > a', (e) => getComputedStyle(e).textDecorationLine === 'none'), `trilha: a linha em si não sublinha (${tema})`);

  // Linha de lista em outra página (histórico de lançamentos): o primeiro texto da linha é o título.
  await ir('?amostra#lancar/historico');
  const lh = '.lista > li > a';
  const tituloLh = `${lh} > .empilha > :first-child`;
  conferir((await estilo(tituloLh, 'color')) !== LINK && (await estilo(tituloLh, 'textDecorationLine')) === 'none', `histórico: linha parada sem azul e sem sublinhado (${tema})`);
  await sobre(lh);
  conferir((await estilo(tituloLh, 'color')) === TEXTO && (await estilo(tituloLh, 'textDecorationLine')).includes('underline'), `histórico: com o cursor, só o título sublinha (${tema})`);
  await fora();
  // Desativado não reage: seta "anterior" do carrossel no primeiro cartão. O carrossel escreve o estado das setas
  // no primeiro quadro depois de desenhado: espera por ele e confere que é mesmo a "anterior".
  await ir('#inicio');
  const seta = '.carrossel__seta:disabled';
  await p.waitForSelector(seta, { state: 'attached', timeout: 5000 });
  conferir((await p.$eval(seta, (e) => e.getAttribute('aria-label'))) === 'Anterior', `no primeiro cartão, a seta desativada é a "Anterior" (${tema})`);
  // O cursor vai pela coordenada: a seta desativada tem pointer-events: none, e o hover() do Playwright esperaria
  // ela "receber" o cursor (nesse meio tempo o autoplay avança e ela deixa de estar desativada).
  await (await p.$(seta)).scrollIntoViewIfNeeded(); await p.waitForTimeout(400);
  const fundo = await estilo(seta, 'backgroundColor');
  const caixa = await (await p.$(seta)).boundingBox();
  await p.mouse.move(caixa.x + caixa.width / 2, caixa.y + caixa.height / 2); await p.waitForTimeout(400);
  conferir((await estilo(seta, 'backgroundColor')) === fundo, `seta desativada não reage ao cursor (${tema})`);
  await fora();

  // Tabela de indicadores (Stocks): rótulo à esquerda, valor à direita dele; ausente é "–"; linhas alinhadas.
  await ir('?amostra#analise/PETR4');
  const tab = await p.$$eval('.indicadores > div', (ds) => ds.map((d) => { const t = d.querySelector('dt').getBoundingClientRect(), v = d.querySelector('dd').getBoundingClientRect(), c = d.getBoundingClientRect(); return { direita: v.left >= t.right - 1, junto: v.top < t.bottom && v.bottom > t.top, topo: Math.round(c.top) }; }));
  conferir(tab.length === 12 && tab.every((x) => x.direita && x.junto) && new Set(tab.map((x) => x.topo)).size === 3, `indicadores: 12 pares com o valor à direita do rótulo, em 3 linhas alinhadas (${tema})`, JSON.stringify(tab));
  // Números: valor sempre abaixo do rótulo, alinhado à esquerda dele; valores da mesma linha da grade alinhados.
  await ir('?amostra#ativo/a-demo-1');
  const pares = await p.$$eval('.estatisticas > div', (ds) => ds.filter((d) => d.offsetParent).map((d) => { const t = d.querySelector('dt').getBoundingClientRect(), v = d.querySelector('dd').getBoundingClientRect(), c = d.getBoundingClientRect(); return { abaixo: v.top >= t.bottom - 1, esquerda: Math.abs(v.left - t.left) < 1.5, topo: Math.round(c.top), base: Math.round(v.bottom) }; }));
  conferir(pares.length > 10 && pares.every((x) => x.abaixo && x.esquerda), `números: valor abaixo do rótulo em todos os pares (${pares.length})`);
  const porLinha = {};
  for (const x of pares) (porLinha[x.topo] ||= []).push(x.base);
  const desalinhadas = Object.values(porLinha).filter((b) => Math.max(...b) - Math.min(...b) > 2);
  conferir(!desalinhadas.length, `números: valores da mesma linha na mesma altura (${tema})`, JSON.stringify(desalinhadas));
  // Introdução de seção: 32 px até o conteúdo.
  await ir('?amostra#analise/PETR4');
  const intro = await p.$$eval('.conteudo > .introducao + :not(.introducao)', (es) => es.map((e) => Math.round(e.getBoundingClientRect().top - e.previousElementSibling.getBoundingClientRect().bottom)));
  conferir(intro.length && intro.every((d) => d >= 30), `introdução de seção a 32 px do conteúdo (${intro.join(', ')})`);
  await ctx.close();
}
await navegador.close(); site.close();
console.log(`\n${certas.length} verificações certas, ${falhas.length} com problema`);
process.exit(falhas.length ? 1 : 0);

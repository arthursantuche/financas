// Indicadores de interação cortados (Diretório - Identidade Visual - Apple, seção 10.1). Copiado do
// portal Escócia 2027 (versão 2.5) e adaptado: sobe o próprio servidor do site e percorre as rotas
// do Portal Finanças. Força :hover e :focus-visible em cada elemento interativo (pelo protocolo do
// Chrome) e confere se o indicador (box-shadow de fora, outline) cabe nos ancestrais que cortam.
// Uso: node testes/checar-indicadores.cjs   (TEMA=dark para o escuro). Sai com 1 se achar corte.
const http = require('http'), fs = require('fs'), path = require('path'), { execSync } = require('child_process');
const { chromium } = require(process.env.PLAYWRIGHT || path.join(execSync('npm root -g').toString().trim(), '@playwright/cli/node_modules/playwright-core'));
const RAIZ = path.join(__dirname, '..', 'Portal');
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.md': 'text/markdown; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png' };
const servidor = http.createServer((q, r) => { let c = decodeURIComponent(new URL(q.url, 'http://x').pathname); if (c === '/') c = '/index.html'; fs.readFile(path.join(RAIZ, c), (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': TIPOS[path.extname(c)] || 'application/octet-stream' }); r.end(d); }); });
let BASE;
const ROTAS = (process.env.ROTAS || 'inicio,aprender,aprender/renda-fixa,artigo/opcoes,indicadores,simuladores,simuladores/juros-compostos,sobre,carteira,ativo/a-demo-1,lancar,analise,analise/PETR4,alertas,agente,ajustes').split(',');
const TELAS = JSON.parse(process.env.TELAS || '[[1440,900,0],[1024,768,1],[844,390,1],[390,844,1]]');
const TEMA = process.env.TEMA || 'light';
const SEL = 'a[href], button, summary, select, input:not([type=hidden]), textarea, [tabindex="0"]';

// Roda na página: mede o indicador do elemento i no estado forçado e devolve os cortes.
function medir([i, estado]) {
  const e = window.__alvos[i];
  if (!e) return null;
  const s = getComputedStyle(e);
  const b = e.getBoundingClientRect();
  if (!b.width || !b.height || s.visibility === 'hidden' || e.closest('[hidden]')) return null;
  const ext = { t: 0, r: 0, b: 0, l: 0 };
  const sombras = s.boxShadow === 'none' ? [] : s.boxShadow.split(/,(?![^(]*\))/);
  for (const sh of sombras) {
    if (/inset/.test(sh)) continue;
    const [x = 0, y = 0, blur = 0, spread = 0] = (sh.replace(/rgba?\([^)]*\)/g, '').match(/-?[\d.]+px/g) || []).map(parseFloat);
    const a = blur + spread;
    ext.t = Math.max(ext.t, a - y); ext.b = Math.max(ext.b, a + y);
    ext.l = Math.max(ext.l, a - x); ext.r = Math.max(ext.r, a + x);
  }
  if (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) {
    const o = parseFloat(s.outlineWidth) + parseFloat(s.outlineOffset || 0);
    for (const k in ext) ext[k] = Math.max(ext[k], o);
  }
  if (!ext.t && !ext.r && !ext.b && !ext.l) return null;
  const caixa = { t: b.top - ext.t, b: b.bottom + ext.b, l: b.left - ext.l, r: b.right + ext.r };
  const cortes = [];
  for (let a = e.parentElement; a && a !== document.body; a = a.parentElement) {
    const sa = getComputedStyle(a);
    if (sa.overflowX === 'visible' && sa.overflowY === 'visible' && sa.clipPath === 'none' && !/paint|strict|content/.test(sa.contain)) continue;
    const ra = a.getBoundingClientRect();
    const clip = { t: ra.top + parseFloat(sa.borderTopWidth), l: ra.left + parseFloat(sa.borderLeftWidth) };
    clip.b = clip.t + a.clientHeight; clip.r = clip.l + a.clientWidth;
    const lados = [];
    // Como nas laterais: numa lista que rola na vertical, só conta o elemento inteiro na janela visível
    // (um item rolado para fora não é indicador cortado). Adaptação do Portal Finanças.
    if (caixa.t < clip.t - 0.5 && b.top >= clip.t - 1 && b.top < clip.b) lados.push(`topo ${(clip.t - caixa.t).toFixed(1)}px`);
    if (caixa.b > clip.b + 0.5 && b.bottom <= clip.b + 1 && b.bottom > clip.t) lados.push(`base ${(caixa.b - clip.b).toFixed(1)}px`);
    // Nas laterais de um trilho que rola, só conta o elemento que está inteiro na janela visível.
    if (caixa.l < clip.l - 0.5 && b.left >= clip.l - 1) lados.push(`esquerda ${(clip.l - caixa.l).toFixed(1)}px`);
    if (caixa.r > clip.r + 0.5 && b.right <= clip.r + 1) lados.push(`direita ${(caixa.r - clip.r).toFixed(1)}px`);
    if (lados.length) cortes.push(`${a.tagName.toLowerCase()}.${String(a.className).split(' ')[0]} corta ${lados.join(', ')}`);
  }
  if (!cortes.length) return null;
  const nome = e.tagName.toLowerCase() + (typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\s+/)[0] : '');
  return { chave: `${estado} ${nome}: ${cortes.join('; ')}`, texto: (e.textContent || e.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 30) };
}

(async () => {
  await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok));
  BASE = `http://127.0.0.1:${servidor.address().port}/?amostra`;
  const nav = await chromium.launch({ channel: 'chrome' });
  const achados = new Map();
  for (const [w, h, toque] of TELAS) {
    const ctx = await nav.newContext({ viewport: { width: w, height: h }, isMobile: !!toque, hasTouch: !!toque, colorScheme: TEMA, reducedMotion: 'reduce', bypassCSP: true });
    const p = await ctx.newPage();
    const cdp = await ctx.newCDPSession(p);
    try {
      await p.goto(`${BASE}#${ROTAS[0]}`, { waitUntil: 'networkidle' });
    } catch {
      console.error(`Não abriu ${BASE}. Ligue o servidor portal-sem-cache (.claude/launch.json) ou informe BASE.`);
      process.exit(2);
    }
    await p.waitForTimeout(700);
    await p.addStyleTag({ content: '*,*::before,*::after{transition:none!important;animation-duration:0s!important}' });
    await cdp.send('DOM.enable');
    await cdp.send('CSS.enable');
    for (const rota of ROTAS) {
      await p.evaluate((r) => { location.hash = '#' + r; }, rota);
      await p.waitForTimeout(600);
      await p.evaluate(() => document.querySelectorAll('details').forEach((d) => { d.open = true; }));
      const { root } = await cdp.send('DOM.getDocument', { depth: -1 });
      const { nodeIds } = await cdp.send('DOM.querySelectorAll', { nodeId: root.nodeId, selector: SEL });
      await p.evaluate((sel) => { window.__alvos = [...document.querySelectorAll(sel)]; }, SEL);
      // Tela de toque não tem hover: só o foco.
      for (const estado of toque ? ['focus-visible'] : ['hover', 'focus-visible']) {
        for (let i = 0; i < nodeIds.length; i++) {
          const forcar = estado === 'hover' ? ['hover'] : ['focus', 'focus-visible'];
          await cdp.send('CSS.forcePseudoState', { nodeId: nodeIds[i], forcedPseudoClasses: forcar });
          const r = await p.evaluate(medir, [i, estado]);
          await cdp.send('CSS.forcePseudoState', { nodeId: nodeIds[i], forcedPseudoClasses: [] });
          if (!r) continue;
          const chave = `${w}×${h} ${r.chave}`;
          if (!achados.has(chave)) achados.set(chave, { exemplo: r.texto, rotas: new Set() });
          achados.get(chave).rotas.add(rota);
        }
      }
    }
    await ctx.close();
  }
  await nav.close(); servidor.close();
  for (const [chave, { exemplo, rotas }] of achados) console.log(`${chave} ("${exemplo}", em ${[...rotas].join(', ')})`);
  console.log(achados.size ? `${achados.size} indicador(es) cortado(s).` : 'Nenhum indicador cortado.');
  process.exit(achados.size ? 1 : 0);
})();

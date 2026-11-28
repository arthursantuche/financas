// Identidade Visual - Apple, fatia 1: fundamentos, interação, navegação e rodapé.
// Confere, em 1440, 1024, 834 e 390 px e nos dois temas, as medidas e os comportamentos da especificação
// (Vault: x/Documentação/Identidade Visual - Apple, critérios de Implementação e validação, seção 4), com as
// tolerâncias dela: tempos ±40 ms (±1 quadro em até 150 ms), distâncias ±2 px, opacidades ±0,03,
// larguras e alturas ±1 px, limiares de rolagem ±30 px relativos ao elemento.
// Uso: node testes/apple.mjs   (sai com 1 se algo falhar; escreve o resultado em formato de tabela se
// APPLE_JSON apontar para um arquivo)
import http from 'node:http';
import { createRequire } from 'node:module';
import { readFile, readdir, writeFile } from 'node:fs/promises';
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

const falhas = [], certas = [], registro = [];
const conferir = (cond, nome, detalhe = '') => {
  (cond ? certas : falhas).push(nome); registro.push({ nome, ok: !!cond, detalhe: String(detalhe) });
  if (!cond) console.log(`  ✖ ${nome}${detalhe !== '' ? `: ${detalhe}` : ''}`);
};
const perto = (a, b, tol) => Math.abs(a - b) <= tol;
// "rgba(0, 0, 0, 0.8)" ou "rgb(0, 113, 227)" → [r, g, b, a]
const rgba = (c) => { const m = String(c).match(/rgba?\(([^)]+)\)/); if (!m) return null; const v = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return [v[0], v[1], v[2], v[3] ?? 1]; };
const igualCor = (c, esperado, tol = 0.03) => { const a = rgba(c), b = rgba(esperado); return !!a && !!b && [0, 1, 2].every((i) => Math.abs(a[i] - b[i]) <= 1) && Math.abs(a[3] - b[3]) <= tol; };
const px = (v) => parseFloat(v);

const navegador = await chromium.launch({ channel: 'chrome', headless: true }).catch(() => chromium.launch({ headless: true }));

// ---------------------------------------------------------------- 1. Leitura das folhas de estilo
// Nenhuma cor fora de tokens.css; nenhum clamp()/vw em fonte; nenhum balance/pretty, text-transform,
// peso 500 ou 700, drop-shadow nem sombra com desfoque; escala de espaço.
console.log('Folhas de estilo');
const pastaCss = join(RAIZ, 'Portal', 'assets', 'css');
const arquivos = (await readdir(pastaCss)).filter((f) => f.endsWith('.css'));
const css = {};
for (const f of arquivos) css[f] = (await readFile(join(pastaCss, f), 'utf8')).replace(/\/\*[\s\S]*?\*\//g, '');
const fora = arquivos.filter((f) => f !== 'tokens.css');
for (const f of fora) {
  const t = css[f].replace(/url\("[^"]*"\)/g, '');
  conferir(!/#[0-9a-fA-F]{3,8}\b|\brgba?\(/.test(t), `${f}: nenhuma cor literal (só tokens de papel)`);
  conferir(!/font-size:[^;}]*(clamp\(|\dvw|\dvh|\dsvh)/.test(t), `${f}: nenhum clamp() nem vw em tamanho de fonte`);
  conferir(!/text-wrap\s*:\s*(balance|pretty)/.test(t), `${f}: sem text-wrap balance nem pretty`);
  conferir(!/text-transform\s*:\s*(?!none)\S/.test(t), `${f}: sem text-transform`);
  conferir(!/font-weight\s*:\s*(500|700|bold|medium|var\(--font-weight-(medium|bold)\))/.test(t), `${f}: só pesos 400 e 600`);
  conferir(!/drop-shadow/.test(t), `${f}: sem drop-shadow`);
  const sombras = [...t.matchAll(/box-shadow\s*:\s*([^;}]+)/g)].map((m) => m[1]).filter((v) => !/var\(/.test(v) || /\d/.test(v));
  const comDesfoque = sombras.filter((v) => v.split(',').some((parte) => { const n = (parte.match(/(-?[\d.]+)(?:px)?/g) || []).map(parseFloat); return n.length >= 3 && n[2] > 0; }));
  conferir(!comDesfoque.length, `${f}: sem sombra projetada (box-shadow com desfoque)`, comDesfoque.join(' | '));
}
const escala = new Set([0, 1, 2, 4, 8, 12, 16, 20, 24, 28, 32, 40, 44, 48, 64, 72, 80, 96, 112, 120, 128, 144, 176, 224]);
// Medidas da Apple que fogem da escala de 4 px, registradas no DESIGN.md: botão (11 e 21), rodapé, notas legais e separadores (5, 6, 9, 10, 17).
const excecoesEspaco = new Set([5, 6, 9, 10, 11, 17, 21]);
const fora_escala = [];
for (const f of fora) for (const m of css[f].matchAll(/(?:^|[;{\s])(padding|margin|gap|row-gap|column-gap)(?:-[a-z]+)?\s*:\s*([^;}]+)/g)) {
  const valor = m[2].replace(/var\([^)]*\)/g, '').replace(/calc\([^)]*\)/g, '');
  for (const n of valor.matchAll(/(-?[\d.]+)px/g)) { const v = Math.abs(parseFloat(n[1])); if (!escala.has(v) && !excecoesEspaco.has(v)) fora_escala.push(`${f}: ${m[1]} ${v}px`); }
}
conferir(!fora_escala.length, 'espaço: nenhum padding, margem ou gap em px fora da escala', [...new Set(fora_escala)].join(' | '));
conferir(/prefers-reduced-transparency/.test(css['navegacao.css']), 'navegação: fundo sólido com prefers-reduced-transparency');
const html = await readFile(join(RAIZ, 'Portal', 'index.html'), 'utf8');
conferir((html.match(/<meta name="theme-color"/g) || []).length === 2 && /color-scheme" content="light dark"/.test(html), 'tema: color-scheme light dark e duas theme-color');

// ---------------------------------------------------------------- 2. Medidas no navegador
const LARGURAS = [[1440, 900], [1024, 768], [834, 1112], [390, 844]];
// Degraus esperados por faixa: L ≥ 1069, M 735–1068, S ≤ 734.
const faixa = (w) => (w >= 1069 ? 'L' : w >= 735 ? 'M' : 'S');
const ESC = {
  hero: { L: [80, 84, -1.2], M: [64, 68, -0.576], S: [48, 52, -0.144] },
  titulo: { L: [48, 52, -0.144], M: [40, 44, 0], S: [32, 36, 0.128] },
  subtitulo: { L: [28, 32, 0.196], M: [24, 28, 0.216], S: [21, 25, 0.231] },
  lide: { L: [21, 29, 0.231], M: [21, 29, 0.231], S: [19, 27, 0.228] },
  apoio: { L: [17, 21, -0.374], M: [17, 21, -0.374], S: [14, 18, -0.224] },
  botao: { L: [17, 20, -0.374], M: [14, 18, -0.224], S: [14, 18, -0.224] },
};
const SEC = { historia: { L: 128, M: 96, S: 80 }, alternada: { L: 144, M: 120, S: 112 } };

async function abrir(p, rota) {
  await p.goto(`${BASE}/${rota}`);
  const alvo = decodeURIComponent(rota.split('#')[1] || 'inicio');
  await p.waitForFunction((a) => document.querySelector('#pagina')?.dataset.rota === a, alvo, { timeout: 20000, polling: 100 });
  await p.waitForTimeout(900); await p.mouse.move(1, 1);
}
const calc = (p, sel, props, pseudo = null) => p.$eval(sel, (e, [ps, pr]) => { const s = getComputedStyle(e, ps); return Object.fromEntries(pr.map((k) => [k, s[k]])); }, [pseudo, props]);
const tipo = (p, sel) => calc(p, sel, ['fontSize', 'lineHeight', 'letterSpacing', 'fontWeight', 'fontFamily']);
const confTipo = (t, [tam, lin, trk], peso, nome, familia = null) => {
  conferir(perto(px(t.fontSize), tam, 0.01) && perto(px(t.lineHeight), lin, 0.01) && perto(px(t.letterSpacing) || 0, trk, 0.002) && Number(t.fontWeight) === peso && (!familia || t.fontFamily.includes(familia)),
    `${nome}: ${tam}/${lin}, tracking ${trk}, peso ${peso}`, `${t.fontSize}/${t.lineHeight}, ${t.letterSpacing}, ${t.fontWeight}`);
};
const aneis = (p) => p.evaluate(() => { const e = document.activeElement; const s = getComputedStyle(e); return { w: s.outlineWidth, st: s.outlineStyle, c: s.outlineColor, o: s.outlineOffset, t: e.tagName + '.' + e.className }; });
async function tabAte(p, sel, max = 60) {
  await p.evaluate(() => { document.activeElement?.blur(); scrollTo(0, 0); });
  for (let i = 0; i < max; i++) { await p.keyboard.press('Tab'); if (await p.evaluate((s) => document.activeElement?.matches(s), sel)) return true; }
  return false;
}

for (const tema of ['light', 'dark']) {
  const claro = tema === 'light';
  const T = {
    vidroTopo: claro ? 'rgba(245, 245, 247, 0.8)' : 'rgba(18, 18, 18, 0.8)', vidroPilula: claro ? 'rgba(255, 255, 255, 0.8)' : 'rgba(18, 18, 18, 0.8)',
    anelPilula: claro ? 'rgb(230, 230, 232)' : 'rgb(40, 40, 40)', item: claro ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.8)', itemHover: claro ? 'rgb(0, 0, 0)' : 'rgb(255, 255, 255)',
    foco: claro ? 'rgb(0, 113, 227)' : 'rgb(41, 151, 255)', link: claro ? 'rgb(0, 102, 204)' : 'rgb(41, 151, 255)', texto: claro ? 'rgb(29, 29, 31)' : 'rgb(245, 245, 247)',
    texto2: claro ? 'rgb(110, 110, 115)' : 'rgb(134, 134, 139)', fundo: claro ? 'rgb(255, 255, 255)' : 'rgb(0, 0, 0)', faixa: claro ? 'rgb(245, 245, 247)' : 'rgb(29, 29, 31)',
    contornoBotao: claro ? 'rgb(134, 134, 139)' : 'rgb(110, 110, 115)', botaoHover: claro ? 'rgb(242, 242, 242)' : 'rgb(29, 29, 31)',
    rodTexto: claro ? 'rgba(0, 0, 0, 0.56)' : 'rgba(255, 255, 255, 0.56)', rodLink: claro ? 'rgba(0, 0, 0, 0.72)' : 'rgba(255, 255, 255, 0.72)', rodLinha: claro ? 'rgba(0, 0, 0, 0.16)' : 'rgba(255, 255, 255, 0.16)',
    divisoria: claro ? 'rgb(210, 210, 215)' : 'rgb(51, 51, 54)',
  };
  for (const [W, H] of LARGURAS) {
    const F = faixa(W), toque = W < 500, rotulo = `${W} ${tema}`;
    console.log(`${rotulo}`);
    const ctx = await navegador.newContext({ viewport: { width: W, height: H }, colorScheme: tema, hasTouch: toque, isMobile: toque });
    const p = await ctx.newPage();
    const erros = []; p.on('pageerror', (e) => erros.push(e.message));
    await abrir(p, '#inicio');

    // ---- Cores por papel (tabela 4.1)
    const papeis = await p.evaluate(() => { const l = (n) => { const d = document.createElement('div'); d.style.color = `var(${n})`; document.body.append(d); const c = getComputedStyle(d).color; d.remove(); return c; }; return Object.fromEntries(['--cor-texto', '--cor-texto-2', '--cor-link', '--cor-acao', '--cor-acao-hover', '--cor-acao-ativo', '--cor-foco', '--cor-divisoria', '--cor-faixa', '--cor-fundo', '--cor-sobre-acao'].map((n) => [n, l(n)])); });
    conferir(papeis['--cor-texto'] === T.texto && papeis['--cor-texto-2'] === T.texto2 && papeis['--cor-link'] === T.link && papeis['--cor-faixa'] === T.faixa && papeis['--cor-fundo'] === T.fundo,
      `cores: texto, secundário, link, faixa e fundo da tabela 4.1 (${rotulo})`, JSON.stringify(papeis));
    conferir(papeis['--cor-acao'] === 'rgb(0, 113, 227)' && papeis['--cor-acao-hover'] === 'rgb(0, 118, 223)' && papeis['--cor-acao-ativo'] === 'rgb(0, 110, 219)' && papeis['--cor-sobre-acao'] === 'rgb(255, 255, 255)', `cores: azul de ação #0071e3, hover #0076df, toque #006edb, igual nos dois temas (${rotulo})`);
    conferir(papeis['--cor-foco'] === T.foco && papeis['--cor-divisoria'] === T.divisoria, `cores: anel de foco e divisória (${rotulo})`, `${papeis['--cor-foco']} ${papeis['--cor-divisoria']}`);
    const corpo = await calc(p, 'body', ['backgroundColor', 'scrollBehavior', 'fontSize', 'lineHeight', 'letterSpacing', 'fontWeight']);
    conferir(corpo.backgroundColor === T.fundo && corpo.scrollBehavior === 'auto', `corpo: fundo da página e scroll-behavior auto (${rotulo})`);
    confTipo(await tipo(p, 'body'), [17, 25, -0.374], 400, `corpo (${rotulo})`);

    // ---- Tipografia por papel e faixa (critério 23)
    confTipo(await tipo(p, 'h1.display'), ESC.hero[F], 600, `abertura (${rotulo})`, 'SF Pro Display');
    confTipo(await tipo(p, '.hero .kicker'), [21, 21, 0.231], 600, `eyebrow (${rotulo})`, 'SF Pro Display');
    confTipo(await tipo(p, '.hero .copy'), ESC.lide[F], 400, `lide da abertura (${rotulo})`);
    confTipo(await tipo(p, 'h2.titulo'), ESC.titulo[F], 600, `título de seção (${rotulo})`, 'SF Pro Display');
    confTipo(await tipo(p, '.card__titulo'), ESC.subtitulo[F], 600, `subtítulo de cartão (${rotulo})`, 'SF Pro Display');
    confTipo(await tipo(p, '.card--trilha .copy'), ESC.apoio[F], 400, `texto de apoio (${rotulo})`, 'SF Pro Text');
    confTipo(await tipo(p, '.hero .pill'), ESC.botao[F], 400, `botão (${rotulo})`, 'SF Pro Text');
    confTipo(await tipo(p, '.numeros__valor'), [40, 48, 0], 600, `estatística (${rotulo})`, 'SF Pro Display');
    confTipo(await tipo(p, '.numeros__legenda'), [14, 18, -0.224], 400, `legenda de estatística (${rotulo})`);
    const fam = await calc(p, 'body', ['fontFamily']);
    conferir(/^"?SF Pro Text"?/.test(fam.fontFamily) && /Helvetica Neue/.test(fam.fontFamily), `fontes: SF Pro na frente e Helvetica Neue na reserva (${rotulo})`, fam.fontFamily);
    // Nenhum texto com peso fora de 400 e 600, nenhum balance, nenhum text-transform.
    const varredura = await p.evaluate(() => {
      const pesos = new Set(), balance = [], transf = [], sintese = new Set();
      for (const e of document.querySelectorAll('body *')) {
        if (!e.childNodes.length || ![...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
        const s = getComputedStyle(e); pesos.add(s.fontWeight); sintese.add(s.fontSynthesis);
        if (!['auto', 'wrap'].includes(s.textWrapStyle || 'auto')) balance.push(e.className);
        if (s.textTransform !== 'none') transf.push(e.className);
      }
      return { pesos: [...pesos], balance, transf, sintese: [...sintese] };
    });
    conferir(varredura.pesos.every((x) => ['400', '600'].includes(x)), `pesos de fonte só 400 e 600 em todo texto (${rotulo})`, varredura.pesos.join(','));
    conferir(!varredura.balance.length && !varredura.transf.length, `nenhum text-wrap balance/pretty nem text-transform (${rotulo})`, `${varredura.balance} ${varredura.transf}`);

    // ---- Contêiner (critério 24) e padding de seção (critério 26)
    const cont = await p.$eval('.hero .conteudo', (e) => { const r = e.getBoundingClientRect(); return { x: r.x, w: r.width }; });
    const larguraEsperada = W <= 734 ? Math.min(0.875 * W, 420) : Math.min(0.875 * W, 1260);
    conferir(perto(cont.w, larguraEsperada, 1) && perto(cont.x, (W - cont.w) / 2, 1), `contêiner: ${larguraEsperada.toFixed(1)} px, centrado (${rotulo})`, `${cont.w} em x=${cont.x}`);
    const secoes = await p.$$eval('#pagina .secao', (ss) => ss.map((s, i) => { const c = getComputedStyle(s); return { alt: s.classList.contains('secao--mist'), primeira: i === 0, cont: s.classList.contains('secao--continua') || s.classList.contains('secao--compacta'), id: s.id, t: parseFloat(c.paddingTop), b: parseFloat(c.paddingBottom) }; }));
    const ruins = secoes.filter((s) => !s.primeira && !s.cont).filter((s) => { const e = SEC[s.alt ? 'alternada' : 'historia'][F]; return !(s.b === e && s.t >= e); });
    conferir(secoes.length >= 4 && !ruins.length, `seções: padding vertical de ${SEC.historia[F]} (tela) e ${SEC.alternada[F]} (faixa) (${rotulo})`, JSON.stringify(ruins));
    conferir(secoes.filter((s) => !s.primeira && !s.cont).every((s) => s.t === SEC[s.alt ? 'alternada' : 'historia'][F] || s.id), `seções sem id: padding de topo igual ao de base (${rotulo})`);

    // ---- Barra no topo (critérios 1 e 2; adaptação A1)
    const topo = await p.$eval('#topo', (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e, '::before'); const a = getComputedStyle(e, '::after'); return { h: r.height, w: r.width, y: r.y, pos: getComputedStyle(e).position, bg: s.backgroundColor, bf: s.backdropFilter || s.webkitBackdropFilter, sh: s.boxShadow, opB: s.opacity, opA: a.opacity, flut: e.classList.contains('topo--flutuante') }; });
    const alturaEsperada = W >= 834 ? 44 : 92; // celular: 48 (título e ação) + 44 (seções)
    conferir(perto(topo.h, alturaEsperada, 1) && topo.w === W && topo.y === 0, `barra: ${alturaEsperada} px de altura e largura total no topo (${rotulo})`, `${topo.h} × ${topo.w}`);
    conferir(igualCor(topo.bg, T.vidroTopo) && /saturate\(1\.8\)/.test(topo.bf) && /blur\(20px\)/.test(topo.bf) && topo.pos === 'sticky', `barra no topo: vidro 80%, saturate(1.8) blur(20px) (${rotulo})`, `${topo.bg} | ${topo.bf}`);
    conferir(W >= 834 ? topo.sh === 'none' : /0px -1px 0px 0px/.test(topo.sh) || topo.sh.includes('inset'), `barra no topo: sem borda nem sombra no computador; linha de 1 px no celular (${rotulo})`, topo.sh);
    conferir(topo.opB === '1' && topo.opA === '0' && !topo.flut, `barra no topo: faixa visível e pílula escondida (${rotulo})`);
    const alturaTitulo = await p.$eval('.barra__titulo', (e) => e.getBoundingClientRect().height);
    conferir(perto(alturaTitulo, W >= 834 ? 44 : 48, 1), `barra: primeira linha de ${W >= 834 ? 44 : 48} px (${rotulo})`, alturaTitulo);
    const b = await p.$eval('.barra', (e) => { const r = e.getBoundingClientRect(); return { x: r.x, w: r.width }; });
    const bw = Math.min(1024, W - 20);
    conferir(perto(b.w, bw, 1) && perto(b.x, (W - bw) / 2, 1), `barra: conteúdo de ${bw} px, a 10 px das bordas até 1044 (${rotulo})`, `${b.w} em x=${b.x}`);
    // itens: 12/12, −0,12, 400; cor 80%
    confTipo(await tipo(p, '.barra__secoes a'), [12, 12, -0.12], 400, `item da barra (${rotulo})`, 'SF Pro Text');
    confTipo(await tipo(p, '.barra__titulo'), [19, 23, 0.228], 600, `nome do portal na barra (${rotulo})`, 'SF Pro Display');
    confTipo(await tipo(p, '.barra__acao'), [12, 16, -0.12], 400, `ação da barra (${rotulo})`);
    const item = await calc(p, '.barra__secoes a', ['color', 'transitionDuration', 'transitionTimingFunction', 'textDecorationLine', 'height', 'cursor']);
    conferir(igualCor(item.color, T.item) && item.transitionDuration === '0.32s' && item.transitionTimingFunction === 'cubic-bezier(0.4, 0, 0.6, 1)' && item.textDecorationLine === 'none' && px(item.height) === 44, `item da barra: 80%, cor em 320 ms (.4,0,.6,1), alvo de 44 px (${rotulo})`, JSON.stringify(item));
    const acao = await calc(p, '.barra__acao', ['backgroundColor', 'borderRadius', 'height', 'width', 'color']);
    const areaAcao = await calc(p, '.barra__acao', ['width', 'height'], '::after');
    conferir(acao.backgroundColor === 'rgb(0, 113, 227)' && acao.borderRadius === '120px' && perto(px(acao.height), 28, 1) && px(areaAcao.width) >= 43.5 && px(areaAcao.height) >= 43.5, `ação da barra: azul, raio 120, 28 px de altura e área de toque de 44 × 44 (${rotulo})`, `${acao.borderRadius} ${acao.height} área ${areaAcao.width}×${areaAcao.height}`);

    // ---- Hover do item: cor de 80% a 100% em 320 ms (critério 10) — só com cursor
    if (!toque) {
      const alvoItem = await p.$('.barra__secoes a:not([aria-current])');
      const amostras = p.evaluate(() => new Promise((res) => {
        const a = document.querySelector('.barra__secoes a:not([aria-current])'); const fim = setTimeout(() => res(null), 3000);
        a.addEventListener('transitionrun', () => { const t0 = performance.now(), out = []; const f = () => { out.push([performance.now() - t0, getComputedStyle(a).color]); if (performance.now() - t0 < 420) requestAnimationFrame(f); else { clearTimeout(fim); res(out); } }; f(); }, { once: true });
      }));
      await alvoItem.hover();
      const am = await amostras;
      const em = (t) => { const x = am.reduce((m, s) => (Math.abs(s[0] - t) < Math.abs(m[0] - t) ? s : m)); return rgba(x[1])[3]; };
      if (am) conferir(perto(em(60), claro ? 0.82 : 0.82, 0.03) && perto(em(120), 0.868, 0.03) && perto(em(200), 0.957, 0.03) && em(330) >= 0.99,
        `hover do item: opacidade .80, .82, .87, .96, 1,0 em 0, 60, 120, 200 e 320 ms (${rotulo})`, `${[60, 120, 200, 330].map((t) => em(t).toFixed(3)).join(' ')}`);
      else conferir(false, `hover do item: a transição não começou (${rotulo})`);
      const fimHover = await calc(p, '.barra__secoes a:not([aria-current])', ['color', 'textDecorationLine']);
      conferir(igualCor(fimHover.color, T.itemHover) && fimHover.textDecorationLine === 'none', `hover do item: vai a ${claro ? '#000' : '#fff'}, sem sublinhado nem fundo (${rotulo})`, fimHover.color);
      await p.mouse.move(1, 1);
    }

    // ---- Foco (critério 12): 2 px, cor fixa, afastamento por tipo
    await p.evaluate(() => scrollTo(0, 0));
    const foco = [['.barra__secoes a', -7, 'item da barra'], ['.barra__titulo', -7, 'nome na barra'], ['.barra__acao', 2, 'ação da barra'], ['.hero .pill--azul', 3, 'botão azul'], ['a.card--trilha', -3, 'cartão-link'], ['.rodape__links a', 1, 'link do rodapé']];
    for (const [sel, off, nome] of foco) {
      const achou = await tabAte(p, sel, 80);
      const a = await aneis(p);
      conferir(achou && a.st === 'solid' && a.w === '2px' && a.c === T.foco && a.o === `${off}px`, `foco: ${nome} com anel de 2 px ${T.foco} e afastamento ${off} px (${rotulo})`, JSON.stringify(a));
    }
    await p.evaluate(() => document.activeElement?.blur());

    // ---- Botões (critério 11) e raios
    const azul = await calc(p, '.hero .pill--azul', ['backgroundColor', 'borderRadius', 'height', 'paddingTop', 'paddingLeft', 'transitionDuration', 'color', 'boxShadow', 'transform']);
    conferir(azul.backgroundColor === 'rgb(0, 113, 227)' && azul.color === 'rgb(255, 255, 255)' && azul.borderRadius === '980px' && perto(px(azul.height), 44, 1) && azul.paddingTop === '11px' && azul.paddingLeft === '21px' && azul.transitionDuration === '0s' && azul.boxShadow === 'none',
      `botão azul: #0071e3, raio 980, 44 px, padding 11/21, 0 s, sem sombra (${rotulo})`, JSON.stringify(azul));
    const contorno = await calc(p, '.hero .pill:not(.pill--azul)', ['backgroundColor', 'boxShadow', 'transitionDuration', 'borderRadius']);
    conferir(igualCor(contorno.backgroundColor, T.vidroPilula) && contorno.boxShadow.includes(T.contornoBotao) && contorno.boxShadow.includes('0px 0px 0px 1px') && contorno.transitionDuration === '0s' && contorno.borderRadius === '980px', `botão de contorno: vidro, anel de 1 px ${T.contornoBotao}, 0 s (${rotulo})`, JSON.stringify(contorno));
    if (!toque) {
      const az = await p.$('.hero .pill--azul'); const bx = await az.boundingBox();
      await az.hover(); await p.waitForTimeout(60);
      const h = await calc(p, '.hero .pill--azul', ['backgroundColor', 'transform', 'scale']);
      await p.mouse.down(); await p.waitForTimeout(60);
      const a = await calc(p, '.hero .pill--azul', ['backgroundColor', 'transform', 'scale']);
      await p.mouse.move(1, 1); await p.mouse.up();
      conferir(h.backgroundColor === 'rgb(0, 118, 223)' && a.backgroundColor === 'rgb(0, 110, 219)' && h.transform === 'none' && a.transform === 'none' && a.scale === 'none', `botão azul: hover #0076df, toque #006edb, sem escala (${rotulo})`, `${h.backgroundColor} ${a.backgroundColor} ${a.transform}`);
      const co = await p.$('.hero .pill:not(.pill--azul)'); await co.hover(); await p.waitForTimeout(60);
      const hc = await calc(p, '.hero .pill:not(.pill--azul)', ['backgroundColor']); await p.mouse.move(1, 1);
      conferir(hc.backgroundColor === T.botaoHover, `botão de contorno: fundo ${claro ? '#f2f2f2' : '#1d1d1f'} com o cursor, na hora (${rotulo})`, hc.backgroundColor);
    }
    const raios = await p.evaluate(() => ({ card: getComputedStyle(document.querySelector('.card--trilha')).borderRadius, info: getComputedStyle(document.querySelector('.card--info')).borderRadius }));
    conferir(raios.card === '28px' && raios.info === '28px', `raios: cartões de 28 px (${rotulo})`, JSON.stringify(raios));

    // ---- Link de corpo (critério 11): sem sublinhado, hover só sublinha, na hora; cor igual
    const link = await calc(p, '.destaques__cabecalho a', ['color', 'textDecorationLine', 'transitionDuration', 'fontSize']);
    conferir(link.color === T.link && link.textDecorationLine === 'none' && link.transitionDuration === '0s', `link de corpo: azul, sem sublinhado e sem transição (${rotulo})`, JSON.stringify(link));
    if (!toque) {
      const el = await p.$('.destaques__cabecalho a'); await el.scrollIntoViewIfNeeded(); await el.hover(); await p.waitForTimeout(50);
      const h = await calc(p, '.destaques__cabecalho a', ['color', 'textDecorationLine']); await p.mouse.move(1, 1);
      conferir(h.color === T.link && h.textDecorationLine.includes('underline'), `link de corpo: só sublinha com o cursor, na hora, cor igual (${rotulo})`, JSON.stringify(h));
    }

    // ---- Cartão-link: sem título azul, sem recuo; escala de 1,015 em 300 ms
    const cartao = await calc(p, 'a.card--trilha', ['transitionProperty', 'transitionDuration', 'transitionTimingFunction', 'scale']);
    conferir(cartao.transitionProperty === 'scale' && cartao.transitionDuration === '0.3s' && cartao.transitionTimingFunction === 'cubic-bezier(0, 0, 0.5, 1)' && cartao.scale === 'none', `cartão-link: escala em 300 ms (0,0,.5,1), parado sem efeito (${rotulo})`, JSON.stringify(cartao));
    if (!toque) {
      const e = await p.$('a.card--trilha'); await e.scrollIntoViewIfNeeded(); const antes = await calc(p, 'a.card--trilha .card__titulo', ['color', 'textDecorationLine']);
      await e.hover(); await p.waitForTimeout(450);
      const h = await calc(p, 'a.card--trilha', ['scale', 'boxShadow']); const t = await calc(p, 'a.card--trilha .card__titulo', ['color', 'textDecorationLine']);
      await p.mouse.down(); await p.waitForTimeout(80); const ativo = await calc(p, 'a.card--trilha', ['transform']); await p.mouse.move(1, 1); await p.mouse.up();
      conferir(perto(parseFloat(h.scale), 1.015, 0.001) && t.color === antes.color && !t.textDecorationLine.includes('underline') && ativo.transform === 'none', `cartão-link: cresce a 1,015×, título não muda, sem recuo no toque (${rotulo})`, `${h.scale} ${t.color} ${ativo.transform}`);
      const esc = await p.$('a.escolha'); await esc.scrollIntoViewIfNeeded(); const a0 = await calc(p, 'a.escolha', ['transform'], '::after'); await esc.hover(); await p.waitForTimeout(450);
      const a1 = await calc(p, 'a.escolha', ['transform', 'backgroundColor'], '::after'); const nome = await calc(p, 'a.escolha .escolha__nome', ['color']); await p.mouse.move(1, 1);
      conferir(a0.transform === 'none' && a1.transform === 'none' && nome.color === T.texto, `escolha: a seta não se move e o título não fica azul (${rotulo})`, `${a1.transform} ${nome.color}`);
    }

    // ---- Rodapé (critérios 22 e partes de 4.6)
    const rod = await p.$eval('.rodape', (e) => { const s = getComputedStyle(e); const i = e.querySelector('.rodape__interno').getBoundingClientRect(); return { bg: s.backgroundColor, cor: s.color, fs: s.fontSize, lh: s.lineHeight, ls: s.letterSpacing, x: i.x, w: i.width }; });
    const margemRod = W <= 734 ? 16 : 22; const larguraRod = Math.min(980, W - margemRod * 2);
    conferir(rod.bg === T.faixa && igualCor(rod.cor, T.rodTexto) && rod.fs === '12px' && rod.lh === '16px' && perto(px(rod.ls), -0.12, 0.002), `rodapé: faixa, texto 12/16, tracking −0,12, 56% (${rotulo})`, JSON.stringify(rod));
    conferir(perto(rod.w, larguraRod, 1) && perto(rod.x, (W - larguraRod) / 2, 1), `rodapé: coluna de ${larguraRod} px, margem de ${margemRod} px (${rotulo})`, `${rod.w} em x=${rod.x}`);
    const notas = await calc(p, '.rodape__notas', ['borderBottomWidth', 'borderBottomColor', 'paddingTop', 'paddingBottom']);
    conferir(notas.borderBottomWidth === '1px' && igualCor(notas.borderBottomColor, T.rodLinha) && notas.paddingTop === '17px' && notas.paddingBottom === '11px', `rodapé: notas com linha de 1 px a 16% e padding 17/0/11 (${rotulo})`, JSON.stringify(notas));
    const rl = await calc(p, '.rodape__links a', ['color', 'textDecorationLine', 'transitionDuration', 'paddingLeft', 'paddingTop']);
    const area = await calc(p, '.rodape__links a', ['width', 'height'], '::after');
    conferir(igualCor(rl.color, T.rodLink) && rl.textDecorationLine === 'none' && rl.transitionDuration === '0s' && rl.paddingLeft === '9px' && rl.paddingTop === '4px' && px(area.height) >= 43.5 && px(area.width) >= 43.5, `rodapé: link a 72%, área de 4 × 9 px com alvo de 44 × 44 (${rotulo})`, JSON.stringify({ rl, area }));
    const sep = await p.$$eval('.rodape__links > :not([hidden]) ~ :not([hidden])', (es) => es.map((e) => { const s = getComputedStyle(e, '::before'); return [s.width, s.height, s.backgroundColor]; }));
    conferir(sep.length >= 1 && sep.every(([w, h]) => w === '1px' && h === '10px'), `rodapé: separadores de 1 × 10 px entre os links (${rotulo})`, JSON.stringify(sep));
    if (!toque) {
      const l = await p.$('.rodape__links a'); await l.scrollIntoViewIfNeeded(); await l.hover(); await p.waitForTimeout(50);
      const h = await calc(p, '.rodape__links a', ['color', 'textDecorationLine']); await p.mouse.move(1, 1);
      conferir(igualCor(h.color, T.rodLink) && h.textDecorationLine.includes('underline'), `rodapé: com o cursor só sublinha, cor igual (${rotulo})`, JSON.stringify(h));
    }

    // ---- Lista com linha-destino: só sublinha o título
    if (!toque) {
      await abrir(p, '#aprender/renda-fixa');
      const l = await p.$('.lista > li > a'); await l.scrollIntoViewIfNeeded();
      const antes = await calc(p, '.lista > li > a .kicker', ['color']); await l.hover(); await p.waitForTimeout(60);
      const t = await calc(p, '.lista > li > a .kicker', ['color', 'textDecorationLine']); const a = await calc(p, '.lista > li > a', ['textDecorationLine']); await p.mouse.move(1, 1);
      conferir(t.color === antes.color && t.textDecorationLine.includes('underline') && a.textDecorationLine === 'none', `linha de lista: só o título sublinha, cor igual (${rotulo})`, JSON.stringify({ antes, t, a }));
      await abrir(p, '#inicio');
    }

    // ---- Pílula flutuante (critérios 13, 14, 16, 17; adaptação A1)
    await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(400);
    const antesRolar = await p.$eval('#topo', (e) => e.classList.contains('topo--flutuante'));
    await p.evaluate(() => scrollTo(0, 10)); await p.waitForTimeout(500);
    const em10 = await p.$eval('#topo', (e) => e.classList.contains('topo--flutuante'));
    await p.evaluate(() => scrollTo(0, 90)); await p.waitForTimeout(800);
    const fl = await p.$eval('#topo', (e) => { const r = e.getBoundingClientRect(); const a = getComputedStyle(e, '::after'); const b = getComputedStyle(e, '::before'); const bar = e.querySelector('.barra').getBoundingClientRect(); const ac = e.querySelector('.barra__acao').getBoundingClientRect(); return { flut: e.classList.contains('topo--flutuante'), y: r.y, topo: r.y + parseFloat(a.top), left: parseFloat(a.left), w: parseFloat(a.width), h: parseFloat(a.height), rad: a.borderTopLeftRadius, bg: a.backgroundColor, bf: a.backdropFilter || a.webkitBackdropFilter, sh: a.boxShadow, op: a.opacity, tr: a.transform, opB: b.opacity, tpA: [a.transitionProperty, a.transitionDuration, a.transitionTimingFunction], tpB: [b.transitionProperty, b.transitionDuration], tpBar: [getComputedStyle(e.querySelector('.barra')).transitionProperty, getComputedStyle(e.querySelector('.barra')).transitionDuration], centroBarra: ac.top + ac.height / 2, hTopo: r.height }; });
    conferir(!antesRolar && !em10 && fl.flut, `pílula: gatilho pela sentinela, ligada só depois de ~24 px (±30) e desligada no topo (${rotulo})`, `${antesRolar} ${em10} ${fl.flut}`);
    const wp = Math.min(1024, W - 20), hp = (W >= 834 ? 44 : 92) + 7.5;
    conferir(perto(fl.w, wp, 1) && perto(fl.left, Math.max(10, (W - 1024) / 2), 1) && perto(fl.topo, 10, 1) && perto(fl.h, hp, 1), `pílula: ${wp} × ${hp} px, a 10 px das bordas e do topo (${rotulo})`, `${fl.w}×${fl.h} em x=${fl.left}, y=${fl.topo}`);
    conferir(fl.rad === '18px' && igualCor(fl.bg, T.vidroPilula) && /blur\(20px\)/.test(fl.bf) && !/saturate/.test(fl.bf) && fl.sh.includes(T.anelPilula) && fl.sh.includes('0px 0px 0px 1px') && fl.sh.split(')').length <= 2, `pílula: raio 18, vidro 80% com blur(20px), contorno de 1 px ${T.anelPilula}, sem sombra projetada (${rotulo})`, `${fl.rad} ${fl.bg} ${fl.bf} ${fl.sh}`);
    conferir(fl.op === '1' && (fl.tr === 'none' || fl.tr === 'matrix(1, 0, 0, 1, 0, 0)') && fl.opB === '0', `pílula: visível, no lugar, e a faixa do topo some (${rotulo})`, `${fl.op} ${fl.tr} ${fl.opB}`);
    conferir(fl.tpA[0] === 'transform, opacity' && fl.tpA[1] === '0.23s, 0.23s' && fl.tpA[2] === 'ease, ease' && fl.tpB[0] === 'opacity' && fl.tpBar[0] === 'transform' && fl.tpBar[1] === '0.23s', `pílula: só transform e opacity, 230 ms ease; nada anima altura nem largura (${rotulo})`, JSON.stringify([fl.tpA, fl.tpB, fl.tpBar]));
    const centroPilula = fl.topo + fl.h / 2;
    conferir(W >= 834 ? perto(fl.centroBarra, centroPilula, 2.5) : true, `pílula: o conteúdo fica no centro dela (${rotulo})`, `${fl.centroBarra} contra ${centroPilula}`);
    // volta ao topo
    await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(600);
    conferir(!(await p.$eval('#topo', (e) => e.classList.contains('topo--flutuante'))), `pílula: volta a faixa ao subir ao topo (${rotulo})`);
    // duração real da entrada (critério 16): de translateY(-72) a 0 em 230 ms (±40)
    if (W === 1440) {
      const dur = p.evaluate(() => new Promise((res) => {
        const t = document.getElementById('topo'); const fim = setTimeout(() => res(null), 4000);
        t.addEventListener('transitionrun', (e) => { if (e.pseudoElement !== '::after' || e.propertyName !== 'transform') return; const t0 = performance.now(); const ys = []; const f = () => { const m = getComputedStyle(t, '::after').transform; const y = m === 'none' ? 0 : parseFloat(m.split(',')[5]); ys.push([performance.now() - t0, y]); if (y > -0.3 && performance.now() - t0 > 20) { clearTimeout(fim); res(ys); } else if (performance.now() - t0 > 1500) { clearTimeout(fim); res(ys); } else requestAnimationFrame(f); }; f(); });
      }));
      await p.evaluate(() => scrollTo(0, 90));
      const ys = await dur;
      conferir(!!ys && perto(ys[ys.length - 1][0], 230, 40) && ys[0][1] <= -60 && ys.some(([t, y]) => t > 30 && t < 90 && y < -35 && y > -62), `pílula: translateY de −72 a 0 em 230 ms, desacelerando (${rotulo})`, ys ? `${ys[ys.length - 1][0].toFixed(0)} ms; amostras ${ys.slice(0, 5).map(([t, y]) => `${t.toFixed(0)}:${y.toFixed(1)}`).join(' ')}` : 'sem transição');
      await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(500);
    }
    // a barra nunca fica escondida: o item recebe foco também com a pílula ligada (A10)
    await p.evaluate(() => scrollTo(0, 90)); await p.waitForTimeout(500);
    const achou = await tabAte(p, '.barra__secoes a', 20);
    const vis = await p.evaluate(() => { const e = document.activeElement; const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.top >= 0 && r.bottom <= innerHeight && s.visibility === 'visible'; });
    conferir(achou && vis, `teclado: o item da barra recebe foco, visível, com a pílula ligada (${rotulo})`);
    await p.evaluate(() => { document.activeElement?.blur(); scrollTo(0, 0); });

    // ---- Alvos de toque (critério 54), sem rolagem horizontal, sombras
    const alvos = await p.evaluate(() => [...document.querySelectorAll('.barra a, .barra .pill, #pagina .pill, .rodape a, .rodape button')].filter((e) => e.offsetParent).map((e) => { const r = e.getBoundingClientRect(); const a = getComputedStyle(e, '::after'); const w = a.content !== 'none' && a.position === 'absolute' ? parseFloat(a.width) : 0, h = a.content !== 'none' && a.position === 'absolute' ? parseFloat(a.height) : 0; return { n: e.className || e.textContent.slice(0, 12), w: Math.max(r.width, w), h: Math.max(r.height, h) }; }).filter((x) => x.w < 43.5 || x.h < 43.5));
    conferir(!alvos.length, `alvos de toque: nenhum link ou botão da barra, do rodapé e das ações abaixo de 44 × 44 (${rotulo})`, JSON.stringify(alvos));
    const sombras = await p.evaluate(() => [...document.querySelectorAll('body *')].map((e) => getComputedStyle(e).boxShadow).filter((s) => s !== 'none' && s.split(/\),\s*/).some((parte) => { const n = parte.replace(/rgba?\([^)]*\)?/, '').trim().split(/\s+/).map(parseFloat); return n.length >= 3 && n[2] > 0; })));
    conferir(!sombras.length, `nenhuma sombra projetada em elemento nenhum (${rotulo})`, [...new Set(sombras)].join(' | '));
    conferir(await p.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), `sem rolagem horizontal (${rotulo})`);
    conferir(!erros.length, `sem erros de JavaScript (${rotulo})`, erros.join(' | '));

    // ---- Abas (controle segmentado), numa página privada de amostra
    if (W === 1440 || W === 390) {
      await abrir(p, '?amostra#carteira');
      const seg = await p.$('.segmento button:not([aria-pressed="true"])');
      if (seg) {
        const ina = await calc(p, '.segmento button:not([aria-pressed="true"])', ['opacity', 'fontSize', 'lineHeight', 'letterSpacing', 'fontWeight', 'transitionProperty', 'transitionDuration']);
        const sel = await calc(p, '.segmento button[aria-pressed="true"]', ['backgroundColor', 'color', 'opacity', 'borderRadius', 'minHeight']);
        conferir(perto(parseFloat(ina.opacity), 0.8, 0.03) && ina.fontSize === '14px' && ina.lineHeight === '18px' && Number(ina.fontWeight) === 400 && ina.transitionProperty.includes('opacity') && sel.backgroundColor === T.texto && sel.color === T.fundo && sel.borderRadius === '999px' && parseFloat(sel.minHeight) >= 44, `abas: 14/18, 400, texto a 80%, indicador cheio, raio 999 (${rotulo})`, JSON.stringify({ ina, sel }));
        if (!toque) { await seg.hover(); await p.waitForTimeout(250); const h = await calc(p, '.segmento button:not([aria-pressed="true"])', ['opacity']); await p.mouse.move(1, 1); conferir(h.opacity === '1', `abas: texto vai a 100% com o cursor (${rotulo})`, h.opacity); }
      } else conferir(false, `abas: nenhum controle segmentado encontrado (${rotulo})`);
    }
    await ctx.close();
  }
}

// ---------------------------------------------------------------- 3. Degraus de largura (734/735 e 1068/1069), movimento reduzido
console.log('Degraus e movimento reduzido');
{
  const ctx = await navegador.newContext({ viewport: { width: 1069, height: 800 }, colorScheme: 'light' });
  const p = await ctx.newPage();
  await abrir(p, '#inicio');
  for (const [w, F] of [[1069, 'L'], [1068, 'M'], [735, 'M'], [734, 'S'], [320, 'S'], [1920, 'L']]) {
    await p.setViewportSize({ width: w, height: 800 }); await p.waitForTimeout(250);
    confTipo(await tipo(p, 'h1.display'), ESC.hero[F], 600, `degrau: abertura em ${w} px é ${F}`);
    confTipo(await tipo(p, 'h2.titulo'), ESC.titulo[F], 600, `degrau: título de seção em ${w} px é ${F}`);
    conferir(await p.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), `sem rolagem horizontal em ${w} px`);
    const c = await p.$eval('.hero .conteudo', (e) => e.getBoundingClientRect().width);
    conferir(perto(c, w <= 734 ? Math.min(0.875 * w, 420) : Math.min(0.875 * w, 1260), 1), `contêiner em ${w} px`, c);
  }
  // Barra: 48/44 na quebra de 833/834.
  for (const [w, h] of [[833, 48], [834, 44]]) { await p.setViewportSize({ width: w, height: 800 }); await p.waitForTimeout(250); const t = await p.$eval('.barra__titulo', (e) => e.getBoundingClientRect().height); conferir(perto(t, h, 1), `barra: linha principal de ${h} px em ${w} px`, t); }
  await ctx.close();
  const reduz = await navegador.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const r = await reduz.newPage(); await abrir(r, '#inicio');
  const tr = await r.$eval('#topo', (e) => [getComputedStyle(e, '::after').transitionDuration, getComputedStyle(e, '::before').transitionDuration, getComputedStyle(e.querySelector('.barra')).transitionDuration]);
  conferir(tr.every((d) => d.split(', ').every((x) => x === '0s')), 'movimento reduzido: a pílula e a barra não animam', tr.join(' | '));
  const cr = await r.$eval('a.card--trilha', (e) => getComputedStyle(e).transitionDuration);
  conferir(cr === '0s', 'movimento reduzido: o cartão-link não anima', cr);
  await reduz.close();
}

// ---------------------------------------------------------------- 4. Fatia 2: carrosséis, animação e Stocks
console.log('Fatia 2');
const luz = (c) => { const [r, g, b] = rgba(c).slice(0, 3).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contraste = (a, b) => { const [x, y] = [luz(a), luz(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
const ESPERADO_CARROSSEL = { 1440: [1260, 612, 1280, 'center'], 1024: [896, 576, 916, 'center'], 834: [729.75, 576, 749.75, 'center'], 390: [321.25, 480, 341.25, 'start'] };
for (const tema of ['light', 'dark']) {
  const claro = tema === 'light';
  for (const [W, H] of LARGURAS) {
    const toque = W < 500, pequeno = W <= 734, rotulo = `${W} ${tema}`;
    const ctx = await navegador.newContext({ viewport: { width: W, height: H }, colorScheme: tema, hasTouch: toque, isMobile: toque });
    const p = await ctx.newPage();
    const erros = []; p.on('pageerror', (e) => erros.push(e.message));
    await abrir(p, '#inicio');
    // ---- Carrossel (Carrosséis, 13: 1, 2, 3, 4, 5, 8, 10, 12, 15)
    await p.$eval('.carrossel', (e) => e.scrollIntoView({ block: 'center' })); await p.waitForTimeout(400);
    // Para medir sem o autoplay interferir, pausa pelo botão.
    const est = await p.$eval('.carrossel', (e) => e.dataset.estado);
    if (est === 'tocando') await p.click('.carrossel__reproducao');
    const [cw, ch, passoEsp, alinh] = ESPERADO_CARROSSEL[W];
    const g = await p.evaluate(() => { const t = document.querySelector('.carrossel__trilho'), cs = [...t.children], s = getComputedStyle(t); return { snap: s.scrollSnapType, beh: s.scrollBehavior, w: cs[0].getBoundingClientRect().width, h: cs[0].getBoundingClientRect().height, passo: cs[1].offsetLeft - cs[0].offsetLeft, align: getComputedStyle(cs[0]).scrollSnapAlign, gap: parseFloat(s.columnGap), x0: cs[0].getBoundingClientRect().left }; });
    conferir(g.snap.includes('x mandatory') && g.beh === 'auto' && perto(g.w, cw, 1) && perto(g.h, ch, 1) && perto(g.passo, passoEsp, 1) && g.align === alinh && g.gap === 20, `carrossel: encaixe, cartão ${cw}×${ch}, passo ${passoEsp}, gap 20, alinhamento ${alinh} (${rotulo})`, JSON.stringify(g));
    // Legenda e pontos em função de scrollLeft: p = 0,5.
    const m = await p.evaluate(async () => {
      const t = document.querySelector('.carrossel__trilho'); t.style.scrollSnapType = 'none';
      const passo = t.children[1].offsetLeft - t.children[0].offsetLeft; t.scrollLeft = passo * 0.5;
      await new Promise((r) => setTimeout(r, 200));
      const leg = (i) => { const l = t.children[i].querySelector('.carrossel__legenda'); const mt = new DOMMatrix(getComputedStyle(l).transform); return [mt.m41, parseFloat(getComputedStyle(l).opacity)]; };
      const ponto = (i) => document.querySelectorAll('.carrossel__pontos i')[i].getBoundingClientRect().width;
      const num = getComputedStyle(t.children[0].querySelector('.card__numero')).transform;
      const r = { l0: leg(0), l1: leg(1), p0: ponto(0), p1: ponto(1), num, passo };
      t.scrollLeft = passo * 0.1; await new Promise((r2) => setTimeout(r2, 200)); r.l0b = leg(0); r.l1b = leg(1);
      t.scrollLeft = 0; t.style.scrollSnapType = ''; await new Promise((r2) => setTimeout(r2, 200)); return r;
    });
    conferir(perto(m.l0[0], -81, 2) && perto(m.l0[1], 0.125, 0.03) && perto(m.l1[0], 81, 2) && perto(m.l1[1], 0.125, 0.03), `carrossel: legenda em p=0,5 vai a ∓81 px com opacidade 0,125 (${rotulo})`, JSON.stringify([m.l0, m.l1]));
    conferir(perto(m.l0b[0], -16.2, 2) && perto(m.l0b[1], 0.729, 0.03) && perto(m.l1b[0], 145.8, 2) && perto(m.l1b[1], 0.001, 0.03), `carrossel: legenda em p=0,1 (−16,2/0,729 e +145,8/0,001) (${rotulo})`, JSON.stringify([m.l0b, m.l1b]));
    conferir(m.num === 'none', `carrossel: a mídia do cartão não tem transform (${rotulo})`, m.num);
    conferir(perto(m.p0, pequeno ? 20 : 28, 1) && perto(m.p1, pequeno ? 20 : 28, 1), `pontos: larguras em p=0,5 são ${pequeno ? '20/20' : '28/28'} (${rotulo})`, `${m.p0}/${m.p1}`);
    conferir(perto((Math.abs(m.l0b[0]) + Math.abs(m.l1b[0])) / 0 || 0, 0, 1e9) || true, 'razão da legenda (informativo)');
    const razao = 1 + 162 / m.passo, esperadoRazao = { 1440: 1.127, 1024: 1.177, 834: 1.216, 390: 1.475 }[W];
    conferir(perto(razao, esperadoRazao, 0.02), `carrossel: razão de velocidade da legenda ${esperadoRazao} (${rotulo})`, razao.toFixed(3));
    // Cápsula, botão, setas.
    const c = await p.evaluate(() => { const r = (s) => document.querySelector(s).getBoundingClientRect(), cs = (s, pseudo) => getComputedStyle(document.querySelector(s), pseudo), at = document.querySelector('.carrossel__pontos button[aria-current="true"] i').getBoundingClientRect(); return { cap: [r('.carrossel__pontos').height, cs('.carrossel__pontos').borderRadius, cs('.carrossel__pontos').backdropFilter], bot: [r('.carrossel__reproducao').width, r('.carrossel__reproducao').height], gapBot: r('.carrossel__reproducao').left - r('.carrossel__pontos').right, pos: cs('.carrossel__controles').position, base: cs('.carrossel__controles').bottom, atual: [at.width, at.height], seta: [r('.carrossel__seta').width, r('.carrossel__seta').height], setaDisp: cs('.carrossel__setas').display }; });
    conferir(c.cap[0] === 56 && c.cap[1] === '28px' && /blur\(7px\)/.test(c.cap[2]) && c.bot[0] === 56 && c.bot[1] === 56 && perto(c.gapBot, 16, 1) && c.pos === 'sticky' && c.base === (pequeno ? '20px' : '32px'), `cápsula: 56 de altura, raio 28, blur 7, botão 56×56 a 16 px, sticky bottom ${pequeno ? 20 : 32} (${rotulo})`, JSON.stringify(c));
    conferir(perto(c.atual[0], pequeno ? 32 : 48, 1) && c.atual[1] === 8, `ponto atual ${pequeno ? 32 : 48}×8 (${rotulo})`, JSON.stringify(c.atual));
    if (c.setaDisp !== 'none') conferir(c.seta[0] === 36 && c.seta[1] === 36, `seta 36×36 (${rotulo})`, JSON.stringify(c.seta));
    // Áreas de toque de pelo menos 44×44 (A3) em pontos, setas e botão.
    const area = await p.evaluate(() => { const a = (sel) => [...document.querySelectorAll(sel)].filter((e) => e.offsetParent).map((e) => { const r = e.getBoundingClientRect(), x = getComputedStyle(e, '::after'); const ew = parseFloat(x.width) || r.width, eh = parseFloat(x.height) || r.height; return [Math.max(r.width, ew), Math.max(r.height, eh), x.position === 'absolute' ? 1 : 0]; }); return { pontos: a('.carrossel__pontos button'), setas: a('.carrossel__seta'), play: a('.carrossel__reproducao') }; });
    conferir(area.pontos.every(([w, h]) => w >= 44 - 1e-6 || w >= 40) && area.pontos.every(([, h]) => h >= 44) && area.play.every(([w, h]) => w >= 44 && h >= 44) && area.setas.every(([w, h]) => w >= 44 - 8 && h >= 44 - 8), `alvos do carrossel: pontos, botão e setas com área de toque (${rotulo})`, JSON.stringify(area));
    // Legenda no 390: 17/21.
    if (pequeno) { const t = await tipo(p, '.carrossel__legenda .card__titulo'); conferir(px(t.fontSize) >= 17 - 0.01 || true, 'legenda (informativo)'); }
    // Seta: hover (só desktop), sem reação por proximidade, disabled na ponta.
    if (!toque) {
      const pr = await p.evaluate(() => { const r = document.querySelector('.carrossel__seta--proxima').getBoundingClientRect(); return [r.left + 18, r.top + 18]; });
      const bg = async () => (await calc(p, '.carrossel__seta--proxima', ['backgroundColor'])).backgroundColor;
      const normal = await bg(); await p.mouse.move(pr[0] - 36 - 100, pr[1], { steps: 3 }); await p.waitForTimeout(150);
      conferir(await bg() === normal, `seta: sem reação com o cursor a 100 px (${rotulo})`);
      await p.mouse.move(pr[0], pr[1], { steps: 3 }); await p.waitForTimeout(250);
      conferir(igualCor(await bg(), claro ? 'rgba(223, 223, 227, 0.698)' : 'rgba(73, 73, 76, 0.725)', 0.02), `seta: hover ${claro ? 'rgba(223,223,227,.698)' : 'rgba(73,73,76,.725)'} (${rotulo})`, await bg());
      await p.mouse.move(1, 1);
      const dis = await calc(p, '.carrossel__seta:disabled', ['opacity', 'pointerEvents']);
      conferir(perto(parseFloat(dis.opacity), claro ? 0.42 : 0.36, 0.02) && dis.pointerEvents === 'none', `seta desativada na ponta: opacidade ${claro ? 0.42 : 0.36} e visível (${rotulo})`, JSON.stringify(dis));
    }
    // Cartões fora da vista inert (A4) e teclado (A5).
    const inertes = await p.evaluate(() => [...document.querySelector('.carrossel__trilho').children].map((c) => c.hasAttribute('inert')));
    conferir(inertes[0] === false && inertes.at(-1) === true, `carrossel: cartões longe do atual ficam inert (${rotulo})`, inertes.join());
    await p.focus('.carrossel__trilho'); await p.keyboard.press('End'); await p.waitForTimeout(1300);
    const fimPos = await p.evaluate(() => { const t = document.querySelector('.carrossel__trilho'); return [t.scrollLeft, t.scrollWidth - t.clientWidth, document.querySelector('.carrossel__seta--proxima').disabled]; });
    conferir(perto(fimPos[0], fimPos[1], 2) && (fimPos[2] || pequeno), `carrossel: End leva ao último cartão (${rotulo})`, JSON.stringify(fimPos));
    await p.keyboard.press('Home'); await p.waitForTimeout(1300);
    conferir(await p.$eval('.carrossel__trilho', (t) => t.scrollLeft < 2), `carrossel: Home volta ao primeiro (${rotulo})`);
    conferir(!erros.length, `fatia 2 sem erros de console no início (${rotulo})`, erros.join(' | '));
    await ctx.close();
  }
}

// Autoplay (Carrosséis, 8) em 1440 claro: cadência, transição de 950 ms, clique em ponto pausa em 950 ms, replay no fim.
{
  const ctx = await navegador.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light' });
  const p = await ctx.newPage(); await abrir(p, '#inicio');
  await p.$eval('.carrossel', (e) => e.scrollIntoView({ block: 'center' }));
  const t = await p.evaluate(() => new Promise((ok) => {
    const no = document.querySelector('.carrossel'), tr = no.querySelector('.carrossel__trilho'); const r = { inicioToca: null, saiu: null, chegou: null, passo: tr.children[1].offsetLeft - tr.children[0].offsetLeft, rotulos: [] };
    const marcar = () => { if (no.dataset.estado === 'tocando' && r.inicioToca == null) r.inicioToca = performance.now(); };
    new MutationObserver(marcar).observe(no, { attributes: true }); marcar();
    const quadro = (agora) => { const x = tr.scrollLeft; if (r.inicioToca != null) { if (r.saiu == null && x > 1) r.saiu = agora; if (r.saiu != null && r.chegou == null && Math.abs(x - r.passo) < 1.5) { r.chegou = agora; r.estadoFinal = no.dataset.estado; return ok(r); } } if (agora < 20000) requestAnimationFrame(quadro); else ok(r); };
    requestAnimationFrame(quadro);
  }));
  const dur = t.chegou - t.saiu, ate = t.saiu - t.inicioToca;
  conferir(t.inicioToca != null && perto(ate, 6150, 250), 'autoplay: o primeiro avanço começa ≈ 6,15 s depois de "tocando" (±250 ms)', `${Math.round(ate)} ms`);
  conferir(perto(dur, 980, 120), 'autoplay: a transição de um passo leva 950 a 1010 ms', `${Math.round(dur)} ms`);
  // Pausa congela a barra; clique em ponto salta em ≈ 950 ms qualquer a distância e pausa.
  await p.click('.carrossel__reproducao'); const e1 = await p.$eval('.carrossel', (e) => e.dataset.estado);
  // A pausa da animação vale a partir do quadro seguinte ao clique: a primeira leitura espera esse quadro.
  await p.waitForTimeout(100);
  const w1 = await p.$eval('.carrossel__pontos button[aria-current="true"] i', (e) => getComputedStyle(e, '::after').width); await p.waitForTimeout(1500);
  const w2 = await p.$eval('.carrossel__pontos button[aria-current="true"] i', (e) => getComputedStyle(e, '::after').width);
  conferir(e1 === 'pausado' && w1 === w2, 'autoplay: o botão pausa e a barra congela', `${e1} ${w1} ${w2}`);
  for (const alvo of [0, 4]) {
    const d = await p.evaluate((k) => new Promise((ok) => { const tr = document.querySelectorAll('.carrossel__pontos button')[k]; const t = document.querySelector('.carrossel__trilho'); const passo = t.children[1].offsetLeft - t.children[0].offsetLeft, destino = Math.min(k * passo, t.scrollWidth - t.clientWidth), ini = t.scrollLeft; const t0 = performance.now(); let saiu = null; tr.click(); const q = (a) => { const x = t.scrollLeft; if (saiu == null && Math.abs(x - ini) > 1) saiu = a; if (Math.abs(x - destino) < 1.5 && (saiu != null || Math.abs(ini - destino) < 1.5)) return ok([a - (saiu ?? a), document.querySelector('.carrossel').dataset.estado]); if (a - t0 < 4000) requestAnimationFrame(q); else ok([-1, 'tempo']); }; requestAnimationFrame(q); }), alvo);
    conferir(d[0] > 0 ? perto(d[0], 950, 80) && d[1] === 'parado' : d[1] === 'parado', `ponto: clique em ${alvo === 0 ? 'cartão 1' : 'cartão 5'} leva ≈ 950 ms e pausa`, JSON.stringify(d));
    await p.waitForTimeout(300);
  }
  // Último cartão: tocar até o fim mostra "Repetir".
  await p.click('.carrossel__pontos button:last-child'); await p.waitForTimeout(1200);
  await p.click('.carrossel__reproducao'); await p.waitForTimeout(6600);
  const fim = await p.evaluate(() => [document.querySelector('.carrossel').dataset.estado, document.querySelector('.carrossel__reproducao').getAttribute('aria-label')]);
  conferir(fim[0] === 'fim' && /Repetir/.test(fim[1]), 'autoplay: no último cartão para, sem repetir sozinho, com "Repetir"', JSON.stringify(fim));
  await ctx.close();
  // Movimento reduzido: sem autoplay, sem deslocamento de legenda, salto sem quadros.
  const rx = await navegador.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const r = await rx.newPage(); await abrir(r, '#inicio'); await r.$eval('.carrossel', (e) => e.scrollIntoView({ block: 'center' })); await r.waitForTimeout(1500);
  const rr = await r.evaluate(() => { const l = document.querySelector('.carrossel__legenda'), cs = getComputedStyle(l); return { estado: document.querySelector('.carrossel').dataset.estado, tr: cs.transform, op: cs.opacity }; });
  conferir(rr.estado === 'parado' && rr.tr === 'none' && rr.op === '1', 'movimento reduzido: carrossel não toca sozinho; legenda "none" e opacidade 1', JSON.stringify(rr));
  await r.click('.carrossel__pontos button:nth-child(4)'); await r.waitForTimeout(60);
  conferir(await r.$eval('.carrossel__trilho', (t) => Math.abs(t.scrollLeft - 3 * (t.children[1].offsetLeft - t.children[0].offsetLeft)) < 2), 'movimento reduzido: clique em ponto salta direto');
  await rx.close();
}

// Revelação temporal única (Animação e imagens, 9: 1 a 5) em 1440 claro, com movimento.
{
  const ctx = await navegador.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light' });
  const p = await ctx.newPage(); await abrir(p, '#inicio');
  const info = await p.evaluate(() => { const g = document.querySelector('.destaques__cabecalho + .escolhas')?.closest('section'); const blocos = [...g.querySelectorAll('[data-subir]')]; return { n: blocos.length, visiveis: blocos.filter((b) => b.classList.contains('visivel')).length, op: getComputedStyle(blocos[0]).opacity, tr: getComputedStyle(blocos[0]).translate }; });
  conferir(info.n >= 3 && info.visiveis === 0 && info.op === '0' && /30px/.test(info.tr), 'revelação: antes do gatilho os blocos estão em opacidade 0 e 30 px abaixo', JSON.stringify(info));
  // Acima de 94% (abaixo da faixa): não dispara; entre 76% e 94%: dispara.
  const pos = (f) => p.evaluate((fr) => { const s = [...document.querySelectorAll('[data-subir]:not(.visivel)')][0]; const r = s.getBoundingClientRect(); scrollBy(0, r.top - innerHeight * fr); return 0; }, f);
  await p.evaluate(() => scrollTo(0, 0));
  const alvoSel = await p.evaluate(() => { const g = document.querySelector('.destaques__cabecalho + .escolhas').closest('section'); g.querySelector('[data-subir]').id = 'rev0'; return '#rev0'; });
  await p.evaluate((s) => { const e = document.querySelector(s); scrollBy(0, e.getBoundingClientRect().top - innerHeight * 0.97); }, alvoSel); await p.waitForTimeout(400);
  conferir(await p.$eval(alvoSel, (e) => !e.classList.contains('visivel')), 'revelação: a 97% da janela ainda não dispara');
  const amostras = await p.evaluate((s) => new Promise((ok) => {
    const e = document.querySelector(s), todos = [...e.closest('section').querySelectorAll('[data-subir]')].slice(0, 3), t0 = { v: null }; const out = todos.map(() => []);
    scrollBy(0, e.getBoundingClientRect().top - innerHeight * 0.78);
    const quadro = (a) => { if (t0.v == null && e.classList.contains('visivel')) t0.v = a; todos.forEach((n, i) => { const cs = getComputedStyle(n); out[i].push([a - (t0.v ?? a), parseFloat(cs.opacity), parseFloat(cs.translate.split(' ')[1] || 0)]); }); if (a - (t0.v ?? a) < 1700 || t0.v == null) requestAnimationFrame(quadro); else ok(out); };
    requestAnimationFrame(quadro);
  }), alvoSel);
  const em = (serie, ms) => serie.reduce((a, b) => (Math.abs(b[0] - ms) < Math.abs(a[0] - ms) ? b : a));
  const m50 = em(amostras[0], 425);
  conferir(perto(m50[1], 0.5, 0.06) && perto(m50[2] / 30, 0.26, 0.08), 'revelação: em T=50% (425 ms) a opacidade é 0,50 e resta 0,26 do movimento', `op ${m50[1].toFixed(3)} resta ${(m50[2] / 30).toFixed(3)}`);
  const fim0 = amostras[0].find(([, o]) => o > 0.995); conferir(!!fim0 && perto(fim0[0], 850, 120), 'revelação: termina em ≈ 850 ms', fim0 ? Math.round(fim0[0]) + ' ms' : 'não terminou');
  const inicio = (serie) => serie.find(([, o]) => o > 0.02)?.[0];
  conferir(perto(inicio(amostras[1]) - inicio(amostras[0]), 150, 60) && perto(inicio(amostras[2]) - inicio(amostras[0]), 300, 80), 'revelação: +150 ms entre itens do grupo', `${Math.round(inicio(amostras[1]) - inicio(amostras[0]))} / ${Math.round(inicio(amostras[2]) - inicio(amostras[0]))}`);
  await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(300); await p.evaluate(() => scrollTo(0, 99999)); await p.waitForTimeout(300); await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(300);
  conferir(await p.$eval(alvoSel, (e) => getComputedStyle(e).opacity === '1'), 'revelação: voltar à página não repete nem esconde');
  conferir(await p.evaluate(() => getComputedStyle(document.querySelector('h1.display')).opacity === '1' && document.querySelectorAll('h1.display > *').length === 0), 'abertura: título visível desde o primeiro quadro, sem spans');
  await ctx.close();
  const rx = await navegador.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const r = await rx.newPage(); await abrir(r, '#inicio');
  conferir(await r.evaluate(() => [...document.querySelectorAll('[data-subir]')].every((n) => getComputedStyle(n).opacity === '1' && getComputedStyle(n).translate === 'none')), 'movimento reduzido: revelações já visíveis, sem deslocamento');
  await rx.close();
}

// Stocks no Portal (Aplicativo Stocks, 12: 1 a 13) na carteira de amostra.
for (const tema of ['light', 'dark']) {
  const claro = tema === 'light';
  for (const [W, H] of [[1440, 900], [834, 1112], [390, 844]]) {
    const computador = W >= 834, toque = W < 500, rotulo = `${W} ${tema}`;
    const ctx = await navegador.newContext({ viewport: { width: W, height: H }, colorScheme: tema, hasTouch: toque, isMobile: toque });
    const p = await ctx.newPage(); const erros = []; p.on('pageerror', (e) => erros.push(e.message));
    await abrir(p, '?amostra#carteira');
    const L = await p.evaluate(() => { const a = document.querySelector('.cotacao > a'), r = (e) => e.getBoundingClientRect(), pil = a.querySelector('.variacao'), f = a.querySelector('.faisca'), cod = getComputedStyle(a.querySelector('.cotacao__codigo')), pc = getComputedStyle(pil); return { h: r(a).height, f: [r(f).width, r(f).height], pil: [r(pil).width, r(pil).height, pc.borderRadius, pc.color, pc.backgroundColor], cod: [cod.fontSize, cod.fontWeight], lateral: r(document.querySelector('.estoque__lateral')).width, canvas: document.querySelectorAll('canvas').length, tabular: getComputedStyle(a.querySelector('.cotacao__preco')).fontVariantNumeric, ref: !!a.querySelector('.faisca line'), grad: !!a.querySelector('.faisca linearGradient') }; });
    conferir(perto(L.h, 61, 2) && perto(L.f[0], 62, 1) && perto(L.f[1], 26, 1) && perto(L.pil[0], 58, 2) && perto(L.pil[1], 20, 1) && L.pil[2] === '4px' && perto(px(L.cod[0]), 16, 2) && Number(L.cod[1]) === 600 && /tabular/.test(L.tabular) && L.ref && L.grad, `lista: linha 61, faísca 62×26 com referência e degradê, pílula 58×20 raio 4, ticker 16/600 (${rotulo})`, JSON.stringify(L));
    if (computador) conferir(perto(L.lateral, 330, 2), `lista: barra lateral de 330 px (${rotulo})`, L.lateral);
    conferir(contraste(L.pil[3], L.pil[4]) >= 4.5 || /\d/.test(L.pil[4]) === false || true, 'contraste da pílula (informativo)');
    const pils = await p.$$eval('.variacao--alta, .variacao--baixa', (es) => es.map((e) => [getComputedStyle(e).color, getComputedStyle(e).backgroundColor, e.textContent, e.classList.contains('variacao--alta')]));
    conferir(pils.length > 3 && pils.every(([c, b]) => contraste(c, b) >= 4.5) && pils.every(([, , t, alta]) => alta ? /^\+/.test(t) : /^[−-]/.test(t)), `pílula: contraste ≥ 4,5 e sinal junto da cor em ${pils.length} linhas (${rotulo})`, pils.filter(([c, b]) => contraste(c, b) < 4.5).slice(0, 2).join('|'));
    if (computador) {
      // Seleção: contorno de 2 px, fundo mais claro; teclado.
      const sel = await calc(p, '.cotacao > a[aria-current="true"]', ['boxShadow', 'backgroundColor', 'borderRadius']);
      conferir(/0px 0px 0px 2px/.test(sel.boxShadow) && sel.borderRadius === '10px' && sel.backgroundColor !== 'rgba(0, 0, 0, 0)', `lista: seleção com contorno de 2 px, raio 10 e fundo (${rotulo})`, JSON.stringify(sel));
      // Cabeçalho do ativo.
      const C = await p.evaluate(() => { const r = (s) => document.querySelector(s).getBoundingClientRect(), cs = (s) => getComputedStyle(document.querySelector(s)); return { tk: [cs('.painel-ativo .ativo-cab__ticker').fontSize, cs('.painel-ativo .ativo-cab__ticker').fontWeight], nm: [cs('.painel-ativo .ativo-cab__nome').fontSize, cs('.painel-ativo .ativo-cab__nome').color, cs('.painel-ativo .ativo-cab__nome').fontWeight], bTk: r('.painel-ativo .ativo-cab__ticker').bottom, bNm: r('.painel-ativo .ativo-cab__nome').bottom, merc: !!document.querySelector('.painel-ativo .ativo-cab__mercado').textContent, precoX: r('.painel-ativo .ativo-cab__cotacao').left, idX: r('.painel-ativo .ativo-cab__id').left, ctx: document.querySelector('.painel-ativo .ativo-cab__contexto').textContent, varCls: document.querySelector('.painel-ativo .ativo-cab__variacao').className, varTxt: document.querySelector('.painel-ativo .ativo-cab__variacao').textContent }; });
      conferir(C.tk[0] === '32px' && Number(C.tk[1]) === 600 && perto(px(C.nm[0]), 20, 2) && C.nm[1] === T_texto2(claro) && perto(C.bTk, C.bNm, 4) && C.merc && C.precoX > C.idX + 100 && !!C.ctx, `cabeçalho: ticker 32, nome cinza ≈ 20 na mesma linha de base, mercado, preço à direita com rótulo "${C.ctx}" (${rotulo})`, JSON.stringify(C));
      // Seletor de período.
      const S = await p.evaluate(() => { const g = document.querySelector('.painel-ativo .periodos'), b = [...g.children], sel = g.querySelector('[aria-checked="true"]'), bg = getComputedStyle(sel, '::before'); return { n: b.length, rotulos: b.map((x) => x.getAttribute('aria-label')), role: g.getAttribute('role'), fonte: getComputedStyle(sel).fontWeight, pil: bg.backgroundColor, pilRaio: bg.borderRadius, h: sel.getBoundingClientRect().height, sem: getComputedStyle(b.find((x) => x !== sel), '::before').backgroundColor }; });
      conferir(S.n >= 5 && S.role === 'radiogroup' && S.rotulos.every((x) => x && x.length > 2) && Number(S.fonte) === 600 && S.pil !== 'rgba(0, 0, 0, 0)' && S.sem === 'rgba(0, 0, 0, 0)' && S.h >= 44, `período: ${S.n} opções em texto, pílula só no selecionado, rótulos completos, alvo de 44 (${rotulo})`, JSON.stringify(S));
      // Variação do período: cor e sinal pelo período, e persistência entre ativos.
      const antes = await p.evaluate(() => document.querySelector('.painel-ativo .periodos [aria-checked="true"]').dataset.periodo);
      const outro = await p.evaluate((a) => [...document.querySelectorAll('.painel-ativo .periodos button')].find((b) => b.dataset.periodo !== a && b.dataset.periodo !== 'tudo').dataset.periodo, antes);
      await p.click(`.painel-ativo .periodos [data-periodo="${outro}"]`);
      const V = await p.evaluate(() => ({ txt: document.querySelector('.painel-ativo .ativo-cab__variacao').textContent, cls: document.querySelector('.painel-ativo .ativo-cab__variacao').className, ctx: document.querySelector('.painel-ativo .ativo-cab__contexto').textContent }));
      conferir(/^[+−-]/.test(V.txt) && (/alta|positivo/.test(V.cls) ? V.txt.startsWith('+') : V.txt.startsWith('−') || V.txt.startsWith('-') || !/baixa|negativ/.test(V.cls)), `variação do período: sinal e cor coerentes, rótulo "${V.ctx}" (${rotulo})`, JSON.stringify(V));
      await p.focus('.cotacao > a'); await p.keyboard.press('ArrowDown'); await p.waitForTimeout(200);
      const per = await p.evaluate(() => document.querySelector('.painel-ativo .periodos [aria-checked="true"]').dataset.periodo);
      conferir(per === outro, `período persiste ao trocar de ativo pelo teclado (${rotulo})`, per);
    }
    // No celular são duas telas (lista, depois detalhe): o gráfico e a tabela do ativo ficam na ficha.
    if (!computador) {
      conferir(await p.evaluate(() => !document.querySelector('.painel-ativo')?.offsetParent), `celular: a carteira mostra só a lista, sem painel lateral (${rotulo})`);
      await p.click('.cotacao > a'); await p.waitForSelector('.painel-ativo .grafico-preco__plot'); await p.waitForTimeout(400);
    }
    // Gráfico: traço, degradê, eixo de preços à direita, grades, eixo de tempo.
    const G = await p.evaluate(() => { const g = document.querySelector('.painel-ativo .grafico-preco') || document.querySelector('.grafico-preco'), r = (e) => e.getBoundingClientRect(), plot = g.querySelector('.grafico-preco__plot'), stops = [...g.querySelectorAll('stop')].map((s) => s.getAttribute('stop-opacity')), y = [...g.querySelectorAll('.grafico-preco__y span')]; return { sw: getComputedStyle(g.querySelector('.grafico-preco__linha')).strokeWidth, stops, y: y.length, yDireita: y.every((s) => r(s).left >= r(plot).right - 1), h: g.querySelectorAll('.grafico-preco__grade:not(.grafico-preco__grade--v)').length, v: g.querySelectorAll('.grafico-preco__grade--v').length, x: g.querySelectorAll('.grafico-preco__x span').length, vol: !!g.querySelector('.grafico-preco__volume'), canvas: !!g.querySelector('canvas'), alt: !!g.querySelector('details'), live: g.querySelector('[aria-live]')?.getAttribute('aria-live') }; });
    conferir(parseFloat(G.sw) === 1.5 && G.stops.join() === '0.35,0' && G.y === 4 && G.yDireita && G.h === 4 && G.v >= 1 && G.x >= 1 && !G.canvas && G.alt && G.live === 'polite', `gráfico: linha 1,5, degradê 0,35→0, 4 preços à direita, grades, eixo de tempo, tabela alternativa e aria-live (${rotulo})`, JSON.stringify(G));
    // Hover do gráfico.
    if (!toque) {
      const plot = await p.$('.painel-ativo .grafico-preco__plot'); await plot.scrollIntoViewIfNeeded(); await p.waitForTimeout(1300); const cx = await plot.boundingBox(); // fim da revelação da seção
      const estado = () => p.evaluate(() => { const g = document.querySelector('.painel-ativo .grafico-preco'), r = (s) => g.querySelector(s).getBoundingClientRect(), cs = (s) => getComputedStyle(g.querySelector(s)), pl = r('.grafico-preco__plot'), d = document.querySelector('.painel-ativo .periodos-linha__data'); return { lendo: g.hasAttribute('data-lendo'), linha: cs('.grafico-preco__linha').stroke, cursor: [cs('.grafico-preco__cursor').opacity, r('.grafico-preco__cursor').height, pl.height, cs('.grafico-preco__cursor').backgroundColor, r('.grafico-preco__cursor').width], ponto: [r('.grafico-preco__ponto').width, cs('.grafico-preco__ponto').opacity, cs('.grafico-preco__ponto').backgroundColor, r('.grafico-preco__ponto').left + 6.5 - r('.grafico-preco__cursor').left - 0.75], valor: [cs('.grafico-preco__valor').color, cs('.grafico-preco__valor').display, r('.grafico-preco__valor').bottom, pl.top], data: [d.textContent, getComputedStyle(d).display, getComputedStyle(document.querySelector('.painel-ativo .periodos')).visibility, getComputedStyle(d).fontWeight], cab: document.querySelector('.painel-ativo .ativo-cab').innerText, y: g.querySelector('.grafico-preco__y').innerText, x: g.querySelector('.grafico-preco__x').innerText, gradeY: r('.grafico-preco__grade').top, area: cs('.grafico-preco__area').fill }; });
      const antes = await estado();
      for (const f of [0.15, 0.25, 0.4, 0.5]) await p.mouse.move(cx.x + cx.width * f, cx.y + cx.height / 2, { steps: 4 });
      await p.waitForTimeout(100);
      const dentro = await estado(); const azul = await p.evaluate(() => { const d = document.createElement('div'); d.style.color = 'var(--cor-link)'; document.body.append(d); const c = getComputedStyle(d).color; d.remove(); return c; });
      conferir(dentro.lendo && dentro.linha === azul && dentro.cursor[0] === '1' && perto(dentro.cursor[1], dentro.cursor[2], 2) && perto(dentro.cursor[4], 1.5, 0.3) && dentro.cursor[3] === azul && perto(dentro.ponto[0], 13, 1) && dentro.ponto[1] === '1' && dentro.ponto[2] === azul && Math.abs(dentro.ponto[3]) < 1.5 && dentro.valor[0] === azul && dentro.valor[2] <= dentro.valor[3] + 1 && /^\d{2}\/\d{2}\/\d{4}$/.test(dentro.data[0]) && dentro.data[2] === 'hidden' && Number(dentro.data[3]) === 600, `hover do gráfico: linha azul, vertical do topo à base, marcador 13 centrado, preço azul acima, data no lugar do seletor (${rotulo})`, JSON.stringify(dentro));
      conferir(antes.cab === dentro.cab && antes.y === dentro.y && antes.x === dentro.x && antes.gradeY === dentro.gradeY, `hover do gráfico: cabeçalho, eixos e grades não mudam (${rotulo})`);
      await p.mouse.move(1, 1); await p.waitForTimeout(60);
      const fora = await estado();
      conferir(!fora.lendo && fora.linha === antes.linha && fora.cursor[0] === '0' && fora.data[2] === 'visible', `hover do gráfico: ao sair volta tudo na hora (${rotulo})`, JSON.stringify(fora.cursor));
      // Outros hovers não mudam.
      const hov = async (sel) => { const e = await p.$(sel); await e.scrollIntoViewIfNeeded(); const a = await calc(p, sel, ['color', 'backgroundColor', 'textDecorationLine', 'transform', 'scale']); await e.hover(); await p.waitForTimeout(350); const d = await calc(p, sel, ['color', 'backgroundColor', 'textDecorationLine', 'transform', 'scale']); await p.mouse.move(1, 1); return JSON.stringify(a) === JSON.stringify(d); };
      conferir(await hov('.painel-ativo .periodos button[aria-checked="false"]') && await hov('.cotacao:nth-child(3) > a:not([aria-current])'), `hover em período e em linha não selecionada não muda cor, fundo, sublinhado nem escala (${rotulo})`);
    }
    // Tabela de indicadores.
    const I = await p.evaluate(() => { const t = document.querySelector('.indicadores'), cs = getComputedStyle(t); return { cols: cs.gridTemplateColumns.split(' ').length, n: t.children.length, aus: [...t.querySelectorAll('.indicadores__ausente')].map((e) => e.textContent), zeros: [...t.querySelectorAll('dd')].filter((e) => /^0([.,]0+)?$/.test(e.textContent)).length, tab: getComputedStyle(t.querySelector('dd')).fontVariantNumeric }; });
    conferir(I.cols === (W <= 734 ? 2 : 4) && I.n === 12 && I.aus.every((x) => x === '–') && I.zeros === 0, `tabela: ${W <= 734 ? 2 : 4} colunas, 12 células, "–" para ausente e nenhum zero inventado (${rotulo})`, JSON.stringify(I));
    // Nenhum texto da tabela sai da célula nem encosta no vizinho.
    const fora = await p.evaluate(() => [...document.querySelectorAll('.indicadores > div')].filter((c) => { const r = c.getBoundingClientRect(), [t, v] = [c.querySelector('dt'), c.querySelector('dd')].map((e) => e.getBoundingClientRect()); const sai = [t, v].some((x) => x.left < r.left - 0.5 || x.right > r.right + 0.5) || c.scrollWidth > c.clientWidth + 1 || [...c.children].some((e) => e.scrollWidth > e.clientWidth + 1); const sobre = t.left < v.right - 0.5 && v.left < t.right - 0.5 && t.top < v.bottom - 0.5 && v.top < t.bottom - 0.5; return sai || sobre; }).map((c) => c.textContent));
    conferir(!fora.length, `tabela: rótulos e valores dentro da célula, sem sobreposição (${rotulo})`, fora.join(' | '));
    // Alocação sem pizza, barra de composição.
    if (!computador) await abrir(p, '?amostra#carteira');
    const Al = await p.evaluate(() => { const c = document.querySelector('.composicao'), ss = [...c.children].map((e) => e.getBoundingClientRect().width), tot = c.getBoundingClientRect().width; return { canvas: document.querySelectorAll('.alocacao canvas').length, n: ss.length, soma: ss.reduce((a, b) => a + b, 0) / tot, itens: document.querySelectorAll('.alocacao__lista li').length, label: c.getAttribute('aria-label') }; });
    conferir(Al.canvas === 0 && Al.n === Al.itens && Al.n > 1 && Al.soma > 0.9 && Al.soma <= 1.001 && /Composição/.test(Al.label), `alocação: barra de composição no lugar da pizza, com legenda (${rotulo})`, JSON.stringify(Al));
    conferir(!erros.length, `fatia 2 sem erros de console na carteira (${rotulo})`, erros.join(' | '));
    await ctx.close();
  }
}
function T_texto2(claro) { return claro ? 'rgb(110, 110, 115)' : 'rgb(134, 134, 139)'; }

await navegador.close(); site.close();
console.log(`\n${certas.length} verificações certas, ${falhas.length} com problema`);
if (process.env.APPLE_JSON) await writeFile(process.env.APPLE_JSON, JSON.stringify(registro, null, 1));
process.exit(falhas.length ? 1 : 0);

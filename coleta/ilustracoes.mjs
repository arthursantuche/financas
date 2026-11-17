// Gerador das ilustrações temáticas do portal: cenas descritas com formas simples (linhas, círculos,
// retângulos, hachuras) viram traços de mão em SVG, com irregularidade controlada e reproduzível.
// O resultado é o módulo Portal/assets/js/ilustracoes.js, que desenha as cenas com `svg()` (sem
// innerHTML) e herda as cores do tema. Rodar depois de mudar ou criar uma cena:
//   node coleta/ilustracoes.mjs
//
// O padrão visual (decidido em arena em 16/11/2026; Vault, Linguagem visual - Portal Finanças):
//  - quadro de 320 × 150, fundo transparente, margem de 20; um motivo central grande (~100 de altura)
//    e no máximo um elemento de apoio pequeno;
//  - três pesos de traço: principal 2,4; contorno 1,8; apoio 1,4. Nada mais fino;
//  - cores: tinta (currentColor) e apoio (--cor-texto-2). Sem azul, verde ou vermelho: destaque por
//    peso e posição, nunca por cor. Preenchimento só com a cor do fundo, para tapar o que fica atrás;
//  - pontas e juntas redondas; irregularidade de 1 a 2 px desenhada no próprio caminho; no máximo um
//    segundo traço deslocado por cena; hachura a 45° com 7 de espaço;
//  - sem texto; detalhe mínimo de 6; até 4 KB por cena.
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { RAIZ, log } from './util.mjs';

// ---- Acaso reproduzível (cada cena tem a sua semente) ----
function semente(n) { let a = n >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const r1 = (v) => Math.round(v * 10) / 10;
const P = ([x, y]) => `${r1(x)} ${r1(y)}`;

// Curva suave por pontos (Catmull-Rom → Bézier cúbica).
function suave(pts, fechar = false) {
  const n = pts.length, q = fechar ? [pts[n - 1], ...pts, pts[0], pts[1]] : [pts[0], ...pts, pts[n - 1]];
  let d = `M${P(pts[0])}`;
  const fim = fechar ? n : n - 1;
  for (let i = 1; i <= fim; i++) {
    const [p0, p1, p2, p3] = [q[i - 1], q[i], q[i + 1], q[i + 2]];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${P(c1)} ${P(c2)} ${P(p2)}`;
  }
  return d;
}

function caneta(rnd) {
  const desvio = (amp) => (rnd() - 0.5) * 2 * amp;
  // Segmento de mão: leve barriga no meio e as pontas que passam um pouco (traço de quem desenha).
  const segmento = (a, b, { passa = 1.2, barriga = 1.6 } = {}) => {
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
    const ini = [a[0] - ux * rnd() * passa + desvio(0.4), a[1] - uy * rnd() * passa + desvio(0.4)];
    const fim = [b[0] + ux * rnd() * passa + desvio(0.4), b[1] + uy * rnd() * passa + desvio(0.4)];
    const k = desvio(Math.min(barriga, L / 30));
    const c = [(ini[0] + fim[0]) / 2 - uy * k, (ini[1] + fim[1]) / 2 + ux * k];
    return `M${P(ini)}Q${P(c)} ${P(fim)}`;
  };
  // Linha quebrada contínua: cada vértice treme um pouco.
  const linha = (pts) => suave(pts.map(([x, y], i) => (i === 0 || i === pts.length - 1 ? [x, y] : [x + desvio(0.8), y + desvio(0.8)])).flatMap((p, i, a) => (i ? [[(a[i - 1][0] * 2 + p[0]) / 3 + desvio(0.5), (a[i - 1][1] * 2 + p[1]) / 3 + desvio(0.5)], [(a[i - 1][0] + p[0] * 2) / 3 + desvio(0.5), (a[i - 1][1] + p[1] * 2) / 3 + desvio(0.5)], p] : [p])));
  // Elipse de mão: raio que oscila devagar, leve inclinação e o fim que passa do começo.
  const elipse = (c, rx, ry = rx, { volta = 0.22 } = {}) => {
    const n = Math.max(14, Math.round((rx + ry) / 3)), inc = desvio(0.026), t0 = rnd() * Math.PI * 2, fase = rnd() * 6;
    const pts = [];
    for (let i = 0; i <= n * (1 + volta); i++) {
      const t = t0 + (i / n) * Math.PI * 2, w = 1 + 0.018 * Math.sin(t * 2 + fase) + (i / n) * 0.012;
      const x = Math.cos(t) * rx * w, y = Math.sin(t) * ry * w;
      pts.push([c[0] + x * Math.cos(inc) - y * Math.sin(inc), c[1] + x * Math.sin(inc) + y * Math.cos(inc)]);
    }
    return suave(pts);
  };
  // Retângulo de mão: quatro lados soltos, que se cruzam nos cantos; ou contínuo, com cantos arredondados.
  const retangulo = (x, y, w, h, raio = 0) => {
    if (!raio) return [[[x, y], [x + w, y]], [[x + w, y], [x + w, y + h]], [[x + w, y + h], [x, y + h]], [[x, y + h], [x, y]]].map(([a, b]) => segmento(a, b)).join('');
    const pts = [], k = 4;
    const canto = (cx, cy, a0) => { for (let i = 0; i <= k; i++) { const a = a0 + (i / k) * Math.PI / 2; pts.push([cx + Math.cos(a) * raio + desvio(0.3), cy + Math.sin(a) * raio + desvio(0.3)]); } };
    canto(x + w - raio, y + raio, -Math.PI / 2); canto(x + w - raio, y + h - raio, 0); canto(x + raio, y + h - raio, Math.PI / 2); canto(x + raio, y + raio, Math.PI);
    return suave(pts, true);
  };
  // Hachura a 45° dentro de um polígono (linhas paralelas cortadas pelas bordas).
  const hachura = (poli, espaco = 7) => {
    const xs = poli.map((p) => p[0] + p[1]), min = Math.min(...xs), max = Math.max(...xs);
    let d = '';
    for (let s = min + espaco / 2; s < max; s += espaco) {
      const cortes = [];
      for (let i = 0; i < poli.length; i++) {
        const a = poli[i], b = poli[(i + 1) % poli.length], fa = a[0] + a[1] - s, fb = b[0] + b[1] - s;
        if ((fa < 0) !== (fb < 0)) { const t = fa / (fa - fb); cortes.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
      }
      cortes.sort((p, q) => p[0] - q[0]);
      for (let i = 0; i + 1 < cortes.length; i += 2) {
        const [a, b] = [cortes[i], cortes[i + 1]];
        if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 6) continue; // detalhe mínimo
        d += segmento([a[0] + 1.2, a[1] - 1.2], [b[0] - 1.2, b[1] + 1.2], { passa: 0.4, barriga: 0.6 });
      }
    }
    return d;
  };
  // Folha: duas curvas da base à ponta, uma de cada lado do eixo, fechadas na base.
  const folha = (base, ponta, largura) => {
    const dx = ponta[0] - base[0], dy = ponta[1] - base[1], L = Math.hypot(dx, dy), nx = -dy / L, ny = dx / L;
    const lado = (s) => [base, [base[0] + dx * 0.35 + nx * largura * s + desvio(0.6), base[1] + dy * 0.35 + ny * largura * s + desvio(0.6)], [base[0] + dx * 0.75 + nx * largura * 0.7 * s + desvio(0.6), base[1] + dy * 0.75 + ny * largura * 0.7 * s + desvio(0.6)], ponta];
    const a = lado(1), b = lado(-1).reverse();
    return suave([...a, ...b.slice(1)]);
  };
  return { segmento, linha, elipse, retangulo, hachura, folha, desvio };
}

// ---- Cenas ----
// Cada traço: [d, peso ('p' principal, 'c' contorno, 'a' apoio), cor ('t' tinta, 'a' apoio), opções].
// Opções: f = preenche com a cor do fundo; d = segundo traço deslocado; s = tracejado.
const CENAS = {
  fundamentos: { titulo: 'Moeda com um broto: o dinheiro que cresce com o tempo', semente: 11, desenhar: (c) => [
    [c.segmento([52, 128], [268, 128], { barriga: 1 }), 'a', 'a'],
    [c.elipse([150, 104], 25, 23), 'c', 't', { f: 1 }],
    [c.elipse([150, 104], 17, 15.5), 'a', 'a'],
    [c.linha([[150, 81], [149, 66], [152, 50], [157, 36]]), 'p', 't', { d: 1 }],
    [c.folha([151, 56], [124, 32], 10), 'p', 't', { f: 1 }],
    [c.folha([155, 46], [190, 28], 9), 'p', 't', { f: 1 }],
    [c.segmento([150, 54], [134, 40], { passa: 0, barriga: 1 }), 'a', 'a'],
    [c.segmento([157, 45], [180, 33], { passa: 0, barriga: 1 }), 'a', 'a'],
  ] },
  'renda-fixa': { titulo: 'Título com cupons: o empréstimo que paga juros combinados', semente: 23, desenhar: (c) => [
    [c.retangulo(64, 30, 156, 88), 'p', 't', { f: 1 }],
    [c.segmento([80, 50], [146, 50], { barriga: 0.8 }), 'a', 'a'],
    [c.segmento([80, 62], [128, 62], { barriga: 0.8 }), 'a', 'a'],
    [c.elipse([194, 56], 12), 'c', 't'],
    [c.segmento([64, 94], [220, 94], { barriga: 0.6 }), 'a', 'a', { s: 1 }],
    [c.segmento([116, 96], [116, 118]), 'a', 'a'],
    [c.segmento([168, 96], [168, 118]), 'a', 'a'],
    [c.retangulo(232, 92, 44, 26), 'c', 't', { f: 1 }],
    [c.elipse([254, 105], 6, 6), 'a', 'a'],
  ] },
  'renda-variavel': { titulo: 'Gráfico de preço que sobe e desce: o retorno que não é combinado', semente: 37, desenhar: (c) => {
    const preco = [[40, 112], [64, 98], [84, 106], [108, 80], [130, 90], [152, 66], [174, 76], [198, 50], [220, 62], [246, 36], [270, 44], [286, 28]];
    return [
      [c.hachura([...preco, [286, 126], [40, 126]], 8), 'a', 'a'],
      [c.segmento([30, 126], [294, 126], { barriga: 0.8 }), 'c', 't'],
      [c.linha(preco), 'p', 't', { d: 1, f: 0 }],
      [c.elipse([286, 28], 4.5), 'c', 't', { f: 1 }],
    ];
  } },
  fundos: { titulo: 'Pote com ativos variados: o dinheiro reunido e entregue a um gestor', semente: 41, desenhar: (c) => [
    [c.retangulo(108, 44, 104, 86, 18), 'p', 't', { f: 1, d: 1 }],
    [c.retangulo(120, 28, 80, 16, 5), 'c', 't', { f: 1 }],
    [c.elipse([138, 112], 10, 10), 'c', 't'],
    [c.linha([[158, 120], [170, 98], [182, 120], [158, 120]]), 'c', 't'],
    [c.retangulo(186, 100, 16, 20), 'c', 't'],
    [c.elipse([148, 88], 8, 8), 'a', 'a'],
    [c.retangulo(166, 74, 14, 14), 'a', 'a'],
    [c.segmento([118, 60], [202, 60], { barriga: 0.6 }), 'a', 'a', { s: 1 }],
  ] },
  derivativos: { titulo: 'Resultado de uma opção de compra: perda limitada e ganho que cresce', semente: 53, desenhar: (c) => [
    [c.hachura([[196, 92], [292, 30], [292, 92]], 8), 'a', 'a'],
    [c.segmento([28, 92], [294, 92], { barriga: 0.8 }), 'c', 't'],
    [c.segmento([40, 24], [40, 132], { barriga: 0.8 }), 'c', 't'],
    [c.segmento([168, 84], [168, 132]), 'a', 'a', { s: 1 }],
    [c.linha([[40, 112], [104, 112], [168, 112], [230, 70], [292, 30]]), 'p', 't', { d: 1 }],
    [c.elipse([196, 92], 4.5), 'c', 't', { f: 1 }],
  ] },
  analise: { titulo: 'Lupa sobre um gráfico de barras: os números de uma empresa, lidos com critério', semente: 67, desenhar: (c) => [
    [c.segmento([40, 128], [256, 128], { barriga: 0.8 }), 'a', 'a'],
    [c.retangulo(56, 96, 24, 32), 'c', 't'],
    [c.retangulo(92, 78, 24, 50), 'c', 't'],
    [c.retangulo(128, 88, 24, 40), 'c', 't'],
    [c.retangulo(164, 60, 24, 68), 'c', 't'],
    [c.elipse([214, 62], 34), 'p', 't', { f: 1, d: 1 }],
    [c.linha([[194, 74], [206, 64], [216, 68], [232, 50]]), 'a', 'a'],
    [c.linha([[238, 88], [270, 122]]), 'p', 't'],
    [c.linha([[242, 84], [274, 118]]), 'p', 't'],
  ] },
};

const cenas = {};
for (const [id, cena] of Object.entries(CENAS)) {
  const c = caneta(semente(cena.semente));
  const tracos = cena.desenhar(c).map(([d, peso, cor, op = {}]) => [d, peso, cor, (op.f ? 'f' : '') + (op.d ? 'd' : '') + (op.s ? 's' : '')]);
  // Segundo traço: no máximo um por cena, no primeiro traço marcado com d, deslocado 1,2 px.
  const i = tracos.findIndex((t) => t[3].includes('d'));
  if (i >= 0) tracos.splice(i, 0, [tracos[i][0], 'a', 'a', 'x']);
  const bytes = JSON.stringify(tracos).length;
  if (bytes > 4096) throw new Error(`A cena ${id} passou de 4 KB (${bytes} bytes): simplifique`);
  cenas[id] = { titulo: cena.titulo, tracos };
}

const modulo = `// Gerado por coleta/ilustracoes.mjs: não edite à mão. Ilustrações temáticas das trilhas, em traço
// de mão, que herdam as cores do tema (tinta e cinza). Padrão no Vault: Linguagem visual - Portal Finanças.
import { svg } from './util.js';

export const CENAS = ${JSON.stringify(cenas)};

// Desenha a cena da trilha. \`tracar\`: o traço principal se desenha com a rolagem (só na abertura de
// artigo; ver financas.css). Decorativa nos cartões (aria-hidden); com \`rotulo\`, vira imagem com título.
export function ilustracao(id, { tracar = false, rotulo = false } = {}) {
  const cena = CENAS[id];
  if (!cena) return null;
  const PESO = { p: 'principal', c: 'contorno', a: 'apoio' };
  return svg('svg', { class: \`ilustracao\${tracar ? ' ilustracao--tracar' : ''}\`, viewBox: '0 0 320 150', 'aria-hidden': rotulo ? null : 'true', role: rotulo ? 'img' : null, 'aria-label': rotulo ? cena.titulo : null, focusable: 'false' },
    cena.tracos.map(([d, peso, cor, op]) => svg('path', {
      d, class: ['ilustracao__traco', \`ilustracao__traco--\${PESO[peso]}\`, cor === 'a' && 'ilustracao__traco--cinza', op.includes('f') && 'ilustracao__traco--fundo', op.includes('s') && 'ilustracao__traco--tracejado', op.includes('x') && 'ilustracao__traco--eco'].filter(Boolean).join(' '),
      pathLength: peso === 'p' ? '1' : null,
    })));
}
`;
await writeFile(join(RAIZ, 'Portal', 'assets', 'js', 'ilustracoes.js'), modulo);
log(`ilustrações: ${Object.keys(cenas).length} cenas, ${Object.values(cenas).map((c) => JSON.stringify(c.tracos).length).join(', ')} bytes`);

// Gráficos. Chart.js (cópia local) para linhas, barras e roscas; SVG próprio para o gráfico de
// preço com leitura por arraste e para as faíscas da lista de cotações. As cores vêm sempre dos
// tokens de papel, lidas no momento de desenhar, e os gráficos são refeitos quando o tema muda.
import { el, svg, token, dataBR, data as dataDe, mesAno } from './util.js';

const vivos = new Set(); // funções de redesenho, chamadas na troca de tema
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => vivos.forEach((f) => f()));

const fonte = () => getComputedStyle(document.body).fontFamily;
function base() {
  return {
    responsive: true, maintainAspectRatio: false,
    animation: false, // o Stocks não anima o desenho dos gráficos: eles aparecem inteiros (Aplicativo Stocks, 5)
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: token('--cor-texto'), titleColor: token('--cor-fundo'), bodyColor: token('--cor-fundo'),
        cornerRadius: 10, padding: 10, displayColors: false, titleFont: { family: fonte(), size: 12 }, bodyFont: { family: fonte(), size: 12 },
      },
    },
    scales: {
      x: { grid: { display: false }, border: { color: token('--cor-divisoria') }, ticks: { color: token('--cor-texto-2'), font: { family: fonte(), size: 12 }, maxRotation: 0, autoSkipPadding: 24 } },
      y: { grid: { color: token('--cor-divisoria') }, border: { display: false }, ticks: { color: token('--cor-texto-2'), font: { family: fonte(), size: 12 }, maxTicksLimit: 5 } },
    },
  };
}

// Cria o gráfico só quando o canvas aparece (para a entrada animada ser vista) e registra o
// redesenho para a troca de tema. `montar` devolve a configuração do Chart.js.
function quandoVisivel(canvas, montar) {
  let grafico = null;
  const desenhar = () => {
    if (!canvas.isConnected) { vivos.delete(desenhar); grafico?.destroy(); return; }
    grafico?.destroy();
    if (!window.Chart) return;
    grafico = new window.Chart(canvas, montar());
  };
  const obs = new IntersectionObserver((entradas) => {
    if (entradas.some((e) => e.isIntersecting)) { obs.disconnect(); desenhar(); vivos.add(desenhar); }
  }, { threshold: 0.2 });
  obs.observe(canvas);
  return { atualizar: () => { if (grafico || !obs.takeRecords) desenhar(); } };
}

export function moldura(rotulo, classe = '') {
  const canvas = el('canvas', { role: 'img', 'aria-label': rotulo });
  return { no: el('div', { class: `grafico ${classe}` }, canvas), canvas };
}

// Linhas. series: [{ nome, cor: '--cor-link', valores: [], tracejado, area }]; rotulos: eixo x.
export function graficoLinhas(canvas, { rotulos, series, formato = (v) => v, formatoEixo = formato }) {
  return quandoVisivel(canvas, () => {
    const o = base();
    o.plugins.tooltip.callbacks = { label: (c) => `${c.dataset.label}: ${formato(c.parsed.y)}` };
    o.scales.y.ticks.callback = (v) => formatoEixo(v);
    o.elements = { point: { radius: 0, hoverRadius: 4 }, line: { tension: 0.15, borderWidth: 2 } };
    return {
      type: 'line',
      data: { labels: rotulos, datasets: series.map((s) => ({ label: s.nome, data: s.valores, borderColor: token(s.cor), backgroundColor: s.area ? token(s.area) : 'transparent', fill: !!s.area, borderDash: s.tracejado ? [4, 4] : [], stepped: s.degraus || false, pointBackgroundColor: token(s.cor) })) },
      options: o,
    };
  });
}

export function graficoBarras(canvas, { rotulos, series, formato = (v) => v, formatoEixo = formato, empilhado = false, horizontal = false }) {
  return quandoVisivel(canvas, () => {
    const o = base();
    o.plugins.tooltip.callbacks = { label: (c) => `${c.dataset.label}: ${formato(horizontal ? c.parsed.x : c.parsed.y)}` };
    const eixoValor = horizontal ? o.scales.x : o.scales.y;
    eixoValor.ticks.callback = (v) => formatoEixo(v);
    if (horizontal) { o.indexAxis = 'y'; o.scales.x.grid = { color: token('--cor-divisoria') }; o.scales.y.grid = { display: false }; }
    o.scales.x.stacked = empilhado; o.scales.y.stacked = empilhado;
    return {
      type: 'bar',
      data: { labels: rotulos, datasets: series.map((s) => ({ label: s.nome, data: s.valores, backgroundColor: s.cores ? s.cores.map(token) : token(s.cor), borderRadius: 4, maxBarThickness: 48 })) },
      options: o,
    };
  });
}

export const CORES_SERIE = ['--cor-serie-1', '--cor-serie-2', '--cor-serie-3', '--cor-serie-4', '--cor-serie-5', '--cor-serie-6', '--cor-serie-7', '--cor-serie-8'];
export function graficoRosca(canvas, { rotulos, valores, formato = (v) => v }) {
  return quandoVisivel(canvas, () => {
    const o = base();
    delete o.scales;
    o.cutout = '68%';
    o.plugins.tooltip.callbacks = { label: (c) => `${c.label}: ${formato(c.parsed)}` };
    return { type: 'doughnut', data: { labels: rotulos, datasets: [{ data: valores, backgroundColor: rotulos.map((_, i) => token(CORES_SERIE[i % CORES_SERIE.length])), borderColor: token('--cor-fundo'), borderWidth: 2 }] }, options: o };
  });
}

// Curva de resultado (payoff): acima de zero em verde, abaixo em vermelho.
export function graficoResultado(canvas, { pontos, formato, formatoX, marcas = [] }) {
  return quandoVisivel(canvas, () => {
    const o = base();
    const alta = token('--cor-alta-traco'), baixa = token('--cor-baixa-traco');
    o.scales.x.type = 'linear';
    o.scales.x.ticks.callback = (v) => formatoX(v);
    o.scales.y.ticks.callback = (v) => formato(v);
    o.scales.y.grid = { color: (c) => (c.tick.value === 0 ? token('--cor-contorno') : token('--cor-divisoria')) };
    o.plugins.tooltip.callbacks = { title: (i) => `Ativo a ${formatoX(i[0].parsed.x)}`, label: (c) => `Resultado: ${formato(c.parsed.y)}` };
    o.elements = { point: { radius: 0, hoverRadius: 4 }, line: { tension: 0, borderWidth: 2 } };
    return {
      type: 'line',
      data: { datasets: [
        { label: 'Resultado', data: pontos.map((p) => ({ x: p.preco, y: p.resultado })), segment: { borderColor: (c) => ((c.p0.parsed.y + c.p1.parsed.y) / 2 >= 0 ? alta : baixa) }, borderColor: alta, fill: { target: 'origin', above: token('--cor-alta-area'), below: token('--cor-baixa-area') } },
        ...marcas.map((m) => ({ label: m.nome, data: [{ x: m.x, y: m.y ?? 0 }], pointRadius: 5, pointBackgroundColor: token('--cor-texto'), showLine: false })),
      ] },
      options: o,
    };
  });
}

// ---- Faísca: a linha miúda da lista de ativos (Stocks, seção 3) ----
// Traço fino na cor da variação, preenchimento em degradê da mesma cor e linha pontilhada na referência.
// valores: fechamentos em ordem; referencia: preço de comparação (fechamento anterior).
let contadorFaisca = 0;
export function faisca(valores, referencia = null) {
  const v = valores.filter((x) => Number.isFinite(x));
  const no = svg('svg', { class: 'faisca', viewBox: '0 0 100 32', preserveAspectRatio: 'none', 'aria-hidden': 'true' });
  if (v.length < 2) return no;
  const ref = referencia ?? v[0];
  const min = Math.min(...v, ref), max = Math.max(...v, ref), amp = max - min || 1;
  const x = (i) => (i / (v.length - 1)) * 100, y = (p) => 30 - ((p - min) / amp) * 28;
  const subiu = v[v.length - 1] >= ref, cor = `var(${subiu ? '--cor-alta-traco' : '--cor-baixa-traco'})`;
  const id = `fa${++contadorFaisca}`;
  const linha = v.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(2)} ${y(p).toFixed(2)}`).join('');
  no.append(
    svg('defs', {}, svg('linearGradient', { id, x1: 0, y1: 0, x2: 0, y2: 1 }, svg('stop', { offset: '0', 'stop-color': cor, 'stop-opacity': '0.35' }), svg('stop', { offset: '1', 'stop-color': cor, 'stop-opacity': '0' }))),
    svg('path', { class: 'faisca__area', d: `${linha}L100 32L0 32Z`, style: `fill:url(#${id});stroke:none` }),
    svg('line', { x1: 0, x2: 100, y1: y(ref), y2: y(ref) }),
    svg('path', { d: linha, stroke: cor }),
  );
  return no;
}

// ---- Gráfico de preço (Aplicativo Stocks, seções 6 e 11) ----
// pontos: [{ data: 'AAAA-MM-DD', valor, volume? }]. Linha de 1,5 px e área em degradê (35% no topo, 0 na base) na cor
// do período inteiro (verde se subiu, vermelho se caiu), eixo de preços à direita (4 rótulos), grades sutis, eixo de
// tempo embaixo e faixa de volume de 10 px quando há dado. Sem animação de desenho. Hover (ou foco e setas, ou toque):
// linha e área viram o azul de destaque, aparecem a linha vertical, o marcador, o preço em azul acima e, no lugar do
// seletor de período, a data (aoLer devolve o ponto; o cabeçalho, as grades, os eixos e o volume não mudam).
let contador = 0;
const MS_DIA = 864e5;
// Marcos do eixo de tempo: dias, semanas, meses ou anos, no máximo 6.
function marcosDeTempo(t0, t1) {
  const dias = (t1 - t0) / MS_DIA, lista = [];
  const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
  const por = (inicio, proximo, rotulo) => { for (let ms = inicio; ms <= t1; ms = proximo(ms)) if (ms > t0) lista.push({ ms, rotulo: rotulo(ms) }); };
  const d0 = new Date(t0);
  if (dias <= 10) por(Date.UTC(d0.getUTCFullYear(), d0.getUTCMonth(), d0.getUTCDate() + 1), (ms) => ms + MS_DIA, (ms) => dataBR(iso(ms)).slice(0, 5));
  else if (dias <= 75) por(Date.UTC(d0.getUTCFullYear(), d0.getUTCMonth(), d0.getUTCDate() + ((8 - d0.getUTCDay()) % 7 || 7)), (ms) => ms + 7 * MS_DIA, (ms) => dataBR(iso(ms)).slice(0, 5));
  else if (dias <= 800) por(Date.UTC(d0.getUTCFullYear(), d0.getUTCMonth() + 1, 1), (ms) => { const d = new Date(ms); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1); }, (ms) => mesAno(iso(ms)));
  else por(Date.UTC(d0.getUTCFullYear() + 1, 0, 1), (ms) => { const d = new Date(ms); return Date.UTC(d.getUTCFullYear() + 1, 0, 1); }, (ms) => String(new Date(ms).getUTCFullYear()));
  let m = lista.map((x) => ({ f: (x.ms - t0) / (t1 - t0), rotulo: x.rotulo })).filter((x) => x.f > 0.03 && x.f < 0.88);
  const limite = matchMedia('(max-width: 734px)').matches ? 3 : 6;
  while (m.length > limite) m = m.filter((_, i) => i % 2 === 0);
  return m;
}

export function graficoPreco({ pontos, referencia = null, formato = (v) => v, formatoEixo = null, rotuloData = dataBR, aoLer = null, neutro = false }) {
  const id = `gp${++contador}`;
  const eixoFormato = formatoEixo || formato;
  const no = el('div', { class: 'grafico-preco' });
  const ps = pontos.filter((p) => Number.isFinite(p.valor));
  if (ps.length < 2) { no.append(el('p', { class: 'vazio grafico-preco__vazio' }, 'Sem histórico suficiente para o período.')); return no; }

  const tempos = ps.map((p) => dataDe(p.data).getTime()), t0 = tempos[0], t1 = tempos[tempos.length - 1], duracao = t1 - t0 || 1;
  const valores = ps.map((p) => p.valor), ref = referencia;
  const min = Math.min(...valores, ref ?? Infinity), max = Math.max(...valores, ref ?? -Infinity), faixa = max - min || Math.abs(max) * 0.02 || 1;
  const lo = min - faixa * 0.08, hi = max + faixa * 0.08;
  const L = 1000, A = 400;
  const fx = (i) => (tempos[i] - t0) / duracao, x = (i) => fx(i) * L, y = (v) => A - ((v - lo) / (hi - lo)) * A;
  const subiu = valores[valores.length - 1] >= (ref ?? valores[0]);
  no.classList.add(neutro ? 'grafico-preco--neutro' : subiu ? 'grafico-preco--alta' : 'grafico-preco--baixa');
  const caminho = ps.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.valor).toFixed(1)}`).join('');
  const grad = svg('linearGradient', { id, x1: 0, y1: 0, x2: 0, y2: 1 },
    svg('stop', { offset: '0', 'stop-color': 'var(--gp-cor)', 'stop-opacity': '0.35' }), svg('stop', { offset: '1', 'stop-color': 'var(--gp-cor)', 'stop-opacity': '0' }));
  const desenho = svg('svg', { class: 'grafico-preco__svg', viewBox: `0 0 ${L} ${A}`, preserveAspectRatio: 'none', 'aria-hidden': 'true' },
    svg('defs', {}, grad),
    svg('path', { class: 'grafico-preco__area', d: `${caminho}L${x(ps.length - 1).toFixed(1)} ${A}L0 ${A}Z`, fill: `url(#${id})` }),
    ref != null ? svg('line', { class: 'grafico-preco__referencia', x1: 0, x2: L, y1: y(ref), y2: y(ref) }) : null,
    svg('path', { class: 'grafico-preco__linha', d: caminho }),
  );

  // Grades: 4 horizontais (com o preço à direita) e uma vertical por marco de tempo.
  const grades = [1, 2, 3, 4].map((k) => ({ topo: (1 - k / 5) * 100, valor: lo + (hi - lo) * (k / 5) }));
  const marcos = marcosDeTempo(t0, t1);
  const plot = el('div', { class: 'grafico-preco__plot', role: 'img', tabindex: '0' },
    grades.map((g) => el('i', { class: 'grafico-preco__grade', style: `top:${g.topo}%` })),
    marcos.map((m) => el('i', { class: 'grafico-preco__grade grafico-preco__grade--v', style: `left:${m.f * 100}%` })),
    desenho);
  const cursor = el('i', { class: 'grafico-preco__cursor' }), ponto = el('i', { class: 'grafico-preco__ponto' }), valorAzul = el('span', { class: 'grafico-preco__valor' });
  plot.append(cursor, ponto, valorAzul);
  const eixoY = el('div', { class: 'grafico-preco__y', 'aria-hidden': 'true' }, grades.map((g) => el('span', { style: `top:${g.topo}%` }, eixoFormato(g.valor))));
  const eixoX = el('div', { class: 'grafico-preco__x', 'aria-hidden': 'true' }, marcos.map((m) => el('span', { style: `left:${m.f * 100}%` }, m.rotulo)));
  const temVolume = ps.some((p) => p.volume > 0);
  let faixaVolume = null;
  if (temVolume) {
    const vmax = Math.max(...ps.map((p) => p.volume || 0));
    faixaVolume = el('div', { class: 'grafico-preco__volume', 'aria-hidden': 'true' }, svg('svg', { viewBox: `0 0 ${L} 10`, preserveAspectRatio: 'none' },
      svg('path', { d: ps.map((p, i) => (p.volume > 0 ? `M${x(i).toFixed(1)} 10V${(10 - (p.volume / vmax) * 10).toFixed(1)}` : '')).join('') })));
  }
  const falado = el('p', { class: 'oculto-leitura', 'aria-live': 'polite' });
  const rotuloGeral = `Gráfico de ${rotuloData(ps[0].data)} a ${rotuloData(ps[ps.length - 1].data)}: de ${eixoFormato(valores[0])} para ${eixoFormato(valores[valores.length - 1])}. Mínimo ${eixoFormato(Math.min(...valores))}, máximo ${eixoFormato(Math.max(...valores))}. Use as setas para ler cada ponto.`;
  plot.setAttribute('aria-label', rotuloGeral);

  // Alternativa em tabela para quem não usa o gráfico (no máximo 60 linhas, em intervalos regulares).
  const passoTabela = Math.max(1, Math.ceil(ps.length / 60));
  const linhas = ps.filter((_, i) => i % passoTabela === 0 || i === ps.length - 1);
  const tabela = el('details', { class: 'grafico-preco__tabela' }, el('summary', {}, 'Ver os valores do gráfico em tabela'),
    el('div', { class: 'tabela-rolavel' }, el('table', { class: 'tabela tabela--numeros' }, el('caption', { class: 'oculto-leitura' }, 'Valores do gráfico'),
      el('thead', {}, el('tr', {}, el('th', { scope: 'col' }, 'Data'), el('th', { scope: 'col' }, 'Valor'))),
      el('tbody', {}, linhas.map((p) => el('tr', {}, el('th', { scope: 'row' }, rotuloData(p.data)), el('td', {}, formato(p.valor))))))),
    passoTabela > 1 && el('p', { class: 'selo' }, `Mostra 1 a cada ${passoTabela} dias; o gráfico tem ${ps.length} pontos.`));

  no.append(el('div', { class: 'grafico-preco__corpo' }, plot, eixoY, eixoX, faixaVolume), falado, tabela);

  const normal = () => { delete no.dataset.lendo; aoLer?.(null); };
  const ler = (i, falar = false) => {
    const p = ps[i], f = fx(i);
    cursor.style.left = ponto.style.left = valorAzul.style.left = `${f * 100}%`;
    ponto.style.top = `${(y(p.valor) / A) * 100}%`;
    valorAzul.textContent = formato(p.valor);
    valorAzul.dataset.borda = f < 0.06 ? 'inicio' : f > 0.94 ? 'fim' : '';
    no.dataset.lendo = '';
    if (falar) falado.textContent = `${formato(p.valor)}, ${rotuloData(p.data)}`;
    aoLer?.(p);
  };
  // Ponto mais próximo do cursor (busca binária pela data).
  const indice = (e) => {
    const r = plot.getBoundingClientRect(), alvo = t0 + Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * duracao;
    let a = 0, b = tempos.length - 1;
    while (b - a > 1) { const m = (a + b) >> 1; if (tempos[m] < alvo) a = m; else b = m; }
    return Math.abs(tempos[a] - alvo) <= Math.abs(tempos[b] - alvo) ? a : b;
  };
  plot.addEventListener('pointermove', (e) => ler(indice(e)));
  plot.addEventListener('pointerdown', (e) => ler(indice(e)));
  plot.addEventListener('pointerleave', normal);
  plot.addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') normal(); });
  plot.addEventListener('pointercancel', normal);
  // Teclado: as setas percorrem os pontos (Home e End vão às pontas) e a leitura é falada; Esc volta ao normal.
  let foco = ps.length - 1;
  const salto = Math.max(1, Math.round(ps.length / 50));
  plot.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') foco = Math.max(0, foco - salto);
    else if (e.key === 'ArrowRight') foco = Math.min(ps.length - 1, foco + salto);
    else if (e.key === 'Home') foco = 0;
    else if (e.key === 'End') foco = ps.length - 1;
    else if (e.key === 'Escape') { normal(); return; }
    else return;
    e.preventDefault(); ler(foco, true);
  });
  plot.addEventListener('blur', normal);
  return no;
}

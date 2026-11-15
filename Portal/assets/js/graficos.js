// Gráficos. Chart.js (cópia local) para linhas, barras e roscas; SVG próprio para o gráfico de
// preço com leitura por arraste e para as faíscas da lista de cotações. As cores vêm sempre dos
// tokens de papel, lidas no momento de desenhar, e os gráficos são refeitos quando o tema muda.
import { el, svg, token, reduzido, dataBR } from './util.js';

const vivos = new Set(); // funções de redesenho, chamadas na troca de tema
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => vivos.forEach((f) => f()));

const fonte = () => getComputedStyle(document.body).fontFamily;
function base() {
  return {
    responsive: true, maintainAspectRatio: false,
    animation: reduzido() ? false : { duration: 900, easing: 'easeOutQuart' },
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

// ---- Faísca: a linha miúda da lista de cotações ----
// valores: fechamentos em ordem; referencia: preço de comparação (linha pontilhada).
export function faisca(valores, referencia = null) {
  const v = valores.filter((x) => Number.isFinite(x));
  const no = svg('svg', { class: 'faisca', viewBox: '0 0 100 32', preserveAspectRatio: 'none', 'aria-hidden': 'true' });
  if (v.length < 2) return no;
  const ref = referencia ?? v[0];
  const min = Math.min(...v, ref), max = Math.max(...v, ref), amp = max - min || 1;
  const x = (i) => (i / (v.length - 1)) * 100, y = (p) => 30 - ((p - min) / amp) * 28;
  const subiu = v[v.length - 1] >= ref;
  no.append(
    svg('line', { x1: 0, x2: 100, y1: y(ref), y2: y(ref) }),
    svg('path', { d: v.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(2)} ${y(p).toFixed(2)}`).join(''), stroke: `var(${subiu ? '--cor-alta-traco' : '--cor-baixa-traco'})` }),
  );
  return no;
}

// ---- Gráfico de preço (referência: app Stocks) ----
// pontos: [{ data: 'AAAA-MM-DD' ou ISO, valor }]. A cor segue o desempenho do período: verde se
// o último ponto está acima do primeiro (ou da referência), vermelho se abaixo. Arrastar o dedo
// ou o cursor mostra o valor e a data do ponto; ao soltar, volta ao resumo do período.
let contador = 0;
export function graficoPreco({ pontos, referencia = null, formato = (v) => v, rotuloData = dataBR, aoLer = null, neutro = false }) {
  const id = `gp${++contador}`;
  const leitura = el('div', { class: 'grafico-preco__leitura legenda', 'aria-live': 'off' });
  const palco = el('div', { class: 'grafico-preco__palco', role: 'img', tabindex: '0' });
  const eixo = el('div', { class: 'grafico-preco__eixo', 'aria-hidden': 'true' });
  const no = el('div', { class: 'grafico-preco' }, leitura, palco, eixo);
  const ps = pontos.filter((p) => Number.isFinite(p.valor));
  if (ps.length < 2) { palco.append(el('p', { class: 'vazio' }, 'Sem histórico suficiente para o período.')); return no; }

  const valores = ps.map((p) => p.valor), ref = referencia ?? valores[0];
  const min = Math.min(...valores, ref), max = Math.max(...valores, ref), amp = max - min || Math.abs(max) || 1;
  const L = 1000, A = 400, folga = 12;
  const x = (i) => (i / (ps.length - 1)) * L, y = (v) => A - folga - ((v - min) / amp) * (A - 2 * folga);
  const subiu = valores[valores.length - 1] >= ref;
  const cor = neutro ? '--cor-texto' : subiu ? '--cor-alta-traco' : '--cor-baixa-traco';
  const area = neutro ? '--cor-neutro-area' : subiu ? '--cor-alta-area' : '--cor-baixa-area';
  const caminho = ps.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.valor).toFixed(1)}`).join('');
  const grad = svg('linearGradient', { id, x1: 0, y1: 0, x2: 0, y2: 1 },
    svg('stop', { offset: '0', 'stop-color': `var(${area})` }), svg('stop', { offset: '1', 'stop-color': `var(${area})`, 'stop-opacity': '0' }));
  const desenho = svg('svg', { viewBox: `0 0 ${L} ${A}`, preserveAspectRatio: 'none', 'aria-hidden': 'true' },
    svg('defs', {}, grad),
    svg('path', { class: 'grafico-preco__area', d: `${caminho}L${L} ${A}L0 ${A}Z`, fill: `url(#${id})` }),
    svg('line', { class: 'grafico-preco__base', x1: 0, x2: L, y1: y(ref), y2: y(ref) }),
    svg('path', { class: 'grafico-preco__linha', d: caminho, stroke: `var(${cor})`, pathLength: 1 }),
  );
  const cursor = el('div', { class: 'grafico-preco__cursor' }), ponto = el('div', { class: 'grafico-preco__ponto' });
  palco.append(desenho, cursor, ponto);
  eixo.append(el('span', {}, rotuloData(ps[0].data)), el('span', {}, rotuloData(ps[ps.length - 1].data)));
  palco.setAttribute('aria-label', `Gráfico de ${rotuloData(ps[0].data)} a ${rotuloData(ps[ps.length - 1].data)}: de ${formato(valores[0])} para ${formato(valores[valores.length - 1])}. Mínimo ${formato(Math.min(...valores))}, máximo ${formato(Math.max(...valores))}.`);

  const resumo = () => { leitura.replaceChildren(el('span', {}, `Mín. ${formato(Math.min(...valores))}`), el('span', {}, `Máx. ${formato(Math.max(...valores))}`)); delete no.dataset.lendo; aoLer?.(null); };
  const ler = (i) => {
    const p = ps[i];
    cursor.style.left = ponto.style.left = `${(i / (ps.length - 1)) * 100}%`;
    ponto.style.top = `${(y(p.valor) / A) * 100}%`;
    leitura.replaceChildren(el('strong', {}, formato(p.valor)), el('span', {}, rotuloData(p.data)));
    no.dataset.lendo = ''; aoLer?.(p);
  };
  const indice = (e) => { const r = palco.getBoundingClientRect(); return Math.round(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * (ps.length - 1)); };
  palco.addEventListener('pointermove', (e) => ler(indice(e)));
  palco.addEventListener('pointerdown', (e) => ler(indice(e)));
  palco.addEventListener('pointerleave', resumo);
  palco.addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') resumo(); });
  // Teclado: setas percorrem os pontos; Esc volta ao resumo.
  let foco = ps.length - 1;
  palco.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') foco = Math.max(0, foco - Math.max(1, Math.round(ps.length / 50)));
    else if (e.key === 'ArrowRight') foco = Math.min(ps.length - 1, foco + Math.max(1, Math.round(ps.length / 50)));
    else if (e.key === 'Escape') return resumo();
    else return;
    e.preventDefault(); ler(foco);
  });
  palco.addEventListener('blur', resumo);
  resumo();
  return no;
}

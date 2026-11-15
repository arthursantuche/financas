// Estatística e séries de preços. Funções puras, sem dependências: rodam no navegador e no Node
// (coleta, agente e testes usam este mesmo arquivo). Metodologia: Vault, "Metodologia de cálculo".
// Convenções: séries em ordem cronológica; retornos em fração (0,01 = 1%); ano com 252 pregões.

export const PREGOES_ANO = 252;

export const soma = (v) => v.reduce((a, b) => a + b, 0);
export const media = (v) => (v.length ? soma(v) / v.length : NaN);

// Variância amostral (n − 1). Com menos de dois pontos não há dispersão a medir.
export function variancia(v) {
  if (v.length < 2) return NaN;
  const m = media(v);
  return soma(v.map((x) => (x - m) ** 2)) / (v.length - 1);
}
export const desvioPadrao = (v) => Math.sqrt(variancia(v));

export function covariancia(a, b) {
  const n = Math.min(a.length, b.length);
  if (n < 2) return NaN;
  const x = a.slice(-n), y = b.slice(-n);
  const mx = media(x), my = media(y);
  let s = 0;
  for (let i = 0; i < n; i++) s += (x[i] - mx) * (y[i] - my);
  return s / (n - 1);
}
export function correlacao(a, b) {
  const n = Math.min(a.length, b.length);
  const dp = desvioPadrao(a.slice(-n)) * desvioPadrao(b.slice(-n));
  return dp ? covariancia(a, b) / dp : NaN;
}

// Percentil por interpolação linear (p de 0 a 1).
export function percentil(v, p) {
  if (!v.length) return NaN;
  const o = [...v].sort((a, b) => a - b);
  const pos = (o.length - 1) * Math.min(1, Math.max(0, p));
  const i = Math.floor(pos), f = pos - i;
  return o[i + 1] !== undefined ? o[i] + f * (o[i + 1] - o[i]) : o[i];
}

// Retornos simples de uma série de preços: p[t] / p[t−1] − 1.
export function retornos(precos) {
  const r = [];
  for (let i = 1; i < precos.length; i++) if (precos[i - 1] > 0) r.push(precos[i] / precos[i - 1] - 1);
  return r;
}
export const retornosLog = (precos) => retornos(precos).map((r) => Math.log(1 + r));

// Retorno acumulado do primeiro ao último preço.
export const retornoTotal = (precos) => (precos.length > 1 && precos[0] > 0 ? precos[precos.length - 1] / precos[0] - 1 : NaN);

// Retorno anualizado (CAGR) a partir do número de pregões da série.
export function retornoAnualizado(precos, periodosAno = PREGOES_ANO) {
  const n = precos.length - 1;
  const t = retornoTotal(precos);
  return n > 0 && t > -1 ? (1 + t) ** (periodosAno / n) - 1 : NaN;
}

// Volatilidade anualizada: desvio-padrão dos retornos × raiz do número de períodos no ano.
export const volatilidade = (rets, periodosAno = PREGOES_ANO) => desvioPadrao(rets) * Math.sqrt(periodosAno);

// Série de drawdown: distância de cada ponto ao pico anterior (sempre ≤ 0).
export function serieDrawdown(precos) {
  let pico = -Infinity;
  return precos.map((p) => { pico = Math.max(pico, p); return pico > 0 ? p / pico - 1 : 0; });
}
export function drawdownMaximo(precos) {
  const dd = serieDrawdown(precos);
  let min = 0, fim = -1;
  dd.forEach((d, i) => { if (d < min) { min = d; fim = i; } });
  if (fim < 0) return { valor: 0, inicio: null, fim: null };
  let inicio = fim;
  while (inicio > 0 && dd[inicio] < 0) inicio--;
  return { valor: min, inicio, fim };
}

// Médias móveis. Devolvem uma série do mesmo tamanho; posições sem janela completa ficam null.
export function mediaMovel(v, janela) {
  const r = new Array(v.length).fill(null);
  let s = 0;
  for (let i = 0; i < v.length; i++) {
    s += v[i];
    if (i >= janela) s -= v[i - janela];
    if (i >= janela - 1) r[i] = s / janela;
  }
  return r;
}
export function mediaMovelExponencial(v, janela) {
  const r = new Array(v.length).fill(null);
  if (v.length < janela) return r;
  const k = 2 / (janela + 1);
  let m = media(v.slice(0, janela));
  r[janela - 1] = m;
  for (let i = janela; i < v.length; i++) { m = v[i] * k + m * (1 - k); r[i] = m; }
  return r;
}

// Índice de força relativa (RSI) de Wilder. Devolve o último valor (0 a 100).
export function ifr(precos, janela = 14) {
  if (precos.length <= janela) return NaN;
  let ganho = 0, perda = 0;
  for (let i = 1; i <= janela; i++) {
    const d = precos[i] - precos[i - 1];
    if (d >= 0) ganho += d; else perda -= d;
  }
  ganho /= janela; perda /= janela;
  for (let i = janela + 1; i < precos.length; i++) {
    const d = precos[i] - precos[i - 1];
    ganho = (ganho * (janela - 1) + Math.max(d, 0)) / janela;
    perda = (perda * (janela - 1) + Math.max(-d, 0)) / janela;
  }
  return perda === 0 ? 100 : 100 - 100 / (1 + ganho / perda);
}

// MACD (12, 26, 9): linha, sinal e histograma do último ponto.
export function macd(precos, curta = 12, longa = 26, sinal = 9) {
  const c = mediaMovelExponencial(precos, curta), l = mediaMovelExponencial(precos, longa);
  const linha = precos.map((_, i) => (c[i] != null && l[i] != null ? c[i] - l[i] : null)).filter((x) => x != null);
  const s = mediaMovelExponencial(linha, sinal);
  const ultima = linha[linha.length - 1], ultimoSinal = s[s.length - 1];
  return ultima == null || ultimoSinal == null ? null : { linha: ultima, sinal: ultimoSinal, histograma: ultima - ultimoSinal };
}

// Bandas de Bollinger do último ponto.
export function bollinger(precos, janela = 20, k = 2) {
  if (precos.length < janela) return null;
  const j = precos.slice(-janela), m = media(j), dp = desvioPadrao(j);
  return { media: m, superior: m + k * dp, inferior: m - k * dp, largura: m ? (2 * k * dp) / m : NaN };
}

// Regressão linear simples de y sobre x (mínimos quadrados).
export function regressao(x, y) {
  const n = Math.min(x.length, y.length);
  if (n < 2) return null;
  const vx = variancia(x.slice(-n));
  if (!vx) return null;
  const inclinacao = covariancia(x, y) / vx;
  const intercepto = media(y.slice(-n)) - inclinacao * media(x.slice(-n));
  const r = correlacao(x, y);
  return { inclinacao, intercepto, r2: r * r };
}

// Beta de um ativo em relação a um índice: cov(ativo, índice) / var(índice).
export function beta(retsAtivo, retsIndice) {
  const n = Math.min(retsAtivo.length, retsIndice.length);
  const v = variancia(retsIndice.slice(-n));
  return v ? covariancia(retsAtivo, retsIndice) / v : NaN;
}

// Índice de Sharpe anualizado. taxaLivre é anual (ex.: CDI de 0,1365).
export function sharpe(rets, taxaLivre = 0, periodosAno = PREGOES_ANO) {
  const vol = volatilidade(rets, periodosAno);
  const ret = (1 + media(rets)) ** periodosAno - 1;
  return vol ? (ret - taxaLivre) / vol : NaN;
}
// Sortino: só a volatilidade dos retornos abaixo da taxa livre diária conta como risco.
export function sortino(rets, taxaLivre = 0, periodosAno = PREGOES_ANO) {
  const alvo = (1 + taxaLivre) ** (1 / periodosAno) - 1;
  const quedas = rets.map((r) => Math.min(0, r - alvo));
  const semidesvio = Math.sqrt(soma(quedas.map((q) => q * q)) / rets.length) * Math.sqrt(periodosAno);
  const ret = (1 + media(rets)) ** periodosAno - 1;
  return semidesvio ? (ret - taxaLivre) / semidesvio : NaN;
}

// Valor em risco histórico: perda (número positivo) que não foi superada em `confianca` dos dias.
export const varHistorico = (rets, confianca = 0.95) => -percentil(rets, 1 - confianca);
// Perda média nos dias piores que o VaR (CVaR ou expected shortfall).
export function cvarHistorico(rets, confianca = 0.95) {
  const corte = percentil(rets, 1 - confianca);
  const cauda = rets.filter((r) => r <= corte);
  return cauda.length ? -media(cauda) : NaN;
}

// Matrizes de covariância e correlação de várias séries de retornos (mesmo comprimento).
export function matrizCovariancia(series) {
  return series.map((a) => series.map((b) => covariancia(a, b)));
}
export function matrizCorrelacao(series) {
  return series.map((a, i) => series.map((b, j) => (i === j ? 1 : correlacao(a, b))));
}

// Alinha séries {data: 'AAAA-MM-DD', valor} pelas datas comuns a todas. Devolve { datas, valores[][] }.
export function alinhar(listas) {
  if (!listas.length) return { datas: [], valores: [] };
  const mapas = listas.map((l) => new Map(l.map((p) => [p.data, p.valor])));
  const datas = [...mapas[0].keys()].filter((d) => mapas.every((m) => m.has(d))).sort();
  return { datas, valores: mapas.map((m) => datas.map((d) => m.get(d))) };
}

// Gerador pseudoaleatório com semente (mulberry32): a mesma semente repete a mesma simulação,
// o que torna os resultados auditáveis.
export function aleatorio(semente = 1) {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// Normal padrão por Box-Muller.
export function normalPadrao(rnd) {
  let u = 0;
  while (u === 0) u = rnd();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd());
}

// Simulação de Monte Carlo por reamostragem (bootstrap) dos retornos históricos: não supõe
// distribuição normal e preserva caudas observadas. Devolve percentis do retorno acumulado no
// horizonte e a probabilidade de perda. É um modelo: descreve cenários, não prevê o futuro.
export function simularCenarios(rets, { horizonte = PREGOES_ANO, simulacoes = 2000, semente = 42 } = {}) {
  if (rets.length < 20) return null;
  const rnd = aleatorio(semente);
  const finais = new Array(simulacoes);
  for (let s = 0; s < simulacoes; s++) {
    let acumulado = 1;
    for (let d = 0; d < horizonte; d++) acumulado *= 1 + rets[Math.floor(rnd() * rets.length)];
    finais[s] = acumulado - 1;
  }
  return {
    horizonte, simulacoes, semente,
    p5: percentil(finais, 0.05), p25: percentil(finais, 0.25), mediana: percentil(finais, 0.5),
    p75: percentil(finais, 0.75), p95: percentil(finais, 0.95),
    probabilidadePerda: finais.filter((f) => f < 0).length / simulacoes,
  };
}

// Resumo estatístico de uma série de preços, no formato que o agente e as telas consomem.
export function resumoSerie(precos, { taxaLivre = 0 } = {}) {
  const r = retornos(precos);
  const dd = drawdownMaximo(precos);
  const mm = (j) => { const m = mediaMovel(precos, j); return m[m.length - 1]; };
  const ultimo = precos[precos.length - 1];
  const mm50 = mm(50), mm200 = mm(200);
  return {
    pontos: precos.length,
    ultimo,
    retornoTotal: retornoTotal(precos),
    retornoAnualizado: retornoAnualizado(precos),
    volatilidade: volatilidade(r),
    drawdownMaximo: dd.valor,
    sharpe: sharpe(r, taxaLivre),
    sortino: sortino(r, taxaLivre),
    var95: varHistorico(r, 0.95),
    cvar95: cvarHistorico(r, 0.95),
    ifr14: ifr(precos, 14),
    mm50, mm200,
    // Tendência por médias móveis: descreve o passado recente, não é sinal de compra ou venda.
    tendencia: mm50 == null || mm200 == null ? 'indefinida' : ultimo > mm50 && mm50 > mm200 ? 'alta' : ultimo < mm50 && mm50 < mm200 ? 'baixa' : 'lateral',
  };
}

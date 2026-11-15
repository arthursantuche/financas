// Opções: precificação de Black-Scholes-Merton, gregas, volatilidade implícita e payoff de
// estruturas. Funções puras (navegador e Node). O modelo supõe volatilidade e juros constantes e
// exercício europeu; as opções de ações da B3 são, em geral, americanas (calls) e europeias (puts),
// e o modelo é uma aproximação. Probabilidades aqui são do modelo, não garantias.

// Distribuição normal padrão: densidade e acumulada (aproximação de Abramowitz-Stegun 26.2.17,
// erro máximo de 7,5e-8).
export const densidadeNormal = (x) => Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
export function acumuladaNormal(x) {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const poli = t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  const cauda = densidadeNormal(x) * poli;
  return x >= 0 ? 1 - cauda : cauda;
}

// S: preço do ativo; K: strike; T: prazo em anos; r: juro anual contínuo; sigma: volatilidade
// anual; q: dividendos anuais contínuos; tipo: 'call' ou 'put'.
function d1d2({ S, K, T, r, sigma, q = 0 }) {
  const d1 = (Math.log(S / K) + (r - q + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
  return { d1, d2: d1 - sigma * Math.sqrt(T) };
}

export function precoBS({ tipo, S, K, T, r, sigma, q = 0 }) {
  if (T <= 0 || sigma <= 0) return Math.max(0, tipo === 'call' ? S - K : K - S);
  const { d1, d2 } = d1d2({ S, K, T, r, sigma, q });
  const dS = S * Math.exp(-q * T), dK = K * Math.exp(-r * T);
  return tipo === 'call' ? dS * acumuladaNormal(d1) - dK * acumuladaNormal(d2) : dK * acumuladaNormal(-d2) - dS * acumuladaNormal(-d1);
}

// Gregas. theta por dia corrido; vega e rho por 1 ponto percentual.
export function gregas({ tipo, S, K, T, r, sigma, q = 0 }) {
  if (T <= 0 || sigma <= 0) return { delta: tipo === 'call' ? (S > K ? 1 : 0) : (S < K ? -1 : 0), gama: 0, theta: 0, vega: 0, rho: 0, probabilidadeExercicio: (tipo === 'call' ? S > K : S < K) ? 1 : 0 };
  const { d1, d2 } = d1d2({ S, K, T, r, sigma, q });
  const eq = Math.exp(-q * T), er = Math.exp(-r * T), raiz = Math.sqrt(T), n1 = densidadeNormal(d1);
  const call = tipo === 'call';
  const delta = call ? eq * acumuladaNormal(d1) : -eq * acumuladaNormal(-d1);
  const gama = (eq * n1) / (S * sigma * raiz);
  const vega = (S * eq * n1 * raiz) / 100;
  const thetaAno = call
    ? (-S * eq * n1 * sigma) / (2 * raiz) - r * K * er * acumuladaNormal(d2) + q * S * eq * acumuladaNormal(d1)
    : (-S * eq * n1 * sigma) / (2 * raiz) + r * K * er * acumuladaNormal(-d2) - q * S * eq * acumuladaNormal(-d1);
  const rho = (call ? K * T * er * acumuladaNormal(d2) : -K * T * er * acumuladaNormal(-d2)) / 100;
  // N(d2): probabilidade, no mundo neutro ao risco do modelo, de a opção terminar no dinheiro.
  return { delta, gama, theta: thetaAno / 365, vega, rho, probabilidadeExercicio: call ? acumuladaNormal(d2) : acumuladaNormal(-d2) };
}

// Volatilidade implícita por bisseção (robusta mesmo longe do dinheiro). null se o preço estiver
// fora dos limites de arbitragem do modelo.
export function volatilidadeImplicita({ tipo, preco, S, K, T, r, q = 0 }) {
  if (T <= 0 || preco <= 0) return null;
  const intrinseco = Math.max(0, tipo === 'call' ? S * Math.exp(-q * T) - K * Math.exp(-r * T) : K * Math.exp(-r * T) - S * Math.exp(-q * T));
  if (preco < intrinseco - 1e-9) return null;
  let min = 1e-4, max = 5;
  if (precoBS({ tipo, S, K, T, r, sigma: max, q }) < preco) return null;
  for (let i = 0; i < 100; i++) {
    const meio = (min + max) / 2;
    if (precoBS({ tipo, S, K, T, r, sigma: meio, q }) > preco) max = meio; else min = meio;
    if (max - min < 1e-6) break;
  }
  return (min + max) / 2;
}

// Uma estrutura é uma lista de pernas:
//  { tipo: 'call' | 'put' | 'ativo', lado: 'compra' | 'venda', strike, premio, quantidade }
// Para 'ativo', premio é o preço de entrada da ação. Resultado no vencimento, por unidade × quantidade.
export function payoffNoVencimento(pernas, precoFinal) {
  return pernas.reduce((total, p) => {
    const sinal = p.lado === 'compra' ? 1 : -1;
    const q = p.quantidade ?? 1;
    let valor;
    if (p.tipo === 'ativo') valor = precoFinal - p.premio;
    else valor = Math.max(0, p.tipo === 'call' ? precoFinal - p.strike : p.strike - precoFinal) - p.premio;
    return total + sinal * valor * q;
  }, 0);
}

// Curva de payoff, pontos de equilíbrio, ganho e perda máximos de uma estrutura.
// Além da faixa analisada, a inclinação das pontas diz se ganho ou perda são ilimitados.
export function analisarEstrutura(pernas, { precoAtual, faixa = 0.5, pontos = 201 } = {}) {
  const strikes = pernas.filter((p) => p.tipo !== 'ativo').map((p) => p.strike);
  const ref = precoAtual ?? (strikes.length ? strikes.reduce((a, b) => a + b, 0) / strikes.length : 1);
  const min = Math.max(0, Math.min(ref, ...strikes) * (1 - faixa));
  const max = Math.max(ref, ...strikes) * (1 + faixa);
  const curva = [];
  for (let i = 0; i < pontos; i++) {
    const preco = min + ((max - min) * i) / (pontos - 1);
    curva.push({ preco, resultado: payoffNoVencimento(pernas, preco) });
  }
  // Pontos de equilíbrio: cruzamentos com zero, por interpolação entre pontos vizinhos.
  const equilibrio = [];
  for (let i = 1; i < curva.length; i++) {
    const a = curva[i - 1], b = curva[i];
    if (a.resultado === 0) equilibrio.push(a.preco);
    else if (a.resultado * b.resultado < 0) equilibrio.push(a.preco + ((0 - a.resultado) * (b.preco - a.preco)) / (b.resultado - a.resultado));
  }
  // Inclinação além do maior strike (por real de alta) e no zero (preço não fica negativo).
  const inclinacaoAlta = pernas.reduce((s, p) => s + (p.lado === 'compra' ? 1 : -1) * (p.quantidade ?? 1) * (p.tipo === 'put' ? 0 : 1), 0);
  const noZero = payoffNoVencimento(pernas, 0);
  const resultados = curva.map((c) => c.resultado).concat(noZero);
  const ganhoIlimitado = inclinacaoAlta > 1e-9, perdaIlimitada = inclinacaoAlta < -1e-9;
  const custo = pernas.reduce((s, p) => s + (p.lado === 'compra' ? 1 : -1) * p.premio * (p.quantidade ?? 1), 0);
  return {
    curva,
    equilibrio: [...new Set(equilibrio.map((e) => Math.round(e * 100) / 100))],
    ganhoMaximo: ganhoIlimitado ? Infinity : Math.max(...resultados),
    perdaMaxima: perdaIlimitada ? -Infinity : Math.min(...resultados),
    // Desembolso inicial: positivo é débito (paga para montar), negativo é crédito (recebe).
    custo,
  };
}

// Estruturas comuns, montadas a partir de preços informados. quantidade em número de ações.
export const ESTRUTURAS = {
  compraCall: ({ strike, premio, quantidade = 100 }) => [{ tipo: 'call', lado: 'compra', strike, premio, quantidade }],
  compraPut: ({ strike, premio, quantidade = 100 }) => [{ tipo: 'put', lado: 'compra', strike, premio, quantidade }],
  vendaCoberta: ({ precoAtivo, strike, premio, quantidade = 100 }) => [
    { tipo: 'ativo', lado: 'compra', premio: precoAtivo, quantidade },
    { tipo: 'call', lado: 'venda', strike, premio, quantidade },
  ],
  putProtetora: ({ precoAtivo, strike, premio, quantidade = 100 }) => [
    { tipo: 'ativo', lado: 'compra', premio: precoAtivo, quantidade },
    { tipo: 'put', lado: 'compra', strike, premio, quantidade },
  ],
  travaAltaCall: ({ strikeCompra, premioCompra, strikeVenda, premioVenda, quantidade = 100 }) => [
    { tipo: 'call', lado: 'compra', strike: strikeCompra, premio: premioCompra, quantidade },
    { tipo: 'call', lado: 'venda', strike: strikeVenda, premio: premioVenda, quantidade },
  ],
  travaBaixaPut: ({ strikeCompra, premioCompra, strikeVenda, premioVenda, quantidade = 100 }) => [
    { tipo: 'put', lado: 'compra', strike: strikeCompra, premio: premioCompra, quantidade },
    { tipo: 'put', lado: 'venda', strike: strikeVenda, premio: premioVenda, quantidade },
  ],
  colar: ({ precoAtivo, strikePut, premioPut, strikeCall, premioCall, quantidade = 100 }) => [
    { tipo: 'ativo', lado: 'compra', premio: precoAtivo, quantidade },
    { tipo: 'put', lado: 'compra', strike: strikePut, premio: premioPut, quantidade },
    { tipo: 'call', lado: 'venda', strike: strikeCall, premio: premioCall, quantidade },
  ],
  straddle: ({ strike, premioCall, premioPut, quantidade = 100 }) => [
    { tipo: 'call', lado: 'compra', strike, premio: premioCall, quantidade },
    { tipo: 'put', lado: 'compra', strike, premio: premioPut, quantidade },
  ],
};

// Probabilidade, pelo modelo lognormal, de o ativo terminar acima de um preço no vencimento.
export function probabilidadeAcima({ S, alvo, T, r, sigma, q = 0 }) {
  if (T <= 0 || sigma <= 0) return S > alvo ? 1 : 0;
  return acumuladaNormal(d1d2({ S, K: alvo, T, r, sigma, q }).d2);
}

// Código de negociação de opção na B3: 4 letras do ativo + letra do mês (A–L call, M–X put) + número.
const MESES_CALL = 'ABCDEFGHIJKL', MESES_PUT = 'MNOPQRSTUVWX';
export function decodificarTicker(codigo) {
  const m = /^([A-Z]{4})([A-X])(\d{1,4})(W\d)?$/.exec(String(codigo).trim().toUpperCase());
  if (!m) return null;
  const call = MESES_CALL.indexOf(m[2]);
  return { ativoBase: m[1], tipo: call >= 0 ? 'call' : 'put', mes: (call >= 0 ? call : MESES_PUT.indexOf(m[2])) + 1, serie: m[3], semanal: m[4] || null };
}

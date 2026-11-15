// Carteira: posições a partir dos lançamentos, avaliação, alocação, risco, série histórica pelo
// método de cotas, otimização e dimensionamento de compras. Funções puras (navegador e Node).
// Modelo de dados: Vault, "Modelo de dados". Um lançamento:
//  { id, data: 'AAAA-MM-DD', tipo, ativo, quantidade, preco, custos, ... }
// tipos: compra, venda, provento, desdobramento (quantidade = fator), bonificacao.
import { retornos, volatilidade, matrizCovariancia, matrizCorrelacao, media, PREGOES_ANO } from './estatistica.js';

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const ordenar = (lancs) => [...lancs].sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : String(a.criadoEm || '').localeCompare(String(b.criadoEm || ''))));

// Posição de cada ativo pelo custo médio ponderado (o método usado no Brasil para apurar ganho):
// a compra soma quantidade e custo (com corretagem e taxas); a venda baixa o custo pelo preço médio
// e realiza lucro ou prejuízo; proventos não mudam o preço médio.
export function posicoes(lancamentos, ate = null) {
  const mapa = new Map();
  for (const l of ordenar(lancamentos)) {
    if (ate && l.data > ate) continue;
    let p = mapa.get(l.ativo);
    if (!p) { p = { ativo: l.ativo, quantidade: 0, custo: 0, realizado: 0, proventos: 0, primeiraCompra: null, vendido: 0 }; mapa.set(l.ativo, p); }
    const q = num(l.quantidade), preco = num(l.preco), custos = num(l.custos);
    if (l.tipo === 'compra' || l.tipo === 'venda') {
      // Quantidade com sinal: positiva é posição comprada; negativa é vendida (opção lançada).
      // Uma operação no sentido da posição aumenta; no sentido contrário, fecha pelo preço médio
      // e realiza resultado; o que passar do zero abre posição do outro lado.
      const sinal = l.tipo === 'compra' ? 1 : -1;
      let resta = q;
      p.realizado -= custos;
      if (p.quantidade !== 0 && Math.sign(p.quantidade) !== sinal) {
        const fecha = Math.min(resta, Math.abs(p.quantidade)), pm = p.custo / p.quantidade;
        p.realizado += fecha * (preco - pm) * Math.sign(p.quantidade);
        p.custo -= pm * fecha * Math.sign(p.quantidade);
        p.quantidade -= fecha * Math.sign(p.quantidade);
        resta -= fecha;
        if (Math.abs(p.quantidade) < 1e-9) { p.quantidade = 0; p.custo = 0; }
      }
      if (resta > 0) {
        p.quantidade += sinal * resta; p.custo += sinal * resta * preco;
        if (sinal > 0) { p.custo += custos; p.realizado += custos; } // na compra, os custos entram no preço médio
        p.primeiraCompra = p.primeiraCompra || l.data;
      }
      if (sinal < 0) p.vendido += q * preco;
    } else if (l.tipo === 'provento') {
      p.proventos += num(l.valor ?? q * preco);
    } else if (l.tipo === 'desdobramento') {
      if (q > 0) p.quantidade *= q; // fator: 2 dobra a quantidade; 0,1 agrupa 10 em 1
    } else if (l.tipo === 'bonificacao') {
      p.quantidade += q; p.custo += q * preco;
    }
  }
  return [...mapa.values()].map((p) => ({ ...p, precoMedio: p.quantidade !== 0 ? p.custo / p.quantidade : 0 }));
}

// Junta posições com preços. precos: { ATIVO: { preco, anterior, data, fonte } }.
// Sem preço disponível, o ativo vale o custo e fica marcado (semPreco) para a tela avisar.
export function avaliar(posicoesAtuais, precos = {}) {
  const abertas = posicoesAtuais.filter((p) => p.quantidade !== 0);
  const linhas = abertas.map((p) => {
    const c = precos[p.ativo];
    const preco = c && Number.isFinite(c.preco) ? c.preco : null;
    const valor = preco == null ? p.custo : p.quantidade * preco;
    const anterior = c && Number.isFinite(c.anterior) ? c.anterior : null;
    return {
      ...p, preco, semPreco: preco == null, valor,
      lucro: valor - p.custo,
      rentabilidade: p.custo !== 0 ? (valor - p.custo) / Math.abs(p.custo) : 0,
      variacaoDia: preco != null && anterior ? preco / anterior - 1 : null,
      variacaoDiaValor: preco != null && anterior ? p.quantidade * (preco - anterior) : 0,
      dataPreco: c?.data || null, fonte: c?.fonte || null,
    };
  });
  const total = linhas.reduce((s, l) => s + l.valor, 0);
  const custo = linhas.reduce((s, l) => s + l.custo, 0);
  const diaValor = linhas.reduce((s, l) => s + l.variacaoDiaValor, 0);
  const todas = posicoesAtuais;
  return {
    linhas: linhas.map((l) => ({ ...l, participacao: total > 0 ? l.valor / total : 0 })).sort((a, b) => b.valor - a.valor),
    total, custo,
    lucro: total - custo,
    rentabilidade: custo > 0 ? total / custo - 1 : 0,
    variacaoDiaValor: diaValor,
    variacaoDia: total - diaValor > 0 ? diaValor / (total - diaValor) : 0,
    realizado: todas.reduce((s, p) => s + p.realizado, 0),
    proventos: todas.reduce((s, p) => s + p.proventos, 0),
  };
}

// Soma das participações por um atributo (classe, setor, instituição). info: { ATIVO: { classe, setor } }.
export function alocacao(linhas, info, por = 'classe') {
  const total = linhas.reduce((s, l) => s + l.valor, 0);
  const grupos = new Map();
  for (const l of linhas) {
    const chave = info[l.ativo]?.[por] || 'Não classificado';
    grupos.set(chave, (grupos.get(chave) || 0) + l.valor);
  }
  return [...grupos].map(([nome, valor]) => ({ nome, valor, participacao: total ? valor / total : 0 })).sort((a, b) => b.valor - a.valor);
}

// Concentração: índice de Herfindahl-Hirschman (soma dos quadrados das participações) e o número
// efetivo de posições (1 / HHI): 10 ativos iguais dão 10; um ativo com 70% dá menos de 2.
export function concentracao(participacoes) {
  const hhi = participacoes.reduce((s, w) => s + w * w, 0);
  const ord = [...participacoes].sort((a, b) => b - a);
  return { hhi, efetivo: hhi > 0 ? 1 / hhi : 0, maior: ord[0] || 0, tresMaiores: ord.slice(0, 3).reduce((a, b) => a + b, 0) };
}

export const diasCorridos = (de, ate) => Math.round((Date.parse(ate + 'T00:00:00Z') - Date.parse(de + 'T00:00:00Z')) / 864e5);

// Série histórica da carteira pelo método de cotas (o mesmo dos fundos): aportes e resgates compram
// e vendem cotas, então a cota mede só o desempenho, sem o efeito do dinheiro novo.
// historicos: { ATIVO: [{ data, valor }] } com fechamentos; ativos sem histórico entram pelo custo.
export function serieCotas(lancamentos, historicos) {
  const lancs = ordenar(lancamentos).filter((l) => ['compra', 'venda', 'desdobramento', 'bonificacao'].includes(l.tipo));
  if (!lancs.length) return [];
  const datas = new Set();
  for (const h of Object.values(historicos)) for (const p of h) if (p.data >= lancs[0].data) datas.add(p.data);
  for (const l of lancs) datas.add(l.data);
  const mapas = Object.fromEntries(Object.entries(historicos).map(([k, h]) => [k, new Map(h.map((p) => [p.data, p.valor]))]));
  const qtd = new Map(), ultimoPreco = new Map();
  let cotas = 0, cota = 1, i = 0;
  const serie = [];
  for (const data of [...datas].sort()) {
    let fluxo = 0;
    while (i < lancs.length && lancs[i].data <= data) {
      const l = lancs[i++], q = num(l.quantidade), atual = qtd.get(l.ativo) || 0;
      if (l.tipo === 'compra') { qtd.set(l.ativo, atual + q); fluxo += q * num(l.preco); if (!ultimoPreco.has(l.ativo)) ultimoPreco.set(l.ativo, num(l.preco)); }
      else if (l.tipo === 'venda') { qtd.set(l.ativo, Math.max(0, atual - q)); fluxo -= q * num(l.preco); }
      else if (l.tipo === 'desdobramento') qtd.set(l.ativo, atual * q);
      else if (l.tipo === 'bonificacao') qtd.set(l.ativo, atual + q);
      if (l.tipo === 'compra' || l.tipo === 'venda') { if (!mapas[l.ativo]?.has(data)) ultimoPreco.set(l.ativo, num(l.preco)); }
    }
    let valor = 0;
    for (const [ativo, q] of qtd) {
      const p = mapas[ativo]?.get(data);
      if (p != null) ultimoPreco.set(ativo, p);
      valor += q * (ultimoPreco.get(ativo) || 0);
    }
    // O fluxo do dia entra pela cota do fechamento: cota = (valor − fluxo) / cotas anteriores.
    if (cotas > 0) cota = (valor - fluxo) / cotas > 0 ? (valor - fluxo) / cotas : cota;
    cotas += cota > 0 ? fluxo / cota : 0;
    if (cotas < 1e-9) cotas = 0;
    serie.push({ data, valor, cota, fluxo });
  }
  return serie;
}

// Risco da carteira a partir dos pesos e da matriz de covariância (retornos diários).
export function riscoCarteira(pesos, cov, periodosAno = PREGOES_ANO) {
  const n = pesos.length;
  const marginal = new Array(n).fill(0);
  let variancia = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) marginal[i] += cov[i][j] * pesos[j];
    variancia += pesos[i] * marginal[i];
  }
  const vol = Math.sqrt(Math.max(0, variancia) * periodosAno);
  return {
    volatilidade: vol,
    // Parcela do risco total que cada ativo carrega (soma 1). Diferente da parcela do dinheiro.
    contribuicao: marginal.map((m, i) => (variancia > 0 ? (pesos[i] * m) / variancia : 0)),
  };
}

// Benefício de diversificação: 1 − vol da carteira / média ponderada das vols individuais.
export function diversificacao(pesos, cov, periodosAno = PREGOES_ANO) {
  const vols = cov.map((linha, i) => Math.sqrt(Math.max(0, linha[i]) * periodosAno));
  const ponderada = pesos.reduce((s, w, i) => s + w * vols[i], 0);
  const { volatilidade: vol } = riscoCarteira(pesos, cov, periodosAno);
  return { volatilidadeCarteira: vol, volatilidadePonderada: ponderada, beneficio: ponderada > 0 ? 1 - vol / ponderada : 0 };
}

// Projeção de um vetor no simplex com teto por ativo (soma 1, 0 ≤ w ≤ teto), por bisseção.
function projetarSimplex(v, teto) {
  const n = v.length, max = Math.max(teto, 1 / n + 1e-12);
  let lo = Math.min(...v) - max, hi = Math.max(...v);
  for (let k = 0; k < 80; k++) {
    const t = (lo + hi) / 2;
    const s = v.reduce((a, x) => a + Math.min(max, Math.max(0, x - t)), 0);
    if (s > 1) lo = t; else hi = t;
  }
  const t = (lo + hi) / 2;
  return v.map((x) => Math.min(max, Math.max(0, x - t)));
}

// Otimização média-variância (Markowitz), só comprado e com teto por ativo, por gradiente projetado.
// objetivo 'sharpe' maximiza (retorno − taxa livre) / risco; 'minimaVariancia' minimiza o risco.
// Determinística: mesmas entradas, mesmos pesos. Retornos esperados vêm da média histórica, que é
// um estimador ruidoso: use o resultado como referência de diversificação, não como previsão.
export function otimizar({ retornosEsperados, cov, taxaLivre = 0, tetoPorAtivo = 1, objetivo = 'sharpe', iteracoes = 4000 }) {
  const n = retornosEsperados.length;
  if (!n) return null;
  const mu = retornosEsperados.map((r) => r - taxaLivre);
  const S = cov.map((l) => l.map((x) => x * PREGOES_ANO));
  const escala = Math.max(...S.map((l, i) => l[i]), 1e-12);
  let w = projetarSimplex(new Array(n).fill(1 / n), tetoPorAtivo);
  const valor = (p) => {
    let ret = 0, v = 0;
    for (let i = 0; i < n; i++) { ret += p[i] * mu[i]; for (let j = 0; j < n; j++) v += p[i] * S[i][j] * p[j]; }
    return objetivo === 'sharpe' ? ret / Math.sqrt(Math.max(v, 1e-18)) : -v;
  };
  let melhor = valor(w), passo = 0.5 / escala;
  for (let it = 0; it < iteracoes; it++) {
    const Sw = S.map((l) => l.reduce((s, x, j) => s + x * w[j], 0));
    const v = Math.max(w.reduce((s, x, i) => s + x * Sw[i], 0), 1e-18);
    const ret = w.reduce((s, x, i) => s + x * mu[i], 0);
    const grad = objetivo === 'sharpe' ? mu.map((m, i) => m / Math.sqrt(v) - (ret * Sw[i]) / v ** 1.5) : Sw.map((x) => -2 * x);
    const norma = Math.sqrt(grad.reduce((s, g) => s + g * g, 0)) || 1;
    const cand = projetarSimplex(w.map((x, i) => x + (passo * grad[i]) / norma * Math.sqrt(escala)), tetoPorAtivo);
    const vc = valor(cand);
    if (vc > melhor + 1e-12) { w = cand; melhor = vc; } else { passo *= 0.7; if (passo < 1e-9 / escala) break; }
  }
  const risco = riscoCarteira(w, cov);
  const retorno = w.reduce((s, x, i) => s + x * retornosEsperados[i], 0);
  return { pesos: w, retorno, volatilidade: risco.volatilidade, sharpe: risco.volatilidade ? (retorno - taxaLivre) / risco.volatilidade : 0 };
}

// Estatísticas conjuntas de vários ativos a partir de históricos alinhados por data.
export function estatisticasConjuntas(valores) {
  const rets = valores.map(retornos);
  return {
    retornosDiarios: rets,
    retornosAnuais: rets.map((r) => (1 + media(r)) ** PREGOES_ANO - 1),
    volatilidades: rets.map((r) => volatilidade(r)),
    cov: matrizCovariancia(rets),
    correlacao: matrizCorrelacao(rets),
  };
}

// Transforma pesos-alvo em ordens de compra dentro de um orçamento. Ações à vista negociam em
// lotes de 100, mas o mercado fracionário aceita qualquer quantidade inteira: lote = 1 por padrão.
// Devolve as ordens e a sobra (o que não cabe em quantidades inteiras).
export function dimensionar({ alvos, precos, orcamento, lote = 1 }) {
  const somaPesos = alvos.reduce((s, a) => s + a.peso, 0) || 1;
  let restante = orcamento;
  const ordens = alvos.map((a) => {
    const preco = precos[a.ativo];
    const ideal = (orcamento * a.peso) / somaPesos;
    const quantidade = preco > 0 ? Math.floor(ideal / preco / lote) * lote : 0;
    restante -= quantidade * preco;
    return { ativo: a.ativo, preco, quantidade, valor: quantidade * preco, pesoAlvo: a.peso / somaPesos };
  });
  // Segunda passada: usa a sobra no ativo mais distante do alvo que ainda cabe.
  for (let guarda = 0; guarda < 1000; guarda++) {
    const cabem = ordens.filter((o) => o.preco > 0 && o.preco * lote <= restante + 1e-9);
    if (!cabem.length) break;
    cabem.sort((a, b) => (b.pesoAlvo * orcamento - b.valor) - (a.pesoAlvo * orcamento - a.valor));
    const o = cabem[0];
    if (o.pesoAlvo * orcamento - o.valor <= 0) break;
    o.quantidade += lote; o.valor += o.preco * lote; restante -= o.preco * lote;
  }
  return { ordens: ordens.filter((o) => o.quantidade > 0), sobra: Math.max(0, restante), usado: orcamento - Math.max(0, restante) };
}

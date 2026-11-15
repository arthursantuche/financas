// Dossiê fundamentalista de uma companhia: junta os demonstrativos da CVM (dados abertos), o preço
// (área privada), os pares do setor e a síntese por regras. É a base da página de Análise e dos
// relatórios do agente: os dois usam exatamente os mesmos números e critérios.
import { acharEmpresa, empresa as lerEmpresa, setores as lerSetores, indicadores as lerIndicadores } from '../dados.js';
import { historico, sintetizar, leituraPatrimonial, medianasSetor, multiplos } from '../calculo/fundamentos.js';
import { precosFechamento, precoBolsa } from './mercado.js';

export const CHAVES_SETOR = ['margemEbitda', 'margemEbit', 'margemLiquida', 'margemBruta', 'roe', 'roic', 'dividaLiquidaEbitda', 'liquidezCorrente', 'pl', 'pvp', 'evEbitda', 'crescimentoReceita'];

// Indicadores de um par (linha de setores.json) com múltiplos, se houver preço.
function par(linha, precos) {
  const preco = precos[linha.ticker];
  const base = { ...linha, lucroControladores: linha.lucro };
  return preco ? { ...base, ...multiplos(base, preco) } : base;
}

export async function dossieEmpresa(codigo, { precoInformado = null } = {}) {
  const ref = await acharEmpresa(codigo);
  if (!ref) return null;
  const ticker = ref.tickers.includes(String(codigo).toUpperCase()) ? String(codigo).toUpperCase() : ref.tickers[0];
  const [emp, set, ind, fech, cot] = await Promise.all([lerEmpresa(ref.cvm), lerSetores(), lerIndicadores().catch(() => null), precosFechamento().catch(() => ({ precos: {} })), precoBolsa(ticker).catch(() => null)]);
  const preco = precoInformado ?? cot?.preco ?? fech.precos[ticker] ?? null;
  const h = historico(emp, { preco });
  const doSetor = (set.setores[emp.setor] || []).filter((x) => x.plano === emp.plano || emp.plano !== 'comercial');
  const pares = doSetor.map((x) => par(x, fech.precos));
  const medianas = medianasSetor(pares.filter((x) => x.cvm !== emp.cvm), CHAVES_SETOR);
  const selic = ind ? ind.selicMeta.valor / 100 : null;
  const sintese = sintetizar(h, { setor: medianas, selic });
  return {
    empresa: emp, ticker, preco, cotacao: cot, dataPreco: cot?.data || fech.data || null, fontePreco: cot?.fonte || (fech.precos[ticker] ? 'B3, fechamento oficial' : precoInformado != null ? 'Informado manualmente' : null),
    historico: h, sintese, frases: leituraPatrimonial(h), selic,
    pares: pares.sort((a, b) => (b.receita || 0) - (a.receita || 0)), medianas, numeroPares: pares.length - 1,
  };
}

// Resumo compacto do dossiê para o agente (e para o LLM): só números já calculados e as leituras.
export function resumoDossie(d) {
  const u = d.historico.ultimo?.udm || {}, a = d.historico.ultimo?.anual || {};
  const r = (v, c = 4) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 10 ** c) / 10 ** c);
  return {
    ticker: d.ticker, nome: d.empresa.nome, setor: d.empresa.setor, atividade: d.empresa.atividade, referencia: d.historico.ultimo?.fim, preco: d.preco,
    indicadores: { receita: u.receita, ebitda: u.ebitda, lucro: u.lucroControladores, margemEbitda: r(u.margemEbitda), margemLiquida: r(u.margemLiquida), roe: r(u.roe), roic: r(u.roic), dividaLiquidaEbitda: r(u.dividaLiquidaEbitda, 2), liquidezCorrente: r(u.liquidezCorrente, 2), fcoSobreLucro: r(u.fcoSobreLucro, 2), pl: r(u.pl, 2), pvp: r(u.pvp, 2), evEbitda: r(u.evEbitda, 2), dividendYield: r(u.dividendYield), crescimentoReceita: r(a.receita), crescimentoLucro: r(a.lucroLiquido) },
    medianasSetor: Object.fromEntries(Object.entries(d.medianas).map(([k, v]) => [k, r(v)])), numeroPares: d.numeroPares,
    sintese: { saude: d.sintese.saude, tendencia: d.sintese.tendencia, sinal: d.sintese.sinal, porque: d.sintese.porque, notaSaude: r(d.sintese.notaSaude, 2), notaValor: r(d.sintese.notaValor, 2) },
    favoraveis: d.sintese.favoraveis.map((c) => `${c.nome}: ${c.texto}`), desfavoraveis: d.sintese.desfavoraveis.map((c) => `${c.nome}: ${c.texto}`),
    tendencias: d.sintese.tendencias.map((t) => `${t.nome}: ${t.texto} (${t.leitura})`),
  };
}

// Universo para a triagem do agente: todas as companhias com indicadores de 12 meses, já com
// preço e múltiplos, e as medianas de cada setor.
export async function universo() {
  const [set, fech] = await Promise.all([lerSetores(), precosFechamento().catch(() => ({ precos: {}, data: null }))]);
  const empresas = [], medianasPorSetor = {};
  for (const [setor, linhas] of Object.entries(set.setores)) {
    const pares = linhas.map((x) => ({ ...par(x, fech.precos), setor }));
    medianasPorSetor[setor] = medianasSetor(pares, CHAVES_SETOR);
    empresas.push(...pares);
  }
  return { empresas, medianasPorSetor, dataPrecos: fech.data, geradoEm: set.geradoEm };
}

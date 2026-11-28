// Renda fixa, juros e tributos. Funções puras (navegador e Node).
// Regras tributárias: Lei 11.033/2004 (tabela regressiva), Decreto 6.306/2007 (IOF regressivo).
// Conferidas em 14/11/2026; ao mudar a lei, altere só as tabelas abaixo e a data em VIGENCIA.

export const VIGENCIA = '2026-11-14';
export const DIAS_UTEIS_ANO = 252;

// IR regressivo sobre o rendimento: prazo em dias corridos desde a aplicação.
export const TABELA_IR = [
  { ate: 180, aliquota: 0.225 },
  { ate: 360, aliquota: 0.20 },
  { ate: 720, aliquota: 0.175 },
  { ate: Infinity, aliquota: 0.15 },
];
export const aliquotaIR = (diasCorridos) => TABELA_IR.find((f) => diasCorridos <= f.ate).aliquota;

// IOF regressivo: percentual do rendimento retido em resgates com menos de 30 dias.
const IOF = [96, 93, 90, 86, 83, 80, 76, 73, 70, 66, 63, 60, 56, 53, 50, 46, 43, 40, 36, 33, 30, 26, 23, 20, 16, 13, 10, 6, 3, 0];
export const aliquotaIOF = (diasCorridos) => (diasCorridos >= 30 ? 0 : diasCorridos < 1 ? 0.96 : IOF[diasCorridos - 1] / 100);

// Conversões de taxa (juros compostos).
export const anualParaMensal = (a) => (1 + a) ** (1 / 12) - 1;
export const mensalParaAnual = (m) => (1 + m) ** 12 - 1;
export const anualParaDiaria = (a, base = DIAS_UTEIS_ANO) => (1 + a) ** (1 / base) - 1;
export const diariaParaAnual = (d, base = DIAS_UTEIS_ANO) => (1 + d) ** base - 1;

// Taxa real a partir da nominal e da inflação (equação de Fisher).
export const taxaReal = (nominal, inflacao) => (1 + nominal) / (1 + inflacao) - 1;

// Rendimento líquido de um título tributado: IOF incide antes do IR, ambos só sobre o rendimento.
export function liquidar(aplicado, bruto, diasCorridos, { isento = false } = {}) {
  const rendimento = bruto - aplicado;
  if (rendimento <= 0 || isento) return { bruto, rendimento, iof: 0, ir: 0, liquido: bruto, aliquotaIR: isento ? 0 : aliquotaIR(diasCorridos) };
  const iof = rendimento * aliquotaIOF(diasCorridos);
  const aliq = aliquotaIR(diasCorridos);
  const ir = (rendimento - iof) * aliq;
  return { bruto, rendimento, iof, ir, liquido: bruto - iof - ir, aliquotaIR: aliq };
}

// Projeção de um título por tipo de remuneração, em dias úteis (du) e dias corridos (dc).
//  pos:  percentual de um indexador anual (ex.: 110% do CDI de 13,65% a.a.)
//  pre:  taxa fixa anual
//  ipca: IPCA projetado + taxa real anual
export function projetar({ tipo, valor, taxa, percentual = 1, indexador = 0, inflacao = 0, diasUteis, diasCorridos, isento = false }) {
  let fator;
  if (tipo === 'pos') fator = (1 + anualParaDiaria(indexador) * percentual) ** diasUteis;
  else if (tipo === 'pre') fator = (1 + taxa) ** (diasUteis / DIAS_UTEIS_ANO);
  else if (tipo === 'ipca') fator = ((1 + inflacao) * (1 + taxa)) ** (diasUteis / DIAS_UTEIS_ANO);
  else throw new Error(`Tipo de remuneração desconhecido: ${tipo}`);
  const bruto = valor * fator;
  const r = liquidar(valor, bruto, diasCorridos, { isento });
  const anos = diasUteis / DIAS_UTEIS_ANO;
  return {
    ...r,
    taxaBrutaAnual: fator ** (1 / anos) - 1,
    taxaLiquidaAnual: (r.liquido / valor) ** (1 / anos) - 1,
  };
}

// Valor atual de um título pós-fixado a partir da série diária real do indexador (BCB SGS 12, em
// % ao dia). Usa só os dias presentes na série, então não precisa de calendário de feriados.
// serie: [{ data: 'AAAA-MM-DD', valor: 0.050788 }]; a aplicação rende a partir do dia seguinte.
export function acumularIndexador(serie, dataInicio, dataFim, percentual = 1) {
  let fator = 1, dias = 0, ultima = null;
  for (const p of serie) {
    if (p.data <= dataInicio || p.data > dataFim) continue;
    fator *= 1 + (p.valor / 100) * percentual;
    dias++; ultima = p.data;
  }
  return { fator, diasUteis: dias, ate: ultima };
}

// Índice de um título de renda fixa: quanto vale, a cada dia, R$ 1 aplicado em `desde`, pela curva
// do título (sem marcação a mercado). Com ele, uma aplicação vira "cotas": aplicar V no dia d
// compra V / índice(d) unidades ao preço índice(d), e as mesmas funções da carteira servem para
// ações e para renda fixa. titulo: { indexador: 'cdi' | 'selic' | 'pre' | 'ipca', percentual, taxa }.
// series: { cdi: [[data, % a.d.]], ipca: [[data 'AAAA-MM-01', % a.m.]] } como em Portal/dados/bcb.
export function indiceTitulo(titulo, series, desde, ate) {
  const pontos = [{ data: desde, valor: 1 }];
  const taxa = Number(titulo.taxa) || 0, percentual = Number(titulo.percentual) || 1;
  const dia = (iso) => Date.parse(iso + 'T00:00:00Z') / 864e5;
  if (titulo.indexador === 'cdi' || titulo.indexador === 'selic') {
    const fixoDia = (1 + taxa) ** (1 / DIAS_UTEIS_ANO); // parcela fixa de "CDI + x%"
    let f = 1;
    for (const [d, v] of series.cdi || []) {
      if (d <= desde || d > ate) continue;
      f *= (1 + (v / 100) * percentual) * fixoDia;
      pontos.push({ data: d, valor: f });
    }
  } else {
    // Prefixado e IPCA+: juro fixo por dia corrido; o IPCA entra em degraus mensais, com a
    // defasagem de divulgação (o índice de um mês só é conhecido no mês seguinte).
    const ipca = titulo.indexador === 'ipca' ? (series.ipca || []) : [];
    const t0 = dia(desde), t1 = dia(ate);
    for (let t = t0 + 1; t <= t1; t++) {
      const iso = new Date(t * 864e5).toISOString().slice(0, 10);
      let inflacao = 1;
      for (const [d, v] of ipca) if (d > desde.slice(0, 7) + '-01' && d <= iso.slice(0, 7) + '-01' && d < iso) inflacao *= 1 + v / 100;
      pontos.push({ data: iso, valor: inflacao * (1 + taxa) ** ((t - t0) / 365) });
    }
  }
  return pontos;
}

// Taxa de um título isento que empata com um tributado (e o inverso): "LCI de 90% do CDI equivale
// a um CDB de quanto?". Vale para comparar taxas do mesmo tipo e prazo.
export const equivalenteTributado = (taxaIsenta, diasCorridos) => taxaIsenta / (1 - aliquotaIR(diasCorridos));
export const equivalenteIsento = (taxaTributada, diasCorridos) => taxaTributada * (1 - aliquotaIR(diasCorridos));

// Juros compostos com aportes mensais (aporte no fim de cada mês). Devolve a evolução mês a mês.
export function jurosCompostos({ inicial = 0, aporteMensal = 0, taxaAnual, meses }) {
  const i = anualParaMensal(taxaAnual);
  const evolucao = [{ mes: 0, saldo: inicial, investido: inicial, juros: 0 }];
  let saldo = inicial, investido = inicial;
  for (let m = 1; m <= meses; m++) {
    saldo = saldo * (1 + i) + aporteMensal;
    investido += aporteMensal;
    evolucao.push({ mes: m, saldo, investido, juros: saldo - investido });
  }
  return { saldo, investido, juros: saldo - investido, evolucao };
}

// Aporte mensal necessário para chegar a um objetivo.
export function aporteParaObjetivo({ objetivo, inicial = 0, taxaAnual, meses }) {
  const i = anualParaMensal(taxaAnual);
  const futuroInicial = inicial * (1 + i) ** meses;
  if (i === 0) return (objetivo - inicial) / meses;
  return ((objetivo - futuroInicial) * i) / ((1 + i) ** meses - 1);
}

// Preço unitário de um título prefixado sem cupom (LTN / Tesouro Prefixado): 1000 / (1 + taxa)^(du/252).
export const precoPrefixado = (taxaAnual, diasUteis, nominal = 1000) => nominal / (1 + taxaAnual) ** (diasUteis / DIAS_UTEIS_ANO);

// Marcação a mercado: variação do preço de um prefixado quando a taxa de mercado muda.
export function marcacaoMercado({ taxaCompra, taxaAtual, diasUteisRestantes }) {
  const naCurva = precoPrefixado(taxaCompra, diasUteisRestantes);
  const aMercado = precoPrefixado(taxaAtual, diasUteisRestantes);
  return { naCurva, aMercado, variacao: aMercado / naCurva - 1 };
}

// Duration de Macaulay e modificada de fluxos { prazoAnos, valor } descontados a uma taxa anual.
export function duration(fluxos, taxaAnual) {
  const vp = fluxos.map((f) => f.valor / (1 + taxaAnual) ** f.prazoAnos);
  const preco = vp.reduce((a, b) => a + b, 0);
  const macaulay = fluxos.reduce((s, f, i) => s + f.prazoAnos * vp[i], 0) / preco;
  return { preco, macaulay, modificada: macaulay / (1 + taxaAnual) };
}

// Renda variável (pessoa física), regras vigentes em VIGENCIA. Ganho de capital em operações comuns
// com ações: isento se as vendas do mês somarem até R$ 20 mil; acima disso, 15% sobre o lucro todo.
// Day trade: 20%, sem isenção. FIIs: 20% sobre o ganho na venda; rendimentos mensais isentos (com
// requisitos). ETFs de renda variável: 15%, sem isenção. Prejuízos compensam lucros do mesmo tipo.
export const RENDA_VARIAVEL = {
  acoes: { aliquota: 0.15, isencaoVendasMes: 20000 },
  dayTrade: { aliquota: 0.20, isencaoVendasMes: 0 },
  fii: { aliquota: 0.20, isencaoVendasMes: 0 },
  etf: { aliquota: 0.15, isencaoVendasMes: 0 },
  bdr: { aliquota: 0.15, isencaoVendasMes: 0 },
  opcoes: { aliquota: 0.15, isencaoVendasMes: 0 },
};
export function impostoRendaVariavel({ classe, vendasMes, lucro, prejuizoAcumulado = 0 }) {
  const regra = RENDA_VARIAVEL[classe];
  if (!regra) throw new Error(`Classe sem regra tributária: ${classe}`);
  if (lucro <= 0) return { isento: false, base: 0, imposto: 0, prejuizoRestante: prejuizoAcumulado - lucro };
  if (regra.isencaoVendasMes && vendasMes <= regra.isencaoVendasMes) return { isento: true, base: 0, imposto: 0, prejuizoRestante: prejuizoAcumulado };
  const base = Math.max(0, lucro - prejuizoAcumulado);
  return { isento: false, base, imposto: base * regra.aliquota, prejuizoRestante: Math.max(0, prejuizoAcumulado - lucro) };
}

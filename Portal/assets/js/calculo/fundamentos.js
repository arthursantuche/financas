// Análise fundamentalista: indicadores a partir de demonstrativos padronizados e síntese por regras
// transparentes. Funções puras (navegador e Node). Entrada: os períodos gerados por
// coleta/cvm.mjs (ou digitados/extraídos de um PDF), todos em R$ mil:
//  { fim: 'AAAA-MM-DD', inicio, meses, origem, bp: {...}, fluxo: {...}, acoes: { total, tesouraria } }
// "fluxo" é sempre acumulado desde o início do exercício (como a CVM publica); trimestres isolados
// e os últimos 12 meses (UDM) são derivados aqui. Metodologia: Vault, "Metodologia de cálculo".

export const IR_NOMINAL = 0.34; // IRPJ + CSLL, usado no NOPAT do ROIC

const n = (v) => (Number.isFinite(v) ? v : null);
const div = (a, b) => (Number.isFinite(a) && Number.isFinite(b) && b !== 0 ? a / b : null);
const soma = (...v) => (v.every((x) => x == null) ? null : v.reduce((s, x) => s + (x || 0), 0));
const anoAnterior = (iso) => `${Number(iso.slice(0, 4)) - 1}${iso.slice(4)}`;

const FLUXOS = ['receita', 'custo', 'lucroBruto', 'despesasOperacionais', 'ebit', 'resultadoFinanceiro', 'receitasFinanceiras',
  'despesasFinanceiras', 'lair', 'impostos', 'lucroLiquido', 'lucroControladores', 'fco', 'fci', 'fcf', 'capex', 'da', 'proventosPagos'];

// Índice dos períodos por data de fim.
function indexar(periodos) {
  return new Map([...periodos].sort((a, b) => (a.fim < b.fim ? -1 : 1)).map((p) => [p.fim, p]));
}

// Fluxo do trimestre isolado: acumulado do período menos o acumulado do período anterior do mesmo
// exercício. O primeiro período do exercício (3 meses) já é isolado.
export function fluxoIsolado(periodos, fim) {
  const idx = indexar(periodos), p = idx.get(fim);
  if (!p) return null;
  if (p.meses <= 3) return { ...p.fluxo };
  const anterior = [...idx.values()].filter((q) => q.inicio === p.inicio && q.meses === p.meses - 3)[0];
  if (!anterior) return null;
  return Object.fromEntries(FLUXOS.map((k) => [k, p.fluxo[k] == null || anterior.fluxo[k] == null ? null : p.fluxo[k] - anterior.fluxo[k]]));
}

// Fluxo dos últimos 12 meses terminados em `fim`: acumulado atual + exercício anterior completo −
// acumulado do mesmo período do exercício anterior. Para um fechamento anual, é o próprio período.
export function fluxoUDM(periodos, fim) {
  const idx = indexar(periodos), p = idx.get(fim);
  if (!p) return null;
  if (p.meses === 12) return { ...p.fluxo };
  const mesmoAnoPassado = idx.get(anoAnterior(fim));
  const fechamento = [...idx.values()].filter((q) => q.meses === 12 && q.fim < fim).pop();
  if (!mesmoAnoPassado || !fechamento || mesmoAnoPassado.meses !== p.meses || fechamento.inicio !== mesmoAnoPassado.inicio) return null;
  return Object.fromEntries(FLUXOS.map((k) => {
    const a = p.fluxo[k], b = fechamento.fluxo[k], c = mesmoAnoPassado.fluxo[k];
    return [k, a == null || b == null || c == null ? null : a + b - c];
  }));
}

// Indicadores de um período. `fluxo` é o fluxo de 12 meses (UDM) ou do exercício; `bp`, o balanço
// do fim do período; `bpAnterior` (12 meses antes) permite usar saldos médios em ROE, ROA e ROIC.
export function indicadores({ bp, fluxo, acoes, bpAnterior = null, financeira = false, preco = null }) {
  const f = fluxo || {}, b = bp || {};
  const medio = (k) => (bpAnterior && bpAnterior[k] != null && b[k] != null ? (b[k] + bpAnterior[k]) / 2 : b[k]);
  const ebitda = financeira ? null : soma(f.ebit, f.da);
  const dividaBruta = financeira ? null : soma(b.dividaCP, b.dividaLP);
  const caixaTotal = soma(b.caixa, b.aplicacoes);
  const dividaLiquida = dividaBruta == null ? null : dividaBruta - (caixaTotal || 0);
  const plControladores = b.patrimonioLiquido == null ? null : b.patrimonioLiquido - (b.minoritarios || 0);
  const lucro = f.lucroControladores ?? f.lucroLiquido;
  const capitalInvestido = financeira || b.patrimonioLiquido == null ? null : b.patrimonioLiquido + (dividaLiquida || 0);
  const capitalAnterior = bpAnterior && !financeira && bpAnterior.patrimonioLiquido != null
    ? bpAnterior.patrimonioLiquido + (soma(bpAnterior.dividaCP, bpAnterior.dividaLP) || 0) - (soma(bpAnterior.caixa, bpAnterior.aplicacoes) || 0) : null;
  const capitalMedio = capitalInvestido != null && capitalAnterior != null ? (capitalInvestido + capitalAnterior) / 2 : capitalInvestido;
  const circulacao = acoes && acoes.total ? acoes.total - (acoes.tesouraria || 0) : null;
  const fcl = f.fco == null ? null : f.fco + (f.capex || 0); // capex é negativo

  const r = {
    // Resultado
    receita: n(f.receita), lucroBruto: n(f.lucroBruto), ebit: financeira ? null : n(f.ebit), ebitda, lucroLiquido: n(f.lucroLiquido), lucroControladores: n(lucro),
    margemBruta: financeira ? null : div(f.lucroBruto, f.receita),
    margemEbit: financeira ? null : div(f.ebit, f.receita),
    margemEbitda: div(ebitda, f.receita),
    margemLiquida: div(f.lucroLiquido, f.receita),
    // Rentabilidade (saldos médios quando há o balanço de 12 meses antes)
    roe: div(lucro, bpAnterior && bpAnterior.patrimonioLiquido != null && plControladores != null ? (plControladores + bpAnterior.patrimonioLiquido - (bpAnterior.minoritarios || 0)) / 2 : plControladores),
    roa: div(f.lucroLiquido, medio('ativoTotal')),
    roic: financeira || f.ebit == null ? null : div(f.ebit * (1 - IR_NOMINAL), capitalMedio),
    giroAtivo: financeira ? null : div(f.receita, medio('ativoTotal')),
    // Estrutura patrimonial
    ativoTotal: n(b.ativoTotal), patrimonioLiquido: n(b.patrimonioLiquido), dividaBruta, caixaTotal, dividaLiquida,
    imobilizadoSobreAtivo: div(b.imobilizado, b.ativoTotal),
    aplicacoesSobreAtivo: div(b.aplicacoes, b.ativoTotal),
    caixaSobreAtivo: div(caixaTotal, b.ativoTotal),
    passivoCurtoPrazo: div(b.passivoCirculante, soma(b.passivoCirculante, b.passivoNaoCirculante)),
    endividamentoGeral: div(soma(b.passivoCirculante, b.passivoNaoCirculante), b.ativoTotal),
    dividaCurtoPrazo: div(b.dividaCP, dividaBruta),
    // Endividamento
    dividaLiquidaEbitda: ebitda != null && ebitda > 0 ? div(dividaLiquida, ebitda) : null,
    dividaLiquidaPL: div(dividaLiquida, b.patrimonioLiquido),
    coberturaJuros: financeira || !f.despesasFinanceiras ? null : div(f.ebit, Math.abs(f.despesasFinanceiras)),
    // Liquidez
    liquidezCorrente: financeira ? null : div(b.ativoCirculante, b.passivoCirculante),
    liquidezSeca: financeira || b.ativoCirculante == null ? null : div(b.ativoCirculante - (b.estoques || 0), b.passivoCirculante),
    liquidezImediata: financeira ? null : div(caixaTotal, b.passivoCirculante),
    // Caixa
    fco: n(f.fco), capex: n(f.capex), fcl,
    // Só faz sentido com lucro relevante: perto de zero, a razão explode e não diz nada.
    fcoSobreLucro: f.lucroLiquido > 0 && (!f.receita || f.lucroLiquido / f.receita > 0.02) ? div(f.fco, f.lucroLiquido) : null,
    patrimonioSobreAtivo: div(b.patrimonioLiquido, b.ativoTotal),
    fcoSobreEbitda: ebitda > 0 ? div(f.fco, ebitda) : null,
    capexSobreReceita: f.capex == null ? null : div(-f.capex, f.receita),
    capexSobreDA: f.capex == null || !f.da ? null : div(-f.capex, f.da),
    proventosPagos: n(f.proventosPagos),
    payout: lucro > 0 && f.proventosPagos != null ? div(f.proventosPagos, lucro) : null,
    // Por ação (valores em R$; os demonstrativos estão em R$ mil)
    acoes: circulacao,
    lpa: circulacao ? div(lucro * 1000, circulacao) : null,
    vpa: circulacao && plControladores != null ? div(plControladores * 1000, circulacao) : null,
  };
  if (preco != null) Object.assign(r, multiplos(r, preco));
  return r;
}

// Múltiplos de mercado a partir do preço da ação. O valor de mercado usa o preço do papel
// consultado para todas as ações (ON e PN), a aproximação usual quando há mais de uma classe.
export function multiplos(ind, preco) {
  const valorMercado = ind.acoes ? (preco * ind.acoes) / 1000 : null; // R$ mil
  const ev = valorMercado == null || ind.dividaLiquida == null ? null : valorMercado + ind.dividaLiquida;
  return {
    preco, valorMercado, valorFirma: ev,
    pl: ind.lpa > 0 ? div(preco, ind.lpa) : null,
    pvp: ind.vpa > 0 ? div(preco, ind.vpa) : null,
    psr: div(valorMercado, ind.receita),
    evEbitda: ind.ebitda > 0 ? div(ev, ind.ebitda) : null,
    evEbit: ind.ebit > 0 ? div(ev, ind.ebit) : null,
    earningsYield: ind.lpa != null ? div(ind.lpa, preco) : null,
    dividendYield: ind.proventosPagos != null ? div(ind.proventosPagos, valorMercado) : null,
    fclYield: ind.fcl != null ? div(ind.fcl, valorMercado) : null,
  };
}

// Variação entre dois valores; null quando a base é zero ou negativa (variação sem sentido).
export const variacao = (atual, base) => (atual == null || base == null || base <= 0 ? null : atual / base - 1);

// Histórico completo de uma empresa: para cada período, indicadores UDM, do trimestre isolado e as
// variações contra o trimestre anterior e contra o mesmo período do ano anterior.
export function historico(empresa, { preco = null } = {}) {
  const periodos = [...empresa.periodos].sort((a, b) => (a.fim < b.fim ? -1 : 1));
  const idx = indexar(periodos);
  const financeira = empresa.plano !== 'comercial';
  const linhas = periodos.map((p) => {
    const udm = fluxoUDM(periodos, p.fim), tri = fluxoIsolado(periodos, p.fim);
    const antes = idx.get(anoAnterior(p.fim));
    return {
      fim: p.fim, meses: p.meses, origem: p.origem, consolidado: p.consolidado,
      udm: udm ? indicadores({ bp: p.bp, fluxo: udm, acoes: p.acoes, bpAnterior: antes?.bp, financeira }) : null,
      trimestre: tri ? indicadores({ bp: p.bp, fluxo: tri, acoes: p.acoes, financeira }) : null,
    };
  });
  const porFim = new Map(linhas.map((l) => [l.fim, l]));
  const CRESC = ['receita', 'ebitda', 'ebit', 'lucroLiquido', 'fco'];
  for (const [i, l] of linhas.entries()) {
    const ano = porFim.get(anoAnterior(l.fim)), ant = linhas[i - 1];
    l.anual = {}; l.trimestral = {};
    for (const k of CRESC) {
      l.anual[k] = variacao(l.udm?.[k], ano?.udm?.[k]);                    // UDM contra UDM de um ano antes
      l.anual[k + 'Tri'] = variacao(l.trimestre?.[k], ano?.trimestre?.[k]); // trimestre contra o mesmo trimestre
      l.trimestral[k] = variacao(l.trimestre?.[k], ant?.trimestre?.[k]);    // trimestre contra o anterior
    }
  }
  const ultimo = [...linhas].reverse().find((l) => l.udm) || null;
  if (ultimo && preco != null) Object.assign(ultimo.udm, multiplos(ultimo.udm, preco));
  return { linhas, ultimo, financeira };
}

// Mediana dos pares do setor para cada indicador. pares: lista de objetos de indicadores.
export function medianasSetor(pares, chaves) {
  const r = {};
  for (const k of chaves) {
    const v = pares.map((p) => p[k]).filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
    r[k] = v.length >= 5 ? (v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2) : null;
  }
  return r;
}

// ---------------------------------------------------------------------------------------------
// Síntese por regras. Cada critério devolve { grupo, nome, valor, leitura, nota: 1 | 0 | -1, regra }.
// As faixas são referências gerais para empresas não financeiras brasileiras; quando há mediana do
// setor (5 pares ou mais), o critério também compara com ela. Nenhuma conclusão sai de um único
// indicador: saúde, tendência e sinal exigem concordância entre grupos (ver `sintetizar`).
// ---------------------------------------------------------------------------------------------
const pct = (v) => (v == null ? '—' : `${(v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`);
const vezes = (v) => (v == null ? '—' : `${v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}×`);

function faixa(valor, { bom, ruim, maiorMelhor = true }) {
  if (valor == null) return null;
  if (maiorMelhor) return valor >= bom ? 1 : valor < ruim ? -1 : 0;
  return valor <= bom ? 1 : valor > ruim ? -1 : 0;
}
function contraSetor(valor, mediana, maiorMelhor = true, folga = 0.1) {
  if (valor == null || mediana == null) return null;
  const dif = maiorMelhor ? valor - mediana : mediana - valor;
  const base = Math.abs(mediana) || 1;
  return dif / base > folga ? 1 : dif / base < -folga ? -1 : 0;
}

export function criterios(h, { setor = null, selic = null } = {}) {
  const u = h.ultimo?.udm;
  if (!u) return [];
  const linha = h.ultimo, s = setor || {}, lista = [];
  const add = (grupo, nome, valor, formato, nota, regra, extra = '') => {
    if (nota == null) return;
    lista.push({ grupo, nome, valor, texto: formato(valor), nota, leitura: nota > 0 ? 'favorável' : nota < 0 ? 'desfavorável' : 'neutro', regra: regra + extra });
  };
  const comSetor = (k, maior = true) => (s[k] != null ? `; mediana do setor ${k.startsWith('margem') || k.startsWith('ro') ? pct(s[k]) : vezes(s[k])} (${['abaixo', 'em linha', 'acima'][contraSetor(u[k], s[k], true) + 1]})` : '');

  // Rentabilidade
  const custoCapital = selic != null ? selic : 0.12;
  add('Rentabilidade', 'ROE', u.roe, pct, faixa(u.roe, { bom: Math.max(0.15, custoCapital), ruim: 0.08 }), `favorável a partir de ${pct(Math.max(0.15, custoCapital))} (15% ou a Selic, o que for maior), desfavorável abaixo de 8%`, comSetor('roe'));
  if (!h.financeira) {
    add('Rentabilidade', 'ROIC', u.roic, pct, faixa(u.roic, { bom: 0.12, ruim: 0.06 }), 'favorável a partir de 12%, desfavorável abaixo de 6%', comSetor('roic'));
    add('Rentabilidade', 'Margem EBITDA contra o setor', u.margemEbitda, pct, contraSetor(u.margemEbitda, s.margemEbitda), 'favorável se mais de 10% acima da mediana do setor, desfavorável se mais de 10% abaixo', comSetor('margemEbitda'));
  }
  if (h.financeira) {
    // Bancos e seguradoras: sem EBITDA nem dívida líquida, valem retorno sobre o ativo e capital próprio.
    add('Rentabilidade', 'Retorno sobre o ativo (ROA)', u.roa, (v) => pct(v), faixa(u.roa, { bom: 0.012, ruim: 0.006 }), 'favorável a partir de 1,2%, desfavorável abaixo de 0,6% (referência para instituições financeiras)');
    add('Endividamento', 'Patrimônio líquido / ativo total', u.patrimonioSobreAtivo, pct, faixa(u.patrimonioSobreAtivo, { bom: 0.08, ruim: 0.05 }), 'favorável a partir de 8%, desfavorável abaixo de 5%; não substitui o índice de Basileia, que não consta dos dados abertos');
  }
  add('Rentabilidade', 'Margem líquida', u.margemLiquida, pct, faixa(u.margemLiquida, { bom: 0.10, ruim: 0.03 }), 'favorável a partir de 10%, desfavorável abaixo de 3%', comSetor('margemLiquida'));

  // Endividamento e liquidez (não se aplicam a instituições financeiras)
  if (!h.financeira) {
    const dl = u.dividaLiquida != null && u.dividaLiquida <= 0 ? 1 : faixa(u.dividaLiquidaEbitda, { bom: 2, ruim: 3.5, maiorMelhor: false });
    add('Endividamento', 'Dívida líquida / EBITDA', u.dividaLiquidaEbitda, (v) => (u.dividaLiquida <= 0 ? 'caixa líquido' : vezes(v)), u.ebitda != null && u.ebitda <= 0 && u.dividaLiquida > 0 ? -1 : dl, 'favorável até 2× (ou caixa líquido), desfavorável acima de 3,5× ou com EBITDA negativo');
    add('Endividamento', 'Cobertura de juros (EBIT / despesa financeira)', u.coberturaJuros, vezes, faixa(u.coberturaJuros, { bom: 3, ruim: 1.5 }), 'favorável a partir de 3×, desfavorável abaixo de 1,5×');
    // Só pesa quando o caixa não cobre a dívida inteira: com caixa líquido, o prazo da dívida deixa de ser risco.
    add('Endividamento', 'Dívida de curto prazo', u.dividaCurtoPrazo, pct, u.dividaBruta > 0 && u.dividaLiquida > 0 ? faixa(u.dividaCurtoPrazo, { bom: 0.3, ruim: 0.5, maiorMelhor: false }) : null, 'favorável até 30% da dívida bruta, desfavorável acima de 50% (não se aplica a quem tem mais caixa que dívida)');
    add('Liquidez', 'Liquidez corrente', u.liquidezCorrente, vezes, faixa(u.liquidezCorrente, { bom: 1.5, ruim: 1 }), 'favorável a partir de 1,5×, desfavorável abaixo de 1×');
    add('Liquidez', 'Caixa e aplicações / dívida de curto prazo', div(u.caixaTotal, linha.udm.dividaBruta * (u.dividaCurtoPrazo || 0)), vezes, u.dividaBruta > 0 && u.dividaCurtoPrazo > 0 ? faixa(div(u.caixaTotal, u.dividaBruta * u.dividaCurtoPrazo), { bom: 1.5, ruim: 1 }) : null, 'favorável a partir de 1,5×, desfavorável abaixo de 1×');
    // Geração de caixa
    add('Caixa', 'Caixa operacional / lucro líquido', u.fcoSobreLucro, vezes, faixa(u.fcoSobreLucro, { bom: 0.9, ruim: 0.6 }), 'favorável a partir de 0,9× (o lucro vira caixa), desfavorável abaixo de 0,6×');
    add('Caixa', 'Fluxo de caixa livre', u.fcl, (v) => (v == null ? '—' : `R$ ${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} mi`), u.fcl == null ? null : u.fcl > 0 ? 1 : -1, 'favorável se positivo nos últimos 12 meses (caixa operacional menos investimentos em imobilizado e intangível)');
  }

  // Crescimento (últimos 12 meses contra os 12 meses anteriores)
  const a = linha.anual || {};
  add('Crescimento', 'Receita', a.receita, pct, faixa(a.receita, { bom: 0.08, ruim: 0 }), 'favorável a partir de 8% em 12 meses, desfavorável se cair');
  add('Crescimento', 'Lucro líquido', a.lucroLiquido, pct, u.lucroLiquido < 0 ? -1 : faixa(a.lucroLiquido, { bom: 0.08, ruim: 0 }), 'favorável a partir de 8% em 12 meses, desfavorável se cair ou houver prejuízo');
  if (a.receita != null && a.lucroLiquido != null) add('Crescimento', 'Lucro acompanha a receita', a.lucroLiquido - a.receita, (v) => `${v >= 0 ? '+' : ''}${(v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} p.p.`, a.lucroLiquido >= a.receita - 0.02 ? 1 : a.lucroLiquido < a.receita - 0.10 ? -1 : 0, 'favorável se o lucro cresce no ritmo da receita (até 2 p.p. abaixo), desfavorável se fica mais de 10 p.p. atrás');
  return lista;
}

// Tendência: compara os indicadores dos últimos 12 meses com os de um ano antes.
export function tendencias(h) {
  const linhas = h.linhas.filter((l) => l.udm);
  const atual = linhas[linhas.length - 1];
  const antes = atual && linhas.find((l) => l.fim === anoAnterior(atual.fim));
  if (!atual || !antes) return [];
  const itens = [];
  const add = (nome, k, { maiorMelhor = true, limiar, formato = pct, pontos = true }) => {
    const x = atual.udm[k], y = antes.udm[k];
    if (x == null || y == null) return;
    // Mudou de verdade quando passa do limiar absoluto e de 10% do nível anterior: 1 ponto num
    // ROE de 30% é ruído; num ROE de 5%, não.
    const d = x - y, sinal = Math.abs(d) < Math.max(limiar, 0.1 * Math.abs(y)) ? 0 : (d > 0) === maiorMelhor ? 1 : -1;
    itens.push({ nome, de: y, para: x, texto: `${formato(y)} → ${formato(x)}`, diferenca: d, pontos, nota: sinal, leitura: sinal > 0 ? 'melhora' : sinal < 0 ? 'piora' : 'estável' });
  };
  if (!h.financeira) {
    add('Margem EBITDA', 'margemEbitda', { limiar: 0.01 });
    add('Margem EBIT', 'margemEbit', { limiar: 0.01 });
    add('Dívida líquida / EBITDA', 'dividaLiquidaEbitda', { maiorMelhor: false, limiar: 0.25, formato: vezes });
    add('ROIC', 'roic', { limiar: 0.01 });
    add('Liquidez corrente', 'liquidezCorrente', { limiar: 0.1, formato: vezes });
    add('Caixa operacional / lucro', 'fcoSobreLucro', { limiar: 0.15, formato: vezes });
  }
  add('Margem líquida', 'margemLiquida', { limiar: 0.01 });
  add('ROE', 'roe', { limiar: 0.01 });
  if (h.financeira) add('Retorno sobre o ativo', 'roa', { limiar: 0.001 });
  return itens;
}

// Avaliação de preço: só entra com cotação. Compara com a mediana do setor e com a renda fixa.
export function criteriosValor(u, { setor = null, selic = null } = {}) {
  if (!u || u.preco == null) return [];
  const s = setor || {}, lista = [];
  const add = (nome, valor, formato, nota, regra) => { if (nota != null) lista.push({ grupo: 'Preço', nome, valor, texto: formato(valor), nota, leitura: nota > 0 ? 'favorável' : nota < 0 ? 'desfavorável' : 'neutro', regra }); };
  add('P/L contra o setor', u.pl, vezes, u.pl == null ? (u.lpa != null && u.lpa <= 0 ? -1 : null) : contraSetor(u.pl, s.pl, false, 0.15), `favorável se mais de 15% abaixo da mediana do setor${s.pl != null ? ` (${vezes(s.pl)})` : ''}, desfavorável se mais de 15% acima ou com prejuízo`);
  add('EV/EBITDA contra o setor', u.evEbitda, vezes, contraSetor(u.evEbitda, s.evEbitda, false, 0.15), `favorável se mais de 15% abaixo da mediana do setor${s.evEbitda != null ? ` (${vezes(s.evEbitda)})` : ''}, desfavorável se mais de 15% acima`);
  add('P/VP e ROE', u.pvp, vezes, u.pvp == null || u.roe == null ? null : u.pvp <= 1.5 && u.roe >= 0.12 ? 1 : u.pvp > 3 && u.roe < 0.15 ? -1 : 0, 'favorável se P/VP até 1,5× com ROE de 12% ou mais; desfavorável se P/VP acima de 3× com ROE abaixo de 15%');
  if (selic != null) add('Lucro por preço contra a Selic', u.earningsYield, pct, u.earningsYield == null ? null : u.earningsYield >= selic ? 1 : u.earningsYield < selic * 0.5 ? -1 : 0, `favorável se o lucro por ação dividido pelo preço supera a Selic (${(selic * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%); desfavorável se fica abaixo da metade dela`);
  return lista;
}

// Síntese executiva. Transparente e conservadora:
//  saúde     → média das notas de Rentabilidade, Endividamento, Liquidez e Caixa (mínimo de 4 critérios);
//  tendência → saldo de melhoras e pioras em 12 meses (mínimo de 3 itens);
//  sinal     → combina saúde, tendência e preço; exige preço e nunca decorre de um indicador só.
export function sintetizar(h, opcoes = {}) {
  const cs = criterios(h, opcoes), ts = tendencias(h), vs = criteriosValor(h.ultimo?.udm, opcoes);
  const mediaNotas = (l) => (l.length ? l.reduce((s, c) => s + c.nota, 0) / l.length : null);
  const grupos = [...new Set(cs.map((c) => c.grupo))].map((g) => ({ grupo: g, media: mediaNotas(cs.filter((c) => c.grupo === g)), criterios: cs.filter((c) => c.grupo === g).length }));
  const estrutura = cs.filter((c) => c.grupo !== 'Crescimento');
  const notaSaude = estrutura.length >= (h.financeira ? 3 : 4) ? mediaNotas(estrutura) : null;
  const criticos = cs.filter((c) => c.nota < 0 && ['Endividamento', 'Liquidez'].includes(c.grupo)).length;
  // Saudável: média alta e nenhum critério desfavorável de endividamento ou liquidez.
  // Frágil: média negativa, ou dois ou mais critérios desfavoráveis de endividamento e liquidez sem
  // rentabilidade e caixa que compensem (média abaixo de 0,2). O resto é atenção.
  const saude = notaSaude == null ? 'dados insuficientes' : notaSaude >= 0.4 && criticos === 0 ? 'financeiramente saudável' : notaSaude <= -0.3 || (criticos >= 2 && notaSaude < 0.2) ? 'situação frágil' : 'situação de atenção';
  const saldo = ts.reduce((s, t) => s + t.nota, 0);
  const minimo = h.financeira ? 2 : 3;
  const tendencia = ts.length < minimo ? 'sem histórico comparável' : saldo >= 2 ? 'melhora dos fundamentos' : saldo <= -2 ? 'deterioração dos fundamentos' : 'fundamentos estáveis';
  const notaValor = vs.length >= 2 ? mediaNotas(vs) : null;
  let sinal = null, porque = '';
  if (notaSaude == null) porque = 'Faltam dados para avaliar a saúde financeira.';
  else if (notaValor == null) porque = 'Sem cotação ou sem pares suficientes para avaliar o preço: a síntese fica restrita aos fundamentos.';
  else if (saude === 'financeiramente saudável' && saldo >= 0 && notaValor > 0.3) { sinal = 'considerar compra'; porque = 'Fundamentos saudáveis, sem deterioração em 12 meses e preço favorável em mais de um critério.'; }
  else if (saude === 'situação frágil' && saldo < 0) { sinal = 'considerar redução ou venda'; porque = 'Situação financeira frágil e fundamentos em deterioração.'; }
  else if (notaValor < -0.5 && saldo <= -2) { sinal = 'considerar redução ou venda'; porque = 'Preço desfavorável em mais de um critério e fundamentos em deterioração.'; }
  else { sinal = 'manter posição'; porque = 'Os critérios não concordam o bastante para indicar compra ou venda.'; }
  return {
    saude, tendencia, sinal, porque, notaSaude, saldoTendencia: saldo, notaValor,
    favoraveis: cs.concat(vs).filter((c) => c.nota > 0), desfavoraveis: cs.concat(vs).filter((c) => c.nota < 0),
    grupos, criterios: cs, tendencias: ts, valor: vs,
    referencia: h.ultimo?.fim || null,
  };
}

// Respostas diretas às perguntas de composição do balanço, em frases, com os números usados.
export function leituraPatrimonial(h) {
  const u = h.ultimo?.udm;
  if (!u) return [];
  const linhas = h.linhas.filter((l) => l.udm), antes = linhas.find((l) => l.fim === anoAnterior(h.ultimo.fim))?.udm;
  const frases = [];
  const p = (cond, texto) => { if (cond) frases.push(texto); };
  p(u.imobilizadoSobreAtivo != null, `O imobilizado representa ${pct(u.imobilizadoSobreAtivo)} do ativo total.`);
  p(u.passivoCurtoPrazo != null, `${pct(u.passivoCurtoPrazo)} das obrigações vencem no curto prazo (passivo circulante sobre o passivo exigível).`);
  p(u.caixaSobreAtivo != null, `Caixa e aplicações financeiras somam ${pct(u.caixaSobreAtivo)} do ativo${u.aplicacoesSobreAtivo != null ? `, dos quais ${pct(u.aplicacoesSobreAtivo)} em aplicações` : ''}.`);
  const posicao = (v) => (v <= 0 ? `caixa líquido de R$ ${milhoes(-v)}` : `dívida líquida de R$ ${milhoes(v)}`);
  p(u.dividaLiquida != null && antes?.dividaLiquida != null, `Em 12 meses a empresa passou de ${posicao(antes?.dividaLiquida)} para ${posicao(u.dividaLiquida)}${u.dividaLiquida <= 0 ? ': tem mais caixa e aplicações que dívida financeira' : ''}.`);
  p(u.margemEbitda != null && antes?.margemEbitda != null, `A margem EBITDA ${u.margemEbitda > antes?.margemEbitda + 0.001 ? 'subiu' : u.margemEbitda < antes?.margemEbitda - 0.001 ? 'caiu' : 'ficou estável'}: ${pct(antes?.margemEbitda)} → ${pct(u.margemEbitda)}.`);
  const a = h.ultimo.anual || {};
  p(a.receita != null && a.lucroLiquido != null, `Em 12 meses a receita variou ${pct(a.receita)} e o lucro líquido, ${pct(a.lucroLiquido)}: ${a.lucroLiquido >= a.receita - 0.02 ? 'o lucro acompanha a receita' : 'o lucro cresce menos que a receita'}.`);
  p(u.fcoSobreLucro != null, `O caixa gerado pela operação equivale a ${vezes(u.fcoSobreLucro)} o lucro líquido: ${u.fcoSobreLucro >= 0.9 ? 'o resultado contábil está virando caixa' : u.fcoSobreLucro >= 0.6 ? 'parte do lucro ainda não virou caixa' : 'o lucro contábil não está se convertendo em caixa'}.`);
  return frases;
}
const milhoes = (v) => (v == null ? '—' : `${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} mi`);

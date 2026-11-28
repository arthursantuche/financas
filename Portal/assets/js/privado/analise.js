// Análise fundamentalista. Duas entradas: buscar uma companhia pelo código (dados oficiais da
// CVM) ou enviar um demonstrativo (envio.js). A página separa quatro camadas, sempre rotuladas:
// dados oficiais → cálculos do portal → interpretação por regras → sinal.
import { el, brl, pct, pctSinal, numero, vezes, compacto, dataBR, trimestre, semAcento, adiar, classeSinal, plural } from '../util.js';
import { moldura, graficoBarras, graficoLinhas } from '../graficos.js';
import { indiceEmpresas } from '../dados.js';
import { dossieEmpresa } from './empresa.js';
import { lista } from './cofre.js';
import { presenca, blocoPresenca } from './investidores.js';
import { marca } from '../marca.js';
import { cabecalhoAtivo, tabelaIndicadores, textoVariacao } from './stocks.js';
// Primeira letra maiúscula, no texto (a identidade proíbe text-transform).
const inicial = (t) => (t ? t[0].toUpperCase() + t.slice(1) : t);

const mil = (v) => (v == null ? '—' : compacto(v * 1000));
const FORMATOS = { pct: (v) => pct(v, 1), vezes: (v) => vezes(v, 2), mil, pctSinal: (v) => pctSinal(v, 1) };
const leitura = (texto) => el('span', { class: `leitura leitura--${semAcento(texto).replace(/\s.*/, '')}` }, texto);

// Síntese executiva: três vereditos e o porquê. Sempre com a camada indicada.
export function blocoSintese(d) {
  const s = d.sintese;
  const sinalTexto = s.sinal || 'sem sinal';
  return el('div', { class: 'empilha empilha--folgada' },
    el('div', { class: 'sintese' },
      el('div', { class: 'veredito' }, el('p', { class: 'selo' }, 'Saúde financeira'), el('p', { class: 'veredito__valor' }, inicial(s.saude)), el('p', { class: 'legenda' }, `${plural(s.favoraveis.length, 'critério favorável', 'critérios favoráveis')} e ${plural(s.desfavoraveis.length, 'desfavorável', 'desfavoráveis')}`)),
      el('div', { class: 'veredito' }, el('p', { class: 'selo' }, 'Tendência em 12 meses'), el('p', { class: 'veredito__valor' }, inicial(s.tendencia)), el('p', { class: 'legenda' }, s.tendencias.length ? `${plural(s.tendencias.filter((t) => t.nota > 0).length, 'indicador melhorou', 'indicadores melhoraram')} e ${plural(s.tendencias.filter((t) => t.nota < 0).length, 'piorou', 'pioraram')}` : 'Falta o período de um ano antes para comparar')),
      el('div', { class: 'veredito' }, el('p', { class: 'selo' }, 'Sinal pelas regras'), el('p', { class: 'veredito__valor' }, inicial(sinalTexto)), el('p', { class: 'legenda' }, s.porque))),
    el('div', { class: 'natureza' }, el('strong', {}, 'Como ler'), el('span', { class: 'legenda' }, `Síntese produzida por regras fixas sobre os demonstrativos entregues à CVM (referência ${dataBR(s.referencia)})${d.preco != null ? ` e o preço de ${brl(d.preco)}` : ''}. É uma leitura do passado por critérios gerais: não conhece seus objetivos, não prevê resultados e não substitui a sua análise.`)));
}

export function blocoCriterios(d) {
  const grupos = [...new Set(d.sintese.criterios.concat(d.sintese.valor).map((c) => c.grupo))];
  return el('div', { class: 'grade-2 grade-2--folgada' }, grupos.map((g) => el('div', {},
    el('h3', { class: 'kicker' }, g),
    el('div', {}, d.sintese.criterios.concat(d.sintese.valor).filter((c) => c.grupo === g).map((c) => el('div', { class: 'criterio' },
      el('span', {}, c.nome, ' ', leitura(c.leitura)), el('span', { class: 'criterio__valor' }, c.texto), el('span', { class: 'legenda' }, `Regra: ${c.regra}.`)))))));
}

export function blocoTendencias(d) {
  if (!d.sintese.tendencias.length) return el('p', { class: 'vazio' }, 'Sem o período de um ano antes para comparar.');
  return el('div', {}, d.sintese.tendencias.map((t) => el('div', { class: 'criterio' }, el('span', {}, t.nome, ' ', leitura(t.leitura)), el('span', { class: 'criterio__valor' }, t.texto))));
}

// Gráficos: resultado por trimestre, margens, endividamento, caixa e composição do balanço.
export function blocoGraficos(d) {
  const linhas = d.historico.linhas, fin = d.historico.financeira;
  const tri = linhas.filter((l) => l.trimestre && l.trimestre.receita != null).slice(-8);
  const udm = linhas.filter((l) => l.udm).slice(-8);
  const blocos = [];
  const cartao = (titulo, grafico, legendaItens, nota) => el('div', { class: 'card card--auto card--info' }, el('h3', { class: 'kicker' }, titulo), legendaItens && el('p', { class: 'legenda legenda-grafico' }, legendaItens.map(([n, c]) => el('span', { class: c }, n))), grafico, nota && el('p', { class: 'selo' }, nota));
  if (tri.length >= 2) {
    const g = moldura('Receita e lucro líquido por trimestre');
    graficoBarras(g.canvas, { rotulos: tri.map((l) => trimestre(l.fim)), series: [{ nome: 'Receita', cor: '--cor-grafico-previsto', valores: tri.map((l) => l.trimestre.receita) }, ...(fin ? [] : [{ nome: 'EBITDA', cor: '--cor-link', valores: tri.map((l) => l.trimestre.ebitda) }]), { nome: 'Lucro líquido', cor: '--cor-texto', valores: tri.map((l) => l.trimestre.lucroLiquido) }], formato: mil, formatoEixo: mil });
    blocos.push(cartao('Resultado por trimestre', g.no, [['Receita', 'cor-previsto'], ...(fin ? [] : [['EBITDA', 'cor-link']]), ['Lucro líquido', 'cor-pago']], 'Trimestres isolados. O quarto trimestre é o ano menos os nove meses.'));
  }
  if (udm.length >= 2) {
    const g = moldura('Margens dos últimos 12 meses');
    graficoLinhas(g.canvas, { rotulos: udm.map((l) => trimestre(l.fim)), series: [...(fin ? [] : [{ nome: 'Margem bruta', cor: '--cor-grafico-previsto', valores: udm.map((l) => l.udm.margemBruta * 100) }, { nome: 'Margem EBITDA', cor: '--cor-link', valores: udm.map((l) => l.udm.margemEbitda * 100) }]), { nome: 'Margem líquida', cor: '--cor-texto', valores: udm.map((l) => l.udm.margemLiquida * 100) }], formato: (v) => `${numero(v, 1)}%`, formatoEixo: (v) => `${numero(v, 0)}%` });
    blocos.push(cartao('Margens', g.no, [...(fin ? [] : [['Bruta', 'cor-previsto'], ['EBITDA', 'cor-link']]), ['Líquida', 'cor-pago']], 'Acumulado de 12 meses em cada data.'));
    const g2 = moldura('Rentabilidade sobre o patrimônio e sobre o capital investido');
    graficoLinhas(g2.canvas, { rotulos: udm.map((l) => trimestre(l.fim)), series: [{ nome: 'ROE', cor: '--cor-texto', valores: udm.map((l) => (l.udm.roe ?? null) && l.udm.roe * 100) }, ...(fin ? [] : [{ nome: 'ROIC', cor: '--cor-link', valores: udm.map((l) => (l.udm.roic ?? null) && l.udm.roic * 100) }])], formato: (v) => `${numero(v, 1)}%`, formatoEixo: (v) => `${numero(v, 0)}%` });
    blocos.push(cartao('Rentabilidade', g2.no, [['ROE', 'cor-pago'], ...(fin ? [] : [['ROIC', 'cor-link']])]));
    if (!fin) {
      const g3 = moldura('Dívida líquida e relação com o EBITDA');
      graficoBarras(g3.canvas, { rotulos: udm.map((l) => trimestre(l.fim)), series: [{ nome: 'Dívida líquida', cor: '--cor-alerta', valores: udm.map((l) => l.udm.dividaLiquida) }, { nome: 'EBITDA de 12 meses', cor: '--cor-link', valores: udm.map((l) => l.udm.ebitda) }], formato: mil, formatoEixo: mil });
      blocos.push(cartao('Endividamento', g3.no, [['Dívida líquida', 'cor-apagar'], ['EBITDA de 12 meses', 'cor-link']], `Dívida líquida / EBITDA: ${udm.map((l) => (l.udm.dividaLiquidaEbitda == null ? '—' : vezes(l.udm.dividaLiquidaEbitda, 1))).slice(-4).join(' → ')}`));
      const g4 = moldura('Lucro líquido, caixa operacional e fluxo de caixa livre');
      graficoBarras(g4.canvas, { rotulos: udm.map((l) => trimestre(l.fim)), series: [{ nome: 'Lucro líquido', cor: '--cor-texto', valores: udm.map((l) => l.udm.lucroLiquido) }, { nome: 'Caixa operacional', cor: '--cor-link', valores: udm.map((l) => l.udm.fco) }, { nome: 'Caixa livre', cor: '--cor-grafico-previsto', valores: udm.map((l) => l.udm.fcl) }], formato: mil, formatoEixo: mil });
      blocos.push(cartao('Lucro e geração de caixa', g4.no, [['Lucro líquido', 'cor-pago'], ['Caixa operacional', 'cor-link'], ['Caixa livre', 'cor-previsto']], 'Últimos 12 meses em cada data. Lucro que não vira caixa pede atenção.'));
    }
  }
  return el('div', { class: 'grade-2' }, blocos);
}

// Composição do balanço mais recente, em barras de peso.
export function blocoBalanco(d) {
  const p = [...d.empresa.periodos].reverse().find((x) => x.bp.ativoTotal), b = p?.bp;
  if (!b) return null;
  const barra = (nome, valor, total) => (valor == null ? null : el('div', { class: 'empilha' }, el('div', { class: 'fila fila--entre fila--valor' }, el('span', {}, nome), el('span', { class: 'num' }, `${mil(valor)} · ${pct(valor / total, 1)}`)), el('div', { class: 'barra-peso' }, (() => { const i = el('i'); i.style.width = `${Math.max(0, Math.min(100, (valor / total) * 100))}%`; return i; })())));
  const passivo = (b.passivoCirculante || 0) + (b.passivoNaoCirculante || 0) + (b.patrimonioLiquido || 0) || b.ativoTotal;
  return el('div', { class: 'grade-2 grade-2--folgada' },
    el('div', { class: 'empilha' }, el('h3', { class: 'kicker' }, 'Onde o dinheiro está aplicado'), barra('Caixa e aplicações', (b.caixa || 0) + (b.aplicacoes || 0) || null, b.ativoTotal), barra('Contas a receber', b.contasReceber, b.ativoTotal), barra('Estoques', b.estoques, b.ativoTotal), barra('Imobilizado', b.imobilizado, b.ativoTotal), barra('Intangível', b.intangivel, b.ativoTotal), el('p', { class: 'selo' }, `Ativo total de ${mil(b.ativoTotal)} em ${dataBR(p.fim)}`)),
    el('div', { class: 'empilha' }, el('h3', { class: 'kicker' }, 'De onde o dinheiro veio'), barra('Passivo de curto prazo', b.passivoCirculante, passivo), barra('Passivo de longo prazo', b.passivoNaoCirculante, passivo), barra('Patrimônio líquido', b.patrimonioLiquido, passivo), (b.dividaCP != null || b.dividaLP != null) && el('p', { class: 'legenda' }, `Dívida financeira: ${mil(b.dividaCP)} no curto prazo e ${mil(b.dividaLP)} no longo.`)));
}

const LINHAS_TABELA = [
  ['Receita líquida', 'receita', 'mil'], ['Lucro bruto', 'lucroBruto', 'mil'], ['EBIT', 'ebit', 'mil'], ['EBITDA', 'ebitda', 'mil'], ['Lucro líquido', 'lucroLiquido', 'mil'],
  ['Margem bruta', 'margemBruta', 'pct'], ['Margem EBITDA', 'margemEbitda', 'pct'], ['Margem líquida', 'margemLiquida', 'pct'],
  ['Caixa operacional', 'fco', 'mil'], ['Investimentos (capex)', 'capex', 'mil'],
];
const LINHAS_UDM = [['ROE', 'roe', 'pct'], ['ROIC', 'roic', 'pct'], ['Dívida líquida', 'dividaLiquida', 'mil'], ['Dívida líquida / EBITDA', 'dividaLiquidaEbitda', 'vezes'], ['Liquidez corrente', 'liquidezCorrente', 'vezes'], ['Patrimônio líquido', 'patrimonioLiquido', 'mil'], ['Ativo total', 'ativoTotal', 'mil']];
export function blocoTabela(d, modo = 'trimestre') {
  const linhas = d.historico.linhas.filter((l) => (modo === 'trimestre' ? l.trimestre?.receita != null || l.trimestre?.lucroLiquido != null : l.meses === 12 && l.udm)).slice(modo === 'trimestre' ? -6 : -5);
  if (!linhas.length) return el('p', { class: 'vazio' }, 'Sem períodos suficientes.');
  const chave = modo === 'trimestre' ? 'trimestre' : 'udm';
  const usa = (k) => linhas.some((l) => l[chave]?.[k] != null);
  const fileira = ([nome, k, f], fonte) => (linhas.some((l) => l[fonte]?.[k] != null) ? el('tr', {}, el('th', { scope: 'row' }, nome), linhas.map((l) => el('td', {}, l[fonte]?.[k] == null ? '—' : FORMATOS[f](l[fonte][k])))) : null);
  const variacoes = modo === 'trimestre' ? [['Receita contra o trimestre anterior', 'trimestral', 'receita'], ['Receita contra o mesmo trimestre do ano anterior', 'anual', 'receitaTri'], ['Lucro contra o mesmo trimestre do ano anterior', 'anual', 'lucroLiquidoTri']] : [['Receita contra o ano anterior', 'anual', 'receita'], ['Lucro contra o ano anterior', 'anual', 'lucroLiquido']];
  return el('div', { class: 'tabela-rolavel' }, el('table', { class: 'tabela tabela--numeros' },
    el('thead', {}, el('tr', {}, el('th', { scope: 'col' }, modo === 'trimestre' ? 'Trimestre' : 'Exercício'), linhas.map((l) => el('th', { scope: 'col' }, modo === 'trimestre' ? trimestre(l.fim) : l.fim.slice(0, 4))))),
    el('tbody', {}, LINHAS_TABELA.filter(([, k]) => usa(k)).map((x) => fileira(x, chave)), LINHAS_UDM.map((x) => fileira(x, 'udm')),
      variacoes.map(([nome, grupo, k]) => (linhas.some((l) => l[grupo]?.[k] != null) ? el('tr', {}, el('th', { scope: 'row' }, nome), linhas.map((l) => el('td', { class: classeSinal(l[grupo]?.[k]) }, l[grupo]?.[k] == null ? '—' : pctSinal(l[grupo][k], 1)))) : null)))));
}

export function blocoPares(d) {
  const pares = d.pares.slice(0, 12);
  if (pares.length < 2) return el('p', { class: 'vazio' }, 'Não há outras companhias do mesmo setor com dados comparáveis.');
  const col = [['Margem EBITDA', 'margemEbitda', 'pct'], ['Margem líquida', 'margemLiquida', 'pct'], ['ROE', 'roe', 'pct'], ['Dív. líq./EBITDA', 'dividaLiquidaEbitda', 'vezes'], ['P/L', 'pl', 'vezes'], ['P/VP', 'pvp', 'vezes'], ['EV/EBITDA', 'evEbitda', 'vezes']].filter(([, k]) => pares.some((p) => p[k] != null));
  const cel = (v, f) => (v == null ? '—' : FORMATOS[f](v));
  return el('div', { class: 'empilha' }, el('div', { class: 'tabela-rolavel' }, el('table', { class: 'tabela tabela--numeros' },
    el('thead', {}, el('tr', {}, el('th', { scope: 'col' }, 'Companhia'), el('th', { scope: 'col' }, 'Receita (12 m)'), col.map(([n]) => el('th', { scope: 'col' }, n)))),
    el('tbody', {}, pares.map((p) => el('tr', {}, el('th', { scope: 'row' }, p.cvm === d.empresa.cvm ? el('strong', {}, p.ticker) : el('a', { href: `#analise/${p.ticker}` }, p.ticker)), el('td', {}, mil(p.receita)), col.map(([, k, f]) => el('td', {}, cel(p[k], f)))))),
    el('tfoot', {}, el('tr', {}, el('th', { scope: 'row' }, 'Mediana do setor'), el('td', {}, ''), col.map(([, k, f]) => el('td', {}, cel(d.medianas[k], f))))))),
    el('p', { class: 'selo' }, `Setor pela classificação da CVM: ${d.empresa.setor}. ${d.numeroPares} pares; a mediana exclui a própria companhia e só aparece com 5 ou mais.${d.preco != null ? ' Múltiplos com o último preço disponível de cada papel.' : ' Sem preços: ligue a nuvem para ver os múltiplos.'}`));
}

export function blocoMultiplos(d) {
  const u = d.historico.ultimo?.udm;
  if (!u || d.preco == null) return el('p', { class: 'vazio' }, 'Sem cotação para este papel. Ligue a nuvem em Ajustes para trazer os preços de fechamento da B3.');
  // Tabela do Stocks: 4 colunas por 3 linhas, lidas por coluna; o que falta aparece como "–".
  const m = (v, f) => (v == null ? null : f(v));
  return el('div', { class: 'empilha' }, tabelaIndicadores([
    ['Preço', brl(d.preco)], ['Valor de mercado', m(u.valorMercado, mil)], ['Valor da firma (EV)', m(u.valorFirma, mil)],
    ['P/L', m(u.pl, (v) => vezes(v, 1))], ['P/VP', m(u.pvp, (v) => vezes(v, 2))], ['EV/EBITDA', m(u.evEbitda, (v) => vezes(v, 1))],
    ['EV/EBIT', m(u.evEbit, (v) => vezes(v, 1))], ['Lucro por ação (12 m)', m(u.lpa, brl)], ['Valor patrimonial por ação', m(u.vpa, brl)],
    ['Lucro sobre o preço', m(u.earningsYield, (v) => pct(v, 1))], ['Proventos pagos sobre o valor de mercado', m(u.dividendYield, (v) => pct(v, 1))], ['Caixa livre sobre o valor de mercado', m(u.fclYield, (v) => pct(v, 1))],
  ], 'Preço e múltiplos'),
    el('p', { class: 'selo' }, [d.fontePreco, d.dataPreco && dataBR(String(d.dataPreco).slice(0, 10)), 'valor de mercado aproximado pelo preço deste papel para todas as ações'].filter(Boolean).join(' · ')));
}

export function paginaEmpresa(d) {
  const e = d.empresa, s = (titulo, corpo, { mist = false, camada = null, intro = null } = {}) => el('section', { class: `secao ${mist ? 'secao--mist' : ''}` }, el('div', { class: 'conteudo' }, camada && el('p', { class: 'selo' }, camada), el('h2', { class: 'titulo' }, titulo), intro && el('p', { class: 'copy introducao' }, intro), corpo));
  let modo = 'trimestre';
  const palcoTabela = el('div', {}, blocoTabela(d, modo));
  const seletor = el('div', { class: 'segmento', role: 'group', 'aria-label': 'Períodos' }, [['trimestre', 'Trimestres'], ['ano', 'Exercícios']].map(([m, n]) => el('button', { type: 'button', 'aria-pressed': String(m === modo), onclick: (ev) => { modo = m; [...seletor.children].forEach((b) => b.setAttribute('aria-pressed', String(b === ev.currentTarget))); palcoTabela.replaceChildren(blocoTabela(d, modo)); } }, n)));
  const naCarteira = lista('ativos').find((a) => e.tickers.includes(a.codigo));
  const ant = d.cotacao?.anterior;
  const variacaoDia = d.preco != null && ant > 0 ? textoVariacao({ v: d.preco / ant - 1, abs: d.preco - ant }) : null;
  return el('div', {},
    el('section', { class: 'secao' }, el('div', { class: 'conteudo' },
      el('p', { class: 'kicker' }, el('a', { href: '#analise' }, 'Análise'), ' · ', e.setor),
      cabecalhoAtivo({ nivel: 1, logo: marca({ cvm: e.cvm, codigo: d.ticker, nome: e.nome, tamanho: 'm' }), ticker: d.ticker, nome: e.nome, mercado: `${e.setor} · B3 · BRL`, preco: d.preco != null ? brl(d.preco) : 'Sem preço', variacao: variacaoDia, contexto: variacaoDia ? 'No dia' : d.preco != null ? 'Último preço' : 'Sem cotação' }).no,
      e.atividade && el('p', { class: 'legenda espaco-topo' }, e.atividade),
      el('div', { class: 'espaco-topo' }, blocoSintese(d)),
      el('div', { class: 'atalhos espaco-topo' }, naCarteira ? el('a', { class: 'pill', href: `#ativo/${naCarteira.id}` }, 'Ver na carteira') : el('a', { class: 'pill', href: '#lancar/novo/acao' }, 'Cadastrar na carteira'), el('a', { class: 'pill', href: `#alertas/novo/${d.ticker}` }, 'Criar alerta')))),
    s('O que os números dizem.', el('ul', { class: 'frases copy' }, d.frases.map((f) => el('li', {}, f))), { mist: true, camada: 'Cálculos do portal sobre dados oficiais' }),
    s('Critérios da síntese.', blocoCriterios(d), { camada: 'Interpretação por regras', intro: 'Cada critério mostra o valor, a leitura e a regra aplicada. A saúde financeira é a média dos grupos de rentabilidade, endividamento, liquidez e caixa.' }),
    s('O que mudou em um ano.', blocoTendencias(d), { mist: true, camada: 'Interpretação por regras', intro: 'Últimos 12 meses contra os 12 meses anteriores.' }),
    s('Evolução.', blocoGraficos(d), { camada: 'Dados oficiais da CVM' }),
    s('Períodos lado a lado.', el('div', { class: 'empilha' }, seletor, palcoTabela, el('p', { class: 'selo' }, `Valores em reais, a partir dos demonstrativos ${e.periodos.some((p) => p.consolidado) ? 'consolidados' : 'individuais'} entregues à CVM (DFP e ITR). Rentabilidade e endividamento usam os últimos 12 meses.`)), { mist: true, camada: 'Dados oficiais da CVM' }),
    s('Estrutura do balanço.', blocoBalanco(d), { camada: 'Dados oficiais da CVM' }),
    s('Preço e múltiplos.', blocoMultiplos(d), { mist: true, camada: 'Cálculos do portal', intro: 'Múltiplos relacionam o preço da ação aos resultados. Sozinhos não dizem se algo está caro ou barato: comparam.' }),
    s('Comparação com o setor.', blocoPares(d), { camada: 'Cálculos do portal sobre dados oficiais' }),
    d.presenca !== undefined ? s('Presença em fundos.', blocoPresenca(d.presenca), { mist: true, camada: 'Dado complementar da CVM', intro: 'Quantos fundos brasileiros tinham o papel e para que lado foi o fluxo no mês de referência.' }) : null,
    el('section', { class: 'secao' }, el('div', { class: 'conteudo' }, el('p', { class: 'selo' }, `Fonte: ${e.fonte}. Último período: ${dataBR(d.historico.ultimo?.fim)}. Coleta de ${dataBR(e.geradoEm.slice(0, 10))}.`), e.site && el('p', { class: 'legenda' }, 'Relações com investidores: ', el('a', { href: /^https?:/.test(e.site) ? e.site : `https://${e.site}`, target: '_blank', rel: 'noopener' }, e.site)))));
}

export async function pagina(ctx, [codigo]) {
  if (codigo === 'enviar') return (await import('./envio.js')).pagina(ctx);
  if (codigo === 'fundos') return (await import('./investidores.js')).pagina(ctx);
  if (codigo) {
    const d = await dossieEmpresa(codigo);
    if (d) d.presenca = await presenca(d.ticker);
    if (!d) throw new Error(`Não encontrei "${codigo}" entre as companhias com ações em bolsa registradas na CVM.`);
    return { titulo: `${d.ticker} · Análise`, no: paginaEmpresa(d) };
  }
  const { empresas } = await indiceEmpresas();
  const busca = el('input', { class: 'campo', type: 'search', placeholder: 'Código ou nome: WEGE3, Petrobras…', 'aria-label': 'Buscar companhia', autocomplete: 'off', autocapitalize: 'none' });
  const resultados = el('ul', { class: 'busca__lista', role: 'listbox' });
  const filtrar = () => {
    const t = semAcento(busca.value.trim());
    if (t.length < 2) { resultados.replaceChildren(); return; }
    const achados = empresas.filter((e) => e.tickers.some((x) => x.toLowerCase().startsWith(t)) || semAcento(e.nome).includes(t)).slice(0, 12);
    resultados.replaceChildren(...achados.map((e) => el('li', {}, el('a', { class: 'busca__item', href: `#analise/${e.tickers[0]}` }, marca({ cvm: e.cvm, codigo: e.tickers[0], nome: e.nome, tamanho: 'p' }), el('span', {}, el('strong', {}, e.tickers.join(' · ')), el('span', { class: 'legenda' }, `${e.nome} · ${e.setor}`))))));
  };
  busca.addEventListener('input', adiar(filtrar, 120));
  busca.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { const primeiro = resultados.querySelector('a'); if (primeiro) location.hash = primeiro.getAttribute('href'); } });
  const minhas = lista('ativos').filter((a) => a.classe === 'acao' && empresas.some((e) => e.tickers.includes(a.codigo)));
  return { titulo: 'Análise', no: el('section', { class: 'secao' }, el('div', { class: 'conteudo' },
    el('header', { class: 'pagina__cabecalho' }, el('p', { class: 'kicker' }, 'Análise fundamentalista'), el('h1', { class: 'titulo' }, 'Os números de uma empresa, lidos com critério.'), el('p', { class: 'copy introducao' }, `Demonstrativos oficiais de ${empresas.length} companhias com ações em bolsa, indicadores calculados pelo portal e uma síntese por regras que você pode conferir uma a uma.`)),
    el('div', { class: 'busca' }, busca, resultados),
    minhas.length ? el('div', { class: 'espaco-topo empilha' }, el('h2', { class: 'kicker' }, 'Da sua carteira'), el('div', { class: 'atalhos' }, minhas.map((a) => el('a', { class: 'pill', href: `#analise/${a.codigo}` }, a.codigo)))) : null,
    el('div', { class: 'escolhas espaco-topo' }, el('a', { class: 'escolha', href: '#analise/enviar' }, el('span', { class: 'escolha__nome' }, 'Enviar um demonstrativo'), el('span', { class: 'legenda' }, 'Para empresas fora da lista ou resultados ainda não publicados na CVM: envie o PDF ou digite os valores.')), el('a', { class: 'escolha', href: '#analise/fundos' }, el('span', { class: 'escolha__nome' }, 'O que os fundos carregam'), el('span', { class: 'legenda' }, 'Posições e movimentações em ações declaradas pelos fundos brasileiros à CVM, com a defasagem indicada.'))))) };
}

// Simuladores e gráficos interativos. Cada simulador é uma função que devolve um elemento; a
// página #simuladores lista todos, e os artigos embutem os seus com ":::simulador nome".
// Os cálculos vêm do motor (assets/js/calculo), o mesmo usado na carteira e no agente.
import { el, brl, brl0, pct, numero, lerNumero, adiar, dataBR, mesAno } from '../util.js';
import { moldura, graficoLinhas, graficoBarras, graficoResultado } from '../graficos.js';
import { indicadores, serieBCB, tesouro } from '../dados.js';
import * as rf from '../calculo/rendafixa.js';
import * as op from '../calculo/opcoes.js';

// ---- Peças de formulário ----
function campo({ rotulo, valor, sufixo = '', passo = 'any', min = null, dica = null }) {
  const input = el('input', { class: 'campo', type: 'text', inputmode: 'decimal', value: String(valor).replace('.', ','), autocomplete: 'off', 'aria-label': rotulo });
  const no = el('label', { class: 'rotulo' }, el('span', {}, rotulo), sufixo ? el('span', { class: 'campo--sufixo' }, input, el('span', {}, sufixo)) : input, dica && el('span', { class: 'legenda' }, dica));
  return { no, input, ler: () => { const v = lerNumero(input.value); return v == null || (min != null && v < min) ? null : v; } };
}
function selecao({ rotulo, opcoes, valor }) {
  const select = el('select', { class: 'campo', 'aria-label': rotulo }, opcoes.map(([v, t]) => el('option', { value: v, selected: v === valor }, t)));
  return { no: el('label', { class: 'rotulo' }, el('span', {}, rotulo), el('span', { class: 'seletor' }, select)), input: select, ler: () => select.value };
}
const resultado = (rotulo, valor, apoio = null) => el('div', {}, el('dt', {}, rotulo), el('dd', {}, valor, apoio && el('small', {}, apoio)));

// Monta o cartão: campos em cima, saída embaixo; recalcula a cada digitação.
function simulador({ titulo, campos, calcular, nota = null }) {
  const saida = el('div', { class: 'simulador__saida', 'aria-live': 'polite' });
  const lista = Object.values(campos);
  const atualizar = () => {
    const v = Object.fromEntries(Object.entries(campos).map(([k, c]) => [k, c.ler()]));
    if (Object.values(v).some((x) => x == null || x === '')) { saida.replaceChildren(el('p', { class: 'legenda' }, 'Preencha os campos com números válidos.')); return; }
    try { saida.replaceChildren(...[calcular(v)].flat().filter(Boolean)); } catch (e) { saida.replaceChildren(el('p', { class: 'legenda' }, e.message)); }
  };
  const lento = adiar(atualizar);
  lista.forEach((c) => { c.input.addEventListener('input', lento); c.input.addEventListener('change', atualizar); });
  const no = el('section', { class: 'simulador', 'aria-label': titulo },
    el('h3', { class: 'kicker' }, titulo),
    el('div', { class: 'simulador__campos' }, lista.map((c) => c.no)), saida,
    nota && el('p', { class: 'legenda' }, nota));
  atualizar();
  return no;
}

// ---- Simuladores ----
function jurosCompostos(ind) {
  const cdi = ind?.cdiAnual?.valor ?? 12;
  return simulador({
    titulo: 'Juros compostos com aportes',
    campos: {
      inicial: campo({ rotulo: 'Valor inicial', valor: 1000, sufixo: 'R$', min: 0 }),
      aporte: campo({ rotulo: 'Aporte mensal', valor: 500, sufixo: 'R$', min: 0 }),
      taxa: campo({ rotulo: 'Taxa de juros', valor: cdi, sufixo: '% a.a.' }),
      anos: campo({ rotulo: 'Prazo', valor: 10, sufixo: 'anos', min: 0.1 }),
    },
    calcular: ({ inicial, aporte, taxa, anos }) => {
      const meses = Math.round(anos * 12);
      const r = rf.jurosCompostos({ inicial, aporteMensal: aporte, taxaAnual: taxa / 100, meses });
      const g = moldura('Evolução do saldo: total investido e juros acumulados');
      const passo = Math.max(1, Math.round(meses / 60));
      const ev = r.evolucao.filter((e, i) => i % passo === 0 || i === meses);
      graficoLinhas(g.canvas, {
        rotulos: ev.map((e) => (e.mes % 12 === 0 ? `${e.mes / 12} a` : '')),
        series: [{ nome: 'Saldo', cor: '--cor-link', valores: ev.map((e) => e.saldo), area: '--cor-neutro-area' }, { nome: 'Investido', cor: '--cor-texto-2', valores: ev.map((e) => e.investido), tracejado: true }],
        formato: brl0, formatoEixo: (v) => brl0(v),
      });
      return [
        el('dl', { class: 'resultados' }, resultado('Saldo final', brl0(r.saldo)), resultado('Total investido', brl0(r.investido)), resultado('Juros', brl0(r.juros), `${pct(r.saldo ? r.juros / r.saldo : 0, 0)} do saldo`)),
        g.no,
      ];
    },
    nota: `Projeção com taxa constante, sem impostos nem inflação. A taxa inicial é o CDI de hoje (${numero(cdi, 2)}% a.a.); troque pelo cenário que quiser.`,
  });
}

function juroReal(ind) {
  return simulador({
    titulo: 'Juro real',
    campos: {
      nominal: campo({ rotulo: 'Taxa nominal', valor: ind?.selicMeta?.valor ?? 12, sufixo: '% a.a.' }),
      inflacao: campo({ rotulo: 'Inflação', valor: ind?.ipca12m?.valor ?? 4.5, sufixo: '% a.a.' }),
    },
    calcular: ({ nominal, inflacao }) => {
      const real = rf.taxaReal(nominal / 100, inflacao / 100);
      return el('dl', { class: 'resultados' }, resultado('Juro real', pct(real), 'ganho acima da inflação'), resultado('Conta errada (subtração)', pct((nominal - inflacao) / 100), 'aproximação que piora com taxas altas'));
    },
    nota: 'Juro real = (1 + taxa nominal) ÷ (1 + inflação) − 1.',
  });
}

function rendaFixa(ind) {
  const cdi = ind?.cdiAnual?.valor ?? 12;
  return simulador({
    titulo: 'Comparador de renda fixa',
    campos: {
      valor: campo({ rotulo: 'Valor aplicado', valor: 10000, sufixo: 'R$', min: 1 }),
      meses: campo({ rotulo: 'Prazo', valor: 24, sufixo: 'meses', min: 1 }),
      cdi: campo({ rotulo: 'CDI no período', valor: cdi, sufixo: '% a.a.' }),
      cdb: campo({ rotulo: 'CDB', valor: 105, sufixo: '% do CDI', min: 0 }),
      lci: campo({ rotulo: 'LCI ou LCA', valor: 90, sufixo: '% do CDI', min: 0 }),
    },
    calcular: ({ valor, meses, cdi: taxa, cdb, lci }) => {
      const du = Math.round(meses * 21), dc = Math.round(meses * 30.4375), i = taxa / 100;
      const itens = [
        ['CDB', rf.projetar({ tipo: 'pos', valor, percentual: cdb / 100, indexador: i, diasUteis: du, diasCorridos: dc })],
        ['LCI ou LCA', rf.projetar({ tipo: 'pos', valor, percentual: lci / 100, indexador: i, diasUteis: du, diasCorridos: dc, isento: true })],
        ['Tesouro Selic', rf.projetar({ tipo: 'pos', valor, percentual: 1, indexador: i, diasUteis: du, diasCorridos: dc })],
      ];
      if (ind?.poupancaMes) { const bruto = valor * (1 + ind.poupancaMes.valor / 100) ** meses; itens.push(['Poupança', { bruto, liquido: bruto, ir: 0, iof: 0, aliquotaIR: 0, taxaLiquidaAnual: (bruto / valor) ** (12 / meses) - 1 }]); }
      const melhor = Math.max(...itens.map(([, r]) => r.liquido));
      const g = moldura('Valor líquido no resgate, por aplicação', 'grafico--baixo');
      graficoBarras(g.canvas, { rotulos: itens.map(([n]) => n), series: [{ nome: 'Líquido', valores: itens.map(([, r]) => r.liquido - valor), cores: itens.map(([, r]) => (r.liquido === melhor ? '--cor-link' : '--cor-grafico-previsto')) }], formato: brl, formatoEixo: brl0, horizontal: true });
      return [
        el('div', { class: 'tabela-rolavel' }, el('table', { class: 'tabela tabela--numeros' },
          el('thead', {}, el('tr', {}, ['Aplicação', 'Bruto', 'IR', 'Líquido', 'Líquido a.a.'].map((t) => el('th', { scope: 'col' }, t)))),
          el('tbody', {}, itens.map(([n, r]) => el('tr', {}, el('th', { scope: 'row' }, n), el('td', {}, brl(r.bruto)), el('td', {}, r.ir ? `${brl(r.ir)} (${pct(r.aliquotaIR, 1)})` : 'isento'), el('td', {}, el('strong', {}, brl(r.liquido))), el('td', {}, pct(r.taxaLiquidaAnual))))))),
        el('p', { class: 'legenda' }, 'Rendimento líquido acima do valor aplicado:'), g.no,
      ];
    },
    nota: 'Supõe CDI constante no período e resgate no vencimento. O Tesouro Selic não inclui a taxa de custódia da B3 nem o ágio ou deságio do dia. A poupança usa o rendimento mensal mais recente.',
  });
}

function equivalencia() {
  return simulador({
    titulo: 'LCI ou CDB: quanto um precisa pagar para empatar com o outro',
    campos: {
      taxa: campo({ rotulo: 'Taxa da LCI ou LCA', valor: 90, sufixo: '% do CDI', min: 0 }),
      meses: campo({ rotulo: 'Prazo', valor: 12, sufixo: 'meses', min: 1 }),
    },
    calcular: ({ taxa, meses }) => {
      const dc = Math.round(meses * 30.4375);
      return el('dl', { class: 'resultados' }, resultado('CDB equivalente', `${numero(rf.equivalenteTributado(taxa, dc), 1)}% do CDI`, `com IR de ${pct(rf.aliquotaIR(dc), 1)} no prazo`), resultado('Alíquota de IR no prazo', pct(rf.aliquotaIR(dc), 1), `${dc} dias corridos`));
    },
    nota: 'Aproximação válida para títulos do mesmo indexador e do mesmo prazo: taxa isenta ÷ (1 − alíquota de IR).',
  });
}

function marcacao() {
  return simulador({
    titulo: 'Marcação a mercado de um prefixado',
    campos: {
      compra: campo({ rotulo: 'Taxa na compra', valor: 13, sufixo: '% a.a.' }),
      atual: campo({ rotulo: 'Taxa de mercado hoje', valor: 14, sufixo: '% a.a.' }),
      anos: campo({ rotulo: 'Prazo até o vencimento', valor: 3, sufixo: 'anos', min: 0.1 }),
    },
    calcular: ({ compra, atual, anos }) => {
      const m = rf.marcacaoMercado({ taxaCompra: compra / 100, taxaAtual: atual / 100, diasUteisRestantes: Math.round(anos * 252) });
      const taxas = Array.from({ length: 21 }, (_, i) => compra - 5 + i * 0.5).filter((t) => t > 0);
      const g = moldura('Variação do preço conforme a taxa de mercado', 'grafico--baixo');
      graficoLinhas(g.canvas, { rotulos: taxas.map((t) => `${numero(t, 1)}%`), series: [{ nome: 'Variação do preço', cor: '--cor-link', valores: taxas.map((t) => rf.marcacaoMercado({ taxaCompra: compra / 100, taxaAtual: t / 100, diasUteisRestantes: Math.round(anos * 252) }).variacao * 100) }], formato: (v) => `${numero(v, 1)}%` });
      return [
        el('dl', { class: 'resultados' }, resultado('Variação do preço', el('span', { class: m.variacao >= 0 ? 'alta' : 'baixa' }, pct(m.variacao)), 'se vender hoje, antes do vencimento'), resultado('Preço pela taxa da compra', brl(m.naCurva)), resultado('Preço de mercado', brl(m.aMercado))),
        g.no,
      ];
    },
    nota: 'Título prefixado sem cupom, de valor nominal R$ 1.000. Quem leva o título ao vencimento recebe a taxa contratada, qualquer que seja o caminho do preço.',
  });
}

function objetivo(ind) {
  return simulador({
    titulo: 'Quanto investir por mês para chegar a um objetivo',
    campos: {
      objetivo: campo({ rotulo: 'Objetivo', valor: 100000, sufixo: 'R$', min: 1 }),
      inicial: campo({ rotulo: 'Já tenho', valor: 5000, sufixo: 'R$', min: 0 }),
      taxa: campo({ rotulo: 'Rentabilidade', valor: Math.max(1, Math.round((ind?.juroRealExPost ?? 0.06) * 1000) / 10), sufixo: '% a.a.' }),
      anos: campo({ rotulo: 'Prazo', valor: 5, sufixo: 'anos', min: 0.1 }),
    },
    calcular: ({ objetivo: alvo, inicial, taxa, anos }) => {
      const meses = Math.round(anos * 12), aporte = rf.aporteParaObjetivo({ objetivo: alvo, inicial, taxaAnual: taxa / 100, meses });
      if (aporte <= 0) return el('p', { class: 'copy' }, 'O valor que você já tem chega ao objetivo sem novos aportes nesse prazo e nessa taxa.');
      return el('dl', { class: 'resultados' }, resultado('Aporte mensal', brl(aporte)), resultado('Você deposita', brl0(inicial + aporte * meses)), resultado('Os juros completam', brl0(alvo - inicial - aporte * meses)));
    },
    nota: 'Use uma rentabilidade real (acima da inflação) para pensar em poder de compra: a sugerida é o juro real de hoje. Valores sem impostos.',
  });
}

function impostoAcoes() {
  return simulador({
    titulo: 'Imposto na venda de ações',
    campos: {
      classe: selecao({ rotulo: 'Operação', opcoes: [['acoes', 'Ações (operação comum)'], ['dayTrade', 'Day trade'], ['fii', 'Fundo imobiliário'], ['etf', 'ETF de renda variável']], valor: 'acoes' }),
      vendas: campo({ rotulo: 'Total vendido no mês', valor: 18000, sufixo: 'R$', min: 0 }),
      lucro: campo({ rotulo: 'Lucro ou prejuízo no mês', valor: 2500, sufixo: 'R$' }),
      prejuizo: campo({ rotulo: 'Prejuízo a compensar', valor: 0, sufixo: 'R$', min: 0 }),
    },
    calcular: ({ classe, vendas, lucro, prejuizo }) => {
      const r = rf.impostoRendaVariavel({ classe, vendasMes: vendas, lucro, prejuizoAcumulado: prejuizo });
      const regra = rf.RENDA_VARIAVEL[classe];
      return el('dl', { class: 'resultados' },
        resultado('Imposto do mês', r.isento ? 'Isento' : brl(r.imposto), r.isento ? `vendas de até ${brl0(regra.isencaoVendasMes)} no mês` : `${pct(regra.aliquota, 0)} sobre ${brl(r.base)}`),
        resultado('Prejuízo que sobra', brl(r.prejuizoRestante), 'compensa lucros futuros do mesmo tipo'));
    },
    nota: `Regras para pessoa física vigentes em ${dataBR(rf.VIGENCIA)}. Não considera o imposto retido na fonte (0,005% nas operações comuns e 1% no day trade), que é abatido do valor a pagar. O imposto é pago por DARF até o último dia útil do mês seguinte.`,
  });
}

const ESTRUTURAS = {
  compraCall: { nome: 'Compra de call', campos: { strike: ['Strike', 42], premio: ['Prêmio pago', 1.8] } },
  compraPut: { nome: 'Compra de put', campos: { strike: ['Strike', 38], premio: ['Prêmio pago', 1.2] } },
  vendaCoberta: { nome: 'Venda coberta', campos: { precoAtivo: ['Preço de compra da ação', 40], strike: ['Strike da call vendida', 44], premio: ['Prêmio recebido', 1.5] } },
  putProtetora: { nome: 'Put de proteção', campos: { precoAtivo: ['Preço de compra da ação', 40], strike: ['Strike da put', 36], premio: ['Prêmio pago', 1.1] } },
  travaAltaCall: { nome: 'Trava de alta com calls', campos: { strikeCompra: ['Strike comprado', 40], premioCompra: ['Prêmio pago', 2.6], strikeVenda: ['Strike vendido', 44], premioVenda: ['Prêmio recebido', 1.0] } },
  travaBaixaPut: { nome: 'Trava de baixa com puts', campos: { strikeCompra: ['Strike comprado', 40], premioCompra: ['Prêmio pago', 2.2], strikeVenda: ['Strike vendido', 36], premioVenda: ['Prêmio recebido', 0.8] } },
  colar: { nome: 'Colar (put comprada e call vendida)', campos: { precoAtivo: ['Preço de compra da ação', 40], strikePut: ['Strike da put', 36], premioPut: ['Prêmio pago', 1.1], strikeCall: ['Strike da call', 45], premioCall: ['Prêmio recebido', 1.2] } },
};
function payoff(_, args = []) {
  const inicial = ESTRUTURAS[args[0]] ? args[0] : 'vendaCoberta';
  const escolha = selecao({ rotulo: 'Estrutura', opcoes: Object.entries(ESTRUTURAS).map(([k, e]) => [k, e.nome]), valor: inicial });
  const palco = el('div', { class: 'empilha empilha--folgada' });
  const montar = () => {
    const e = ESTRUTURAS[escolha.ler()];
    const campos = Object.fromEntries(Object.entries(e.campos).map(([k, [rotulo, valor]]) => [k, campo({ rotulo, valor, sufixo: 'R$', min: 0 })]));
    campos.quantidade = campo({ rotulo: 'Quantidade', valor: 100, sufixo: 'ações', min: 1 });
    palco.replaceChildren(simulador({
      titulo: e.nome, campos,
      calcular: (v) => {
        const pernas = op.ESTRUTURAS[escolha.ler()](v);
        const ref = v.precoAtivo ?? v.strike ?? v.strikeCompra;
        const a = op.analisarEstrutura(pernas, { precoAtual: ref, faixa: 0.35 });
        const g = moldura('Resultado no vencimento conforme o preço da ação');
        graficoResultado(g.canvas, { pontos: a.curva, formato: brl0, formatoX: (x) => brl(x), marcas: a.equilibrio.map((x) => ({ nome: 'Equilíbrio', x })) });
        const lim = (x, sinal) => (Number.isFinite(x) ? brl(x) : sinal > 0 ? 'Ilimitado' : 'Ilimitada');
        return [
          el('dl', { class: 'resultados' },
            resultado('Ganho máximo', el('span', { class: 'alta' }, lim(a.ganhoMaximo, 1))),
            resultado('Perda máxima', el('span', { class: 'baixa' }, lim(a.perdaMaxima, -1))),
            resultado('Ponto de equilíbrio', a.equilibrio.length ? a.equilibrio.map((x) => brl(x)).join(' e ') : '—'),
            resultado(a.custo >= 0 ? 'Desembolso inicial' : 'Crédito inicial', brl(Math.abs(a.custo)))),
          g.no,
        ];
      },
      nota: 'Resultado no vencimento, sem corretagem, emolumentos e impostos. Antes do vencimento, o valor da estrutura também depende do tempo e da volatilidade.',
    }));
  };
  escolha.input.addEventListener('change', montar);
  montar();
  return el('div', { class: 'empilha empilha--folgada' }, el('div', { class: 'formulario' }, escolha.no), palco);
}

function blackScholes(ind) {
  return simulador({
    titulo: 'Preço teórico e gregas (Black-Scholes)',
    campos: {
      tipo: selecao({ rotulo: 'Tipo', opcoes: [['call', 'Call (compra)'], ['put', 'Put (venda)']], valor: 'call' }),
      S: campo({ rotulo: 'Preço da ação', valor: 40, sufixo: 'R$', min: 0.01 }),
      K: campo({ rotulo: 'Strike', valor: 42, sufixo: 'R$', min: 0.01 }),
      dias: campo({ rotulo: 'Dias até o vencimento', valor: 45, sufixo: 'dias', min: 1 }),
      sigma: campo({ rotulo: 'Volatilidade', valor: 30, sufixo: '% a.a.', min: 0.1 }),
      r: campo({ rotulo: 'Juros', valor: ind?.selicMeta?.valor ?? 12, sufixo: '% a.a.' }),
    },
    calcular: ({ tipo, S, K, dias, sigma, r }) => {
      const p = { tipo, S, K, T: dias / 365, r: Math.log(1 + r / 100), sigma: sigma / 100 };
      const g = op.gregas(p);
      return el('dl', { class: 'resultados' },
        resultado('Preço teórico', brl(op.precoBS(p))),
        resultado('Delta', numero(g.delta, 3), 'variação por R$ 1 na ação'),
        resultado('Gama', numero(g.gama, 4), 'variação do delta'),
        resultado('Theta', brl(g.theta), 'perda por dia que passa'),
        resultado('Vega', brl(g.vega), 'por 1 ponto de volatilidade'),
        resultado('Chance de exercício', pct(g.probabilidadeExercicio, 1), 'pelo modelo, não é garantia'));
    },
    nota: 'O modelo supõe volatilidade e juros constantes e exercício só no vencimento. Serve de referência; o preço de mercado inclui expectativas que o modelo não vê.',
  });
}

function diversificacao() {
  return simulador({
    titulo: 'O efeito da correlação no risco de dois ativos',
    campos: {
      volA: campo({ rotulo: 'Volatilidade do ativo A', valor: 30, sufixo: '% a.a.', min: 0 }),
      volB: campo({ rotulo: 'Volatilidade do ativo B', valor: 20, sufixo: '% a.a.', min: 0 }),
      corr: campo({ rotulo: 'Correlação entre eles', valor: 0.3, sufixo: '−1 a 1' }),
    },
    calcular: ({ volA, volB, corr }) => {
      const c = Math.max(-1, Math.min(1, corr));
      const vol = (w) => Math.sqrt((w * volA) ** 2 + ((1 - w) * volB) ** 2 + 2 * w * (1 - w) * volA * volB * c);
      const pesos = Array.from({ length: 21 }, (_, i) => i / 20);
      const minimo = pesos.reduce((m, w) => (vol(w) < vol(m) ? w : m), 0);
      const g = moldura('Volatilidade da carteira conforme a fatia do ativo A', 'grafico--baixo');
      graficoLinhas(g.canvas, { rotulos: pesos.map((w) => `${Math.round(w * 100)}%`), series: [{ nome: 'Volatilidade da carteira', cor: '--cor-link', valores: pesos.map(vol) }, { nome: 'Média simples das volatilidades', cor: '--cor-texto-2', valores: pesos.map((w) => w * volA + (1 - w) * volB), tracejado: true }], formato: (v) => `${numero(v, 1)}%` });
      return [
        el('dl', { class: 'resultados' }, resultado('Meio a meio', `${numero(vol(0.5), 1)}%`, `a média simples seria ${numero((volA + volB) / 2, 1)}%`), resultado('Menor risco possível', `${numero(vol(minimo), 1)}%`, `com ${Math.round(minimo * 100)}% em A`)),
        g.no,
      ];
    },
    nota: 'Com correlação abaixo de 1, o risco da carteira fica abaixo da média dos riscos. Correlações mudam com o tempo e costumam subir nas crises.',
  });
}

// ---- Gráficos de séries oficiais ----
async function graficoSelicIpca() {
  const [selic, ipca] = await Promise.all([serieBCB('selic-meta'), serieBCB('ipca-12m')]);
  const meses = ipca.pontos.filter(([d]) => d >= '2012-01-01');
  const selicEm = (d) => { let v = null; for (const [dia, valor] of selic.pontos) { if (dia <= d.slice(0, 8) + '31') v = valor; else break; } return v; };
  const g = moldura('Meta da Selic e IPCA acumulado em 12 meses desde 2012');
  graficoLinhas(g.canvas, { rotulos: meses.map(([d]) => (d.slice(5, 7) === '01' ? d.slice(0, 4) : '')), series: [{ nome: 'Selic (meta)', cor: '--cor-texto', valores: meses.map(([d]) => selicEm(d)), degraus: true }, { nome: 'IPCA em 12 meses', cor: '--cor-alerta', valores: meses.map(([, v]) => v) }], formato: (v) => `${numero(v, 2)}%`, formatoEixo: (v) => `${v}%` });
  return el('figure', { class: 'empilha' }, legenda([['Selic (meta)', 'cor-pago'], ['IPCA em 12 meses', 'cor-apagar']]), g.no, el('figcaption', { class: 'selo' }, `Fonte: Banco Central do Brasil, SGS (séries 432 e 13522) · até ${mesAno(meses[meses.length - 1][0])}`));
}
async function graficoAcumulado(_, args = []) {
  const anos = Number(args[0]) || 10;
  const [cdi, ipca, poup] = await Promise.all([serieBCB('cdi'), serieBCB('ipca'), serieBCB('poupanca')]);
  const inicio = `${new Date().getFullYear() - anos}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`;
  const mesesIpca = ipca.pontos.filter(([d]) => d >= inicio);
  const acum = (pontos) => { let f = 1; const m = new Map(); for (const [d, v] of pontos) { if (d < inicio) continue; f *= 1 + v / 100; m.set(d.slice(0, 7), f); } return m; };
  const a = { cdi: acum(cdi.pontos), ipca: acum(ipca.pontos), poup: acum(poup.pontos) };
  const rot = mesesIpca.map(([d]) => d.slice(0, 7));
  const g = moldura(`R$ 100 aplicados há ${anos} anos: CDI, poupança e inflação`);
  graficoLinhas(g.canvas, { rotulos: rot.map((m) => (m.slice(5) === '01' ? m.slice(0, 4) : '')), series: [{ nome: 'CDI', cor: '--cor-link', valores: rot.map((m) => (a.cdi.get(m) ?? null) && a.cdi.get(m) * 100) }, { nome: 'Poupança', cor: '--cor-grafico-previsto', valores: rot.map((m) => (a.poup.get(m) ?? null) && a.poup.get(m) * 100) }, { nome: 'IPCA', cor: '--cor-alerta', valores: rot.map((m) => (a.ipca.get(m) ?? null) && a.ipca.get(m) * 100) }], formato: brl, formatoEixo: brl0 });
  return el('figure', { class: 'empilha' }, legenda([['CDI', 'cor-link'], ['Poupança', 'cor-previsto'], ['IPCA (inflação)', 'cor-apagar']]), g.no, el('figcaption', { class: 'selo' }, `R$ 100 em ${mesAno(inicio)}, valores brutos. Fonte: Banco Central do Brasil, SGS (séries 12, 196 e 433)`));
}
async function graficoDolar() {
  const d = await serieBCB('dolar');
  const pontos = d.pontos.filter(([dia]) => dia >= `${new Date().getFullYear() - 5}-01-01`).filter((_, i) => i % 5 === 0);
  const g = moldura('Dólar comercial nos últimos cinco anos');
  graficoLinhas(g.canvas, { rotulos: pontos.map(([dia], i) => (i % 50 === 0 ? dia.slice(0, 4) : '')), series: [{ nome: 'Dólar (PTAX venda)', cor: '--cor-texto', valores: pontos.map(([, v]) => v) }], formato: (v) => `R$ ${numero(v, 4)}`, formatoEixo: (v) => `R$ ${numero(v, 2)}` });
  return el('figure', { class: 'empilha' }, g.no, el('figcaption', { class: 'selo' }, `Fonte: Banco Central do Brasil, SGS (série 1) · até ${dataBR(d.pontos[d.pontos.length - 1][0])}`));
}
async function tabelaTesouro() {
  const t = await tesouro();
  const titulos = t.titulos.filter((x) => x.disponivelCompra);
  return el('figure', { class: 'empilha' },
    el('div', { class: 'tabela-rolavel' }, el('table', { class: 'tabela tabela--numeros' },
      el('thead', {}, el('tr', {}, ['Título', 'Vencimento', 'Taxa (a.a.)', 'Preço unitário'].map((x) => el('th', { scope: 'col' }, x)))),
      el('tbody', {}, titulos.map((x) => el('tr', {}, el('th', { scope: 'row' }, x.nome), el('td', {}, dataBR(x.vencimento)), el('td', {}, `${x.indexador === 'selic' ? 'Selic + ' : x.indexador === 'ipca' ? 'IPCA + ' : ''}${numero(x.taxaCompra, 2)}%`), el('td', {}, brl(x.puCompra))))))),
    el('figcaption', { class: 'selo' }, `Títulos à venda em ${dataBR(t.dataBase)}, referência da manhã. Fonte: Tesouro Nacional, Tesouro Transparente`));
}
const legenda = (itens) => el('p', { class: 'legenda legenda-grafico' }, itens.map(([nome, classe]) => el('span', { class: classe }, nome)));

export const SIMULADORES = {
  'juros-compostos': { titulo: 'Juros compostos', resumo: 'Aportes mensais, taxa e prazo: quanto do saldo final vem dos juros.', montar: jurosCompostos },
  objetivo: { titulo: 'Aporte para um objetivo', resumo: 'Quanto guardar por mês para chegar a um valor em um prazo.', montar: objetivo },
  'juro-real': { titulo: 'Juro real', resumo: 'O ganho acima da inflação, pela conta certa.', montar: juroReal },
  'renda-fixa': { titulo: 'Comparador de renda fixa', resumo: 'CDB, LCI, Tesouro Selic e poupança, já com o imposto de renda.', montar: rendaFixa },
  'lci-cdb': { titulo: 'LCI ou CDB', resumo: 'A taxa que um título tributado precisa pagar para empatar com um isento.', montar: equivalencia },
  'marcacao-mercado': { titulo: 'Marcação a mercado', resumo: 'Por que um prefixado perde valor quando os juros sobem.', montar: marcacao },
  diversificacao: { titulo: 'Diversificação', resumo: 'Como a correlação entre dois ativos muda o risco da carteira.', montar: diversificacao },
  'imposto-acoes': { titulo: 'Imposto em renda variável', resumo: 'Isenção de R$ 20 mil, alíquotas e compensação de prejuízo.', montar: impostoAcoes },
  payoff: { titulo: 'Estruturas com opções', resumo: 'Ganho, perda e ponto de equilíbrio de sete estruturas.', montar: payoff },
  'black-scholes': { titulo: 'Preço de opções e gregas', resumo: 'Preço teórico, delta, gama, theta e vega.', montar: blackScholes },
};
const GRAFICOS = { 'selic-ipca': graficoSelicIpca, acumulado: graficoAcumulado, dolar: graficoDolar, tesouro: tabelaTesouro };

// Usado pelos artigos: devolve o elemento na hora e preenche quando os dados chegam.
export function componente(tipo, nome, args = []) {
  const no = el('div', { class: 'componente' });
  const fabrica = tipo === 'simulador' ? SIMULADORES[nome]?.montar : GRAFICOS[nome];
  if (!fabrica) return null;
  no.append(el('span', { class: 'esqueleto esqueleto--midia' }));
  indicadores().catch(() => null).then((ind) => fabrica(ind, args)).then((conteudo) => no.replaceChildren(conteudo)).catch((e) => no.replaceChildren(el('p', { class: 'legenda' }, `Não foi possível carregar este componente: ${e.message}`)));
  return no;
}

export async function pagina(ctx, [nome]) {
  const ind = await indicadores().catch(() => null);
  if (nome && SIMULADORES[nome]) {
    const s = SIMULADORES[nome];
    return { titulo: s.titulo, no: el('section', { class: 'secao' }, el('div', { class: 'conteudo conteudo--estreito' },
      el('header', { class: 'pagina__cabecalho' }, el('p', { class: 'kicker' }, el('a', { href: '#simuladores' }, 'Simuladores')), el('h1', { class: 'titulo' }, `${s.titulo}.`), el('p', { class: 'copy introducao' }, s.resumo)),
      await s.montar(ind, []))) };
  }
  return { titulo: 'Simuladores', no: el('section', { class: 'secao' }, el('div', { class: 'conteudo' },
    el('header', { class: 'pagina__cabecalho' }, el('p', { class: 'kicker' }, 'Simuladores'), el('h1', { class: 'titulo' }, 'Faça as contas.'), el('p', { class: 'copy introducao' }, 'Calculadoras com as mesmas fórmulas usadas na carteira. Os valores iniciais vêm dos indicadores oficiais do dia; troque pelo seu cenário.')),
    el('div', { class: 'escolhas' }, Object.entries(SIMULADORES).map(([id, s]) => el('a', { class: 'escolha', href: `#simuladores/${id}`, 'data-subir': true }, el('span', { class: 'escolha__nome' }, s.titulo), el('span', { class: 'legenda' }, s.resumo)))))) };
}

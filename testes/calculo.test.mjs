// Testes do motor de cálculo. Rodar: node --test "testes/*.test.mjs"
// Os valores de referência vêm de fórmulas fechadas ou de exemplos clássicos da literatura.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as est from '../Portal/assets/js/calculo/estatistica.js';
import * as rf from '../Portal/assets/js/calculo/rendafixa.js';
import * as op from '../Portal/assets/js/calculo/opcoes.js';

const perto = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} ≉ ${b} (tolerância ${tol})`);

test('estatística básica', () => {
  const v = [2, 4, 4, 4, 5, 5, 7, 9];
  perto(est.media(v), 5);
  perto(est.variancia(v), 32 / 7);
  perto(est.correlacao([1, 2, 3, 4], [2, 4, 6, 8]), 1);
  perto(est.correlacao([1, 2, 3, 4], [8, 6, 4, 2]), -1);
  perto(est.percentil([1, 2, 3, 4, 5], 0.5), 3);
  perto(est.percentil([1, 2, 3, 4], 0.5), 2.5);
});

test('retornos, volatilidade e drawdown', () => {
  const p = [100, 110, 99, 120, 90, 108];
  const r = est.retornos(p);
  perto(r[0], 0.1); perto(r[1], -0.1);
  perto(est.retornoTotal(p), 0.08);
  const dd = est.drawdownMaximo(p);
  perto(dd.valor, 90 / 120 - 1);
  assert.equal(dd.inicio, 3); assert.equal(dd.fim, 4);
  perto(est.volatilidade([0.01, -0.01, 0.01, -0.01]), est.desvioPadrao([0.01, -0.01, 0.01, -0.01]) * Math.sqrt(252));
  assert.equal(est.drawdownMaximo([1, 2, 3]).valor, 0);
});

test('médias móveis e IFR', () => {
  assert.deepEqual(est.mediaMovel([1, 2, 3, 4, 5], 3), [null, null, 2, 3, 4]);
  const mme = est.mediaMovelExponencial([1, 2, 3, 4, 5], 3);
  perto(mme[2], 2); perto(mme[3], 3); perto(mme[4], 4);
  assert.equal(est.ifr(Array.from({ length: 30 }, (_, i) => 10 + i), 14), 100);
  perto(est.ifr(Array.from({ length: 30 }, (_, i) => 100 - i), 14), 0);
  const alternado = Array.from({ length: 60 }, (_, i) => 100 + (i % 2));
  assert.ok(Math.abs(est.ifr(alternado, 14) - 50) < 8);
});

test('beta, regressão e matrizes', () => {
  const indice = [0.01, -0.02, 0.015, 0.003, -0.007];
  perto(est.beta(indice.map((x) => 2 * x), indice), 2);
  const reg = est.regressao([1, 2, 3, 4], [3, 5, 7, 9]);
  perto(reg.inclinacao, 2); perto(reg.intercepto, 1); perto(reg.r2, 1);
  const m = est.matrizCorrelacao([indice, indice.map((x) => -x)]);
  perto(m[0][1], -1); perto(m[0][0], 1);
});

test('alinhamento de séries por data', () => {
  const a = [{ data: '2026-01-02', valor: 1 }, { data: '2026-01-05', valor: 2 }, { data: '2026-01-06', valor: 3 }];
  const b = [{ data: '2026-01-05', valor: 20 }, { data: '2026-01-06', valor: 30 }, { data: '2026-01-07', valor: 40 }];
  assert.deepEqual(est.alinhar([a, b]), { datas: ['2026-01-05', '2026-01-06'], valores: [[2, 3], [20, 30]] });
});

test('simulação é reprodutível com a mesma semente', () => {
  const rnd = est.aleatorio(7);
  const rets = Array.from({ length: 300 }, () => est.normalPadrao(rnd) * 0.01 + 0.0004);
  const a = est.simularCenarios(rets, { horizonte: 60, simulacoes: 500, semente: 3 });
  const b = est.simularCenarios(rets, { horizonte: 60, simulacoes: 500, semente: 3 });
  assert.deepEqual(a, b);
  assert.ok(a.p5 < a.mediana && a.mediana < a.p95);
  assert.ok(a.probabilidadePerda > 0 && a.probabilidadePerda < 1);
  assert.equal(est.simularCenarios([0.01, 0.02]), null);
});

test('VaR e CVaR históricos', () => {
  const rets = Array.from({ length: 100 }, (_, i) => (i - 50) / 1000);
  perto(est.varHistorico(rets, 0.95), 0.04505, 1e-4);
  assert.ok(est.cvarHistorico(rets, 0.95) > est.varHistorico(rets, 0.95));
});

test('tabela regressiva do IR e IOF', () => {
  assert.equal(rf.aliquotaIR(1), 0.225); assert.equal(rf.aliquotaIR(180), 0.225);
  assert.equal(rf.aliquotaIR(181), 0.20); assert.equal(rf.aliquotaIR(360), 0.20);
  assert.equal(rf.aliquotaIR(361), 0.175); assert.equal(rf.aliquotaIR(720), 0.175);
  assert.equal(rf.aliquotaIR(721), 0.15);
  assert.equal(rf.aliquotaIOF(1), 0.96); assert.equal(rf.aliquotaIOF(15), 0.50);
  assert.equal(rf.aliquotaIOF(29), 0.03); assert.equal(rf.aliquotaIOF(30), 0);
});

test('conversão de taxas e taxa real', () => {
  perto(rf.mensalParaAnual(rf.anualParaMensal(0.1365)), 0.1365);
  perto(rf.diariaParaAnual(rf.anualParaDiaria(0.1365)), 0.1365);
  perto(rf.taxaReal(0.1365, 0.0463), 1.1365 / 1.0463 - 1);
});

test('projeção de CDB e de LCI', () => {
  // CDB a 100% de um CDI de 12% a.a. por 252 dias úteis (366 dias corridos): bruto de 12%, IR de 17,5%.
  const cdb = rf.projetar({ tipo: 'pos', valor: 1000, percentual: 1, indexador: 0.12, diasUteis: 252, diasCorridos: 366 });
  perto(cdb.bruto, 1120, 1e-6);
  perto(cdb.ir, 120 * 0.175, 1e-6);
  perto(cdb.liquido, 1120 - 21, 1e-6);
  const lci = rf.projetar({ tipo: 'pos', valor: 1000, percentual: 0.9, indexador: 0.12, diasUteis: 252, diasCorridos: 366, isento: true });
  assert.equal(lci.ir, 0);
  assert.ok(lci.liquido > cdb.liquido);
  const pre = rf.projetar({ tipo: 'pre', valor: 1000, taxa: 0.14, diasUteis: 504, diasCorridos: 731 });
  perto(pre.bruto, 1000 * 1.14 ** 2, 1e-6);
  assert.equal(pre.aliquotaIR, 0.15);
  const ipca = rf.projetar({ tipo: 'ipca', valor: 1000, taxa: 0.07, inflacao: 0.045, diasUteis: 252, diasCorridos: 365 });
  perto(ipca.bruto, 1000 * 1.045 * 1.07, 1e-6);
});

test('resgate com menos de 30 dias paga IOF antes do IR', () => {
  const r = rf.liquidar(1000, 1010, 10);
  perto(r.iof, 10 * 0.66);
  perto(r.ir, (10 - 6.6) * 0.225);
  perto(r.liquido, 1010 - 6.6 - 3.4 * 0.225);
});

test('acúmulo do indexador pela série diária', () => {
  const serie = [
    { data: '2026-11-10', valor: 0.05 }, { data: '2026-11-11', valor: 0.05 },
    { data: '2026-11-12', valor: 0.05 }, { data: '2026-11-13', valor: 0.05 },
  ];
  const a = rf.acumularIndexador(serie, '2026-11-10', '2026-11-13', 1.1);
  assert.equal(a.diasUteis, 3);
  perto(a.fator, (1 + 0.0005 * 1.1) ** 3, 1e-12);
});

test('equivalência entre título isento e tributado', () => {
  perto(rf.equivalenteTributado(0.9, 400), 0.9 / 0.825);
  perto(rf.equivalenteIsento(rf.equivalenteTributado(0.9, 800), 800), 0.9);
});

test('juros compostos e aporte para objetivo', () => {
  const j = rf.jurosCompostos({ inicial: 1000, aporteMensal: 0, taxaAnual: 0.12, meses: 12 });
  perto(j.saldo, 1120, 1e-6);
  const aporte = rf.aporteParaObjetivo({ objetivo: 100000, inicial: 5000, taxaAnual: 0.1, meses: 60 });
  const conf = rf.jurosCompostos({ inicial: 5000, aporteMensal: aporte, taxaAnual: 0.1, meses: 60 });
  perto(conf.saldo, 100000, 1e-4);
});

test('prefixado: preço, marcação a mercado e duration', () => {
  perto(rf.precoPrefixado(0.1, 252), 1000 / 1.1);
  const m = rf.marcacaoMercado({ taxaCompra: 0.12, taxaAtual: 0.14, diasUteisRestantes: 756 });
  assert.ok(m.variacao < 0);
  perto(m.variacao, (1.12 / 1.14) ** 3 - 1, 1e-9);
  const d = rf.duration([{ prazoAnos: 3, valor: 1000 }], 0.1);
  perto(d.macaulay, 3); perto(d.modificada, 3 / 1.1);
});

test('imposto de renda variável', () => {
  assert.equal(rf.impostoRendaVariavel({ classe: 'acoes', vendasMes: 20000, lucro: 3000 }).isento, true);
  const t = rf.impostoRendaVariavel({ classe: 'acoes', vendasMes: 20000.01, lucro: 3000, prejuizoAcumulado: 1000 });
  perto(t.imposto, 2000 * 0.15); assert.equal(t.prejuizoRestante, 0);
  perto(rf.impostoRendaVariavel({ classe: 'fii', vendasMes: 5000, lucro: 1000 }).imposto, 200);
  assert.equal(rf.impostoRendaVariavel({ classe: 'acoes', vendasMes: 50000, lucro: -500, prejuizoAcumulado: 100 }).prejuizoRestante, 600);
});

test('Black-Scholes: exemplo clássico (Hull) e paridade put-call', () => {
  // Hull, "Options, Futures and Other Derivatives": S=42, K=40, r=10%, sigma=20%, T=0,5 → c=4,76; p=0,81.
  const base = { S: 42, K: 40, T: 0.5, r: 0.1, sigma: 0.2 };
  const c = op.precoBS({ tipo: 'call', ...base }), p = op.precoBS({ tipo: 'put', ...base });
  perto(c, 4.76, 0.005); perto(p, 0.81, 0.005);
  perto(c - p, 42 - 40 * Math.exp(-0.05), 1e-6);
  perto(op.acumuladaNormal(0), 0.5, 1e-7); perto(op.acumuladaNormal(1.96), 0.975, 1e-4);
});

test('gregas coerentes com diferenças finitas', () => {
  const b = { tipo: 'call', S: 50, K: 52, T: 0.25, r: 0.13, sigma: 0.35 };
  const g = op.gregas(b), h = 0.01;
  const delta = (op.precoBS({ ...b, S: b.S + h }) - op.precoBS({ ...b, S: b.S - h })) / (2 * h);
  perto(g.delta, delta, 1e-4);
  const vega = op.precoBS({ ...b, sigma: b.sigma + 0.01 }) - op.precoBS({ ...b, sigma: b.sigma });
  perto(g.vega, vega, 2e-3);
  const theta = op.precoBS({ ...b, T: b.T - 1 / 365 }) - op.precoBS(b);
  perto(g.theta, theta, 2e-3);
  const put = op.gregas({ ...b, tipo: 'put' });
  perto(g.delta - put.delta, 1, 1e-6);
  perto(g.probabilidadeExercicio + put.probabilidadeExercicio, 1, 1e-6);
});

test('volatilidade implícita recupera a volatilidade usada no preço', () => {
  const b = { tipo: 'put', S: 30, K: 28, T: 0.2, r: 0.13 };
  const preco = op.precoBS({ ...b, sigma: 0.42 });
  perto(op.volatilidadeImplicita({ ...b, preco }), 0.42, 1e-4);
  assert.equal(op.volatilidadeImplicita({ tipo: 'call', S: 30, K: 20, T: 0.2, r: 0.13, preco: 1 }), null);
});

test('estruturas: payoff, equilíbrio, ganho e perda máximos', () => {
  const coberta = op.analisarEstrutura(op.ESTRUTURAS.vendaCoberta({ precoAtivo: 40, strike: 44, premio: 1.5, quantidade: 100 }), { precoAtual: 40 });
  perto(coberta.ganhoMaximo, (44 - 40 + 1.5) * 100, 1e-6);
  perto(coberta.perdaMaxima, -(40 - 1.5) * 100, 1e-6);
  perto(coberta.equilibrio[0], 38.5, 0.011);
  const trava = op.analisarEstrutura(op.ESTRUTURAS.travaAltaCall({ strikeCompra: 40, premioCompra: 3, strikeVenda: 45, premioVenda: 1, quantidade: 100 }), { precoAtual: 41 });
  perto(trava.ganhoMaximo, 300, 1e-6); perto(trava.perdaMaxima, -200, 1e-6); perto(trava.custo, 200, 1e-9);
  perto(trava.equilibrio[0], 42, 0.011);
  const call = op.analisarEstrutura(op.ESTRUTURAS.compraCall({ strike: 40, premio: 2 }), { precoAtual: 40 });
  assert.equal(call.ganhoMaximo, Infinity); perto(call.perdaMaxima, -200, 1e-6);
  const descoberta = op.analisarEstrutura([{ tipo: 'call', lado: 'venda', strike: 40, premio: 2, quantidade: 100 }], { precoAtual: 40 });
  assert.equal(descoberta.perdaMaxima, -Infinity);
  const protetora = op.analisarEstrutura(op.ESTRUTURAS.putProtetora({ precoAtivo: 40, strike: 36, premio: 1, quantidade: 100 }), { precoAtual: 40 });
  perto(protetora.perdaMaxima, -(40 - 36 + 1) * 100, 1e-6); assert.equal(protetora.ganhoMaximo, Infinity);
});

test('códigos de opções da B3', () => {
  assert.deepEqual(op.decodificarTicker('PETRL452'), { ativoBase: 'PETR', tipo: 'call', mes: 12, serie: '452', semanal: null });
  assert.equal(op.decodificarTicker('VALEX60').tipo, 'put');
  assert.equal(op.decodificarTicker('VALEX60').mes, 12);
  assert.equal(op.decodificarTicker('PETR4'), null);
});

// ---- Carteira ----
import * as car from '../Portal/assets/js/calculo/carteira.js';

test('posições: preço médio, venda parcial, custos e proventos', () => {
  const l = [
    { ativo: 'A', data: '2026-01-05', tipo: 'compra', quantidade: 100, preco: 10, custos: 5 },
    { ativo: 'A', data: '2026-02-05', tipo: 'compra', quantidade: 100, preco: 12, custos: 5 },
    { ativo: 'A', data: '2026-03-05', tipo: 'venda', quantidade: 50, preco: 15, custos: 3 },
    { ativo: 'A', data: '2026-03-10', tipo: 'provento', valor: 40 },
  ];
  const [p] = car.posicoes(l);
  perto(p.quantidade, 150);
  perto(p.precoMedio, 2210 / 200);            // (1000 + 5 + 1200 + 5) / 200 = 11,05
  perto(p.realizado, 50 * (15 - 11.05) - 3);  // 194,50
  perto(p.proventos, 40);
  perto(car.posicoes(l, '2026-01-31')[0].quantidade, 100);
});

test('posições: desdobramento, bonificação e venda total', () => {
  const l = [
    { ativo: 'B', data: '2026-01-05', tipo: 'compra', quantidade: 10, preco: 100 },
    { ativo: 'B', data: '2026-02-01', tipo: 'desdobramento', quantidade: 2 },
    { ativo: 'B', data: '2026-03-01', tipo: 'venda', quantidade: 20, preco: 60 },
  ];
  const [p] = car.posicoes(l);
  assert.equal(p.quantidade, 0); perto(p.realizado, 200); perto(p.custo, 0);
});

test('posições vendidas (opção lançada) e recompra', () => {
  const l = [
    { ativo: 'OP', data: '2026-01-05', tipo: 'venda', quantidade: 100, preco: 2, custos: 1 },
    { ativo: 'OP', data: '2026-01-20', tipo: 'compra', quantidade: 40, preco: 1.5, custos: 1 },
  ];
  const [p] = car.posicoes(l);
  perto(p.quantidade, -60); perto(p.precoMedio, 2);
  perto(p.realizado, 40 * 0.5 - 2);
  const av = car.avaliar([p], { OP: { preco: 1, anterior: 1.2 } });
  perto(av.linhas[0].valor, -60); perto(av.linhas[0].lucro, 60); perto(av.linhas[0].rentabilidade, 0.5);
});

test('avaliação, alocação e concentração', () => {
  const pos = car.posicoes([
    { ativo: 'A', data: '2026-01-05', tipo: 'compra', quantidade: 100, preco: 10 },
    { ativo: 'B', data: '2026-01-05', tipo: 'compra', quantidade: 10, preco: 100 },
    { ativo: 'C', data: '2026-01-05', tipo: 'compra', quantidade: 1, preco: 500 },
  ]);
  const av = car.avaliar(pos, { A: { preco: 12, anterior: 11 }, B: { preco: 90, anterior: 90 } });
  perto(av.total, 1200 + 900 + 500); perto(av.custo, 2500); perto(av.lucro, 100);
  assert.equal(av.linhas.find((x) => x.ativo === 'C').semPreco, true);
  perto(av.variacaoDiaValor, 100); perto(av.variacaoDia, 100 / 2500);
  const al = car.alocacao(av.linhas, { A: { classe: 'Ações' }, B: { classe: 'Ações' }, C: { classe: 'Renda fixa' } });
  perto(al[0].participacao, 2100 / 2600);
  perto(car.concentracao([0.7, 0.1, 0.1, 0.1]).efetivo, 1 / 0.52);
  perto(car.concentracao(Array(10).fill(0.1)).efetivo, 10);
});

test('método de cotas: aporte não altera a rentabilidade', () => {
  const hist = { A: [['2026-01-05', 10], ['2026-01-06', 11], ['2026-01-07', 11], ['2026-01-08', 12.1]].map(([data, valor]) => ({ data, valor })) };
  const l = [
    { ativo: 'A', data: '2026-01-05', tipo: 'compra', quantidade: 100, preco: 10 },
    { ativo: 'A', data: '2026-01-07', tipo: 'compra', quantidade: 100, preco: 11 }, // dobra o patrimônio sem ganho
  ];
  const s = car.serieCotas(l, hist);
  perto(s[0].cota, 1); perto(s[1].cota, 1.1); perto(s[2].cota, 1.1); perto(s[3].cota, 1.21);
  perto(s[3].valor, 2420);
});

test('risco da carteira, diversificação e otimização', () => {
  const cov = [[0.0004, 0.0001], [0.0001, 0.0001]]; // variâncias diárias
  const r = car.riscoCarteira([0.5, 0.5], cov);
  perto(r.volatilidade, Math.sqrt((0.25 * 0.0004 + 0.25 * 0.0001 + 0.5 * 0.0001) * 252), 1e-9);
  perto(r.contribuicao[0] + r.contribuicao[1], 1);
  assert.ok(car.diversificacao([0.5, 0.5], cov).beneficio > 0);
  const mv = car.otimizar({ retornosEsperados: [0.1, 0.1], cov, objetivo: 'minimaVariancia' });
  perto(mv.pesos[0] + mv.pesos[1], 1, 1e-6);
  perto(mv.pesos[0], 0, 0.02); // solução analítica: (σb² − cov)/(σa² + σb² − 2cov) = 0
  const sh = car.otimizar({ retornosEsperados: [0.2, 0.1], cov: [[0.0004, 0], [0, 0.0004]], taxaLivre: 0 });
  perto(sh.pesos[0], 2 / 3, 0.02);     // ativos independentes de mesmo risco: peso proporcional ao retorno
  const teto = car.otimizar({ retornosEsperados: [0.3, 0.1, 0.1], cov: [[0.0004, 0, 0], [0, 0.0004, 0], [0, 0, 0.0004]], tetoPorAtivo: 0.4 });
  assert.ok(teto.pesos.every((w) => w <= 0.4 + 1e-6));
  const a = car.otimizar({ retornosEsperados: [0.2, 0.1], cov: [[0.0004, 0], [0, 0.0004]] });
  assert.deepEqual(a.pesos, sh.pesos); // determinístico
});

test('dimensionamento de ordens dentro do orçamento', () => {
  const d = car.dimensionar({ alvos: [{ ativo: 'A', peso: 0.5 }, { ativo: 'B', peso: 0.5 }], precos: { A: 33, B: 47 }, orcamento: 1000 });
  const total = d.ordens.reduce((s, o) => s + o.valor, 0);
  assert.ok(total <= 1000 && d.sobra < 33);
  perto(total + d.sobra, 1000, 1e-9);
  assert.ok(d.ordens.every((o) => Number.isInteger(o.quantidade)));
});

test('índice de título: CDI, prefixado e IPCA+', () => {
  const cdi = [['2026-01-02', 0.05], ['2026-01-05', 0.05], ['2026-01-06', 0.05]];
  const i = rf.indiceTitulo({ indexador: 'cdi', percentual: 1.1 }, { cdi }, '2026-01-02', '2026-01-06');
  assert.equal(i.length, 3); perto(i[2].valor, (1 + 0.0005 * 1.1) ** 2, 1e-12);
  const pre = rf.indiceTitulo({ indexador: 'pre', taxa: 0.12 }, {}, '2026-01-01', '2027-01-01');
  perto(pre[pre.length - 1].valor, 1.12, 1e-9);
  const ipca = rf.indiceTitulo({ indexador: 'ipca', taxa: 0.06 }, { ipca: [['2026-01-01', 1], ['2026-02-01', 0.5], ['2026-03-01', 0.4]] }, '2026-01-15', '2026-03-20');
  perto(ipca[ipca.length - 1].valor, 1.005 * 1.004 * 1.06 ** (64 / 365), 1e-9);
});

// ---- Fundamentos ----
import * as fun from '../Portal/assets/js/calculo/fundamentos.js';

// Empresa fictícia com dois exercícios e três trimestres, em R$ mil.
function empresaTeste({ dividaLP = 300, lucro3T = 90 } = {}) {
  const bp = (x) => ({ ativoTotal: 2000, ativoCirculante: 800, caixa: 200, aplicacoes: 100, estoques: 150, contasReceber: 250, imobilizado: 700, intangivel: 100, passivoCirculante: 400, dividaCP: 100, passivoNaoCirculante: 600, dividaLP, patrimonioLiquido: 1000, minoritarios: 0, ...x });
  const fl = (m, x = {}) => ({ receita: 100 * m, custo: -60 * m, lucroBruto: 40 * m, despesasOperacionais: -20 * m, ebit: 20 * m, resultadoFinanceiro: -2 * m, despesasFinanceiras: -3 * m, receitasFinanceiras: m, lair: 18 * m, impostos: -6 * m, lucroLiquido: 12 * m, lucroControladores: 12 * m, fco: 14 * m, fci: -6 * m, fcf: -4 * m, capex: -5 * m, da: 4 * m, proventosPagos: 5 * m, ...x });
  const acoes = { total: 1000000, tesouraria: 0 };
  return { plano: 'comercial', periodos: [
    { fim: '2024-12-31', inicio: '2024-01-01', meses: 12, origem: 'DFP', bp: bp(), fluxo: fl(12, { receita: 1000, lucroLiquido: 100, lucroControladores: 100 }), acoes },
    { fim: '2025-03-31', inicio: '2025-01-01', meses: 3, origem: 'ITR', bp: bp(), fluxo: fl(3), acoes },
    { fim: '2025-06-30', inicio: '2025-01-01', meses: 6, origem: 'ITR', bp: bp(), fluxo: fl(6), acoes },
    { fim: '2025-09-30', inicio: '2025-01-01', meses: 9, origem: 'ITR', bp: bp(), fluxo: fl(9), acoes },
    { fim: '2025-12-31', inicio: '2025-01-01', meses: 12, origem: 'DFP', bp: bp(), fluxo: fl(12), acoes },
    { fim: '2026-03-31', inicio: '2026-01-01', meses: 3, origem: 'ITR', bp: bp(), fluxo: fl(3, { receita: 330 }), acoes },
    { fim: '2026-06-30', inicio: '2026-01-01', meses: 6, origem: 'ITR', bp: bp(), fluxo: fl(6, { receita: 660 }), acoes },
    { fim: '2026-09-30', inicio: '2026-01-01', meses: 9, origem: 'ITR', bp: bp(), fluxo: fl(9, { receita: 990, lucroLiquido: lucro3T, lucroControladores: lucro3T }), acoes },
  ] };
}

test('fundamentos: trimestre isolado e últimos 12 meses', () => {
  const e = empresaTeste();
  perto(fun.fluxoIsolado(e.periodos, '2025-09-30').receita, 300);
  perto(fun.fluxoIsolado(e.periodos, '2025-12-31').receita, 300);   // 4º trimestre = ano − nove meses
  perto(fun.fluxoIsolado(e.periodos, '2025-03-31').receita, 300);
  perto(fun.fluxoUDM(e.periodos, '2026-09-30').receita, 990 + 1200 - 900);
  perto(fun.fluxoUDM(e.periodos, '2025-12-31').receita, 1200);
  assert.equal(fun.fluxoUDM(e.periodos, '2025-03-31'), null); // sem o 1T24 não há como montar 12 meses
});

test('fundamentos: indicadores conferidos à mão', () => {
  const e = empresaTeste();
  const p = e.periodos.find((x) => x.fim === '2025-12-31');
  const i = fun.indicadores({ bp: p.bp, fluxo: p.fluxo, acoes: p.acoes, preco: 2 });
  perto(i.ebitda, 240 + 48); perto(i.margemEbitda, 288 / 1200); perto(i.margemLiquida, 0.12);
  perto(i.dividaBruta, 400); perto(i.dividaLiquida, 100); perto(i.dividaLiquidaEbitda, 100 / 288);
  perto(i.roe, 144 / 1000); perto(i.roic, (240 * 0.66) / 1100);
  perto(i.liquidezCorrente, 2); perto(i.liquidezSeca, 650 / 400); perto(i.coberturaJuros, 240 / 36);
  perto(i.fcl, 168 - 60); perto(i.imobilizadoSobreAtivo, 0.35); perto(i.passivoCurtoPrazo, 0.4);
  perto(i.lpa, 0.144); perto(i.vpa, 1); perto(i.pl, 2 / 0.144); perto(i.pvp, 2);
  perto(i.valorMercado, 2000); perto(i.evEbitda, 2100 / 288); perto(i.dividendYield, 60 / 2000);
});

test('fundamentos: síntese exige concordância e explica a regra', () => {
  const boa = fun.historico(empresaTeste(), { preco: 1 });
  const s = fun.sintetizar(boa, { selic: 0.1, setor: { pl: 20, evEbitda: 12 } });
  assert.equal(s.saude, 'financeiramente saudável');
  assert.ok(s.criterios.every((c) => c.regra && c.leitura));
  assert.equal(s.sinal, 'considerar compra'); // saudável, sem piora e preço favorável em mais de um critério
  // Sem preço, não há sinal de compra ou venda.
  assert.equal(fun.sintetizar(fun.historico(empresaTeste()), { selic: 0.1 }).sinal, null);
  // Dívida alta e lucro em queda: situação frágil.
  const ruim = fun.historico(empresaTeste({ dividaLP: 1800, lucro3T: -200 }), { preco: 1 });
  const r = fun.sintetizar(ruim, { selic: 0.1 });
  assert.notEqual(r.saude, 'financeiramente saudável');
  assert.notEqual(r.sinal, 'considerar compra');
});

test('fundamentos: medianas do setor só com 5 pares', () => {
  assert.equal(fun.medianasSetor([{ roe: 0.1 }, { roe: 0.2 }], ['roe']).roe, null);
  perto(fun.medianasSetor([0.1, 0.2, 0.3, 0.4, 0.5].map((roe) => ({ roe })), ['roe']).roe, 0.3);
});

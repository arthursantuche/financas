// Gera a demonstração (?amostra): uma carteira fictícia e dados de mercado fictícios, no mesmo
// formato do repositório privado. Preços e cotas são inventados por um passeio aleatório com
// semente fixa: servem para mostrar e testar o portal, não representam o mercado.
// Uso: node coleta/amostra.mjs
import { join } from 'node:path';
import { DADOS, gravarJSON, lerJSON, log } from './util.mjs';
import { aleatorio, normalPadrao } from '../Portal/assets/js/calculo/estatistica.js';
import { precoBS } from '../Portal/assets/js/calculo/opcoes.js';

const HOJE = (await lerJSON(join(DADOS, 'tesouro.json')))?.dataBase || new Date().toISOString().slice(0, 10);
const semente = (texto) => [...texto].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7);

// Dias úteis (sem feriados: é uma demonstração) dos últimos três anos até HOJE.
const dias = [];
for (let t = Date.parse(HOJE + 'T00:00:00Z') - 3 * 365 * 864e5; t <= Date.parse(HOJE + 'T00:00:00Z'); t += 864e5) { const d = new Date(t); if (d.getUTCDay() % 6) dias.push(d.toISOString().slice(0, 10)); }

function passeio(codigo, final, { vol = 0.28, tendencia = 0.10 } = {}) {
  const rnd = aleatorio(semente(codigo)), mercado = aleatorio(20261114);
  const rets = dias.map(() => tendencia / 252 + (vol / Math.sqrt(252)) * (0.75 * normalPadrao(rnd) + 0.66 * normalPadrao(mercado) * 0.6));
  let p = 1; const serie = rets.map((r) => (p *= 1 + r));
  const escala = final / serie[serie.length - 1];
  return dias.map((d, i) => [d, Math.round(serie[i] * escala * 100) / 100]);
}

const BOLSA = [
  ['PETR4', 'Petrobras PN', 'acao', 45.3, 0.30, 0.14], ['VALE3', 'Vale ON', 'acao', 61.8, 0.28, 0.02], ['ITUB4', 'Itaú Unibanco PN', 'acao', 38.4, 0.22, 0.16],
  ['WEGE3', 'WEG ON', 'acao', 41.2, 0.27, 0.08], ['BBAS3', 'Banco do Brasil ON', 'acao', 24.9, 0.26, -0.04], ['ABEV3', 'Ambev ON', 'acao', 13.6, 0.20, 0.03],
  ['BOVA11', 'iShares Ibovespa', 'etf', 152.4, 0.19, 0.11], ['IVVB11', 'iShares S&P 500', 'etf', 412.5, 0.18, 0.17],
  ['HGLG11', 'CSHG Logística', 'fii', 161.3, 0.13, 0.06], ['KNRI11', 'Kinea Renda Imobiliária', 'fii', 148.7, 0.12, 0.05],
];
const historicos = Object.fromEntries(BOLSA.map(([c, , , final, vol, t]) => [c, passeio(c, final, { vol, tendencia: t })]));

const mercado = {};
const cot = {};
for (const [c] of BOLSA) {
  const h = historicos[c], u = h[h.length - 1][1], ant = h[h.length - 2][1];
  mercado[`mercado/historico/${c}.json`] = { codigo: c, fonte: 'Demonstração (fictício)', pontos: h };
  cot[c] = { preco: u, anterior: ant, data: HOJE, hora: '17:07:00', abertura: Math.round(ant * 1.003 * 100) / 100, minimo: Math.round(Math.min(u, ant) * 0.992 * 100) / 100, maximo: Math.round(Math.max(u, ant) * 1.008 * 100) / 100, volume: Math.round(u * 1.2e6) };
}
mercado['mercado/cotacoes.json'] = { geradoEm: `${HOJE}T20:10:00Z`, fonte: 'Demonstração (preços fictícios)', atraso: 15, ativos: cot };

// Fechamento de todos os tickers conhecidos, para os múltiplos dos pares: preço fictício coerente
// com o lucro e o patrimônio por ação de cada companhia.
const setores = (await lerJSON(join(DADOS, 'empresas', 'setores.json')))?.setores || {};
const indice = (await lerJSON(join(DADOS, 'empresas', 'indice.json')))?.empresas || [];
const fech = {};
for (const e of Object.values(setores).flat()) {
  const rnd = aleatorio(semente(e.ticker));
  const base = e.lpa > 0.05 ? e.lpa * (6 + rnd() * 9) : e.vpa > 0.5 ? e.vpa * (0.5 + rnd()) : 4 + rnd() * 30;
  const preco = Math.max(0.5, Math.round(base * 100) / 100);
  for (const t of indice.find((x) => x.cvm === e.cvm)?.tickers || [e.ticker]) fech[t] = [preco, Math.round(preco * (0.985 + rnd() * 0.03) * 100) / 100];
}
for (const [c, q] of Object.entries(cot)) fech[c] = [q.preco, q.anterior, q.abertura, q.minimo, q.maximo, q.volume];
for (const c of ['PETR3', 'ITUB3']) if (cot[c.slice(0, 4) + '4']) fech[c] = [Math.round(cot[c.slice(0, 4) + '4'].preco * 1.06 * 100) / 100, Math.round(cot[c.slice(0, 4) + '4'].anterior * 1.06 * 100) / 100];
mercado['mercado/fechamento.json'] = { data: HOJE, fonte: 'Demonstração (preços fictícios)', ativos: fech };

// Fundo fictício: cota diária com baixa volatilidade.
const cotas = passeio('FUNDO', 2.8416, { vol: 0.05, tendencia: 0.13 }).map(([d, v]) => [d, Math.round(v * 1e4) / 1e4]);
mercado['mercado/fundos.json'] = { geradoEm: `${HOJE}T12:00:00Z`, fonte: 'Demonstração (fictício)', fundos: { '11111111000111': { nome: 'Fundo Demonstração Multimercado', cota: cotas[cotas.length - 1][1], anterior: cotas[cotas.length - 2][1], data: HOJE, historico: cotas.slice(-500) } } };

// Cadeia de opções fictícia: dois vencimentos, strikes em torno do preço, prêmios por Black-Scholes.
const venc = (meses) => { const d = new Date(HOJE + 'T00:00:00Z'); d.setUTCMonth(d.getUTCMonth() + meses, 1); let n = 0; while (n < 3) { if (d.getUTCDay() === 5) n++; if (n < 3) d.setUTCDate(d.getUTCDate() + 1); } return d.toISOString().slice(0, 10); };
const LETRAS_CALL = 'ABCDEFGHIJKL', LETRAS_PUT = 'MNOPQRSTUVWX';
const opcoes = {};
for (const [base, , , , vol] of BOLSA.filter((b) => b[2] === 'acao')) {
  const S = cot[base].preco, lista = [];
  for (const m of [1, 2]) {
    const v = venc(m), T = (Date.parse(v) - Date.parse(HOJE)) / 864e5 / 365, mes = Number(v.slice(5, 7)) - 1;
    for (const k of [-3, -2, -1, 0, 1, 2, 3]) {
      const passo = S > 100 ? 5 : S > 30 ? 2 : S > 15 ? 1 : 0.5, K = Math.round((Math.round(S / passo) + k) * passo * 100) / 100;
      for (const tipo of ['call', 'put']) {
        const premio = Math.max(0.01, Math.round(precoBS({ tipo, S, K, T, r: Math.log(1.1375), sigma: vol * (1 + 0.04 * Math.abs(k)) }) * 100) / 100);
        lista.push({ codigo: `${base.slice(0, 4)}${(tipo === 'call' ? LETRAS_CALL : LETRAS_PUT)[mes]}${Math.round(K * 10)}`, tipo, strike: K, vencimento: v, ultimo: premio, negocios: Math.max(3, Math.round(400 / (1 + k * k))), volume: Math.round(premio * 100 * 400 / (1 + k * k)) });
      }
    }
  }
  opcoes[base] = lista;
}
mercado['mercado/opcoes.json'] = { data: HOJE, fonte: 'Demonstração (prêmios fictícios)', bases: opcoes };
mercado['mercado/alertas-disparados.json'] = { geradoEm: `${HOJE}T20:10:00Z`, disparos: [{ id: 'al-demo-1', quando: `${HOJE}T14:32:00Z`, texto: `WEGE3 passou de R$ 40,00 (preço de R$ ${String(cot.WEGE3.preco).replace('.', ',')})` }] };
await gravarJSON(join(DADOS, 'amostra', 'mercado.json'), mercado);

// ---- Carteira fictícia ----
const precoEm = (c, data) => { const h = historicos[c]; let p = h[0][1]; for (const [d, v] of h) { if (d > data) break; p = v; } return p; };
const ag = '2026-01-01T00:00:00.000Z';
const ativos = [], lancamentos = [];
let n = 0;
const ativo = (dados) => { const a = { id: `a-demo-${++n}`, instituicao: 'Corretora Exemplo', atualizadoEm: ag, criadoEm: ag, ...dados }; ativos.push(a); return a; };
const mov = (a, dados) => lancamentos.push({ id: `l-demo-${lancamentos.length + 1}`, ativoId: a.id, tipo: 'compra', custos: 0, atualizadoEm: ag, criadoEm: ag, ...dados });
const compras = { PETR4: [[400, 620], [200, 300]], VALE3: [[150, 500]], ITUB4: [[500, 650], [200, 150]], WEGE3: [[300, 420]], BOVA11: [[60, 560]], IVVB11: [[25, 380]], HGLG11: [[40, 480]], KNRI11: [[35, 260]] };
for (const [c, nome, classe] of BOLSA) {
  if (!compras[c]) continue;
  const a = ativo({ classe, codigo: c, nome });
  for (const [qtd, diasAtras] of compras[c]) { const data = dias[dias.length - 1 - diasAtras]; mov(a, { data, quantidade: qtd, preco: precoEm(c, data), custos: 4.9 }); }
  if (c === 'ITUB4') mov(a, { tipo: 'provento', data: dias[dias.length - 60], valor: 412.3 });
  if (c === 'HGLG11') for (const d of [20, 41, 62]) mov(a, { tipo: 'provento', data: dias[dias.length - d], valor: 44 });
  if (c === 'PETR4') mov(a, { tipo: 'venda', data: dias[dias.length - 90], quantidade: 100, preco: precoEm(c, dias[dias.length - 90]), custos: 4.9 });
}
const tes = (await lerJSON(join(DADOS, 'tesouro.json')))?.titulos || [];
const puEm = (id, data) => { const t = tes.find((x) => x.id === id); let p = null; for (const [d, , pu] of t?.historico || []) { if (d > data) break; if (pu > 0) p = pu; } return p ?? t?.puVenda; };
for (const [id, nome, qtd, atras] of [['tesouro-selic-2029', 'Tesouro Selic 2029', 1.5, 400], ['tesouro-ipcamais-2035', 'Tesouro IPCA+ 2035', 6, 520]]) {
  if (!tes.some((t) => t.id === id)) continue;
  const a = ativo({ classe: 'tesouro', titulo: id, nome }), data = dias[dias.length - 1 - atras];
  mov(a, { data, quantidade: qtd, preco: puEm(id, data) });
}
const cdb = ativo({ classe: 'rendafixa', tipo: 'CDB', emissor: 'Banco Exemplo', indexador: 'cdi', percentual: 1.1, taxa: 0, vencimento: '2028-02-10', isento: false, nome: 'CDB Banco Exemplo 110% do CDI', instituicao: 'Banco Exemplo' });
mov(cdb, { data: dias[dias.length - 440], quantidade: 20000, preco: 1 }); mov(cdb, { data: dias[dias.length - 200], quantidade: 5000, preco: 1 });
const lca = ativo({ classe: 'rendafixa', tipo: 'LCA', emissor: 'Banco Exemplo', indexador: 'cdi', percentual: 0.92, taxa: 0, vencimento: '2027-06-15', isento: true, nome: 'LCA Banco Exemplo 92% do CDI', instituicao: 'Banco Exemplo' });
mov(lca, { data: dias[dias.length - 300], quantidade: 15000, preco: 1 });
const deb = ativo({ classe: 'rendafixa', tipo: 'Debênture incentivada', emissor: 'Energia Exemplo', indexador: 'ipca', percentual: 1, taxa: 0.068, vencimento: '2031-05-15', isento: true, nome: 'Debênture incentivada Energia Exemplo IPCA + 6,80%' });
mov(deb, { data: dias[dias.length - 350], quantidade: 10000, preco: 1 });
const fundo = ativo({ classe: 'fundo', nome: 'Fundo Demonstração Multimercado', cnpj: '11111111000111' });
mov(fundo, { data: cotas[cotas.length - 380][0], quantidade: 6000, preco: cotas[cotas.length - 380][1] });
// Venda coberta: call lançada sobre PETR4, no vencimento mais próximo e um strike acima do preço.
const call = opcoes.PETR4.filter((o) => o.tipo === 'call' && o.strike > cot.PETR4.preco).sort((x, y) => (x.vencimento < y.vencimento ? -1 : x.vencimento > y.vencimento ? 1 : x.strike - y.strike))[0];
const op = ativo({ classe: 'opcao', codigo: call.codigo, nome: `Call de PETR4 a ${String(call.strike).replace('.', ',')}`, tipoOpcao: 'call', ativoBase: 'PETR4', strike: call.strike, vencimento: call.vencimento });
mov(op, { tipo: 'venda', data: dias[dias.length - 8], quantidade: 300, preco: Math.round(call.ultimo * 1.25 * 100) / 100, custos: 3.2 });
mercado['mercado/cotacoes.json'].ativos[call.codigo] = { preco: call.ultimo, anterior: Math.round(call.ultimo * 1.06 * 100) / 100, data: HOJE, hora: '17:05:00' };
await gravarJSON(join(DADOS, 'amostra', 'mercado.json'), mercado);

await gravarJSON(join(DADOS, 'amostra', 'carteira.json'), {
  versao: 1, ativos, lancamentos,
  alertas: [{ id: 'al-demo-1', tipo: 'acima', codigo: 'WEGE3', valor: 40, descricao: 'WEG acima de R$ 40', ativo: true, atualizadoEm: ag }, { id: 'al-demo-2', tipo: 'abaixo', codigo: 'VALE3', valor: 55, descricao: 'Vale abaixo de R$ 55', ativo: true, atualizadoEm: ag }],
  relatorios: [], observados: [{ id: 'o-demo-1', codigo: 'ABEV3', atualizadoEm: ag }, { id: 'o-demo-2', codigo: 'BBAS3', atualizadoEm: ag }],
  config: { perfil: 'moderado', horizonteAnos: 5, tetoPorAtivo: 0.15, indiceReferencia: 'CDI', llm: null, enviarCarteiraAoLLM: false, atualizadoEm: ag },
}, { compacto: false });
log(`amostra: ${ativos.length} ativos, ${lancamentos.length} lançamentos, ${Object.keys(fech).length} preços de fechamento fictícios`);

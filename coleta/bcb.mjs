// Indicadores econômicos do Banco Central (SGS) e expectativas do Boletim Focus (Olinda).
// Fonte: https://api.bcb.gov.br e https://olinda.bcb.gov.br. Dados abertos, sem chave.
// Saída: Portal/dados/bcb/<chave>.json (série) e Portal/dados/indicadores.json (resumo para as telas).
// Uso: node coleta/bcb.mjs
import { join } from 'node:path';
import { buscarJSON, gravarJSON, DADOS, agora, dataBR, log } from './util.mjs';

// frequencia: 'D' diária, 'M' mensal. `desde` limita o histórico guardado.
const SERIES = [
  { chave: 'selic-meta', codigo: 432, nome: 'Meta da taxa Selic', unidade: '% a.a.', frequencia: 'D', desde: '2010-01-01', degraus: true },
  { chave: 'selic', codigo: 11, nome: 'Taxa Selic diária', unidade: '% a.d.', frequencia: 'D', desde: '2012-01-01' },
  { chave: 'cdi', codigo: 12, nome: 'Taxa DI (CDI) diária', unidade: '% a.d.', frequencia: 'D', desde: '2012-01-01' },
  { chave: 'cdi-anual', codigo: 4389, nome: 'Taxa DI (CDI) anualizada, base 252', unidade: '% a.a.', frequencia: 'D', desde: '2023-01-01' },
  { chave: 'ipca', codigo: 433, nome: 'IPCA, variação mensal', unidade: '% a.m.', frequencia: 'M', desde: '2000-01-01' },
  { chave: 'ipca-12m', codigo: 13522, nome: 'IPCA acumulado em 12 meses', unidade: '% em 12 meses', frequencia: 'M', desde: '2000-01-01' },
  { chave: 'igpm', codigo: 189, nome: 'IGP-M, variação mensal', unidade: '% a.m.', frequencia: 'M', desde: '2000-01-01' },
  { chave: 'poupanca', codigo: 196, nome: 'Poupança, rendimento mensal (depósitos a partir de 04/05/2012)', unidade: '% a.m.', frequencia: 'M', desde: '2012-06-01' },
  { chave: 'tr', codigo: 7811, nome: 'Taxa Referencial (TR), mensal', unidade: '% a.m.', frequencia: 'M', desde: '2012-01-01' },
  { chave: 'dolar', codigo: 1, nome: 'Dólar comercial (PTAX, venda)', unidade: 'R$', frequencia: 'D', desde: '2012-01-01' },
];

const br = (iso) => iso.split('-').reverse().join('/');

// O SGS limita consultas de séries diárias a janelas de 10 anos: busca em blocos.
async function serie(codigo, desde) {
  const pontos = [];
  let ini = desde;
  const fimGeral = new Date().toISOString().slice(0, 10);
  while (ini <= fimGeral) {
    const anoFim = Number(ini.slice(0, 4)) + 9;
    const fim = `${anoFim}-12-31` < fimGeral ? `${anoFim}-12-31` : fimGeral;
    const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${codigo}/dados?formato=json&dataInicial=${br(ini)}&dataFinal=${br(fim)}`;
    let bloco = [];
    try { bloco = await buscarJSON(url); } catch (e) { if (!/404/.test(e.message)) throw e; } // 404: sem dados na janela
    for (const p of bloco) { const d = dataBR(p.data), v = Number(p.valor); if (d && Number.isFinite(v)) pontos.push([d, v]); }
    ini = `${anoFim + 1}-01-01`;
  }
  return pontos;
}

async function focus(indicador) {
  const url = `https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/odata/ExpectativasMercadoAnuais?$top=8&$filter=Indicador%20eq%20'${encodeURIComponent(indicador)}'%20and%20baseCalculo%20eq%200&$orderby=Data%20desc&$format=json&$select=Indicador,Data,DataReferencia,Mediana`;
  const r = await buscarJSON(url);
  const ultima = r.value[0]?.Data;
  return { data: ultima, anos: Object.fromEntries(r.value.filter((v) => v.Data === ultima).map((v) => [v.DataReferencia, v.Mediana])) };
}

// Acumula variações percentuais (CDI diário, IPCA mensal) a partir de uma data.
const acumular = (pontos, desde) => pontos.filter(([d]) => d >= desde).reduce((f, [, v]) => f * (1 + v / 100), 1) - 1;

async function principal() {
  const dados = {};
  for (const s of SERIES) {
    let pontos = await serie(s.codigo, s.desde);
    if (!pontos.length) throw new Error(`Série ${s.codigo} (${s.nome}) veio vazia`);
    // Séries em degraus (meta da Selic): guarda só as mudanças de valor. A meta já vem preenchida
    // até a próxima reunião do Copom, então datas futuras são descartadas.
    const hojeISO = new Date().toISOString().slice(0, 10);
    pontos = pontos.filter(([d]) => d <= hojeISO);
    if (s.degraus) pontos = pontos.filter((p, i) => i === 0 || p[1] !== pontos[i - 1][1]);
    dados[s.chave] = pontos;
    await gravarJSON(join(DADOS, 'bcb', `${s.chave}.json`), { chave: s.chave, codigoSGS: s.codigo, nome: s.nome, unidade: s.unidade, frequencia: s.frequencia, fonte: 'Banco Central do Brasil, SGS', atualizadoEm: agora(), pontos });
    log(`${s.chave}: ${pontos.length} pontos até ${pontos[pontos.length - 1][0]}`);
  }

  const ultimo = (k) => { const p = dados[k][dados[k].length - 1]; return { data: p[0], valor: p[1] }; };
  const umAno = new Date(Date.now() - 365 * 864e5).toISOString().slice(0, 10);
  const inicioAno = `${new Date().getUTCFullYear()}-01-01`;
  const expectativas = {};
  for (const ind of ['IPCA', 'Selic', 'PIB Total', 'Câmbio']) {
    try { expectativas[ind] = await focus(ind); } catch (e) { log(`Focus ${ind} indisponível: ${e.message}`); }
  }
  const selic = ultimo('selic-meta'), ipca12 = ultimo('ipca-12m'), cdiAnual = ultimo('cdi-anual');
  const resumo = {
    fonte: 'Banco Central do Brasil (SGS e Boletim Focus)', geradoEm: agora(),
    selicMeta: selic, cdiAnual, ipca12m: ipca12, ipcaMes: ultimo('ipca'), igpmMes: ultimo('igpm'),
    poupancaMes: ultimo('poupanca'), dolar: ultimo('dolar'),
    // Juro real: Selic descontada da inflação dos últimos 12 meses (ex post) e da esperada (ex ante).
    juroRealExPost: (1 + selic.valor / 100) / (1 + ipca12.valor / 100) - 1,
    cdiAcumulado12m: acumular(dados.cdi, umAno), cdiAcumuladoAno: acumular(dados.cdi, inicioAno),
    ipcaAcumuladoAno: acumular(dados.ipca, inicioAno),
    poupancaAcumulada12m: acumular(dados.poupanca, umAno.slice(0, 8) + '01'),
    dolar12m: (() => { const p = dados.dolar.filter(([d]) => d >= umAno); return p.length ? p[p.length - 1][1] / p[0][1] - 1 : null; })(),
    expectativas,
  };
  await gravarJSON(join(DADOS, 'indicadores.json'), resumo, { compacto: false });
  log(`resumo: Selic ${selic.valor}% · CDI ${cdiAnual.valor}% · IPCA 12m ${ipca12.valor}%`);
}

principal().catch((e) => { console.error(e); process.exit(1); });

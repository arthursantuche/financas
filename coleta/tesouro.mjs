// Preços e taxas do Tesouro Direto. Fonte: Tesouro Transparente (CSV oficial, dados abertos).
// Saída: Portal/dados/tesouro.json com os títulos do último dia e o histórico mensal de taxas dos
// títulos ainda negociados (para gráficos e para avaliar posições).
// Uso: node coleta/tesouro.mjs
import { join } from 'node:path';
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { baixar, registros, gravarJSON, DADOS, agora, dataBR, numeroBR, log } from './util.mjs';

const URL_CSV = 'https://www.tesourotransparente.gov.br/ckan/dataset/df56aa42-484a-4a59-8184-7676580c81e3/resource/796d2059-14e9-44e3-80c9-2d9e30b405c1/download/PrecoTaxaTesouroDireto.csv';

const INDEXADOR = (tipo) => (/Selic/i.test(tipo) ? 'selic' : /IPCA|Renda\+|Educa\+/i.test(tipo) ? 'ipca' : /IGPM/i.test(tipo) ? 'igpm' : 'pre');
export const idTitulo = (tipo, vencimento) => `${tipo} ${vencimento.slice(0, 4)}`.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9+]+/g, '-').replace(/\+/g, 'mais').replace(/^-|-$/g, '');

async function principal() {
  const arquivo = await baixar(URL_CSV, 'tesouro.csv');
  const linhas = createInterface({ input: createReadStream(arquivo, 'latin1'), crlfDelay: Infinity });
  const porTitulo = new Map();
  let ultimaData = '';
  for await (const l of registros(linhas)) {
    const base = dataBR(l['Data Base']), venc = dataBR(l['Data Vencimento']);
    if (!base || !venc) continue;
    if (base > ultimaData) ultimaData = base;
    const chave = `${l['Tipo Titulo']}|${venc}`;
    let t = porTitulo.get(chave);
    if (!t) { t = { tipo: l['Tipo Titulo'], vencimento: venc, pontos: [] }; porTitulo.set(chave, t); }
    t.pontos.push([base, numeroBR(l['Taxa Compra Manha']), numeroBR(l['Taxa Venda Manha']), numeroBR(l['PU Compra Manha']), numeroBR(l['PU Venda Manha'])]);
  }
  if (!ultimaData) throw new Error('CSV do Tesouro sem datas: formato pode ter mudado');

  const titulos = [];
  for (const t of porTitulo.values()) {
    t.pontos.sort((a, b) => (a[0] < b[0] ? -1 : 1));
    const u = t.pontos[t.pontos.length - 1];
    if (u[0] !== ultimaData || t.vencimento <= ultimaData) continue; // só títulos com preço no último dia
    // Histórico: último ponto de cada mês (taxa de venda e PU de venda), mais o dia mais recente.
    const mensal = new Map();
    for (const p of t.pontos) mensal.set(p[0].slice(0, 7), [p[0], p[2], p[4]]);
    titulos.push({
      id: idTitulo(t.tipo, t.vencimento), nome: `${t.tipo} ${t.vencimento.slice(0, 4)}`, tipo: t.tipo, vencimento: t.vencimento,
      indexador: INDEXADOR(t.tipo), juros: /Juros Semestrais/i.test(t.tipo), data: u[0],
      taxaCompra: u[1], taxaVenda: u[2], puCompra: u[3], puVenda: u[4],
      // Título sem preço de compra não está à venda no dia: só pode ser resgatado.
      disponivelCompra: u[3] > 0,
      historico: [...mensal.values()],
    });
  }
  titulos.sort((a, b) => a.tipo.localeCompare(b.tipo) || (a.vencimento < b.vencimento ? -1 : 1));
  await gravarJSON(join(DADOS, 'tesouro.json'), {
    fonte: 'Tesouro Nacional, Tesouro Transparente (preços e taxas do Tesouro Direto)', dataBase: ultimaData, geradoEm: agora(),
    observacao: 'Taxas em % ao ano e preços unitários (PU) em reais, referência da manhã. A taxa dos títulos Selic é o ágio ou deságio sobre a Selic; a dos indexados ao IPCA é o juro real.',
    titulos,
  });
  log(`${titulos.length} títulos em ${ultimaData}`);
  if (titulos.length < 10) throw new Error('Poucos títulos: formato do Tesouro pode ter mudado');
}

principal().catch((e) => { console.error(e); process.exit(1); });

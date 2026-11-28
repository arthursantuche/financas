// Leitura dos dados abertos publicados com o site (Portal/dados) e do conteúdo editorial.
// Tudo é arquivo estático gerado pela coleta: não há limite de requisições nem chave.
import { numero, dataBR } from './util.js';

const memoria = new Map();
export function ler(caminho) {
  if (!memoria.has(caminho)) {
    memoria.set(caminho, fetch(caminho).then((r) => { if (!r.ok) throw new Error(`Não foi possível ler ${caminho} (${r.status})`); return caminho.endsWith('.md') ? r.text() : r.json(); })
      .catch((e) => { memoria.delete(caminho); throw e; }));
  }
  return memoria.get(caminho);
}

export const indicadores = () => ler('dados/indicadores.json');
export const serieBCB = (chave) => ler(`dados/bcb/${chave}.json`);
export const tesouro = () => ler('dados/tesouro.json');
export const indiceEmpresas = () => ler('dados/empresas/indice.json');
export const setores = () => ler('dados/empresas/setores.json');
export const empresa = (cvm) => ler(`dados/empresas/${cvm}.json`);
export const conteudo = () => ler('conteudo/indice.json');
export const artigo = (caminho) => ler(`conteudo/${caminho}.md`);
export const grandes = () => ler('dados/investidores.json');

// Procura uma empresa pelo ticker (qualquer classe) ou pelo código CVM.
export async function acharEmpresa(codigo) {
  const c = String(codigo).toUpperCase().trim();
  const { empresas } = await indiceEmpresas();
  return empresas.find((e) => e.tickers.includes(c)) || empresas.find((e) => e.cvm === c.padStart(6, '0')) || empresas.find((e) => e.tickers.some((t) => t.slice(0, 4) === c.slice(0, 4))) || null;
}

// Valores atuais usados dentro dos textos ({{selic}}, {{cdi}}…), sempre com a data de referência
// no rodapé do artigo. Devolve { valores: {chave: texto}, referencia: 'dd/mm/aaaa' }.
export async function valoresAtuais() {
  const i = await indicadores();
  const p = (v, casas = 2) => `${numero(v, casas)}%`;
  const focus = (ind, ano) => i.expectativas?.[ind]?.anos?.[ano];
  const ano = new Date().getFullYear();
  return {
    bruto: i,
    referencia: dataBR(i.geradoEm.slice(0, 10)),
    valores: {
      selic: p(i.selicMeta.valor), 'selic-data': dataBR(i.selicMeta.data),
      cdi: p(i.cdiAnual.valor), 'cdi-12m': p(i.cdiAcumulado12m * 100),
      'ipca-12m': p(i.ipca12m.valor), 'ipca-mes': p(i.ipcaMes.valor), 'ipca-ano': p(i.ipcaAcumuladoAno * 100),
      'juro-real': p(i.juroRealExPost * 100), poupanca: p(i.poupancaMes.valor, 4), 'poupanca-12m': p(i.poupancaAcumulada12m * 100),
      dolar: `R$ ${numero(i.dolar.valor, 4)}`,
      'focus-ipca': focus('IPCA', ano) != null ? p(focus('IPCA', ano)) : '—', 'focus-selic': focus('Selic', ano) != null ? p(focus('Selic', ano)) : '—',
      'focus-ipca-proximo': focus('IPCA', ano + 1) != null ? p(focus('IPCA', ano + 1)) : '—', 'focus-selic-proximo': focus('Selic', ano + 1) != null ? p(focus('Selic', ano + 1)) : '—',
      ano: String(ano), 'ano-proximo': String(ano + 1),
    },
  };
}

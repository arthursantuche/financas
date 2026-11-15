// O que os fundos brasileiros carregam em ações: posições e movimentações declaradas à CVM na
// Composição e Diversificação das Aplicações (CDA, dados abertos). Limites que a tela repete:
// a CVM publica com defasagem, e posições podem ficar sob sigilo por até 90 dias; por isso a
// referência é o mês encerrado há cerca de três meses. Informação complementar: saber quem tem
// um papel não diz se ele vai subir.
// Saída: Portal/dados/investidores.json
// Uso: node coleta/investidores.mjs [--mes AAAAMM]
import { join } from 'node:path';
import { baixar, linhasDoZip, registros, gravarJSON, DADOS, agora, log } from './util.mjs';

const arg = (n, p) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : p; };
const mesDe = (d) => `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
const base = new Date(Date.now() - 100 * 864e5);
const MES = arg('mes', mesDe(new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), 1))));
const anterior = (m) => mesDe(new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(4)) - 2, 1)));
const ACOES = new Set(['Ações', 'Certificado ou recibo de depósito de valores mobiliários']);

async function lerMes(mes) {
  const zip = await baixar(`https://dados.cvm.gov.br/dados/FI/DOC/CDA/DADOS/cda_fi_${mes}.zip`, `cda_${mes}.zip`);
  const papeis = new Map(), fundos = new Map();
  for await (const l of registros(linhasDoZip(zip, `cda_fi_BLC_4_${mes}.csv`), { campoLivre: 'DS_ATIVO' })) {
    const cod = (l.CD_ATIVO || '').trim().toUpperCase();
    if (!ACOES.has(l.TP_APLIC) || !/^[A-Z]{4}\d{1,2}$/.test(cod)) continue;
    const valor = Number(l.VL_MERC_POS_FINAL) || 0, compra = Number(l.VL_AQUIS_NEGOC) || 0, venda = Number(l.VL_VENDA_NEGOC) || 0;
    let p = papeis.get(cod); if (!p) { p = { codigo: cod, valor: 0, fundos: new Set(), compras: 0, vendas: 0 }; papeis.set(cod, p); }
    p.valor += valor; p.compras += compra; p.vendas += venda; if (valor > 0) p.fundos.add(l.CNPJ_FUNDO_CLASSE);
    let f = fundos.get(l.CNPJ_FUNDO_CLASSE); if (!f) { f = { cnpj: l.CNPJ_FUNDO_CLASSE, nome: l.DENOM_SOCIAL, valor: 0, posicoes: new Map() }; fundos.set(l.CNPJ_FUNDO_CLASSE, f); }
    f.valor += valor; f.posicoes.set(cod, (f.posicoes.get(cod) || 0) + valor);
  }
  return { papeis, fundos };
}

// Os meses mais recentes chegam incompletos (entregas atrasadas e posições sob sigilo). Recua até
// achar um mês com pelo menos 80% dos fundos do mês anterior a ele: esse é o mês de referência.
let mes = MES, atual = await lerMes(mes), antes = null;
for (let recuos = 0; recuos < 4; recuos++) {
  try { antes = await lerMes(anterior(mes)); } catch (e) { log(`sem mês anterior para comparar: ${e.message}`); antes = null; break; }
  if (atual.fundos.size >= 0.8 * antes.fundos.size) break;
  log(`${mes} incompleto (${atual.fundos.size} fundos contra ${antes.fundos.size} no mês anterior): recuando`);
  mes = anterior(mes); atual = antes; antes = null;
}
if (!antes) { try { antes = await lerMes(anterior(mes)); } catch { antes = null; } }
if (atual.papeis.size < 100) throw new Error(`Só ${atual.papeis.size} papéis no CDA de ${mes}: formato pode ter mudado`);
const r0 = (v) => Math.round(v);
const acoes = [...atual.papeis.values()].sort((a, b) => b.valor - a.valor).slice(0, 200).map((p) => {
  const a = antes?.papeis.get(p.codigo);
  return { codigo: p.codigo, valor: r0(p.valor), fundos: p.fundos.size, compras: r0(p.compras), vendas: r0(p.vendas), fluxo: r0(p.compras - p.vendas), fundosAntes: a ? a.fundos.size : null, valorAntes: a ? r0(a.valor) : null };
});
const maiores = [...atual.fundos.values()].sort((a, b) => b.valor - a.valor).slice(0, 40).map((f) => ({
  nome: f.nome, cnpj: f.cnpj, valorAcoes: r0(f.valor),
  posicoes: [...f.posicoes].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([codigo, valor]) => ({ codigo, valor: r0(valor), peso: Math.round((valor / f.valor) * 1e4) / 1e4 })),
}));
await gravarJSON(join(DADOS, 'investidores.json'), {
  fonte: 'CVM, Composição e Diversificação das Aplicações (CDA) dos fundos de investimento', referencia: `${mes.slice(0, 4)}-${mes.slice(4)}`, comparadoCom: antes ? `${anterior(mes).slice(0, 4)}-${anterior(mes).slice(4)}` : null, geradoEm: agora(),
  observacao: 'Posições em ações declaradas por fundos brasileiros no fim do mês de referência. Não inclui posições sob sigilo (até 90 dias), carteiras de pessoas físicas, de estrangeiros nem de fundos de pensão fora de fundos.',
  totalFundos: atual.fundos.size, acoes, maiores,
});
log(`${mes}: ${atual.papeis.size} papéis em ${atual.fundos.size} fundos`);

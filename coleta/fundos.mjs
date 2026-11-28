// Cotas dos fundos acompanhados, pelo Informe Diário da CVM (dados abertos). Roda no repositório
// privado porque a lista de fundos vem da carteira (monitor.json). A CVM publica com um a três
// dias úteis de defasagem. Saída: mercado/fundos.json { fundos: { CNPJ: { cota, anterior, data, historico } } }
// Uso: node coleta/fundos.mjs [--destino pasta] [--meses 13]
import { join } from 'node:path';
import { baixar, linhasDoZip, registros, gravarJSON, lerJSON, agora, log } from './util.mjs';

const arg = (n, p) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : p; };
const DESTINO = arg('destino', process.env.DESTINO_PRIVADO || join(process.cwd(), '..', 'financas-dados'));
const MESES = Number(arg('meses', 13));

const monitor = (await lerJSON(join(DESTINO, 'monitor.json'))) || { fundos: [] };
const alvo = new Set((monitor.fundos || []).map((c) => c.replace(/\D/g, '')));
if (!alvo.size) { log('nenhum fundo acompanhado'); process.exit(0); }
const existente = (await lerJSON(join(DESTINO, 'mercado', 'fundos.json')))?.fundos || {};
const series = Object.fromEntries([...alvo].map((c) => [c, new Map((existente[c]?.historico || []).map(([d, v]) => [d, v]))]));

const hoje = new Date();
for (let i = MESES - 1; i >= 0; i--) {
  const d = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() - i, 1)), mes = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  // Meses antigos já guardados não são relidos: só os dois mais recentes mudam.
  if (i > 1 && [...alvo].every((c) => [...series[c].keys()].some((k) => k.startsWith(`${mes.slice(0, 4)}-${mes.slice(4)}`)))) continue;
  let zip;
  try { zip = await baixar(`https://dados.cvm.gov.br/dados/FI/DOC/INF_DIARIO/DADOS/inf_diario_fi_${mes}.zip`, `inf_diario_${mes}.zip`); } catch (e) { log(`sem informe de ${mes}: ${e.message}`); continue; }
  for await (const l of registros(linhasDoZip(zip, `inf_diario_fi_${mes}.csv`))) {
    const cnpj = (l.CNPJ_FUNDO_CLASSE || l.CNPJ_FUNDO || '').replace(/\D/g, '');
    if (!alvo.has(cnpj) || l.ID_SUBCLASSE) continue;
    const cota = Number(l.VL_QUOTA);
    if (cota > 0) series[cnpj].set(l.DT_COMPTC, cota);
  }
}
const fundos = {};
for (const [cnpj, mapa] of Object.entries(series)) {
  const historico = [...mapa].sort((a, b) => (a[0] < b[0] ? -1 : 1));
  if (!historico.length) { log(`fundo ${cnpj}: nenhuma cota encontrada na CVM`); continue; }
  const u = historico[historico.length - 1], ant = historico[historico.length - 2];
  fundos[cnpj] = { cota: u[1], anterior: ant?.[1] ?? null, data: u[0], historico: historico.slice(-520) };
}
await gravarJSON(join(DESTINO, 'mercado', 'fundos.json'), { geradoEm: agora(), fonte: 'CVM, Informe Diário de fundos', fundos });
log(`${Object.keys(fundos).length} de ${alvo.size} fundos com cota`);

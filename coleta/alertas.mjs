// Monitor de alertas do repositório privado. Lê os gatilhos de monitor.json (sem quantidades nem
// valores da carteira), avalia com a mesma função do site (calculo/alertas.js) e registra os
// disparos em mercado/alertas-disparados.json. Com --issues, abre uma Issue por disparo (o GitHub
// notifica o dono por e-mail e pelo aplicativo). Um alerta que continua verdadeiro não repete.
// Uso: node coleta/alertas.mjs [--destino pasta] [--issues]
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { gravarJSON, lerJSON, agora, log, DADOS } from './util.mjs';
import { avaliarTodos } from '../Portal/assets/js/calculo/alertas.js';
import { historico, sintetizar } from '../Portal/assets/js/calculo/fundamentos.js';

const arg = (n, p) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : p; };
const DESTINO = arg('destino', process.env.DESTINO_PRIVADO || join(process.cwd(), '..', 'financas-dados'));
const ISSUES = process.argv.includes('--issues');

const monitor = (await lerJSON(join(DESTINO, 'monitor.json'))) || { alertas: [] };
const alertas = (monitor.alertas || []).filter((a) => ['acima', 'abaixo', 'alta', 'queda', 'fundamentos', 'documento'].includes(a.tipo));
if (!alertas.length) { log('nenhum alerta para avaliar'); process.exit(0); }

const [cot, fech, indice] = await Promise.all([lerJSON(join(DESTINO, 'mercado', 'cotacoes.json')), lerJSON(join(DESTINO, 'mercado', 'fechamento.json')), lerJSON(join(DADOS, 'empresas', 'indice.json'))]);
const precos = {};
for (const [c, f] of Object.entries(fech?.ativos || {})) precos[c] = f[0];
for (const [c, q] of Object.entries(cot?.ativos || {})) if (q.preco > 0) precos[c] = q.preco;
const empresaDe = (codigo) => indice?.empresas.find((e) => e.tickers.includes(codigo));
const documentos = Object.fromEntries((indice?.empresas || []).flatMap((e) => e.tickers.map((t) => [t, e.ultimo])));
// Síntese fundamentalista sem preço: saúde e tendência, que é o que o alerta de fundamentos olha.
const sinteses = {};
for (const a of alertas.filter((x) => x.tipo === 'fundamentos')) {
  const e = empresaDe(a.codigo); if (!e) continue;
  const emp = await lerJSON(join(DADOS, 'empresas', `${e.cvm}.json`)); if (!emp) continue;
  const s = sintetizar(historico(emp));
  sinteses[a.codigo] = { saude: s.saude, tendencia: s.tendencia, sinal: s.sinal };
}

const registro = (await lerJSON(join(DESTINO, 'mercado', 'alertas-disparados.json'))) || { disparos: [], estado: {} };
// A base do alerta de documento novo avança a cada disparo, para avisar só uma vez por entrega.
const comBase = alertas.map((a) => (a.tipo === 'documento' && registro.estado[a.id]?.base ? { ...a, base: registro.estado[a.id].base } : a));
const { disparos, estado } = avaliarTodos(comBase, { precos, sinteses, documentos }, registro.estado, agora());
for (const d of disparos) {
  const a = alertas.find((x) => x.id === d.id);
  log(`disparo: ${d.texto}`);
  if (ISSUES) {
    try { execFileSync('gh', ['issue', 'create', '--title', `Alerta: ${d.texto}`.slice(0, 240), '--body', `${d.texto}\n\n${a?.descricao ? `Lembrete: ${a.descricao}\n\n` : ''}Preços com atraso (fechamento oficial da B3 ou cerca de 15 minutos no pregão). Este aviso não é uma ordem.\n\nRegistrado em ${d.quando}.`], { stdio: 'inherit', cwd: DESTINO }); }
    catch (e) { log(`não foi possível abrir a Issue: ${e.message}`); }
  }
}
await gravarJSON(join(DESTINO, 'mercado', 'alertas-disparados.json'), { geradoEm: agora(), disparos: [...disparos, ...registro.disparos].slice(0, 100), estado });
log(`${alertas.length} alertas avaliados, ${disparos.length} disparos`);

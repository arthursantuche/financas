// Cotações do pregão para os papéis acompanhados (carteira, lista de acompanhamento e alertas).
// Fonte: Yahoo Finance, endereço público de gráficos (não oficial, atraso de cerca de 15 minutos,
// uso pessoal). Se falhar, o portal usa o fechamento oficial da B3 (coleta/b3.mjs): nada quebra.
// Roda no repositório privado. Saída: mercado/cotacoes.json
// Uso: node coleta/cotacoes.mjs [--destino pasta]
import { join } from 'node:path';
import { buscarJSON, gravarJSON, lerJSON, agora, log } from './util.mjs';

const arg = (n, p) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : p; };
const DESTINO = arg('destino', process.env.DESTINO_PRIVADO || join(process.cwd(), '..', 'financas-dados'));

const monitor = (await lerJSON(join(DESTINO, 'monitor.json'))) || { codigos: [] };
// Opções não têm cotação nessa fonte: ficam com o fechamento da B3.
const codigos = monitor.codigos.filter((c) => /^[A-Z]{4}\d{1,2}$/.test(c));
const ativos = {}, falhas = [];
for (const c of codigos) {
  try {
    const j = await buscarJSON(`https://query1.finance.yahoo.com/v8/finance/chart/${c}.SA?range=1d&interval=1d`, { tentativas: 2, headers: { 'User-Agent': 'Mozilla/5.0' } });
    const m = j.chart?.result?.[0]?.meta;
    if (!m?.regularMarketPrice) throw new Error('sem preço');
    const quando = new Date(m.regularMarketTime * 1000);
    // Data e hora no fuso de São Paulo.
    const sp = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'medium' }).format(quando);
    ativos[c] = { preco: m.regularMarketPrice, anterior: m.chartPreviousClose ?? m.previousClose ?? null, data: sp.slice(0, 10), hora: sp.slice(11), abertura: j.chart.result[0].indicators?.quote?.[0]?.open?.[0] ?? null, minimo: m.regularMarketDayLow ?? null, maximo: m.regularMarketDayHigh ?? null, volume: m.regularMarketVolume && m.regularMarketPrice ? Math.round(m.regularMarketVolume * m.regularMarketPrice) : null };
  } catch (e) { falhas.push(`${c}: ${e.message}`); }
  await new Promise((ok) => setTimeout(ok, 250)); // sem pressa: poucos papéis, uma chamada por vez
}
if (codigos.length && !Object.keys(ativos).length) { console.error(`Nenhuma cotação obtida: ${falhas.slice(0, 5).join('; ')}`); process.exit(1); }
await gravarJSON(join(DESTINO, 'mercado', 'cotacoes.json'), { geradoEm: agora(), fonte: 'Yahoo Finance', atraso: 15, ativos, falhas });
log(`${Object.keys(ativos).length} de ${codigos.length} cotações${falhas.length ? `; falhas: ${falhas.join('; ')}` : ''}`);

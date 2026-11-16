// Fechamento oficial da B3 (arquivo COTAHIST): preços de todos os ativos do mercado à vista,
// cadeia de opções e históricos diários. Roda no repositório privado: cotações não são publicadas.
// Fonte: https://www.b3.com.br (Séries históricas, arquivo diário e anual). Preços sem ajuste por
// proventos; desdobramentos e grupamentos são detectados por salto de preço e ajustados.
// Saída, na pasta DESTINO (padrão: ../financas-dados):
//   mercado/fechamento.json          { data, ativos: { COD: [fech, anterior, abertura, mín, máx, volume] } }
//   mercado/opcoes.json              { data, bases: { COD: [{ codigo, tipo, strike, vencimento, ultimo, negocios, volume }] } }
//   mercado/historico/<COD>.json     { codigo, pontos: [[data, fechamento ajustado]] }
// Uso: node coleta/b3.mjs [--destino pasta] [--data AAAA-MM-DD] [--anos 3]
import { join } from 'node:path';
import { baixar, linhasDoZip, gravarJSON, lerJSON, agora, log, CACHE } from './util.mjs';
import { rm } from 'node:fs/promises';

const arg = (n, p) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : p; };
const DESTINO = arg('destino', process.env.DESTINO_PRIVADO || join(process.cwd(), '..', 'financas-dados'));
const ANOS = Number(arg('anos', 3));
const URL_BASE = 'https://bvmf.bmfbovespa.com.br/InstDados/SerHist';
const VOLUME_MINIMO = 3e6;      // negociação diária mínima para um papel ganhar histórico
const MAX_UNIVERSO = 220;

const num = (t) => Number(t) / 100;
const dataISO = (t) => `${t.slice(0, 4)}-${t.slice(4, 6)}-${t.slice(6, 8)}`;
// Lê uma linha de cotação (tipo 01) do layout de largura fixa do COTAHIST.
export function lerLinha(l) {
  if (l.slice(0, 2) !== '01') return null;
  return {
    data: dataISO(l.slice(2, 10)), bdi: l.slice(10, 12), codigo: l.slice(12, 24).trim(), mercado: l.slice(24, 27), nome: l.slice(27, 39).trim(), especie: l.slice(39, 49).trim(),
    abertura: num(l.slice(56, 69)), maximo: num(l.slice(69, 82)), minimo: num(l.slice(82, 95)), ultimo: num(l.slice(108, 121)),
    negocios: Number(l.slice(147, 152)), volume: num(l.slice(170, 188)), strike: num(l.slice(188, 201)), vencimento: dataISO(l.slice(202, 210)),
  };
}
// Mercado à vista em lote padrão: ações, units, BDRs, ETFs e fundos imobiliários.
const AVISTA = new Set(['02', '12', '14', '13', '34', '35', '08']);
// Ação de referência de uma opção: raiz do código + classe indicada na espécie (ON → 3, PN → 4…).
export function baseDaOpcao(codigo, especie) {
  const classe = /^UNT/.test(especie) ? '11' : /^PNA/.test(especie) ? '5' : /^PNB/.test(especie) ? '6' : /^PN/.test(especie) ? '4' : /^ON/.test(especie) ? '3' : /^CI/.test(especie) ? '11' : null;
  return classe ? codigo.slice(0, 4) + classe : null;
}

async function ultimoArquivoDiario(dataPedida) {
  const inicio = dataPedida ? new Date(dataPedida + 'T12:00:00Z') : new Date();
  for (let i = 0; i < 8; i++) {
    const d = new Date(inicio.getTime() - i * 864e5);
    if (d.getUTCDay() % 6 === 0) continue;
    const iso = d.toISOString().slice(0, 10), nome = `COTAHIST_D${iso.slice(8)}${iso.slice(5, 7)}${iso.slice(0, 4)}`;
    try { return { zip: await baixar(`${URL_BASE}/${nome}.ZIP`, `${nome}.zip`), arquivo: `${nome}.TXT`, data: iso }; } catch { /* dia sem pregão ou arquivo ainda não publicado */ }
    if (dataPedida) break;
  }
  throw new Error('Nenhum arquivo diário da B3 disponível nos últimos dias');
}

// Ajuste de desdobramentos e grupamentos: um salto de um dia para o outro muito próximo de uma
// razão inteira (2, 3, 4, 5, 8, 10… ou o inverso) é tratado como evento, e os preços anteriores
// são convertidos para a base nova. Heurística: quedas ou altas reais de 50% num dia são raras em
// papéis líquidos, mas podem ser confundidas.
export function ajustarEventos(pontos) {
  const RAZOES = [2, 3, 4, 5, 6, 8, 10, 15, 20, 25, 50, 100];
  const p = pontos.map((x) => [...x]);
  for (let i = p.length - 1; i > 0; i--) {
    const r = p[i - 1][1] / p[i][1];
    if (!(r > 1.8 || r < 0.56)) continue;
    const fator = r > 1 ? RAZOES.find((k) => Math.abs(r / k - 1) < 0.12) : RAZOES.map((k) => 1 / k).find((k) => Math.abs(r / k - 1) < 0.12);
    if (!fator) continue;
    for (let j = 0; j < i; j++) p[j][1] = Math.round((p[j][1] / fator) * 1e4) / 1e4;
  }
  return p;
}

async function principal() {
  const monitor = (await lerJSON(join(DESTINO, 'monitor.json'))) || { codigos: [] };
  const acompanhados = new Set(monitor.codigos.map((c) => c.toUpperCase()));
  const dia = await ultimoArquivoDiario(arg('data', null));
  const anterior = await lerJSON(join(DESTINO, 'mercado', 'fechamento.json'));
  const ativos = {}, opcoesPorBase = {}, volumeOpcoes = {};
  for await (const l of linhasDoZip(dia.zip, dia.arquivo)) {
    const c = lerLinha(l);
    if (!c) continue;
    if (c.mercado === '010' && AVISTA.has(c.bdi)) {
      const ant = anterior && anterior.data < c.data ? anterior.ativos[c.codigo]?.[0] : anterior?.ativos[c.codigo]?.[1];
      ativos[c.codigo] = [c.ultimo, ant ?? null, c.abertura, c.minimo, c.maximo, Math.round(c.volume)];
    } else if ((c.mercado === '070' || c.mercado === '080') && c.negocios > 0) {
      const base = baseDaOpcao(c.codigo, c.especie);
      if (!base) continue;
      (opcoesPorBase[base] ||= []).push({ codigo: c.codigo, tipo: c.mercado === '070' ? 'call' : 'put', strike: c.strike, vencimento: c.vencimento, ultimo: c.ultimo, negocios: c.negocios, volume: Math.round(c.volume) });
      volumeOpcoes[base] = (volumeOpcoes[base] || 0) + c.volume;
    }
  }
  if (Object.keys(ativos).length < 300) throw new Error(`Só ${Object.keys(ativos).length} ativos no arquivo de ${dia.data}: o formato da B3 pode ter mudado`);
  await gravarJSON(join(DESTINO, 'mercado', 'fechamento.json'), { data: dia.data, fonte: 'B3, fechamento oficial (COTAHIST)', geradoEm: agora(), ativos });

  // Opções: das ações acompanhadas e das 40 bases mais negociadas (para os candidatos do agente).
  const maisNegociadas = Object.entries(volumeOpcoes).sort((a, b) => b[1] - a[1]).slice(0, 40).map(([b]) => b);
  const bases = Object.fromEntries([...new Set([...acompanhados, ...maisNegociadas])].filter((b) => opcoesPorBase[b]).map((b) => [b, opcoesPorBase[b].sort((x, y) => (x.vencimento < y.vencimento ? -1 : x.vencimento > y.vencimento ? 1 : x.strike - y.strike))]));
  await gravarJSON(join(DESTINO, 'mercado', 'opcoes.json'), { data: dia.data, fonte: 'B3, fechamento oficial (COTAHIST)', geradoEm: agora(), bases });

  // Históricos: acompanhados e os papéis mais negociados do dia.
  const liquidos = Object.entries(ativos).filter(([, a]) => a[5] >= VOLUME_MINIMO).sort((a, b) => b[1][5] - a[1][5]).slice(0, MAX_UNIVERSO).map(([c]) => c);
  const universo = [...new Set([...[...acompanhados].filter((c) => ativos[c]), ...liquidos])];
  const existentes = {}, faltam = new Set();
  // Um histórico serve se tem mais de 200 pontos sem buraco (ou se a B3 não tem mais que isso para
  // o papel). Buraco de mais de 40 dias entre dois pontos indica um arquivo anual que falhou numa
  // execução anterior: o histórico é refeito.
  const temBuraco = (p) => p.some((x, i) => i > 0 && Date.parse(x[0]) - Date.parse(p[i - 1][0]) > 40 * 864e5);
  for (const c of universo) {
    const h = await lerJSON(join(DESTINO, 'mercado', 'historico', `${c}.json`));
    // `conferido` marca um histórico montado com todos os arquivos anuais: nele, um buraco é real
    // (papel suspenso ou sem negócios) e não motivo para refazer.
    const completo = h?.pontos?.length && !h.incompleto && (h.conferido || !temBuraco(h.pontos)) && (h.pontos.length > 200 || h.semMaisHistorico);
    if (completo) existentes[c] = h; else faltam.add(c);
  }
  if (faltam.size) {
    log(`montando histórico de ${faltam.size} papéis a partir dos arquivos anuais da B3`);
    const series = Object.fromEntries([...faltam].map((c) => [c, []])), anosFalhos = [];
    const anoFim = Number(dia.data.slice(0, 4));
    for (let ano = anoFim - ANOS; ano <= anoFim; ano++) {
      let zip;
      try { zip = await baixar(`${URL_BASE}/COTAHIST_A${ano}.ZIP`, `COTAHIST_A${ano}.zip`); } catch (e) { log(`sem arquivo anual de ${ano}: ${e.message}`); anosFalhos.push(ano); continue; }
      for await (const l of linhasDoZip(zip, `COTAHIST_A${ano}.TXT`)) {
        if (l.slice(0, 2) !== '01' || l.slice(24, 27) !== '010') continue;
        const cod = l.slice(12, 24).trim();
        if (series[cod] && AVISTA.has(l.slice(10, 12))) series[cod].push([dataISO(l.slice(2, 10)), num(l.slice(108, 121))]);
      }
      if (process.env.CI) await rm(zip, { force: true }); // libera disco no GitHub Actions
    }
    // Com algum ano em falta, o histórico é gravado como incompleto e refeito na próxima execução.
    if (anosFalhos.length) console.log(`::warning::históricos incompletos: faltou o arquivo anual de ${anosFalhos.join(', ')}`);
    for (const [c, pontos] of Object.entries(series)) existentes[c] = { codigo: c, pontos: pontos.sort((a, b) => (a[0] < b[0] ? -1 : 1)), semMaisHistorico: !anosFalhos.length && pontos.length <= 200, incompleto: anosFalhos.length > 0, conferido: !anosFalhos.length };
  }
  let gravados = 0;
  for (const c of universo) {
    const h = existentes[c]; if (!h) continue;
    const pontos = h.pontos.filter(([d]) => d !== dia.data);
    pontos.push([dia.data, ativos[c][0]]);
    const ajustados = ajustarEventos(pontos.sort((a, b) => (a[0] < b[0] ? -1 : 1)).slice(-ANOS * 260));
    if (await gravarJSON(join(DESTINO, 'mercado', 'historico', `${c}.json`), { codigo: c, fonte: 'B3, fechamentos oficiais; ajustado por desdobramentos, sem ajuste por proventos', atualizadoEm: agora(), ...(h.semMaisHistorico ? { semMaisHistorico: true } : {}), ...(h.incompleto ? { incompleto: true } : {}), ...(h.conferido ? { conferido: true } : {}), pontos: ajustados })) gravados++;
  }
  log(`${dia.data}: ${Object.keys(ativos).length} ativos, ${Object.keys(bases).length} bases com opções, ${gravados} históricos atualizados (cache em ${CACHE})`);
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('b3.mjs')) principal().catch((e) => { console.error(e); process.exit(1); });

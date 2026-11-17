// Logotipos dos ativos: cópia local dos ícones quadrados do brapi (icons.brapi.dev), conferidos e
// padronizados. O portal nunca chama o serviço de logotipos ao abrir uma página: usa só as cópias.
//
// Dois modos:
//  - público (padrão): as companhias com dados da CVM (Portal/dados/empresas/indice.json). Grava um
//    SVG por companhia em Portal/assets/logos/<cvm>.svg e o índice em Portal/dados/logos.json.
//  - privado (--destino pasta): os códigos acompanhados do monitor.json do repositório privado
//    (ações, ETFs, FIIs, BDRs da carteira). Grava mercado/logos.json com os SVGs conferidos, no
//    repositório privado, porque a lista revela o que a carteira tem.
//
// Por que assim (decisão registrada no Vault, Arquitetura de dados e armazenamento):
//  - Os ícones já vêm em formato de ícone de app (quadrado com fundo da marca), coerentes entre si;
//    o Wikidata cobre menos (110 de 339) e traz logotipos largos, alguns antigos.
//  - Copiar no momento da coleta evita depender do serviço a cada visita, não revela a terceiros o
//    que a pessoa consulta e funciona sem sinal.
//  - Marcas são de seus titulares; o uso é só para identificar o ativo. O índice registra a fonte e a
//    data de cada arquivo, e `coleta/logos-ajustes.json` permite excluir ou trocar um logotipo.
//
// Uso: node coleta/logos.mjs [--destino pasta] [--refazer]
import { join } from 'node:path';
import { readFile, writeFile, mkdir, readdir, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { DADOS, RAIZ, gravarJSON, lerJSON, agora, log } from './util.mjs';

const arg = (n, p) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : p; };
const DESTINO = arg('destino', null);
const REFAZER = process.argv.includes('--refazer');
const FONTE = 'https://icons.brapi.dev/icons';
const PASTA = join(RAIZ, 'Portal', 'assets', 'logos');
const MAX_BYTES = 60 * 1024;
const VALIDADE_DIAS = 90;         // um logotipo baixado é conferido de novo depois disso
const NOVA_TENTATIVA_DIAS = 7;    // um código sem logotipo é procurado de novo depois disso

// Confere o SVG recebido. Ele só é exibido por <img> (onde scripts não rodam), mas a regra é não
// guardar nada que possa agir: sem script, sem objeto estrangeiro, sem eventos, sem referência
// externa, sem entidades. Devolve o texto limpo ou null.
export function conferirSVG(texto) {
  if (typeof texto !== 'string') return null;
  const t = texto.replace(/^﻿/, '').trim();
  if (!t || Buffer.byteLength(t) > MAX_BYTES) return null;
  if (!/^(<\?xml[^>]*>\s*)?<svg[\s>]/i.test(t) || !/<\/svg>\s*$/i.test(t)) return null;
  if (/<script|<foreignObject|<!ENTITY|<!DOCTYPE|<iframe|<embed|<object/i.test(t)) return null;
  if (/\son[a-z]+\s*=/i.test(t)) return null;
  if (/(href|src)\s*=\s*["']\s*(?!#|data:image\/(png|jpe?g|gif|webp);)/i.test(t)) return null;
  if (/url\(\s*["']?\s*(?!#)/i.test(t)) return null;
  return t.replace(/^<\?xml[^>]*>\s*/i, '');
}

async function baixar(codigo) {
  try {
    const r = await fetch(`${FONTE}/${encodeURIComponent(codigo)}.svg`, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; coleta-dados-abertos)' }, signal: AbortSignal.timeout(15000) });
    if (r.status === 404) return { status: 'ausente' };
    if (!r.ok) return { status: 'falha', erro: `HTTP ${r.status}` };
    if (!/svg/.test(r.headers.get('content-type') || '')) return { status: 'recusado', erro: 'não é SVG' };
    const svg = conferirSVG(await r.text());
    return svg ? { status: 'ok', svg } : { status: 'recusado', erro: 'SVG fora das regras' };
  } catch (e) { return { status: 'falha', erro: e.message }; }
}

async function emLote(itens, fn, simultaneos = 6) {
  const fila = [...itens], saida = [];
  await Promise.all(Array.from({ length: simultaneos }, async () => { while (fila.length) { const x = fila.shift(); saida.push(await fn(x)); } }));
  return saida;
}

const dias = (iso) => (Date.now() - Date.parse(iso || 0)) / 864e5;
const hash = (t) => createHash('sha256').update(t).digest('hex').slice(0, 16);

// Um mesmo desenho em muitos códigos diferentes é ícone genérico do serviço, não logotipo.
function marcarGenericos(resultados) {
  const freq = {};
  for (const r of resultados) if (r.svg) freq[hash(r.svg)] = (freq[hash(r.svg)] || 0) + 1;
  for (const r of resultados) if (r.svg && freq[hash(r.svg)] > 3) { r.status = 'generico'; delete r.svg; }
}

async function publico() {
  const indice = await lerJSON(join(DADOS, 'empresas', 'indice.json'));
  if (!indice?.empresas?.length) throw new Error('Sem o índice das companhias: rode antes coleta/cvm.mjs');
  const ajustes = (await lerJSON(join(RAIZ, 'coleta', 'logos-ajustes.json'))) || { excluir: [], codigo: {} };
  const anterior = (await lerJSON(join(DADOS, 'logos.json'))) || { empresas: {} };
  await mkdir(PASTA, { recursive: true });

  const pedidos = [];
  for (const e of indice.empresas) {
    const cvm = String(e.cvm);
    if (ajustes.excluir?.includes(cvm)) continue;
    const a = anterior.empresas[cvm];
    const codigo = ajustes.codigo?.[cvm] || e.tickers?.[0];
    if (!codigo) continue;
    const vencido = !a || REFAZER || (a.arquivo ? dias(a.obtidoEm) > VALIDADE_DIAS : dias(a.procuradoEm) > NOVA_TENTATIVA_DIAS);
    if (vencido) pedidos.push({ cvm, codigo });
  }
  log(`logotipos: ${pedidos.length} de ${indice.empresas.length} companhias para buscar`);
  const resultados = await emLote(pedidos, async (p) => ({ ...p, ...(await baixar(p.codigo)) }));
  marcarGenericos(resultados);

  const empresas = { ...anterior.empresas };
  let novos = 0, falhas = 0;
  for (const r of resultados) {
    if (r.status === 'ok') {
      const arquivo = `${r.cvm}.svg`, caminho = join(PASTA, arquivo);
      const atual = await readFile(caminho, 'utf8').catch(() => null);
      if (atual !== r.svg) { await writeFile(caminho, r.svg); novos++; }
      empresas[r.cvm] = { arquivo, codigo: r.codigo, hash: hash(r.svg), obtidoEm: agora().slice(0, 10) };
    } else if (r.status === 'falha') {
      falhas++; // falha de rede: mantém o que havia
    } else {
      // Sem logotipo (ausente, genérico ou recusado): remove a cópia antiga, se houver, e anota a procura.
      if (empresas[r.cvm]?.arquivo) await rm(join(PASTA, empresas[r.cvm].arquivo), { force: true });
      empresas[r.cvm] = { arquivo: null, codigo: r.codigo, motivo: r.status, procuradoEm: agora().slice(0, 10) };
    }
  }
  // Companhia excluída nos ajustes ou que saiu do índice: some também a cópia.
  const validas = new Set(indice.empresas.map((e) => String(e.cvm)).filter((c) => !ajustes.excluir?.includes(c)));
  for (const cvm of Object.keys(empresas)) if (!validas.has(cvm)) { if (empresas[cvm].arquivo) await rm(join(PASTA, empresas[cvm].arquivo), { force: true }); delete empresas[cvm]; }
  for (const f of await readdir(PASTA)) if (f.endsWith('.svg') && !Object.values(empresas).some((x) => x.arquivo === f)) await rm(join(PASTA, f), { force: true });

  const com = Object.values(empresas).filter((x) => x.arquivo).length;
  await gravarJSON(join(DADOS, 'logos.json'), { geradoEm: agora(), fonte: 'brapi (icons.brapi.dev), cópia conferida', aviso: 'Marcas de seus titulares, usadas só para identificar o ativo.', empresas }, { compacto: false });
  log(`logotipos: ${com} companhias com logotipo, ${novos} arquivos novos ou trocados, ${falhas} falhas de rede`);
  if (falhas > pedidos.length / 2 && pedidos.length > 10) throw new Error('Mais da metade das buscas de logotipo falhou: o serviço pode estar fora do ar');
}

// Privado: os códigos da carteira, inclusive ETFs e FIIs, num só arquivo do repositório privado.
async function privado() {
  const monitor = (await lerJSON(join(DESTINO, 'monitor.json'))) || { codigos: [] };
  const caminho = join(DESTINO, 'mercado', 'logos.json');
  const anterior = (await lerJSON(caminho)) || { ativos: {} };
  const ativos = {};
  const pedidos = [];
  for (const c of monitor.codigos || []) {
    const a = anterior.ativos[c];
    const vencido = !a || REFAZER || (a.svg ? dias(a.obtidoEm) > VALIDADE_DIAS : dias(a.procuradoEm) > NOVA_TENTATIVA_DIAS);
    if (vencido) pedidos.push({ codigo: c }); else ativos[c] = a;
  }
  // Sem o filtro de ícone genérico: na carteira, vários ETFs do mesmo gestor (iShares: BOVA11, IVVB11,
  // SMAL11) trazem, com razão, o mesmo logotipo. O serviço responde 404 quando não tem o código.
  const resultados = await emLote(pedidos, async (p) => ({ ...p, ...(await baixar(p.codigo)) }));
  for (const r of resultados) {
    if (r.status === 'ok') ativos[r.codigo] = { svg: r.svg, obtidoEm: agora().slice(0, 10) };
    else if (r.status === 'falha' && anterior.ativos[r.codigo]) ativos[r.codigo] = anterior.ativos[r.codigo];
    else ativos[r.codigo] = { svg: null, motivo: r.status, procuradoEm: agora().slice(0, 10) };
  }
  await gravarJSON(caminho, { geradoEm: agora(), fonte: 'brapi (icons.brapi.dev), cópia conferida', ativos });
  log(`logotipos privados: ${Object.values(ativos).filter((x) => x.svg).length} de ${Object.keys(ativos).length} códigos com logotipo`);
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('logos.mjs')) (DESTINO ? privado() : publico()).catch((e) => { console.error(e); process.exit(1); });

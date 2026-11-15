// Utilitários da coleta (Node 20+, sem dependências). Os scripts desta pasta rodam no GitHub
// Actions e na máquina local; gravam JSON em Portal/dados (dados abertos, publicados) ou na pasta
// indicada por DESTINO_PRIVADO (cotações, no repositório privado).
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { mkdir, writeFile, stat, readFile } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

export const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
export const DADOS = join(RAIZ, 'Portal', 'dados');
export const CACHE = process.env.COLETA_CACHE || join(RAIZ, 'coleta', '.cache');
const AGENTE = 'Mozilla/5.0 (compatible; coleta-dados-abertos)';

export const hoje = () => new Date().toISOString().slice(0, 10);
export const agora = () => new Date().toISOString();
export const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

export async function buscar(url, { tentativas = 3, espera = 2000, ...opcoes } = {}) {
  let erro;
  for (let t = 1; t <= tentativas; t++) {
    try {
      const r = await fetch(url, { ...opcoes, headers: { 'User-Agent': AGENTE, ...(opcoes.headers || {}) }, signal: AbortSignal.timeout(120000) });
      if (r.ok) return r;
      erro = new Error(`HTTP ${r.status} em ${url}`);
      if (r.status === 404) break;
    } catch (e) { erro = e; }
    if (t < tentativas) await new Promise((ok) => setTimeout(ok, espera * t));
  }
  throw erro;
}
export const buscarJSON = async (url, o) => (await buscar(url, o)).json();
export const buscarTexto = async (url, o) => (await buscar(url, o)).text();

// Baixa para o cache; se o arquivo já existe com o mesmo tamanho do servidor, não baixa de novo.
export async function baixar(url, nome) {
  const destino = join(CACHE, nome);
  await mkdir(dirname(destino), { recursive: true });
  try {
    const local = await stat(destino);
    const cabeca = await fetch(url, { method: 'HEAD', headers: { 'User-Agent': AGENTE }, signal: AbortSignal.timeout(30000) });
    if (cabeca.ok && Number(cabeca.headers.get('content-length')) === local.size) return destino;
  } catch { /* não existe ou não foi possível conferir: baixa */ }
  const r = await buscar(url);
  await pipeline(Readable.fromWeb(r.body), createWriteStream(destino));
  return destino;
}

// Lê um CSV de dentro de um zip, linha a linha, sem descompactar em disco (os arquivos da CVM
// passam de 100 MB). Usa o `unzip` do sistema; a codificação da CVM é Latin-1.
export async function* linhasDoZip(zip, arquivo, { codificacao = 'latin1' } = {}) {
  const proc = spawn('unzip', ['-p', zip, arquivo], { stdio: ['ignore', 'pipe', 'pipe'] });
  let erro = '';
  proc.stderr.on('data', (d) => { erro += d; });
  proc.stdout.setEncoding(codificacao);
  const leitor = createInterface({ input: proc.stdout, crlfDelay: Infinity });
  for await (const linha of leitor) yield linha;
  const codigo = await new Promise((ok) => (proc.exitCode != null ? ok(proc.exitCode) : proc.on('close', ok)));
  if (codigo !== 0 && codigo !== 11) throw new Error(`unzip falhou (${codigo}) em ${arquivo}: ${erro.trim()}`); // 11: arquivo ausente no zip
}

// Linhas de CSV com cabeçalho → objetos. Campos extras (um ";" dentro de um texto) são devolvidos
// ao campo indicado em `campoLivre`, para não deslocar as colunas seguintes.
export async function* registros(linhas, { separador = ';', campoLivre = null } = {}) {
  let cab = null;
  for await (const linha of linhas) {
    if (!linha) continue;
    const partes = linha.split(separador);
    if (!cab) { cab = partes.map((c) => c.trim().replace(/^﻿/, '')); continue; }
    if (partes.length > cab.length && campoLivre) {
      const i = cab.indexOf(campoLivre), sobra = partes.length - cab.length;
      partes.splice(i, sobra + 1, partes.slice(i, i + sobra + 1).join(separador));
    }
    const o = {};
    for (let i = 0; i < cab.length; i++) o[cab[i]] = partes[i] ?? '';
    yield o;
  }
}

export async function gravarJSON(caminho, dados, { compacto = true } = {}) {
  await mkdir(dirname(caminho), { recursive: true });
  const texto = compacto ? JSON.stringify(dados) : JSON.stringify(dados, null, 1);
  // Não regrava (nem gera commit) se o conteúdo, sem o carimbo de hora, não mudou.
  try {
    const antigo = await readFile(caminho, 'utf8');
    const semCarimbo = (t) => t.replace(/"(geradoEm|atualizadoEm)":"[^"]*"/g, '');
    if (semCarimbo(antigo) === semCarimbo(texto)) return false;
  } catch { /* arquivo novo */ }
  await writeFile(caminho, texto);
  return true;
}
export const lerJSON = async (caminho, padrao = null) => { try { return JSON.parse(await readFile(caminho, 'utf8')); } catch { return padrao; } };

export const numeroBR = (t) => { const v = Number(String(t).replace(/\./g, '').replace(',', '.')); return Number.isFinite(v) ? v : null; };
export const dataBR = (t) => { const m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(String(t)); return m ? `${m[3]}-${m[2]}-${m[1]}` : null; };
export const mesesEntre = (ini, fim) => { const a = new Date(ini + 'T00:00:00Z'), b = new Date(fim + 'T00:00:00Z'); return Math.round((b - a) / (864e5 * 30.4375)); };

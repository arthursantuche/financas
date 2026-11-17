// Monta a pasta que vai para o GitHub Pages: copia Portal/ e preenche o service worker com a
// versão (identificador do commit) e a lista de arquivos a guardar para uso sem sinal.
// Uso: node coleta/publicar.mjs <pasta de saída> [versão]
import { cp, readdir, readFile, writeFile, rm } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { RAIZ, log } from './util.mjs';

const saida = process.argv[2] || join(RAIZ, '_site');
const versao = (process.argv[3] || process.env.GITHUB_SHA || String(Date.now())).slice(0, 12);
await rm(saida, { recursive: true, force: true });
await cp(join(RAIZ, 'Portal'), saida, { recursive: true });

async function listar(pasta) {
  const itens = [];
  for (const e of await readdir(pasta, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue;
    const caminho = join(pasta, e.name);
    if (e.isDirectory()) itens.push(...await listar(caminho)); else itens.push(relative(saida, caminho).split('\\').join('/'));
  }
  return itens;
}
const todos = await listar(saida);
// Guardados de saída: o site inteiro menos os dados por companhia (5 MB), os logotipos (entram no
// cache ao serem vistos, um a um) e a demonstração.
const guardar = ['./', ...todos.filter((f) => f !== 'sw.js' && !f.startsWith('dados/empresas/0') && !f.startsWith('assets/logos/') && !f.startsWith('dados/amostra/') && !f.endsWith('.DS_Store'))];
const sw = (await readFile(join(saida, 'sw.js'), 'utf8')).replace('__VERSAO__', versao).replace('self.__ARQUIVOS__ || [\'./\', \'index.html\', \'manifest.webmanifest\']', JSON.stringify(guardar));
if (sw.includes('__VERSAO__') || sw.includes('__ARQUIVOS__')) throw new Error('sw.js não foi preenchido: o modelo mudou?');
await writeFile(join(saida, 'sw.js'), sw);
// Segurança: nada com cara de segredo ou de dado privado pode ir para o ar.
const suspeitos = [];
for (const f of todos.filter((x) => /\.(js|json|html|md|css|mjs)$/.test(x))) {
  const t = await readFile(join(saida, f), 'utf8');
  if (/github_pat_[A-Za-z0-9_]{20,}|ghp_[A-Za-z0-9]{30,}|AIza[0-9A-Za-z_-]{30,}|gsk_[A-Za-z0-9]{30,}|sk-[A-Za-z0-9]{30,}/.test(t)) suspeitos.push(f);
}
if (suspeitos.length) throw new Error(`Possível credencial em: ${suspeitos.join(', ')}`);
log(`site montado em ${saida}: ${todos.length} arquivos, ${guardar.length} no cache inicial, versão ${versao}`);

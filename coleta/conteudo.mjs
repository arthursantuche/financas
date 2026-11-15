// Monta Portal/conteudo/indice.json a partir das trilhas (trilhas.json) e do cabeçalho de cada
// artigo em Markdown. Quem escreve só mexe nos .md: rode este script depois de criar ou editar.
// Uso: node coleta/conteudo.mjs
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { RAIZ, gravarJSON, agora, log } from './util.mjs';
import { separar } from '../Portal/assets/js/markdown.js';

const PASTA = join(RAIZ, 'Portal', 'conteudo');
const trilhas = JSON.parse(await readFile(join(PASTA, 'trilhas.json'), 'utf8'));
const artigos = [], problemas = [];
for (const pasta of await readdir(PASTA, { withFileTypes: true })) {
  if (!pasta.isDirectory()) continue;
  for (const arq of await readdir(join(PASTA, pasta.name))) {
    if (!arq.endsWith('.md')) continue;
    const { meta, corpo } = separar(await readFile(join(PASTA, pasta.name, arq), 'utf8'));
    const slug = arq.replace(/\.md$/, '');
    for (const campo of ['titulo', 'resumo', 'trilha', 'nivel', 'atualizado']) if (!meta[campo]) problemas.push(`${pasta.name}/${arq}: falta "${campo}"`);
    if (![meta.fonte].flat().filter(Boolean).length) problemas.push(`${pasta.name}/${arq}: sem fonte`);
    const palavras = corpo.replace(/[#*|`:>-]/g, ' ').split(/\s+/).filter(Boolean).length;
    artigos.push({ slug, arquivo: `${pasta.name}/${slug}`, titulo: meta.titulo, resumo: meta.resumo, trilha: meta.trilha, ordem: Number(meta.ordem) || 99, nivel: Number(meta.nivel) || 1, temas: [meta.temas].flat().filter(Boolean), minutos: Math.max(2, Math.round(palavras / 200)), atualizado: meta.atualizado });
  }
}
const repetidos = artigos.map((a) => a.slug).filter((s, i, l) => l.indexOf(s) !== i);
if (repetidos.length) problemas.push(`slugs repetidos: ${repetidos.join(', ')}`);
for (const a of artigos) if (!trilhas.some((t) => t.id === a.trilha)) problemas.push(`${a.arquivo}: trilha "${a.trilha}" não existe`);
if (problemas.length) { console.error(problemas.join('\n')); process.exit(1); }
const saida = trilhas.map((t) => ({ ...t, artigos: artigos.filter((a) => a.trilha === t.id).sort((a, b) => a.ordem - b.ordem).map(({ trilha, ordem, ...resto }) => resto) }));
await gravarJSON(join(PASTA, 'indice.json'), { geradoEm: agora(), trilhas: saida }, { compacto: false });
log(`${artigos.length} artigos em ${saida.filter((t) => t.artigos.length).length} trilhas`);

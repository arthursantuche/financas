// Logotipo de um ativo, no formato de ícone de app: quadrado de cantos arredondados, com contorno de
// 1px para o ícone de fundo branco não se perder na página clara.
//
// De onde vem (Vault, Arquitetura de dados e armazenamento, "Imagens"):
//  1. cópia pública em assets/logos/<cvm>.svg, para as companhias com dados da CVM
//     (índice em dados/logos.json, gerado por coleta/logos.mjs);
//  2. fontes extras registradas pela área privada (os logotipos de ETFs e FIIs da carteira, que
//     ficam no repositório privado) — ver `registrarFonte`;
//  3. sem nenhuma das duas: monograma com as letras do código, no mesmo formato.
// O portal nunca busca logotipo em serviço de terceiros ao abrir a página. A imagem só entra no lugar
// do monograma depois de decodificada, sem piscar; se falhar, fica o monograma.
import { el } from './util.js';
import { ler, indiceEmpresas } from './dados.js';

const fontes = [];
export const registrarFonte = (fn) => { fontes.push(fn); };

let indice = null, porTicker = null;
async function preparar() {
  indice ||= ler('dados/logos.json').catch(() => ({ empresas: {} }));
  porTicker ||= indiceEmpresas().then(({ empresas }) => {
    const m = new Map();
    for (const e of empresas) for (const t of e.tickers || []) {
      m.set(t, String(e.cvm));
      // Raiz de quatro letras (PETR, VALE): serve às opções (PETRL460) e a classes sem ticker próprio no índice.
      if (!m.has(`raiz:${t.slice(0, 4)}`)) m.set(`raiz:${t.slice(0, 4)}`, String(e.cvm));
    }
    return m;
  }).catch(() => new Map());
  return Promise.all([indice, porTicker]);
}

// Endereço do logotipo de um código ou de uma companhia, ou null.
export async function enderecoLogo({ codigo = null, cvm = null } = {}) {
  const [ind, mapa] = await preparar();
  const cod = String(codigo || '').toUpperCase();
  // Ação ou unit pelo código exato; opção (quatro letras, letra de série, número) pela raiz da ação.
  const c = cvm ? String(cvm) : cod ? mapa.get(cod) || mapa.get(cod.replace(/F$/, '')) || (/^[A-Z]{4}[A-X]\d{2,4}[A-Z]?$/.test(cod) ? mapa.get(`raiz:${cod.slice(0, 4)}`) : null) : null;
  const arq = c && ind.empresas?.[c]?.arquivo;
  if (arq) return `assets/logos/${arq}`;
  for (const f of fontes) { try { const u = await f(codigo); if (u) return u; } catch { /* fonte indisponível: segue */ } }
  return null;
}

// Letras do monograma: a raiz do código (PETR, BOVA, HGLG) ou as iniciais do nome.
export function letras({ codigo, nome }) {
  if (codigo) return String(codigo).toUpperCase().replace(/\d+F?$/, '').slice(0, 4) || String(codigo).slice(0, 4);
  const palavras = String(nome || '?').replace(/\b(de|da|do|das|dos|e|s\.?a\.?)\b/gi, ' ').trim().split(/\s+/);
  return (palavras.length > 1 ? palavras[0][0] + palavras[1][0] : palavras[0].slice(0, 2)).toUpperCase();
}

// tamanho: 'p' (32px, listas), 'm' (44px, linhas da carteira), 'g' (64px, cabeçalho de página).
export function marca({ codigo = null, cvm = null, nome = '', tamanho = 'm' } = {}) {
  const txt = letras({ codigo, nome });
  const no = el('span', { class: `marca marca--${tamanho}`, 'aria-hidden': 'true', dataset: { letras: String(txt.length) } }, el('span', { class: 'marca__monograma' }, txt));
  if (codigo || cvm) {
    enderecoLogo({ codigo, cvm }).then(async (url) => {
      if (!url) return;
      const img = new Image();
      img.alt = ''; img.decoding = 'async'; img.src = url;
      await img.decode();
      no.replaceChildren(img); no.dataset.logo = '';
    }).catch(() => { /* fica o monograma */ });
  }
  return no;
}

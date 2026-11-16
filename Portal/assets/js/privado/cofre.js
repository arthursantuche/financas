// Cofre: os dados privados (carteira, alertas, relatórios, ajustes) vivem cifrados no aparelho e,
// se a nuvem estiver ligada, cifrados também no repositório privado (sincronia.js).
//
// Como funciona
//  - Uma chave mestra aleatória (AES-GCM de 256 bits) cifra os dados.
//  - A chave mestra é guardada "embrulhada" duas vezes: pela senha (PBKDF2-SHA-256, 600 mil
//    iterações, sal aleatório + nome de usuário) e pela chave de recuperação mostrada na criação.
//  - Entrar é conseguir desembrulhar a chave: não existe servidor conferindo senha, e sem a senha
//    nem a chave de recuperação os dados não podem ser lidos por ninguém.
//  - A chave mestra fica só na memória. "Manter aberto neste aparelho" guarda no IndexedDB uma
//    cópia não exportável (o navegador usa, mas nenhum código consegue ler os bytes).
// Detalhes e modelo de ameaças: Vault, Referência técnica - Portal Finanças, seção 7 (Segurança).

const ITERACOES = 600000;
const NOME_BD = 'financas', LOJA = 'cofre';
const te = new TextEncoder(), td = new TextDecoder();

// ---- IndexedDB (chave → valor) ----
let conexao = null;
function bd() {
  conexao ||= new Promise((ok, falha) => {
    const p = indexedDB.open(NOME_BD, 1);
    p.onupgradeneeded = () => p.result.createObjectStore(LOJA);
    p.onsuccess = () => ok(p.result);
    p.onerror = () => falha(p.error);
  });
  return conexao;
}
async function operar(modo, fn) {
  const base = await bd();
  return new Promise((ok, falha) => {
    const t = base.transaction(LOJA, modo), pedido = fn(t.objectStore(LOJA));
    t.oncomplete = () => ok(pedido?.result);
    t.onerror = t.onabort = () => falha(t.error);
  });
}
export const guardar = (k, v) => operar('readwrite', (l) => l.put(v, k));
export const obter = (k) => operar('readonly', (l) => l.get(k));
export const apagar = (k) => operar('readwrite', (l) => l.delete(k));

// ---- Codificação ----
export const b64 = (buf) => { let s = ''; const b = new Uint8Array(buf); for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return btoa(s); };
export const deB64 = (t) => Uint8Array.from(atob(t), (c) => c.charCodeAt(0));
const B32 = 'ABCDEFGHJKMNPQRSTVWXYZ23456789'; // sem I, L, O, U, 0 e 1, que se confundem
function codigoLegivel(bytes) {
  let s = '';
  for (const b of bytes) s += B32[b % B32.length];
  return s.match(/.{1,5}/g).join('-');
}
const limparCodigo = (c) => String(c).toUpperCase().replace(/[^A-Z0-9]/g, '');
const acaso = (n) => crypto.getRandomValues(new Uint8Array(n));

// ---- Criptografia ----
async function chaveDaSenha(segredo, sal, iteracoes) {
  const material = await crypto.subtle.importKey('raw', te.encode(segredo), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: sal, iterations: iteracoes, hash: 'SHA-256' }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
const salCom = (sal, usuario) => { const u = te.encode(String(usuario).trim().toLowerCase()); const r = new Uint8Array(sal.length + u.length); r.set(sal); r.set(u, sal.length); return r; };
async function embrulhar(bruta, segredo, usuario, iteracoes = ITERACOES) {
  const sal = acaso(16), iv = acaso(12);
  const k = await chaveDaSenha(segredo, salCom(sal, usuario), iteracoes);
  return { sal: b64(sal), iv: b64(iv), iteracoes, cifra: b64(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, bruta)) };
}
async function desembrulhar(e, segredo, usuario) {
  const k = await chaveDaSenha(segredo, salCom(deB64(e.sal), usuario), e.iteracoes);
  return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: deB64(e.iv) }, k, deB64(e.cifra)));
}
const importarMestra = (bruta) => crypto.subtle.importKey('raw', bruta, 'AES-GCM', false, ['encrypt', 'decrypt']);

export async function cifrar(objeto, chave = sessao.chave) {
  const iv = acaso(12);
  return { v: 1, iv: b64(iv), cifra: b64(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, chave, te.encode(JSON.stringify(objeto)))) };
}
export async function decifrar(pacote, chave = sessao.chave) {
  return JSON.parse(td.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: deB64(pacote.iv) }, chave, deB64(pacote.cifra))));
}

// ---- Estado ----
export const COLECOES = ['ativos', 'lancamentos', 'alertas', 'relatorios', 'observados'];
const estadoVazio = () => ({
  versao: 1, ativos: [], lancamentos: [], alertas: [], relatorios: [], observados: [],
  config: { perfil: 'moderado', horizonteAnos: 5, tetoPorAtivo: 0.15, indiceReferencia: 'CDI', llm: null, enviarCarteiraAoLLM: false, atualizadoEm: null },
});

export const sessao = { aberta: false, usuario: null, chave: null, dados: null, nuvem: null, amostra: false, pendente: false };
const ouvintes = new Set();
export const aoMudar = (fn) => { ouvintes.add(fn); return () => ouvintes.delete(fn); };
const avisarOuvintes = (motivo) => ouvintes.forEach((f) => { try { f(motivo); } catch (e) { console.error(e); } });

export class ErroCofre extends Error {}

export const existeCofre = async () => !!(await obter('meta'));
export const metaLocal = () => obter('meta');

// A força mínima evita senhas triviais: como não há servidor limitando tentativas, quem copiar o
// cofre cifrado pode testar senhas à vontade, e só o tamanho da senha o impede.
export function avaliarSenha(senha) {
  const s = String(senha || '');
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(s)).length;
  if (s.length < 12) return { ok: false, motivo: 'Use pelo menos 12 caracteres. Uma frase de quatro palavras funciona bem.' };
  if (classes < 2 && s.length < 20) return { ok: false, motivo: 'Misture letras com números ou símbolos, ou use uma frase com 20 caracteres ou mais.' };
  if (/^(.)\1+$/.test(s) || /^(1234|abcd|senha|password)/i.test(s)) return { ok: false, motivo: 'Essa senha é fácil de adivinhar.' };
  return { ok: true };
}

async function abrirCom(bruta, meta) {
  sessao.chave = await importarMestra(bruta);
  bruta.fill(0);
  sessao.usuario = meta.usuario;
  const pacote = await obter('dados');
  sessao.dados = pacote ? { ...estadoVazio(), ...(await decifrar(pacote)) } : estadoVazio();
  const nuvem = await obter('nuvem');
  sessao.nuvem = nuvem ? await decifrar(nuvem) : null;
  sessao.pendente = !!(await obter('pendente'));
  sessao.aberta = true;
  avisarOuvintes('abriu');
}

export async function criarCofre({ usuario, senha }) {
  if (await existeCofre()) throw new ErroCofre('Já existe um cofre neste aparelho.');
  const forca = avaliarSenha(senha);
  if (!forca.ok) throw new ErroCofre(forca.motivo);
  if (!String(usuario || '').trim()) throw new ErroCofre('Informe um nome de usuário.');
  const bruta = acaso(32), codigo = codigoLegivel(acaso(25));
  const meta = {
    versao: 1, usuario: String(usuario).trim(), criadoEm: new Date().toISOString(),
    senha: await embrulhar(bruta, senha, usuario),
    recuperacao: await embrulhar(bruta, limparCodigo(codigo), usuario, 10000), // o código já tem ~120 bits de acaso
  };
  await guardar('meta', meta);
  await abrirCom(bruta, meta);
  await salvar();
  return { codigoRecuperacao: codigo };
}

export async function abrirCofre({ usuario, senha, manter = false }) {
  const meta = await obter('meta');
  if (!meta) throw new ErroCofre('Não há cofre neste aparelho.');
  let bruta;
  try { bruta = await desembrulhar(meta.senha, senha, usuario); } catch { throw new ErroCofre('Usuário ou senha incorretos.'); }
  await abrirCom(bruta, meta);
  if (manter) await guardar('sessao', { chave: sessao.chave, ate: Date.now() + 30 * 864e5 }); else await apagar('sessao');
}

// Reabre sem senha quando "manter aberto" foi marcado e o prazo não venceu.
export async function retomar() {
  const s = await obter('sessao'), meta = await obter('meta');
  if (!s || !meta || s.ate < Date.now()) { if (s) await apagar('sessao'); return false; }
  sessao.chave = s.chave; sessao.usuario = meta.usuario;
  try {
    const pacote = await obter('dados');
    sessao.dados = pacote ? { ...estadoVazio(), ...(await decifrar(pacote)) } : estadoVazio();
    const nuvem = await obter('nuvem');
    sessao.nuvem = nuvem ? await decifrar(nuvem) : null;
  } catch { await apagar('sessao'); sessao.chave = null; return false; }
  sessao.pendente = !!(await obter('pendente'));
  sessao.aberta = true;
  avisarOuvintes('abriu');
  return true;
}

export async function abrirComRecuperacao({ usuario, codigo, novaSenha }) {
  const meta = await obter('meta');
  if (!meta) throw new ErroCofre('Não há cofre neste aparelho.');
  const forca = avaliarSenha(novaSenha);
  if (!forca.ok) throw new ErroCofre(forca.motivo);
  let bruta;
  try { bruta = await desembrulhar(meta.recuperacao, limparCodigo(codigo), usuario); } catch { throw new ErroCofre('Usuário ou chave de recuperação incorretos.'); }
  meta.senha = await embrulhar(bruta, novaSenha, usuario);
  meta.senhaTrocadaEm = new Date().toISOString();
  await guardar('meta', meta);
  await abrirCom(bruta, meta);
  await marcarPendente('chaves');
}

export async function trocarSenha({ atual, nova }) {
  const meta = await obter('meta');
  const forca = avaliarSenha(nova);
  if (!forca.ok) throw new ErroCofre(forca.motivo);
  let bruta;
  try { bruta = await desembrulhar(meta.senha, atual, meta.usuario); } catch { throw new ErroCofre('A senha atual não confere.'); }
  meta.senha = await embrulhar(bruta, nova, meta.usuario);
  meta.senhaTrocadaEm = new Date().toISOString();
  bruta.fill(0);
  await guardar('meta', meta);
  await apagar('sessao');
  await marcarPendente('chaves');
}

// Instala neste aparelho um cofre que já existe na nuvem (sincronia.js baixa chaves e dados).
export async function instalarCofre({ meta, pacoteDados, usuario, senha }) {
  let bruta;
  try { bruta = await desembrulhar(meta.senha, senha, usuario); } catch { throw new ErroCofre('Usuário ou senha incorretos para o cofre da nuvem.'); }
  await guardar('meta', meta);
  if (pacoteDados) await guardar('dados', pacoteDados);
  await abrirCom(bruta, meta);
}

export async function bloquear() {
  await apagar('sessao');
  Object.assign(sessao, { aberta: false, chave: null, dados: null, nuvem: null, usuario: null, amostra: false, pendente: false });
  avisarOuvintes('bloqueou');
}

async function marcarPendente(oQue = 'dados') {
  if (sessao.amostra) return;
  const atual = (await obter('pendente')) || {};
  atual[oQue] = true;
  await guardar('pendente', atual);
  sessao.pendente = true;
}
export const limparPendente = async () => { await apagar('pendente'); sessao.pendente = false; };
export const pendencias = async () => (await obter('pendente')) || {};

export async function salvar(motivo = 'salvou') {
  if (!sessao.aberta) throw new ErroCofre('O cofre está fechado.');
  if (!sessao.amostra) {
    await guardar('dados', await cifrar(sessao.dados));
    await marcarPendente('dados');
  }
  avisarOuvintes(motivo);
}

export async function definirNuvem(config) {
  sessao.nuvem = config;
  if (config) await guardar('nuvem', await cifrar(config)); else await apagar('nuvem');
  avisarOuvintes('nuvem');
}

// ---- Registros: toda alteração carimba a hora, e remoção deixa uma lápide, para que a mescla
// entre aparelhos saiba qual versão é a mais nova e não ressuscite o que foi apagado.
export const lista = (colecao) => (sessao.dados?.[colecao] || []).filter((r) => !r.removido);
export const achar = (colecao, id) => lista(colecao).find((r) => r.id === id) || null;
export async function gravar(colecao, registro) {
  const agora = new Date().toISOString(), itens = sessao.dados[colecao];
  const i = itens.findIndex((r) => r.id === registro.id);
  const novo = { ...registro, atualizadoEm: agora, criadoEm: registro.criadoEm || (i >= 0 ? itens[i].criadoEm : agora) };
  delete novo.removido;
  if (i >= 0) itens[i] = novo; else itens.push(novo);
  await salvar();
  return novo;
}
export async function remover(colecao, id) {
  const itens = sessao.dados[colecao], i = itens.findIndex((r) => r.id === id);
  if (i < 0) return;
  itens[i] = { id, removido: true, atualizadoEm: new Date().toISOString() };
  await salvar();
}
export async function configurar(mudancas) {
  sessao.dados.config = { ...sessao.dados.config, ...mudancas, atualizadoEm: new Date().toISOString() };
  await salvar();
}

// Mescla dois estados registro a registro: vence o de atualizadoEm mais recente.
export function mesclar(local, remoto) {
  const r = { ...estadoVazio(), versao: Math.max(local.versao || 1, remoto.versao || 1) };
  let mudouLocal = false, mudouRemoto = false;
  for (const c of COLECOES) {
    const mapa = new Map();
    for (const x of remoto[c] || []) mapa.set(x.id, x);
    for (const x of local[c] || []) {
      const y = mapa.get(x.id);
      if (!y) { mapa.set(x.id, x); mudouRemoto = true; }
      else if ((x.atualizadoEm || '') > (y.atualizadoEm || '')) { mapa.set(x.id, x); mudouRemoto = true; }
      else if ((x.atualizadoEm || '') < (y.atualizadoEm || '')) mudouLocal = true;
    }
    if ((remoto[c] || []).some((x) => !(local[c] || []).some((y) => y.id === x.id))) mudouLocal = true;
    r[c] = [...mapa.values()];
  }
  const cl = local.config || {}, cr = remoto.config || {};
  if ((cl.atualizadoEm || '') >= (cr.atualizadoEm || '')) { r.config = { ...estadoVazio().config, ...cl }; if ((cl.atualizadoEm || '') > (cr.atualizadoEm || '')) mudouRemoto = true; }
  else { r.config = { ...estadoVazio().config, ...cr }; mudouLocal = true; }
  return { estado: r, mudouLocal, mudouRemoto };
}

// Cópia de segurança: o arquivo leva as chaves embrulhadas e os dados cifrados. Sem a senha (ou a
// chave de recuperação), o arquivo não revela nada.
export async function exportarCopia() {
  return JSON.stringify({ tipo: 'financas-copia', versao: 1, exportadoEm: new Date().toISOString(), meta: await obter('meta'), dados: await cifrar(sessao.dados) });
}
export async function importarCopia(texto, { usuario, senha }) {
  let copia;
  try { copia = JSON.parse(texto); } catch { throw new ErroCofre('O arquivo não é uma cópia de segurança válida.'); }
  if (copia.tipo !== 'financas-copia' || !copia.meta || !copia.dados) throw new ErroCofre('O arquivo não é uma cópia de segurança deste portal.');
  await instalarCofre({ meta: copia.meta, pacoteDados: copia.dados, usuario, senha });
  await marcarPendente('dados');
}

// Apaga tudo deste aparelho (não toca na nuvem).
export async function apagarDoAparelho() {
  for (const k of ['meta', 'dados', 'nuvem', 'sessao', 'pendente', 'mercado']) await apagar(k);
  await bloquear();
}

// Modo de demonstração (?amostra): carteira fictícia só na memória, sem gravar nada.
export function abrirAmostra(dados) {
  Object.assign(sessao, { aberta: true, amostra: true, usuario: 'demonstração', chave: null, nuvem: null, pendente: false, dados: { ...estadoVazio(), ...dados } });
  avisarOuvintes('abriu');
}

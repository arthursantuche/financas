// Sincronização com o repositório privado do dono, pela API do GitHub, com um token de escopo
// fino restrito a esse repositório. O que sobe:
//   cofre/chaves.json   chaves embrulhadas (inúteis sem a senha)
//   cofre/dados.json    estado cifrado (carteira, alertas, relatórios, ajustes)
//   monitor.json        em claro, só o que os robôs precisam: códigos acompanhados e gatilhos de
//                       alerta. Não leva quantidades, preços pagos nem valores.
// O que desce, gerado pelas rotinas do repositório privado: mercado/*.json (cotações e fechamento).
import { sessao, cifrar, decifrar, mesclar, guardar, obter, definirNuvem, pendencias, limparPendente, metaLocal, instalarCofre, lista, b64, deB64, ErroCofre } from './cofre.js';

const API_PADRAO = 'https://api.github.com';
const te = new TextEncoder(), td = new TextDecoder();
const utf8ParaB64 = (t) => b64(te.encode(t));
const b64ParaUtf8 = (t) => td.decode(deB64(t.replace(/\s/g, '')));

export class ErroNuvem extends Error { constructor(m, status) { super(m); this.status = status; } }

async function api(config, caminho, { metodo = 'GET', corpo = null, bruto = false } = {}) {
  let r;
  try {
    r = await fetch(`${config.api || API_PADRAO}/repos/${config.repo}${caminho ? `/${caminho}` : ''}`, {
      method: metodo,
      headers: { Authorization: `Bearer ${config.token}`, Accept: bruto ? 'application/vnd.github.raw+json' : 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...(corpo ? { 'Content-Type': 'application/json' } : {}) },
      body: corpo ? JSON.stringify(corpo) : undefined, cache: 'no-store',
    });
  } catch { throw new ErroNuvem('Sem conexão com o GitHub.', 0); }
  if (r.status === 401) throw new ErroNuvem('O GitHub recusou o token: ele pode ter expirado ou sido revogado.', 401);
  if (r.status === 403) throw new ErroNuvem('O token não tem permissão para esta operação.', 403);
  return r;
}

export async function lerArquivo(config, caminho) {
  const r = await api(config, `contents/${caminho}`);
  if (r.status === 404) return null;
  if (!r.ok) throw new ErroNuvem(`Falha ao ler ${caminho} (${r.status}).`, r.status);
  const j = await r.json();
  if (j.content) return { texto: b64ParaUtf8(j.content), sha: j.sha };
  // Acima de 1 MB a API não devolve o conteúdo: busca o blob.
  const blob = await (await api(config, `git/blobs/${j.sha}`)).json();
  return { texto: b64ParaUtf8(blob.content), sha: j.sha };
}
// Leitura sem sha, para os arquivos de mercado (podem passar de 1 MB).
export async function lerJSON(config, caminho) {
  const r = await api(config, `contents/${caminho}`, { bruto: true });
  if (r.status === 404) return null;
  if (!r.ok) throw new ErroNuvem(`Falha ao ler ${caminho} (${r.status}).`, r.status);
  return r.json();
}
export async function gravarArquivo(config, caminho, texto, sha, mensagem) {
  const r = await api(config, `contents/${caminho}`, { metodo: 'PUT', corpo: { message: mensagem, content: utf8ParaB64(texto), ...(sha ? { sha } : {}) } });
  if (r.status === 409 || r.status === 422) throw new ErroNuvem('O arquivo mudou no repositório.', 409);
  if (!r.ok) throw new ErroNuvem(`Falha ao gravar ${caminho} (${r.status}).`, r.status);
  return (await r.json()).content.sha;
}

// Confere o token e o repositório antes de salvar a conexão: precisa ser privado.
export async function testarConexao(config) {
  const r = await api(config, '');
  if (r.status === 404) throw new ErroNuvem('Repositório não encontrado ou fora do alcance do token.', 404);
  if (!r.ok) throw new ErroNuvem(`O GitHub respondeu ${r.status}.`, r.status);
  const repo = await r.json();
  if (repo.private === false) throw new ErroNuvem('Este repositório é público. O cofre só pode ficar num repositório privado.', 0);
  if (repo.permissions && repo.permissions.push === false) throw new ErroNuvem('O token só tem leitura. Dê a ele permissão de leitura e escrita em Contents.', 403);
  return { nome: repo.full_name, privado: repo.private };
}

// O que os robôs do repositório privado precisam saber, e nada além disso.
export function montarMonitor() {
  const ativos = lista('ativos');
  const emBolsa = (a) => ['acao', 'etf', 'fii', 'bdr', 'opcao'].includes(a.classe) && a.codigo;
  const codigos = new Set(ativos.filter(emBolsa).map((a) => a.codigo.toUpperCase()));
  for (const o of lista('observados')) codigos.add(o.codigo.toUpperCase());
  const alertas = lista('alertas').filter((a) => a.ativo !== false).map((a) => ({ id: a.id, tipo: a.tipo, codigo: a.codigo || null, valor: a.valor ?? null, base: a.base ?? null, descricao: a.descricao || '' }));
  for (const a of alertas) if (a.codigo) codigos.add(a.codigo.toUpperCase());
  return {
    geradoEm: new Date().toISOString(),
    codigos: [...codigos].sort(),
    fundos: [...new Set(ativos.filter((a) => a.classe === 'fundo' && a.cnpj).map((a) => a.cnpj.replace(/\D/g, '')))].sort(),
    alertas,
  };
}

let emCurso = null;
// Baixa, mescla e sobe. Devolve { enviou, recebeu }. Chamadas simultâneas compartilham a mesma execução.
export function sincronizar() {
  if (!sessao.aberta || !sessao.nuvem || sessao.amostra) return Promise.resolve({ enviou: false, recebeu: false, desligada: true });
  emCurso ||= executar().finally(() => { emCurso = null; });
  return emCurso;
}

async function executar() {
  const config = sessao.nuvem;
  let enviou = false, recebeu = false;
  const pend = await pendencias();
  // Chaves: sobem na criação e quando a senha muda.
  if (pend.chaves || !(await obter('chavesEnviadas'))) {
    const remoto = await lerArquivo(config, 'cofre/chaves.json');
    await gravarArquivo(config, 'cofre/chaves.json', JSON.stringify(await metaLocal(), null, 1), remoto?.sha, 'Atualiza as chaves do cofre');
    await guardar('chavesEnviadas', true);
  }
  for (let tentativa = 0; tentativa < 4; tentativa++) {
    const remoto = await lerArquivo(config, 'cofre/dados.json');
    let estadoRemoto = null;
    if (remoto) {
      try { estadoRemoto = await decifrar(JSON.parse(remoto.texto)); } catch { throw new ErroCofre('O cofre da nuvem foi cifrado com outra chave. Confira se o repositório é o deste cofre.'); }
    }
    const m = estadoRemoto ? mesclar(sessao.dados, estadoRemoto) : { estado: sessao.dados, mudouLocal: false, mudouRemoto: true };
    if (m.mudouLocal) {
      sessao.dados = m.estado; recebeu = true;
      await guardar('dados', await cifrar(sessao.dados));
    }
    if (!m.mudouRemoto && remoto) break;
    try {
      await gravarArquivo(config, 'cofre/dados.json', JSON.stringify(await cifrar(m.estado)), remoto?.sha, 'Atualiza o cofre');
      enviou = true;
      break;
    } catch (e) { if (e.status !== 409 || tentativa === 3) throw e; } // outro aparelho gravou antes: mescla de novo
  }
  // Monitor em claro: só regrava quando o conteúdo muda.
  const monitor = montarMonitor(), atual = await lerArquivo(config, 'monitor.json');
  const semData = (o) => JSON.stringify({ ...o, geradoEm: null });
  if (!atual || semData(JSON.parse(atual.texto)) !== semData(monitor)) { await gravarArquivo(config, 'monitor.json', JSON.stringify(monitor, null, 1), atual?.sha, 'Atualiza a lista de acompanhamento'); enviou = true; }
  await limparPendente();
  await guardar('ultimaSincronia', new Date().toISOString());
  return { enviou, recebeu };
}

// Liga a nuvem num aparelho que já tem cofre.
export async function conectar({ repo, token, api: base }) {
  const config = { repo: repo.trim(), token: token.trim(), ...(base ? { api: base } : {}) };
  const info = await testarConexao(config);
  const chaves = await lerArquivo(config, 'cofre/chaves.json');
  if (chaves) {
    const remota = JSON.parse(chaves.texto), local = await metaLocal();
    if (remota.criadoEm !== local.criadoEm) throw new ErroCofre('Este repositório já guarda outro cofre. Para usá-lo neste aparelho, escolha "Já tenho um cofre na nuvem".');
  }
  await definirNuvem(config);
  await sincronizar();
  return info;
}

// Primeiro acesso num aparelho novo: baixa o cofre da nuvem e abre com a senha.
export async function baixarCofre({ repo, token, usuario, senha, api: base }) {
  const config = { repo: repo.trim(), token: token.trim(), ...(base ? { api: base } : {}) };
  await testarConexao(config);
  const chaves = await lerArquivo(config, 'cofre/chaves.json');
  if (!chaves) throw new ErroCofre('Não há cofre neste repositório. Crie o cofre neste aparelho e ligue a nuvem em Ajustes.');
  const dados = await lerArquivo(config, 'cofre/dados.json');
  await instalarCofre({ meta: JSON.parse(chaves.texto), pacoteDados: dados ? JSON.parse(dados.texto) : null, usuario, senha });
  await guardar('chavesEnviadas', true);
  await definirNuvem(config);
}

// Pede ao repositório privado uma rodada da rotina (`cotacoes`, `fechamento`, `tudo` ou `teste`).
// O agendamento do GitHub atrasa ou pula execuções em horários de pico; com o portal aberto e as
// cotações velhas, o próprio portal pede a rodada. Exige a permissão Actions (leitura e escrita)
// no token; sem ela, devolve false e o portal segue com o que tem.
export async function pedirRotina(config, rotina) {
  try {
    const r = await api(config, 'actions/workflows/rotinas.yml/dispatches', { metodo: 'POST', corpo: { ref: 'main', inputs: { rotina } } });
    return r.status === 204;
  } catch { return false; }
}
export const pedirCotacoes = (config) => pedirRotina(config, 'cotacoes');

export const desconectar = () => definirNuvem(null);
export const ultimaSincronia = () => obter('ultimaSincronia');

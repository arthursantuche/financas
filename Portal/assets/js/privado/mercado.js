// Dados de mercado da área privada e avaliação da carteira.
// Origem dos preços, por classe:
//   ações, ETFs, FIIs, BDRs e opções → repositório privado (mercado/cotacoes.json e fechamento.json,
//                                       gerados pelas rotinas de coleta); sem nuvem, preço manual
//   fundos de investimento           → cota da CVM (mercado/fundos.json); sem nuvem, cota manual
//   Tesouro Direto                   → preço de venda oficial (dados abertos, publicado com o site)
//   renda fixa (CDB, LCI, debênture) → curva do título, calculada com CDI e IPCA do Banco Central
// Todo preço carrega fonte e data, e a tela mostra as duas.
import { sessao, lista, obter, guardar } from './cofre.js';
import { lerJSON, pedirCotacoes } from './sincronia.js';
import { serieBCB, tesouro as lerTesouro, indiceEmpresas, ler } from '../dados.js';
import { indiceTitulo, aliquotaIR } from '../calculo/rendafixa.js';
import { posicoes, avaliar, serieCotas, diasCorridos } from '../calculo/carteira.js';
import { hojeISO } from '../util.js';

export const CLASSES = {
  acao: { nome: 'Ações', um: 'Ação', bolsa: true },
  etf: { nome: 'ETFs', um: 'ETF', bolsa: true },
  fii: { nome: 'Fundos imobiliários', um: 'Fundo imobiliário', bolsa: true },
  bdr: { nome: 'BDRs', um: 'BDR', bolsa: true },
  opcao: { nome: 'Opções', um: 'Opção', bolsa: true },
  fundo: { nome: 'Fundos de investimento', um: 'Fundo de investimento' },
  tesouro: { nome: 'Tesouro Direto', um: 'Título do Tesouro' },
  rendafixa: { nome: 'Renda fixa', um: 'Título de renda fixa' },
  outro: { nome: 'Outros', um: 'Outro ativo' },
};
export const emBolsa = (a) => !!CLASSES[a.classe]?.bolsa;

// ---- Leitura com cópia no aparelho ----
const memoria = new Map();
async function daNuvem(caminho, validadeMin = 10) {
  if (sessao.amostra) return (await amostra())[caminho] ?? null;
  const chave = `mercado:${caminho}`, agora = Date.now();
  const emMemoria = memoria.get(chave);
  if (emMemoria && agora - emMemoria.em < validadeMin * 6e4) return emMemoria.dados;
  const local = await obter(chave);
  if (!sessao.nuvem) return local?.dados ?? null;
  if (local && agora - local.em < validadeMin * 6e4) { memoria.set(chave, local); return local.dados; }
  try {
    const dados = await lerJSON(sessao.nuvem, caminho);
    const registro = { dados, em: agora };
    memoria.set(chave, registro); await guardar(chave, registro);
    return dados;
  } catch (e) { console.warn(e.message); return local?.dados ?? null; } // sem rede: fica a última cópia
}
let pacoteAmostra = null;
const amostra = () => (pacoteAmostra ||= ler('dados/amostra/mercado.json'));
export const limparMemoria = () => memoria.clear();

// Pregão da B3: 10h às 18h de Brasília (13h às 21h UTC; o Brasil não tem horário de verão desde 2019),
// com meia hora de folga para o fechamento.
export function emPregao(agora = new Date()) {
  const dia = agora.getUTCDay(), min = agora.getUTCHours() * 60 + agora.getUTCMinutes();
  return dia >= 1 && dia <= 5 && min >= 13 * 60 && min <= 21 * 60 + 30;
}
// Cotações com mais de 40 minutos no pregão: pede uma rodada da rotina, no máximo a cada 30 minutos.
export function cotacoesVelhas(cot, agora = new Date()) {
  if (!emPregao(agora)) return false;
  const em = Date.parse(cot?.geradoEm || '');
  return !Number.isFinite(em) || agora - em > 40 * 6e4;
}
let pedido = null; // a carteira chama cotacoes() uma vez por ativo: um pedido só
function renovarSeVelhas(cot) {
  if (sessao.amostra || !sessao.nuvem || !cotacoesVelhas(cot)) return;
  pedido ||= (async () => {
    const ultimo = await obter('pedidoCotacoes');
    if (ultimo && Date.now() - ultimo < 30 * 6e4) return;
    await guardar('pedidoCotacoes', Date.now());
    if (await pedirCotacoes(sessao.nuvem)) console.info('Cotações velhas: rodada da rotina pedida ao repositório privado.');
  })().catch(() => {}).finally(() => { setTimeout(() => { pedido = null; }, 30 * 6e4); });
}
export const cotacoes = async () => {
  const cot = await daNuvem('mercado/cotacoes.json', 5);
  renovarSeVelhas(cot);
  return cot;
};
export const fechamento = () => daNuvem('mercado/fechamento.json', 60);
export const fundos = () => daNuvem('mercado/fundos.json', 240);
export const cadeiaOpcoes = () => daNuvem('mercado/opcoes.json', 60);
export const alertasDisparados = () => daNuvem('mercado/alertas-disparados.json', 5);
export async function historico(codigo) {
  const h = await daNuvem(`mercado/historico/${codigo.toUpperCase()}.json`, 240);
  return (h?.pontos || []).map(([data, valor]) => ({ data, valor }));
}

// Preço de um código de bolsa: cotação do pregão, senão o último fechamento oficial.
export async function precoBolsa(codigo) {
  const c = codigo.toUpperCase();
  const [cot, fech] = await Promise.all([cotacoes(), fechamento()]);
  const q = cot?.ativos?.[c];
  if (q?.preco > 0) return { preco: q.preco, anterior: q.anterior ?? null, data: q.data, hora: q.hora || null, fonte: q.fonte || cot.fonte, atraso: q.atraso || cot.atraso || null, minimo: q.minimo, maximo: q.maximo, abertura: q.abertura, volume: q.volume };
  const f = fech?.ativos?.[c];
  if (f) return { preco: f[0], anterior: f[1] ?? null, data: fech.data, fonte: 'B3, fechamento oficial', abertura: f[2], minimo: f[3], maximo: f[4], volume: f[5] };
  return null;
}
// Preços de fechamento de muitos códigos de uma vez (pares do setor, candidatos do agente).
export async function precosFechamento() {
  const [cot, fech] = await Promise.all([cotacoes(), fechamento()]);
  const r = {};
  for (const [c, f] of Object.entries(fech?.ativos || {})) r[c] = f[0];
  for (const [c, q] of Object.entries(cot?.ativos || {})) if (q.preco > 0) r[c] = q.preco;
  return { precos: r, data: fech?.data || cot?.geradoEm?.slice(0, 10) || null };
}

const seriesBCB = async () => {
  const [cdi, ipca] = await Promise.all([serieBCB('cdi'), serieBCB('ipca')]);
  return { cdi: cdi.pontos, ipca: ipca.pontos, ate: cdi.pontos[cdi.pontos.length - 1][0] };
};

// Monta tudo o que as telas da carteira precisam: posições avaliadas, informações de cada ativo,
// históricos e avisos (ativos sem preço, dados velhos).
export async function quadro() {
  const ativos = lista('ativos'), lancs = lista('lancamentos');
  const hoje = hojeISO();
  const porId = new Map(ativos.map((a) => [a.id, a]));
  const precos = {}, historicos = {}, info = {}, avisos = [];
  const precisaBCB = ativos.some((a) => a.classe === 'rendafixa');
  const precisaTesouro = ativos.some((a) => a.classe === 'tesouro');
  const [bcb, tes, fds, emp] = await Promise.all([
    precisaBCB ? seriesBCB().catch(() => null) : null,
    precisaTesouro ? lerTesouro().catch(() => null) : null,
    ativos.some((a) => a.classe === 'fundo') ? fundos() : null,
    indiceEmpresas().catch(() => ({ empresas: [] })),
  ]);
  const setorDe = (codigo) => emp.empresas.find((e) => e.tickers.includes(codigo))?.setor;

  // Lançamentos de renda fixa viram cotas do índice do título (ver calculo/rendafixa.js).
  const lancamentos = [];
  for (const a of ativos) {
    const meus = lancs.filter((l) => l.ativoId === a.id);
    info[a.id] = { classe: CLASSES[a.classe]?.nome || 'Outros', classeId: a.classe, setor: a.setor || (a.codigo && setorDe(a.codigo)) || CLASSES[a.classe]?.nome, instituicao: a.instituicao || 'Não informada', nome: a.nome, codigo: a.codigo || null };
    if (a.classe === 'rendafixa' && bcb && meus.length) {
      const desde = meus.map((l) => l.data).sort()[0];
      const indice = indiceTitulo(a, bcb, desde, a.vencimento && a.vencimento < hoje ? a.vencimento : hoje);
      const em = new Map(indice.map((p) => [p.data, p.valor]));
      const valorEm = (d) => { if (em.has(d)) return em.get(d); let v = 1; for (const p of indice) { if (p.data > d) break; v = p.valor; } return v; };
      for (const l of meus) {
        if (l.tipo !== 'compra' && l.tipo !== 'venda') { lancamentos.push({ ...l, ativo: a.id }); continue; }
        const preco = valorEm(l.data), valor = Number(l.quantidade) * Number(l.preco);
        lancamentos.push({ ...l, ativo: a.id, quantidade: valor / preco, preco });
      }
      const u = indice[indice.length - 1], penultimo = indice[indice.length - 2];
      precos[a.id] = { preco: u.valor, anterior: penultimo?.valor ?? null, data: u.data, fonte: 'Curva do título (CDI e IPCA do Banco Central)' };
      historicos[a.id] = indice;
    } else {
      for (const l of meus) lancamentos.push({ ...l, ativo: a.id });
      if (emBolsa(a) && a.codigo) {
        const p = await precoBolsa(a.codigo);
        if (p) precos[a.id] = p;
        const h = await historico(a.codigo);
        if (h.length) historicos[a.id] = h;
      } else if (a.classe === 'tesouro' && tes) {
        const t = tes.titulos.find((x) => x.id === a.titulo);
        if (t) {
          precos[a.id] = { preco: t.puVenda, anterior: null, data: t.data, fonte: 'Tesouro Nacional, preço de venda da manhã', taxa: t.taxaVenda };
          historicos[a.id] = t.historico.map(([data, , pu]) => ({ data, valor: pu })).filter((p) => p.valor > 0);
        }
      } else if (a.classe === 'fundo' && fds && a.cnpj) {
        const f = fds.fundos?.[a.cnpj.replace(/\D/g, '')];
        if (f) { precos[a.id] = { preco: f.cota, anterior: f.anterior ?? null, data: f.data, fonte: 'CVM, informe diário' }; historicos[a.id] = (f.historico || []).map(([data, valor]) => ({ data, valor })); }
      }
      // Sem fonte automática: vale o preço informado à mão, com a data em que foi informado.
      if (!precos[a.id] && a.precoManual > 0) precos[a.id] = { preco: a.precoManual, anterior: null, data: a.precoManualEm || null, fonte: 'Informado manualmente', manual: true };
    }
  }

  const pos = posicoes(lancamentos);
  const avaliacao = avaliar(pos, precos);
  for (const l of avaliacao.linhas) {
    const a = porId.get(l.ativo);
    Object.assign(l, { id: l.ativo, codigo: a?.codigo || null, nome: a?.nome || l.ativo, classe: a?.classe, fonte: precos[l.ativo]?.fonte, manual: !!precos[l.ativo]?.manual });
    if (a?.classe === 'rendafixa') {
      // Líquido estimado: IR regressivo pelo prazo da primeira aplicação (aproximação conservadora
      // para vários aportes), zero se o título for isento.
      const dias = diasCorridos(l.primeiraCompra, hoje);
      l.aliquotaIR = a.isento ? 0 : aliquotaIR(Math.max(1, dias));
      l.liquido = l.valor - Math.max(0, l.lucro) * l.aliquotaIR;
    }
    if (l.semPreco) avisos.push({ id: l.ativo, texto: `${l.codigo || l.nome}: sem preço. ${emBolsa(a || {}) ? 'Ligue a nuvem em Ajustes ou informe o preço no cadastro do ativo.' : 'Informe o valor atual no cadastro do ativo.'}` });
    else if (l.dataPreco && diasCorridos(l.dataPreco.slice(0, 10), hoje) > 7) avisos.push({ id: l.ativo, texto: `${l.codigo || l.nome}: preço de ${l.dataPreco.slice(0, 10).split('-').reverse().join('/')}, pode estar desatualizado.` });
  }
  const serie = serieCotas(lancamentos, historicos);
  return { avaliacao, posicoes: pos, lancamentos, precos, historicos, info, ativos: porId, avisos, serie, hoje };
}

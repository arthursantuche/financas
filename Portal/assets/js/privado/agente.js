// Agente: configura os parâmetros, executa a análise em etapas visíveis e guarda o relatório.
// A orquestração roda no navegador: coleta (dados abertos + cofre), cálculo determinístico
// (agente/dossie.js) e, se houver provedor de IA configurado, redação (agente/narrativa.js).
import { el, brl, pct, dataHora, novoId, hojeISO, lerNumero } from '../util.js';
import { sessao, lista, gravar, configurar } from './cofre.js';
import { quadro, cadeiaOpcoes, historico, fechamento } from './mercado.js';
import { dossieEmpresa, resumoDossie, universo } from './empresa.js';
import { indicadores as lerIndicadores } from '../dados.js';
import { diagnosticar, triar, selecionar, sugerirVendas, estruturarOpcoes, cenarios, PERFIS, PREMISSAS, LIMITES } from '../agente/dossie.js';
import { narrar } from '../agente/narrativa.js';
import { presenca } from './investidores.js';
import { campo, selecao, marcar, lerCampos } from './formularios.js';

export const ETAPAS = ['Ler a carteira e os preços', 'Reunir os indicadores econômicos', 'Analisar os fundamentos das ações da carteira', 'Diagnosticar concentração e risco', 'Triar as companhias da bolsa', 'Conferir os demonstrativos dos finalistas', 'Dimensionar as ordens', 'Avaliar vendas e estruturas com opções', 'Simular cenários', 'Redigir o relatório'];

// Executa a análise. `aoEtapa(indice, estado, detalhe)` informa o andamento.
export async function executar(p, aoEtapa = () => {}) {
  const passo = async (i, fn) => { aoEtapa(i, 'atual'); try { const r = await fn(); aoEtapa(i, 'feita'); return r; } catch (e) { aoEtapa(i, 'falha', e.message); throw e; } };
  const q = await passo(0, () => quadro());
  const linhas = q.avaliacao.linhas.map((l) => ({ ...l, indexador: q.ativos.get(l.id)?.indexador }));
  const ind = await passo(1, () => lerIndicadores());
  const selic = ind.selicMeta.valor / 100;
  const macro = { selic: ind.selicMeta.valor, cdi: ind.cdiAnual.valor, ipca12m: ind.ipca12m.valor, juroReal: Math.round(ind.juroRealExPost * 1e4) / 100, dolar: ind.dolar.valor, expectativas: Object.fromEntries(Object.entries(ind.expectativas || {}).map(([k, v]) => [k, v.anos])), fonte: 'Banco Central do Brasil', data: ind.geradoEm.slice(0, 10) };

  const dossies = {};
  await passo(2, async () => { for (const l of linhas.filter((x) => x.classe === 'acao' && x.codigo)) { const d = await dossieEmpresa(l.codigo).catch(() => null); if (d) dossies[l.codigo] = d; } });
  const diagnostico = await passo(3, () => diagnosticar({ linhas, info: q.info, total: q.avaliacao.total, perfil: p.perfil, tetoPorAtivo: p.tetoPorAtivo, historicos: q.historicos, dossies }));

  const uni = await passo(4, () => universo());
  const fech = await fechamento().catch(() => null);
  const volumes = Object.fromEntries(Object.entries(fech?.ativos || {}).filter(([, f]) => f[5] != null).map(([c, f]) => [c, f[5]]));
  const triagem = triar({ universo: uni.empresas, medianasPorSetor: uni.medianasPorSetor, selic, perfil: p.perfil, diagnostico, tetoPorAtivo: p.tetoPorAtivo, volumes });
  const finalistas = triagem.candidatos.slice(0, 10);
  await passo(5, async () => { for (const c of finalistas) if (!dossies[c.ticker]) { const d = await dossieEmpresa(c.ticker).catch(() => null); if (d) dossies[c.ticker] = d; } });

  const vendas = p.permitirVendas ? sugerirVendas({ linhas, total: q.avaliacao.total, tetoPorAtivo: p.tetoPorAtivo, dossies }) : null;
  const orcamento = p.orcamento + (vendas?.liquido || 0);
  const selecao = await passo(6, () => selecionar({ finalistas, dossies, orcamento, diagnostico, perfil: p.perfil, tetoPorAtivo: p.tetoPorAtivo }));

  const opcoes = await passo(7, async () => {
    if (!p.incluirOpcoes) return [];
    const cadeia = await cadeiaOpcoes().catch(() => null);
    if (!cadeia?.bases) return [];
    return estruturarOpcoes({ linhas, cadeia: cadeia.bases, historicos: q.historicos, hoje: q.hoje, juro: Math.log(1 + selic), candidatos: selecao.ordens.map((o) => ({ ticker: o.ticker, preco: o.preco })) });
  });

  const empresas = await passo(8, async () => {
    const lista2 = [];
    for (const o of selecao.ordens) {
      const d = dossies[o.ticker], h = await historico(o.ticker).catch(() => []);
      const pf = await presenca(o.ticker).catch(() => null);
      lista2.push({ ...resumoDossie(d), nota: o.nota, notas: o.notas, cenarios: cenarios(h, p.horizonteAnos), fundos: pf ? { referencia: pf.referencia, fundosComPosicao: pf.fundos, fundosNoMesAnterior: pf.fundosAntes, saldoDeComprasNoMes: pf.fluxo, aviso: 'dado defasado e complementar; não é critério de seleção' } : null });
    }
    return lista2;
  });

  const dossie = {
    geradoEm: new Date().toISOString(), parametros: { ...p, orcamentoComVendas: orcamento }, macro, diagnostico,
    triagem: { avaliadas: triagem.avaliadas, descartes: triagem.descartes, dataPrecos: uni.dataPrecos, primeiros: triagem.candidatos.slice(0, 10).map((c) => ({ ticker: c.ticker, setor: c.setor, nota: c.nota, notas: c.notas })) },
    selecao, vendas, opcoes, empresas, premissas: PREMISSAS, limites: LIMITES,
    fontes: [`CVM, demonstrativos de ${uni.geradoEm.slice(0, 10).split('-').reverse().join('/')}`, `Preços de ${uni.dataPrecos ? uni.dataPrecos.split('-').reverse().join('/') : 'data indisponível'}`, `Banco Central, ${macro.data.split('-').reverse().join('/')}`],
  };
  const narrativa = await passo(9, () => narrar(dossie, p.usarIA ? sessao.dados.config.llm : null, { aoAvancar: (t) => aoEtapa(9, 'atual', t) }));
  const relatorio = { id: novoId('rel'), dossie, narrativa };
  if (!sessao.amostra) await gravar('relatorios', relatorio); else sessao.dados.relatorios.push({ ...relatorio, criadoEm: dossie.geradoEm, atualizadoEm: dossie.geradoEm });
  return relatorio;
}

export async function pagina(ctx) {
  const cfg = sessao.dados.config, temIA = !!cfg.llm?.modelo;
  const campos = [
    campo({ nome: 'orcamento', rotulo: 'Valor disponível para investir', tipo: 'numero', valor: '', obrigatorio: true, sufixo: 'R$', dica: 'O agente distribui este valor. Informe zero para só analisar a carteira.' }),
    selecao({ nome: 'perfil', rotulo: 'Perfil de risco', opcoes: Object.entries(PERFIS).map(([k, v]) => [k, `${v.nome}: até ${Math.round(v.rvMax * 100)}% em renda variável`]), valor: cfg.perfil }),
    campo({ nome: 'horizonteAnos', rotulo: 'Horizonte do investimento', tipo: 'numero', valor: cfg.horizonteAnos, obrigatorio: true, sufixo: 'anos' }),
    campo({ nome: 'teto', rotulo: 'Teto por ativo', tipo: 'numero', valor: Math.round(cfg.tetoPorAtivo * 100), obrigatorio: true, sufixo: '% da carteira', dica: 'Nenhuma compra leva um papel acima deste peso.' }),
    marcar({ nome: 'permitirVendas', rotulo: 'Pode sugerir vendas para reduzir risco ou financiar compras', valor: true }),
    marcar({ nome: 'incluirOpcoes', rotulo: 'Avaliar estruturas com opções (venda coberta, proteção e travas)', valor: true }),
    marcar({ nome: 'usarIA', rotulo: temIA ? `Redigir com IA (${cfg.llm.modelo})` : 'Redigir com IA (configure um provedor em Ajustes)', valor: temIA }),
  ];
  if (!temIA) campos[6].input.disabled = true;
  const etapas = el('ol', { class: 'etapas', hidden: true, 'aria-live': 'polite' }, ETAPAS.map((t) => el('li', { dataset: { estado: 'pendente' } }, el('span', {}, t))));
  const erro = el('p', { class: 'status-pendente', role: 'alert' });
  const botao = el('button', { class: 'pill pill--azul', type: 'button' }, 'Executar a análise');
  botao.addEventListener('click', async () => {
    erro.textContent = '';
    const v = lerCampos(campos, { orcamento: (x) => (x >= 0 ? '' : 'Informe zero ou um valor positivo.'), horizonteAnos: (x) => (x >= 1 && x <= 40 ? '' : 'Entre 1 e 40 anos.'), teto: (x) => (x >= 3 && x <= 100 ? '' : 'Entre 3% e 100%.') });
    if (!v) return;
    botao.disabled = true; etapas.hidden = false;
    [...etapas.children].forEach((li) => { li.dataset.estado = 'pendente'; li.querySelector('small')?.remove(); });
    const parametros = { orcamento: v.orcamento, perfil: v.perfil, horizonteAnos: v.horizonteAnos, tetoPorAtivo: v.teto / 100, permitirVendas: v.permitirVendas, incluirOpcoes: v.incluirOpcoes, usarIA: v.usarIA && temIA, enviarCarteiraAoLLM: !!cfg.enviarCarteiraAoLLM };
    try {
      if (!sessao.amostra && (cfg.perfil !== v.perfil || cfg.horizonteAnos !== v.horizonteAnos || cfg.tetoPorAtivo !== v.teto / 100)) await configurar({ perfil: v.perfil, horizonteAnos: v.horizonteAnos, tetoPorAtivo: v.teto / 100 });
      const r = await ctx.comProgresso(executar(parametros, (i, estado, detalhe) => {
        const li = etapas.children[i]; li.dataset.estado = estado;
        if (detalhe) { let s = li.querySelector('small'); if (!s) { s = el('small', { class: 'legenda' }); li.append(' ', s); } s.textContent = ` · ${detalhe}`; }
      }));
      ctx.navegar(`relatorio/${r.id}`);
    } catch (e) { console.error(e); erro.textContent = `A análise parou: ${e.message}`; botao.disabled = false; }
  });

  const anteriores = lista('relatorios').sort((a, b) => (a.dossie.geradoEm < b.dossie.geradoEm ? 1 : -1));
  return { titulo: 'Agente', no: el('div', {},
    el('section', { class: 'secao' }, el('div', { class: 'conteudo conteudo--estreito' },
      el('header', { class: 'pagina__cabecalho' }, el('p', { class: 'kicker' }, 'Agente'), el('h1', { class: 'titulo' }, 'Analisar a carteira e o que fazer com dinheiro novo.'), el('p', { class: 'copy introducao' }, 'O agente lê a sua carteira, compara com o perfil escolhido, tria as companhias da bolsa pelos demonstrativos e monta ordens que cabem no valor informado. Todos os números saem de cálculo determinístico; a IA, se ligada, só redige.')),
      el('div', { class: 'natureza espaco-fundo' }, el('strong', {}, 'Recomendação individualizada, para uso próprio'), el('span', { class: 'legenda' }, 'O resultado considera a sua carteira e os parâmetros abaixo. É uma hipótese de estudo com justificativa, riscos e limites; a decisão e a responsabilidade são suas. Nenhum resultado é garantido.')),
      el('div', { class: 'formulario formulario--largo' }, campos.map((c) => c.no), erro, el('div', { class: 'formulario__acoes' }, botao, el('a', { href: '#ajustes' }, 'Ajustes da IA e do perfil'))),
      el('div', { class: 'espaco-topo' }, etapas))),
    el('section', { class: 'secao secao--mist' }, el('div', { class: 'conteudo conteudo--estreito' },
      el('h2', { class: 'titulo' }, 'Relatórios anteriores.'),
      anteriores.length ? el('ul', { class: 'lista' }, anteriores.map((r) => el('li', {}, el('a', { class: 'fila fila--entre', href: `#relatorio/${r.id}` },
        el('span', { class: 'empilha' }, el('strong', {}, r.dossie.selecao.ordens.length ? r.dossie.selecao.ordens.map((o) => o.ticker).join(', ') : 'Sem compras indicadas'), el('span', { class: 'legenda' }, `${brl(r.dossie.parametros.orcamento)} · perfil ${PERFIS[r.dossie.parametros.perfil]?.nome.toLowerCase()} · ${r.narrativa.modo === 'ia' ? 'redigido com IA' : 'por regras'}`)),
        el('span', { class: 'legenda num' }, dataHora(r.dossie.geradoEm)))))) : el('p', { class: 'vazio' }, 'Nenhum relatório ainda. Os relatórios ficam guardados no cofre.')))) };
}

// Relatório do agente: resumo, diagnóstico da carteira, ordens, vendas, opções e a apresentação
// de cada empresa recomendada (identificação, negócio, forças de Porter, fundamentos, comparação,
// macro, preço, tese e o que a invalidaria). Os números vêm do dossiê guardado; os gráficos e
// tabelas das empresas reaproveitam os blocos da página de Análise.
import { el, brl, brl0, pct, pctSinal, numero, vezes, dataHora, dataBR, compacto, classeSinal } from '../util.js';
import { moldura, graficoResultado, graficoBarras } from '../graficos.js';
import { achar, remover, sessao, lista } from './cofre.js';
import { dossieEmpresa } from './empresa.js';
import { blocoSintese, blocoCriterios, blocoGraficos, blocoTabela, blocoPares, blocoMultiplos, blocoBalanco } from './analise.js';
import { analisarEstrutura } from '../calculo/opcoes.js';
import { PERFIS } from '../agente/dossie.js';

const secao = (titulo, corpo, { mist = false, rotulo = null, intro = null, id = null } = {}) => el('section', { class: `secao ${mist ? 'secao--mist' : ''}`, id }, el('div', { class: 'conteudo' }, rotulo && el('p', { class: 'selo' }, rotulo), el('h2', { class: 'titulo' }, titulo), intro && el('p', { class: 'copy introducao' }, intro), corpo));
const dado = (rotulo, valor, classe = '') => el('div', {}, el('dt', {}, rotulo), el('dd', { class: classe }, valor));
const listaTexto = (itens) => el('ul', { class: 'frases copy' }, (itens || []).map((t) => el('li', {}, t)));
const PORTER = [['rivalidade', 'Rivalidade entre concorrentes'], ['novosEntrantes', 'Ameaça de novos entrantes'], ['substitutos', 'Ameaça de substitutos'], ['poderClientes', 'Poder dos clientes'], ['poderFornecedores', 'Poder dos fornecedores']];
const nivelPorter = (t) => ({ baixa: 1, 'média': 2, media: 2, alta: 3 }[String(t || '').toLowerCase()] || 0);

function cartaoOrdem(o, n) {
  const c = o.criterios;
  return el('article', { class: 'ordem', 'data-subir': true },
    el('div', { class: 'ordem__topo' }, el('h3', { class: 'ordem__codigo' }, el('a', { href: `#emp-${o.ticker}` }, o.ticker)), el('span', { class: 'legenda' }, o.setor)),
    el('dl', { class: 'estatisticas' }, dado('Quantidade', numero(o.quantidade, 0)), dado('Preço de referência', brl(o.preco)), dado('Valor estimado', brl(o.valor)), dado('Peso na carteira depois', pct(o.pesoNaCarteira, 1)), dado('Preço-teto', brl(c.precoTeto)), dado('Ponto de revisão', brl(c.precoRevisao))),
    el('p', { class: 'copy' }, n?.tese),
    el('p', { class: 'legenda' }, `Notas da triagem (0 a 1): saúde ${numero(o.notas.saude, 2)} · qualidade ${numero(o.notas.qualidade, 2)} · preço ${numero(o.notas.valor, 2)} · crescimento ${numero(o.notas.crescimento, 2)}. Preço-teto: ${c.baseTeto}.`));
}

function blocoOpcao(e) {
  const a = analisarEstrutura(e.pernas, { precoAtual: e.precoAtivo, faixa: 0.3 });
  const g = moldura(`Resultado no vencimento de ${e.titulo}`, 'grafico--baixo');
  graficoResultado(g.canvas, { pontos: a.curva, formato: brl0, formatoX: (x) => brl(x), marcas: [...e.equilibrio.map((x) => ({ nome: 'Equilíbrio', x })), { nome: 'Preço atual', x: e.precoAtivo, y: a.curva.reduce((m, p) => (Math.abs(p.preco - e.precoAtivo) < Math.abs(m.preco - e.precoAtivo) ? p : m)).resultado }] });
  return el('article', { class: 'card card--auto', 'data-subir': true },
    el('h3', { class: 'kicker' }, e.titulo), el('p', { class: 'copy introducao' }, e.objetivo),
    el('dl', { class: 'estatisticas' },
      dado('Ganho máximo', e.ganhoIlimitado ? 'Ilimitado' : brl(e.ganhoMaximo), 'alta'), dado('Perda máxima', e.perdaIlimitada ? 'Ilimitada' : brl(e.perdaMaxima), 'baixa'),
      dado('Ponto de equilíbrio', e.equilibrio.map((x) => brl(x)).join(' e ') || '—'), dado(e.custo >= 0 ? 'Desembolso' : 'Crédito recebido', brl(Math.abs(e.custo))),
      dado('Vencimento', `${dataBR(e.opcoes[0].vencimento)} (${e.diasAteVencimento} dias)`), dado('Quantidade', numero(e.quantidade, 0)),
      e.retornoPremio != null && dado('Prêmio sobre o preço da ação', pct(e.retornoPremio, 2)), e.retornoSeExercida != null && dado('Retorno se exercida', pct(e.retornoSeExercida, 2)),
      e.custoProtecao != null && dado('Custo da proteção', pct(e.custoProtecao, 2)), e.piso != null && dado('Preço garantido de venda', brl(e.piso))),
    g.no,
    el('div', { class: 'tabela-rolavel' }, el('table', { class: 'tabela tabela--numeros' },
      el('thead', {}, el('tr', {}, ['Opção', 'Strike', 'Prêmio', 'Negócios', 'Vol. implícita', 'Delta', 'Chance de exercício'].map((t) => el('th', { scope: 'col' }, t)))),
      el('tbody', {}, e.opcoes.map((o) => el('tr', {}, el('th', { scope: 'row' }, `${o.codigo} (${o.tipo})`), el('td', {}, brl(o.strike)), el('td', {}, brl(o.premio)), el('td', {}, o.negocios ?? '—'), el('td', {}, pct(o.volatilidadeImplicita, 1)), el('td', {}, numero(o.delta, 2)), el('td', {}, pct(o.probabilidadeExercicio, 0))))))),
    el('p', { class: 'selo' }, 'Riscos'), listaTexto(e.riscos),
    el('p', { class: 'selo' }, 'A chance de exercício vem do modelo de Black-Scholes com a volatilidade implícita no prêmio: é uma medida do modelo, não uma previsão. Resultado sem corretagem, emolumentos e impostos.'));
}

async function apresentacaoEmpresa(c, ordem, n, d) {
  const atual = await dossieEmpresa(c.ticker).catch(() => null);
  const i = c.indicadores, k = c.cenarios;
  const semIA = (texto) => el('p', { class: 'legenda' }, texto);
  const parte = (titulo, ...corpo) => el('div', { class: 'relatorio__parte empilha' }, el('h3', { class: 'kicker' }, titulo), ...corpo.filter(Boolean));
  const cen = n.cenarios || {};
  const g = k ? moldura(`Cenários de retorno em 12 meses para ${c.ticker}`, 'grafico--baixo') : null;
  if (g) graficoBarras(g.canvas, { rotulos: ['Pessimista (5%)', 'Desfavorável (25%)', 'Mediano', 'Favorável (75%)', 'Otimista (95%)'], series: [{ nome: 'Retorno em 12 meses', valores: [k.pessimista, k.desfavoravel, k.mediano, k.favoravel, k.otimista].map((v) => v * 100), cores: [k.pessimista, k.desfavoravel, k.mediano, k.favoravel, k.otimista].map((v) => (v >= 0 ? '--cor-alta-traco' : '--cor-baixa-traco')) }], formato: (v) => `${numero(v, 1)}%`, formatoEixo: (v) => `${numero(v, 0)}%` });
  return el('section', { class: 'secao', id: `emp-${c.ticker}` }, el('div', { class: 'conteudo relatorio__indice' },
    el('p', { class: 'selo' }, `Empresa recomendada · dados de ${dataBR(c.referencia)}`), el('h2', { class: 'titulo' }, `${c.ticker}.`), el('p', { class: 'copy introducao' }, c.nome),
    el('div', { class: 'empilha empilha--folgada espaco-topo' },
      parte('Identificação', el('dl', { class: 'estatisticas' }, dado('Companhia', c.nome), dado('Código', c.ticker), dado('Setor (CVM)', c.setor), dado('Receita em 12 meses', compacto(i.receita * 1000)), dado('Lucro em 12 meses', compacto(i.lucro * 1000)), dado('Preço de referência', brl(c.preco)))),
      parte('Setor de atuação e modelo de negócios', n.modeloNegocio ? el('p', { class: 'copy' }, n.modeloNegocio) : semIA('Sem descrição disponível.'), !n.qualitativoPorIA && semIA('Descrição declarada pela companhia à CVM. A leitura do modelo de negócios pede um provedor de IA configurado em Ajustes.')),
      parte('Posicionamento competitivo', n.posicionamento ? el('p', { class: 'copy' }, n.posicionamento) : semIA('Não avaliado no modo por regras: os demonstrativos não dizem como a empresa se compara em produto, marca ou escala. Consulte o Formulário de Referência e compare as margens na tabela do setor, abaixo.')),
      parte('Cinco forças de Porter', n.porter ? el('div', { class: 'forcas' }, PORTER.map(([chave, nome]) => { const f = n.porter[chave]; if (!f) return null; const nv = nivelPorter(f.nivel); return el('div', { class: 'forca' }, el('strong', {}, nome), el('div', { class: 'forca__nivel', role: 'img', 'aria-label': `Intensidade ${f.nivel}` }, [1, 2, 3].map((x) => el('i', { 'data-cheio': x <= nv }))), el('span', { class: 'selo' }, `Intensidade ${f.nivel}`), el('span', { class: 'legenda' }, f.texto)); })) : semIA('Não avaliado no modo por regras. As cinco forças (rivalidade, novos entrantes, substitutos, poder de clientes e de fornecedores) são uma análise qualitativa do setor.')),
      parte('Vantagens competitivas', n.vantagens?.length ? listaTexto(n.vantagens) : semIA('Não avaliado no modo por regras. Um indício numérico: retorno sobre o capital acima do setor por vários anos, visível nos gráficos abaixo.')),
      parte('Riscos operacionais e financeiros', listaTexto(n.riscos)),
      parte('Análise fundamentalista', atual ? blocoSintese(atual) : semIA('Demonstrativos indisponíveis.')),
      parte('Indicadores financeiros', atual && blocoCriterios(atual)),
      parte('Comparação histórica dos resultados', atual && blocoGraficos(atual), atual && blocoTabela(atual, 'trimestre'), atual && blocoBalanco(atual)),
      parte('Comparação com concorrentes', atual && blocoPares(atual)),
      c.fundos ? parte('Presença em fundos (dado complementar)', el('p', { class: 'copy' }, `${c.fundos.fundosComPosicao} fundos brasileiros tinham o papel em ${c.fundos.referencia.split('-').reverse().join('/')}${c.fundos.fundosNoMesAnterior != null ? `, contra ${c.fundos.fundosNoMesAnterior} no mês anterior` : ''}. Não entrou na nota da triagem: a informação é defasada e não justifica uma compra por si.`)) : null,
      parte('Cenário macroeconômico', el('dl', { class: 'estatisticas' }, dado('Selic', `${numero(d.macro.selic, 2)}%`), dado('IPCA em 12 meses', `${numero(d.macro.ipca12m, 2)}%`), dado('Juro real', `${numero(d.macro.juroReal, 2)}%`), dado('Dólar', `R$ ${numero(d.macro.dolar, 2)}`)), n.macro ? el('p', { class: 'copy' }, n.macro) : semIA('Juros altos encarecem a dívida e aumentam o retorno exigido das ações; a leitura para esta empresa pede um provedor de IA.')),
      parte('Análise de valuation', atual && blocoMultiplos(atual)),
      parte('Justificativa da recomendação', el('p', { class: 'copy' }, n.tese), ordem && el('dl', { class: 'estatisticas' }, dado('Quantidade sugerida', numero(ordem.quantidade, 0)), dado('Valor estimado', brl(ordem.valor)), dado('Peso na carteira', pct(ordem.pesoNaCarteira, 1)), dado('Horizonte', `${d.parametros.horizonteAnos} anos`)),
        el('div', { class: 'grade-2' }, el('div', { class: 'empilha' }, el('p', { class: 'selo' }, 'Cenário favorável'), el('p', { class: 'copy' }, cen.favoravel), n.cenariosIA && el('p', { class: 'legenda' }, n.cenariosIA.favoravel)), el('div', { class: 'empilha' }, el('p', { class: 'selo' }, 'Cenário desfavorável'), el('p', { class: 'copy' }, cen.desfavoravel), n.cenariosIA && el('p', { class: 'legenda' }, n.cenariosIA.desfavoravel))),
        g && g.no, k && el('p', { class: 'selo' }, `Cenários por ${k.metodo}, sobre ${k.pregoes} pregões. Descrevem o que o histórico comportaria; não são previsão.`),
        ordem && el('div', { class: 'grade-2' }, el('div', { class: 'empilha' }, el('p', { class: 'selo' }, 'Critérios de entrada'), listaTexto(ordem.criterios.entrada)), el('div', { class: 'empilha' }, el('p', { class: 'selo' }, 'Critérios de revisão e saída'), listaTexto(ordem.criterios.revisao)))),
      parte('O que invalidaria a tese', listaTexto(n.invalidacao)))));
}

export async function pagina(ctx, [id]) {
  const r = achar('relatorios', id) || lista('relatorios').find((x) => x.id === id);
  if (!r) throw new Error('Relatório não encontrado.');
  const d = r.dossie, n = r.narrativa, g = d.diagnostico, s = d.selecao;
  const P = PERFIS[d.parametros.perfil];
  const empresas = [];
  for (const c of d.empresas) empresas.push(await apresentacaoEmpresa(c, s.ordens.find((o) => o.ticker === c.ticker), n.empresas[c.ticker] || {}, d));

  let confirmando = false;
  const apagar = el('button', { class: 'link-botao link-botao--alerta', type: 'button', onclick: async () => { if (!confirmando) { confirmando = true; apagar.textContent = 'Toque de novo para apagar este relatório'; return; } if (!sessao.amostra) await remover('relatorios', r.id); ctx.avisar('Relatório apagado.'); ctx.navegar('agente'); } }, 'Apagar relatório');

  const capa = el('section', { class: 'secao' }, el('div', { class: 'conteudo' },
    el('header', { class: 'pagina__cabecalho' }, el('p', { class: 'kicker' }, el('a', { href: '#agente' }, 'Agente'), ' · relatório'), el('h1', { class: 'titulo' }, s.ordens.length ? `${s.ordens.length === 1 ? 'Uma compra indicada' : `${s.ordens.length} compras indicadas`} para ${brl0(d.parametros.orcamento)}.` : 'Nenhuma compra indicada desta vez.'),
      el('p', { class: 'legenda' }, `${dataHora(d.geradoEm)} · perfil ${P.nome.toLowerCase()} · horizonte de ${d.parametros.horizonteAnos} anos · teto de ${pct(d.parametros.tetoPorAtivo, 0)} por ativo · ${n.modo === 'ia' ? `redigido com IA (${n.modelo})` : 'redigido por regras, sem IA'}`)),
    el('p', { class: 'copy prosa lide' }, n.resumo),
    el('div', { class: 'natureza espaco-topo' }, el('strong', {}, 'Recomendação individualizada, para uso próprio'), el('span', { class: 'legenda' }, 'Hipótese de estudo construída sobre a sua carteira e os parâmetros informados. Não é ordem, não garante resultado e não substitui a sua decisão. Confira preços e fatos recentes antes de operar.')),
    n.modo === 'ia' && (n.recusados?.length || n.falhas?.length) ? el('div', { class: 'natureza espaco-topo' }, el('strong', { class: 'selo--atencao' }, 'Controle da redação por IA'), n.recusados.map((x) => el('span', { class: 'legenda' }, `Trecho recusado (${x.trecho}): citava ${x.numeros.join(', ')}, que não estão no dossiê. Ficou o texto por regras.`)), (n.falhas || []).map((f) => el('span', { class: 'legenda' }, `Falha: ${f}`))) : null));

  const ordens = secao(s.ordens.length ? 'Ordens sugeridas.' : 'Por que não há compras.', el('div', { class: 'empilha empilha--folgada' },
    s.ordens.length ? el('div', { class: 'grade-2' }, s.ordens.map((o) => cartaoOrdem(o, n.empresas[o.ticker]))) : el('p', { class: 'vazio' }, s.paraRendaVariavel < 100 ? 'O valor destinado à renda variável ficou abaixo do mínimo para uma ordem.' : 'Nenhuma companhia passou, ao mesmo tempo, pela triagem e pela conferência dos demonstrativos.'),
    el('dl', { class: 'estatisticas' }, dado('Valor informado', brl(d.parametros.orcamento)), d.vendas?.liquido ? dado('Mais o líquido das vendas', brl(d.vendas.liquido)) : null, dado('Para ações', brl(s.ordens.reduce((t, o) => t + o.valor, 0))), dado('Indicado para renda fixa', brl(s.paraRendaFixa)), dado('Sobra (não cabe em quantidades inteiras)', brl(s.sobra))),
    s.motivoRendaFixa && el('p', { class: 'copy' }, s.motivoRendaFixa, ' Para essa parcela, veja os títulos do Tesouro em ', el('a', { href: '#indicadores' }, 'Indicadores'), '.'),
    s.reprovados.length ? el('p', { class: 'legenda' }, `Finalistas descartados na conferência: ${s.reprovados.map((x) => `${x.ticker} (${x.motivo})`).join('; ')}.`) : null), { mist: true, rotulo: 'Cálculo determinístico', intro: s.ordens.length ? 'Quantidades inteiras que cabem no valor disponível, sem levar nenhum papel acima do teto por ativo nem a renda variável acima da faixa do perfil.' : null });

  const diag = secao('Diagnóstico da carteira.', el('div', { class: 'empilha empilha--folgada' },
    el('dl', { class: 'estatisticas' }, dado('Renda variável', pct(g.rendaVariavel, 1)), dado('Faixa do perfil', `${pct(g.faixaRendaVariavel[0], 0)} a ${pct(g.faixaRendaVariavel[1], 0)}`), dado('Maior posição', pct(g.concentracao.maior, 1)), dado('Posições efetivas', `${numero(g.concentracao.efetivo, 1)} de ${g.concentracao.ativos}`), dado('Pós-fixados de resgate fácil', pct(g.posfixadosLiquidos, 1)), g.risco && dado('Volatilidade da parte em bolsa', pct(g.risco.volatilidadeBolsa, 1))),
    g.achados.length ? el('div', {}, g.achados.map((a) => el('div', { class: 'criterio' }, el('span', {}, a.titulo, ' ', el('span', { class: `leitura ${a.gravidade === 'atencao' ? 'leitura--desfavoravel' : 'leitura--neutro'}` }, a.gravidade === 'atencao' ? 'atenção' : 'informação')), el('span'), el('span', { class: 'legenda' }, a.texto)))) : el('p', { class: 'vazio' }, 'Nenhum desvio relevante em relação ao perfil e aos limites definidos.'),
    g.risco && el('div', { class: 'grade-2 grade-2--folgada' },
      el('div', {}, el('h3', { class: 'kicker' }, 'Quem carrega o risco em bolsa'), el('div', { class: 'tabela-rolavel' }, el('table', { class: 'tabela tabela--numeros' }, el('thead', {}, el('tr', {}, ['Ativo', 'Peso', 'Risco', 'Volatilidade'].map((t) => el('th', { scope: 'col' }, t)))), el('tbody', {}, g.risco.contribuicao.map((x) => el('tr', {}, el('th', { scope: 'row' }, x.codigo), el('td', {}, pct(x.peso, 1)), el('td', {}, pct(x.risco, 1)), el('td', {}, pct(x.volatilidade, 1)))))))),
      el('div', {}, el('h3', { class: 'kicker' }, 'Pares mais correlacionados'), el('div', { class: 'tabela-rolavel' }, el('table', { class: 'tabela tabela--numeros' }, el('thead', {}, el('tr', {}, ['Par', 'Correlação'].map((t) => el('th', { scope: 'col' }, t)))), el('tbody', {}, g.risco.correlacoes.map((x) => el('tr', {}, el('th', { scope: 'row' }, `${x.a} e ${x.b}`), el('td', {}, numero(x.correlacao, 2)))))))))), { rotulo: 'Cálculo determinístico' });

  const vendas = d.vendas?.vendas.length ? secao('Vendas sugeridas.', el('div', { class: 'empilha' },
    el('div', { class: 'tabela-rolavel' }, el('table', { class: 'tabela tabela--numeros' }, el('thead', {}, el('tr', {}, ['Ativo', 'Quantidade', 'Preço', 'Valor', 'Resultado'].map((t) => el('th', { scope: 'col' }, t)))), el('tbody', {}, d.vendas.vendas.map((v) => el('tr', {}, el('th', { scope: 'row' }, v.ticker, el('span', { class: 'bloco legenda' }, v.motivo)), el('td', {}, `${numero(v.quantidade, 0)}${v.total ? ' (toda a posição)' : ''}`), el('td', {}, brl(v.preco)), el('td', {}, brl(v.valor)), el('td', { class: classeSinal(v.lucro) }, brl(v.lucro))))))),
    el('p', { class: 'legenda' }, d.vendas.isento ? 'Com vendas de até R$ 20 mil no mês em ações, o ganho fica isento de imposto de renda (confira as outras vendas do mês).' : `Imposto de renda estimado: ${brl(d.vendas.imposto)} (15% sobre o ganho, pago por DARF). Líquido estimado: ${brl(d.vendas.liquido)}.`)), { mist: true, rotulo: 'Cálculo determinístico', intro: 'Só entram posições acima do teto por ativo ou com sinal de redução na análise fundamentalista.' }) : null;

  const opcoes = d.opcoes?.length ? secao('Estruturas com opções.', el('div', { class: 'grade-2' }, d.opcoes.map(blocoOpcao)), { rotulo: 'Cálculo determinístico', intro: 'Alternativas compatíveis com a carteira atual. Opções podem levar à perda total do valor aplicado e exigem acompanhamento até o vencimento. São opcionais em relação às ordens acima.' }) : null;

  const triagem = secao('Como a triagem chegou a estes nomes.', el('div', { class: 'empilha' },
    el('p', { class: 'copy' }, `Foram avaliadas ${d.triagem.avaliadas} companhias com demonstrativos na CVM. Ficaram de fora: ${d.triagem.descartes.semPreco} sem preço, ${d.triagem.descartes.prejuizo} com prejuízo ou sem patrimônio, ${d.triagem.descartes.pequenas} com receita abaixo de R$ 500 milhões, ${d.triagem.descartes.semLiquidez} com pouca negociação e ${d.triagem.descartes.noTeto} já no teto por ativo.`),
    el('div', { class: 'tabela-rolavel' }, el('table', { class: 'tabela tabela--numeros' }, el('thead', {}, el('tr', {}, ['Papel', 'Setor', 'Nota', 'Saúde', 'Qualidade', 'Preço', 'Crescimento'].map((t) => el('th', { scope: 'col' }, t)))), el('tbody', {}, d.triagem.primeiros.map((c) => el('tr', {}, el('th', { scope: 'row' }, el('a', { href: `#analise/${c.ticker}` }, c.ticker)), el('td', {}, c.setor), el('td', {}, el('strong', {}, numero(c.nota, 2))), ['saude', 'qualidade', 'valor', 'crescimento'].map((k) => el('td', {}, numero(c.notas[k], 2)))))))),
    el('p', { class: 'selo' }, `Pesos do perfil ${P.nome.toLowerCase()}: saúde ${pct(P.pesos.saude, 0)}, qualidade ${pct(P.pesos.qualidade, 0)}, preço ${pct(P.pesos.valor, 0)}, crescimento ${pct(P.pesos.crescimento, 0)}. Valorização recente não entra na nota.`)), { mist: !vendas, rotulo: 'Cálculo determinístico' });

  const fim = secao('Premissas e limites.', el('div', { class: 'grade-2 grade-2--folgada' }, el('div', { class: 'empilha' }, el('h3', { class: 'kicker' }, 'Premissas'), listaTexto(d.premissas)), el('div', { class: 'empilha' }, el('h3', { class: 'kicker' }, 'Limites'), listaTexto(d.limites), el('p', { class: 'selo' }, `Fontes: ${d.fontes.join(' · ')}`), el('p', {}, apagar))), { mist: true });

  return { titulo: 'Relatório do agente', no: el('div', {}, capa, ordens, diag, vendas, opcoes, triagem, ...empresas, fim) };
}

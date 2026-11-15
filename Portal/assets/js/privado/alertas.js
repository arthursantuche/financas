// Alertas: regras criadas pelo dono, avaliadas em dois lugares com a mesma função
// (calculo/alertas.js): aqui, sempre que a página abre, e na rotina agendada do repositório
// privado, que avisa por Issue do GitHub mesmo com o site fechado (só os tipos de preço,
// fundamentos e documento, que não dependem das quantidades da carteira).
import { el, brl, numero, dataHora, novoId } from '../util.js';
import { lista, gravar, remover, sessao } from './cofre.js';
import { campo, selecao, formulario } from './formularios.js';
import { TIPOS, avaliarTodos } from '../calculo/alertas.js';
import { quadro, precosFechamento, alertasDisparados } from './mercado.js';
import { dossieEmpresa } from './empresa.js';
import { indiceEmpresas } from '../dados.js';

const descrever = (a) => {
  const t = TIPOS[a.tipo];
  const valor = t.unidade === 'R$' ? brl(a.valor) : t.unidade ? `${numero(a.valor, a.valor % 1 ? 2 : 0)}${t.unidade.startsWith('%') ? '%' : ' dias'}` : '';
  return [a.codigo, t.nome.toLowerCase(), valor, t.usaBase && a.base ? `sobre ${brl(a.base)}` : ''].filter(Boolean).join(' ');
};

async function contexto() {
  const [q, f, emp] = await Promise.all([quadro(), precosFechamento().catch(() => ({ precos: {} })), indiceEmpresas().catch(() => ({ empresas: [] }))]);
  const alertas = lista('alertas').filter((a) => a.ativo !== false);
  const sinteses = {};
  for (const c of new Set(alertas.filter((a) => a.tipo === 'fundamentos').map((a) => a.codigo))) { const d = await dossieEmpresa(c).catch(() => null); if (d) sinteses[c] = d.sintese; }
  const documentos = Object.fromEntries(emp.empresas.flatMap((e) => e.tickers.map((t) => [t, e.ultimo])));
  const precos = { ...f.precos };
  for (const l of q.avaliacao.linhas) if (l.codigo && l.preco) precos[l.codigo] = l.preco;
  return { alertas, ctx: { precos, sinteses, documentos, hoje: q.hoje, posicoes: q.avaliacao.linhas.map((l) => ({ codigo: l.codigo, nome: l.nome, peso: l.participacao, vencimento: q.ativos.get(l.id)?.vencimento })) } };
}

export async function pagina(ctx, [acao, codigoInicial]) {
  if (acao === 'novo') {
    const { precos } = await precosFechamento().catch(() => ({ precos: {} }));
    const tipo = selecao({ nome: 'tipo', rotulo: 'Avisar quando', opcoes: Object.entries(TIPOS).map(([k, t]) => [k, `${t.nome}${t.unidade ? '…' : ''}`]), valor: 'abaixo' });
    const codigo = campo({ nome: 'codigo', rotulo: 'Código', valor: codigoInicial || '', atributos: { autocapitalize: 'characters', spellcheck: 'false' }, dica: 'Ticker do papel: PETR4, BOVA11.' });
    const valor = campo({ nome: 'valor', rotulo: 'Valor', tipo: 'numero', valor: '' });
    const nota = campo({ nome: 'descricao', rotulo: 'Lembrete', valor: '', dica: 'Por que este alerta importa. Aparece junto do aviso.' });
    const ajustar = () => { const t = TIPOS[tipo.ler()]; codigo.no.hidden = !t.precisaCodigo; codigo.obrigatorio = t.precisaCodigo; valor.no.hidden = !t.unidade; valor.obrigatorio = !!t.unidade; valor.no.querySelector('span').firstChild.textContent = t.unidade ? `Valor (${t.unidade})` : 'Valor'; };
    tipo.input.addEventListener('change', ajustar); ajustar();
    const form = formulario({ campos: [tipo, codigo, valor, nota], rotuloBotao: 'Criar alerta', regras: { valor: (v) => (v > 0 ? '' : 'Informe um valor maior que zero.') },
      acao: async (v) => {
        const t = TIPOS[v.tipo], cod = t.precisaCodigo ? v.codigo.toUpperCase().trim() : null;
        const base = t.usaBase ? precos[cod] : v.tipo === 'documento' ? (await indiceEmpresas()).empresas.find((e) => e.tickers.includes(cod))?.ultimo : null;
        if (t.usaBase && !base) throw new Error(`Não há preço de ${cod} para servir de base. Ligue a nuvem em Ajustes ou use "preço acima de" e "preço abaixo de".`);
        await gravar('alertas', { id: novoId('al'), tipo: v.tipo, codigo: cod, valor: t.unidade ? v.valor : null, base: base ?? null, descricao: v.descricao, ativo: true });
        ctx.avisar('Alerta criado.'); ctx.navegar('alertas');
      }, extras: [el('a', { href: '#alertas' }, 'Cancelar')] });
    return { titulo: 'Novo alerta', no: el('section', { class: 'secao' }, el('div', { class: 'conteudo conteudo--estreito' }, el('header', { class: 'pagina__cabecalho' }, el('p', { class: 'kicker' }, el('a', { href: '#alertas' }, 'Alertas')), el('h1', { class: 'titulo' }, 'Novo alerta.')), form)) };
  }

  const { alertas, ctx: c } = await contexto();
  const chave = 'financas:alertas-estado';
  const { disparos, estado } = avaliarTodos(alertas, c, {});          // o que vale agora
  sessionStorage.setItem(chave, JSON.stringify(estado));
  const servidor = (await alertasDisparados().catch(() => null))?.disparos || [];
  const valendo = new Map(disparos.map((d) => [d.id, d]));

  const linhaAlerta = (a) => {
    const d = valendo.get(a.id);
    let confirmando = false;
    const apagar = el('button', { class: 'link-botao link-botao--alerta', type: 'button', onclick: async () => { if (!confirmando) { confirmando = true; apagar.textContent = 'Toque de novo'; return; } await remover('alertas', a.id); ctx.avisar('Alerta removido.'); ctx.navegar('alertas'); } }, 'Remover');
    return el('li', {}, el('div', { class: 'fila fila--entre' },
      el('span', { class: 'empilha' }, el('strong', {}, descrever(a)), d ? el('span', { class: 'status-pendente' }, d.texto) : el('span', { class: 'legenda' }, 'Aguardando a condição'), a.descricao && el('span', { class: 'legenda' }, a.descricao), !TIPOS[a.tipo].servidor && el('span', { class: 'selo' }, 'Avaliado só com o portal aberto')),
      apagar));
  };
  return { titulo: 'Alertas', no: el('div', {},
    el('section', { class: 'secao' }, el('div', { class: 'conteudo conteudo--estreito' },
      el('header', { class: 'pagina__cabecalho' }, el('p', { class: 'kicker' }, 'Alertas'), el('h1', { class: 'titulo' }, disparos.length ? `${disparos.length === 1 ? 'Um alerta vale' : `${disparos.length} alertas valem`} agora.` : 'Nenhum alerta disparado.'), el('p', { class: 'copy introducao' }, 'Preço, variação, piora dos fundamentos, novos demonstrativos, concentração e vencimentos. Os preços têm atraso: um alerta não substitui uma ordem programada na corretora.')),
      el('p', {}, el('a', { class: 'pill pill--azul', href: '#alertas/novo' }, 'Novo alerta')),
      el('div', { class: 'espaco-topo' }, alertas.length ? el('ul', { class: 'lista' }, alertas.map(linhaAlerta)) : el('p', { class: 'vazio' }, 'Você ainda não criou alertas.')))),
    el('section', { class: 'secao secao--mist' }, el('div', { class: 'conteudo conteudo--estreito' },
      el('h2', { class: 'titulo' }, 'Avisos da rotina automática.'),
      el('p', { class: 'copy introducao' }, sessao.nuvem || sessao.amostra ? 'O que a rotina do repositório privado registrou. Cada aviso também vira uma Issue no GitHub, que notifica por e-mail e pelo aplicativo.' : 'Com a nuvem ligada, uma rotina confere os alertas no GitHub mesmo com o portal fechado e avisa por e-mail e pelo aplicativo do GitHub.'),
      servidor.length ? el('ul', { class: 'lista' }, servidor.slice(0, 30).map((d) => el('li', {}, el('span', {}, d.texto), el('span', { class: 'legenda' }, dataHora(d.quando))))) : el('p', { class: 'vazio' }, sessao.nuvem ? 'Nenhum aviso registrado.' : 'Ligue a nuvem em Ajustes para ativar a rotina.')))) };
}

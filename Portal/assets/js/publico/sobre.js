// Metodologia e fontes: o que é cada tipo de conteúdo, de onde vêm os dados e como são calculados.
import { el, dataBR } from '../util.js';
import { VIGENCIA } from '../calculo/rendafixa.js';

const FONTES = [
  ['Banco Central do Brasil (SGS e Boletim Focus)', 'Selic, CDI, IPCA, IGP-M, poupança, dólar e expectativas', 'Diária', 'https://www3.bcb.gov.br/sgspub/'],
  ['CVM, dados abertos', 'Demonstrações financeiras (DFP e ITR), cadastro das companhias, cotas e carteiras de fundos', 'Semanal (demonstrativos), diária (fundos)', 'https://dados.cvm.gov.br/'],
  ['Tesouro Nacional, Tesouro Transparente', 'Preços e taxas dos títulos do Tesouro Direto', 'Diária', 'https://www.tesourotransparente.gov.br/'],
  ['B3', 'Fechamento diário de ações, ETFs, fundos imobiliários e opções (área privada)', 'Diária, depois do pregão', 'https://www.b3.com.br/'],
];

export async function pagina() {
  const p = (...t) => el('p', { class: 'copy' }, t);
  return { titulo: 'Metodologia e fontes', no: el('section', { class: 'secao' }, el('div', { class: 'conteudo conteudo--estreito' },
    el('header', { class: 'pagina__cabecalho' }, el('p', { class: 'kicker' }, 'Sobre o portal'), el('h1', { class: 'titulo' }, 'Metodologia e fontes.')),
    el('div', { class: 'prosa' },
      el('h2', {}, 'Três tipos de conteúdo'),
      el('ul', {},
        el('li', {}, el('strong', {}, 'Educação financeira.'), ' A área pública explica como os investimentos funcionam. Vale para qualquer pessoa e não leva em conta a situação de ninguém.'),
        el('li', {}, el('strong', {}, 'Análise informativa.'), ' A área privada organiza dados públicos de empresas e calcula indicadores por regras fixas e documentadas. Descreve o passado; não prevê o futuro.'),
        el('li', {}, el('strong', {}, 'Recomendações individualizadas.'), ' O agente da área privada usa a carteira e os parâmetros do próprio dono para sugerir operações. Servem só a ele, são hipóteses de estudo e trazem justificativa, premissas, riscos e o que invalidaria a tese.')),
      p('Nada aqui é oferta de valores mobiliários, consultoria ou análise profissional regulada. Rentabilidade passada não garante resultado futuro, e modelos estatísticos descrevem cenários possíveis, não certezas.'),
      el('h2', {}, 'De onde vêm os dados'),
      el('div', { class: 'tabela-rolavel' }, el('table', { class: 'tabela' },
        el('thead', {}, el('tr', {}, ['Fonte', 'O que fornece', 'Atualização'].map((t) => el('th', { scope: 'col' }, t)))),
        el('tbody', {}, FONTES.map(([nome, oque, freq, url]) => el('tr', {}, el('th', { scope: 'row' }, el('a', { href: url, target: '_blank', rel: 'noopener' }, nome)), el('td', {}, oque), el('td', {}, freq)))))),
      p('Cada número mostrado traz a fonte e a data de referência. Não existe cotação em tempo real gratuita: os preços de bolsa da área privada são do fechamento oficial ou têm atraso de 15 a 30 minutos durante o pregão, e a tela diz qual é o caso.'),
      el('h2', {}, 'Como os cálculos são feitos'),
      el('ul', {},
        el('li', {}, 'Todas as contas são feitas por um motor de cálculo determinístico, com testes automatizados. Os simuladores públicos, a carteira e o agente usam as mesmas funções.'),
        el('li', {}, 'A inteligência artificial não calcula: recebe os resultados prontos e escreve a interpretação. Números que ela citar e que não estejam nos dados recebidos são recusados.'),
        el('li', {}, 'Juros compostos em base de 252 dias úteis; rentabilidade da carteira pelo método de cotas, que desconta o efeito de aportes e resgates; preço médio pelo custo médio ponderado.'),
        el('li', {}, `Regras de imposto de renda conferidas em ${dataBR(VIGENCIA)}. A legislação muda: confirme antes de declarar ou pagar.`),
        el('li', {}, 'A análise de empresas usa as contas padronizadas dos demonstrativos entregues à CVM. A síntese combina vários critérios, com as faixas visíveis na tela, e nunca decorre de um indicador só.')),
      el('h2', {}, 'Privacidade'),
      p('A área privada guarda os dados cifrados no próprio aparelho, com uma chave derivada da senha. Se a sincronização estiver ligada, a cópia que vai para a nuvem também é cifrada. O site não tem servidor próprio, não usa cookies de rastreamento e não carrega scripts de terceiros.'),
      el('h2', {}, 'Limitações conhecidas'),
      el('ul', {},
        el('li', {}, 'Bancos e seguradoras usam um plano de contas diferente: para eles, o portal calcula menos indicadores.'),
        el('li', {}, 'O valor de mercado de empresas com mais de uma classe de ação é aproximado pelo preço do papel consultado.'),
        el('li', {}, 'Opções são avaliadas pelo modelo de Black-Scholes, que supõe volatilidade constante e exercício no vencimento.'),
        el('li', {}, 'As carteiras de fundos divulgadas pela CVM têm defasagem de até três meses.'))))) };
}

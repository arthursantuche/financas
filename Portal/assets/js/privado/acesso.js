// Entrar: abrir o cofre deste aparelho, criar um novo, trazer um da nuvem ou restaurar uma cópia.
import { el } from '../util.js';
import { sessao, existeCofre, metaLocal, criarCofre, abrirCofre, abrirComRecuperacao, importarCopia, avaliarSenha } from './cofre.js';
import { campo, marcar, formulario } from './formularios.js';

const SENHA = { 'autocomplete': 'current-password', autocapitalize: 'none', spellcheck: 'false' };
const NOVA = { 'autocomplete': 'new-password', autocapitalize: 'none', spellcheck: 'false' };
const USUARIO = { autocomplete: 'username', autocapitalize: 'none', spellcheck: 'false' };

export async function pagina(ctx, [modo]) {
  if (sessao.aberta) { ctx.navegar('carteira'); return null; }
  const existe = await existeCofre();
  const meta = existe ? await metaLocal() : null;
  const palco = el('div', { class: 'entrar' });
  const seguir = () => { const volta = sessionStorage.getItem('financas:voltar'); sessionStorage.removeItem('financas:voltar'); ctx.navegar(volta && volta !== 'entrar' ? volta : 'carteira'); };
  const cabecalho = (titulo, texto) => el('header', { class: 'pagina__cabecalho' }, el('p', { class: 'kicker' }, 'Área privada'), el('h1', { class: 'titulo' }, titulo), el('p', { class: 'copy introducao' }, texto));
  const senhaForte = (v) => { const f = avaliarSenha(v); return f.ok ? '' : f.motivo; };

  const telas = {
    entrar: () => {
      const u = campo({ nome: 'usuario', rotulo: 'Usuário', valor: meta.usuario, obrigatorio: true, atributos: USUARIO });
      const s = campo({ nome: 'senha', rotulo: 'Senha', tipo: 'password', obrigatorio: true, atributos: SENHA });
      const m = marcar({ nome: 'manter', rotulo: 'Manter aberto neste aparelho por 30 dias' });
      palco.replaceChildren(cabecalho('Entrar.', 'Sua carteira fica cifrada neste aparelho. A senha é a chave: ela não é enviada a lugar nenhum.'),
        formulario({ campos: [u, s, m], rotuloBotao: 'Entrar', acao: async (v) => { await abrirCofre(v); seguir(); }, extras: [el('a', { href: '#entrar/recuperar' }, 'Esqueci a senha')] }));
      s.input.focus();
    },
    criar: () => {
      const u = campo({ nome: 'usuario', rotulo: 'Usuário', obrigatorio: true, dica: 'Um nome para você. Faz parte da chave: guarde como escreveu.', atributos: USUARIO });
      const s = campo({ nome: 'senha', rotulo: 'Senha', tipo: 'password', obrigatorio: true, dica: 'Pelo menos 12 caracteres. Uma frase de quatro palavras funciona bem.', atributos: NOVA });
      const c = campo({ nome: 'confirma', rotulo: 'Repita a senha', tipo: 'password', obrigatorio: true, atributos: NOVA });
      palco.replaceChildren(cabecalho('Criar o cofre.', 'A carteira é cifrada com a sua senha antes de ser guardada. Ninguém além de você consegue ler, nem quem mantém o site.'),
        formulario({ campos: [u, s, c], rotuloBotao: 'Criar cofre', regras: { senha: senhaForte, confirma: (v, t) => (v !== t.senha ? 'As senhas não são iguais.' : '') },
          acao: async (v) => { const { codigoRecuperacao } = await criarCofre(v); telas.chave(codigoRecuperacao); } }),
        el('p', { class: 'legenda' }, 'Já usa o portal em outro aparelho? ', el('a', { href: '#entrar/nuvem' }, 'Trazer o cofre da nuvem'), ' ou ', el('a', { href: '#entrar/copia' }, 'restaurar uma cópia de segurança'), '.'));
    },
    chave: (codigo) => {
      const ok = marcar({ nome: 'guardei', rotulo: 'Guardei a chave de recuperação em lugar seguro' });
      const botao = el('button', { class: 'pill pill--azul', type: 'button', disabled: true, onclick: seguir }, 'Abrir a carteira');
      ok.input.addEventListener('change', () => { botao.disabled = !ok.input.checked; });
      palco.replaceChildren(cabecalho('Guarde a chave de recuperação.', 'Se você esquecer a senha, esta chave é a única forma de abrir o cofre. Ela aparece só agora.'),
        el('p', { class: 'chave-recuperacao', 'aria-label': 'Chave de recuperação' }, codigo),
        el('div', { class: 'natureza' }, el('strong', {}, 'Onde guardar'), el('span', { class: 'legenda' }, 'No gerenciador de senhas ou em papel, fora deste aparelho. Não tire captura de tela nem envie por mensagem. Sem a senha e sem esta chave, os dados não podem ser recuperados por ninguém.')),
        el('div', { class: 'formulario' }, ok.no, el('div', { class: 'formulario__acoes' }, botao, el('button', { class: 'link-botao', type: 'button', onclick: async () => { try { await navigator.clipboard.writeText(codigo); ctx.avisar('Chave copiada.'); } catch { ctx.avisar('Não foi possível copiar: anote à mão.'); } } }, 'Copiar'))));
    },
    recuperar: () => {
      const u = campo({ nome: 'usuario', rotulo: 'Usuário', valor: meta?.usuario || '', obrigatorio: true, atributos: USUARIO });
      const k = campo({ nome: 'codigo', rotulo: 'Chave de recuperação', obrigatorio: true, atributos: { autocapitalize: 'characters', spellcheck: 'false' } });
      const s = campo({ nome: 'novaSenha', rotulo: 'Nova senha', tipo: 'password', obrigatorio: true, atributos: NOVA });
      palco.replaceChildren(cabecalho('Recuperar o acesso.', 'Informe a chave de recuperação mostrada na criação do cofre e defina uma senha nova.'),
        formulario({ campos: [u, k, s], rotuloBotao: 'Redefinir a senha', regras: { novaSenha: senhaForte }, acao: async (v) => { await abrirComRecuperacao(v); ctx.avisar('Senha redefinida.'); seguir(); }, extras: [el('a', { href: '#entrar' }, 'Voltar')] }));
    },
    nuvem: () => {
      const r = campo({ nome: 'repo', rotulo: 'Repositório privado', obrigatorio: true, dica: 'No formato usuario/repositorio.', atributos: { autocapitalize: 'none', spellcheck: 'false', placeholder: 'usuario/financas-dados' } });
      const t = campo({ nome: 'token', rotulo: 'Token de acesso do GitHub', tipo: 'password', obrigatorio: true, dica: 'Token de escopo fino, restrito a esse repositório, com leitura e escrita em Contents.', atributos: { autocomplete: 'off', autocapitalize: 'none', spellcheck: 'false' } });
      const u = campo({ nome: 'usuario', rotulo: 'Usuário do cofre', obrigatorio: true, atributos: USUARIO });
      const s = campo({ nome: 'senha', rotulo: 'Senha do cofre', tipo: 'password', obrigatorio: true, atributos: SENHA });
      palco.replaceChildren(cabecalho('Trazer o cofre da nuvem.', 'Para usar neste aparelho a carteira que já existe em outro. O token fica guardado aqui, cifrado pela sua senha.'),
        formulario({ campos: [r, t, u, s], rotuloBotao: 'Baixar e abrir', regras: { repo: (v) => (/^[\w.-]+\/[\w.-]+$/.test(v) ? '' : 'Use o formato usuario/repositorio.') },
          acao: async (v) => { const { baixarCofre } = await import('./sincronia.js'); await ctx.comProgresso(baixarCofre(v)); ctx.avisar('Cofre baixado.'); seguir(); }, extras: [el('a', { href: '#entrar' }, 'Voltar')] }));
    },
    copia: () => {
      const arq = el('input', { class: 'campo', type: 'file', accept: '.json,application/json', id: 'c-arquivo' });
      const u = campo({ nome: 'usuario', rotulo: 'Usuário do cofre', obrigatorio: true, atributos: USUARIO });
      const s = campo({ nome: 'senha', rotulo: 'Senha do cofre', tipo: 'password', obrigatorio: true, atributos: SENHA });
      const form = formulario({ campos: [u, s], rotuloBotao: 'Restaurar', acao: async (v) => { if (!arq.files[0]) throw new Error('Escolha o arquivo da cópia de segurança.'); await importarCopia(await arq.files[0].text(), v); ctx.avisar('Cópia restaurada.'); seguir(); }, extras: [el('a', { href: '#entrar' }, 'Voltar')] });
      form.prepend(el('label', { class: 'rotulo', for: 'c-arquivo' }, el('span', {}, 'Arquivo da cópia de segurança'), arq));
      palco.replaceChildren(cabecalho('Restaurar uma cópia.', 'Use o arquivo exportado em Ajustes. Ele só abre com o usuário e a senha do cofre de origem.'), form);
    },
  };

  const escolhida = existe ? (modo === 'recuperar' ? 'recuperar' : 'entrar') : (['nuvem', 'copia', 'recuperar'].includes(modo) ? modo : 'criar');
  if (existe && ['nuvem', 'copia'].includes(modo)) telas.entrar(); else telas[escolhida]();
  const demo = el('p', { class: 'legenda centro espaco-topo' }, 'Quer só ver como funciona? ', el('a', { href: '?amostra#carteira' }, 'Abrir a demonstração'), ', com uma carteira fictícia.');
  return { titulo: 'Entrar', no: el('section', { class: 'secao' }, el('div', { class: 'conteudo' }, palco, demo)) };
}

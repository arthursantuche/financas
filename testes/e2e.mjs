// Teste de ponta a ponta no navegador (Chrome sem interface, pelo Playwright já instalado com o
// playwright-cli). Sobe três servidores locais: o site, um GitHub simulado (API de conteúdo com
// controle de versão por sha) e um provedor de IA simulado. Nenhuma credencial real é usada.
// Uso: node testes/e2e.mjs [--so publico|amostra|cofre|ia] [--capturas pasta]
import http from 'node:http';
import { createRequire } from 'node:module';
import { readFile, mkdir } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const RAIZ = join(fileURLToPath(import.meta.url), '..', '..');
const arg = (n) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : null; };
const SO = arg('so'), CAPTURAS = arg('capturas');
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require(join(execSync('npm root -g').toString().trim(), '@playwright/cli/node_modules/playwright-core'))); }
catch { console.error('Playwright não encontrado. Instale com: npm install -g @playwright/cli'); process.exit(2); }

// ---- Servidores ----
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.md': 'text/markdown; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const site = http.createServer(async (req, res) => {
  const caminho = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  try { const dados = await readFile(join(RAIZ, 'Portal', caminho === '/' ? 'index.html' : caminho)); res.writeHead(200, { 'Content-Type': TIPOS[extname(caminho)] || 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(dados); }
  catch { res.writeHead(404); res.end('não encontrado'); }
});
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET, PUT, POST, OPTIONS' };
const corpo = (req) => new Promise((ok) => { let t = ''; req.on('data', (d) => { t += d; }); req.on('end', () => ok(t)); });

// GitHub simulado: um repositório privado em memória.
const repo = new Map(); // caminho → { texto, sha }
const TOKEN = 'token-de-teste-local';
const sha = (t) => createHash('sha1').update(t).digest('hex');
const github = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') { res.writeHead(204, CORS); return res.end(); }
  const json = (status, o) => { res.writeHead(status, { ...CORS, 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
  if (req.headers.authorization !== `Bearer ${TOKEN}`) return json(401, { message: 'Bad credentials' });
  const m = /^\/repos\/dono\/dados(?:\/contents\/(.+))?$/.exec(decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!m) return json(404, { message: 'Not Found' });
  if (!m[1]) return json(200, { full_name: 'dono/dados', private: true, permissions: { push: true } });
  const atual = repo.get(m[1]);
  if (req.method === 'GET') {
    if (!atual) return json(404, { message: 'Not Found' });
    if ((req.headers.accept || '').includes('raw')) { res.writeHead(200, { ...CORS, 'Content-Type': 'application/json' }); return res.end(atual.texto); }
    return json(200, { content: Buffer.from(atual.texto).toString('base64'), sha: atual.sha });
  }
  if (req.method === 'PUT') {
    const p = JSON.parse(await corpo(req));
    if ((atual && p.sha !== atual.sha) || (!atual && p.sha)) return json(409, { message: 'sha não confere' });
    const texto = Buffer.from(p.content, 'base64').toString('utf8');
    repo.set(m[1], { texto, sha: sha(texto + Date.now()) });
    return json(atual ? 200 : 201, { content: { sha: repo.get(m[1]).sha } });
  }
  json(405, {});
});

// IA simulada: responde no formato pedido; no relatório de empresa, inventa um número de propósito.
const pedidosIA = [];
const ia = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') { res.writeHead(204, CORS); return res.end(); }
  const json = (o) => { res.writeHead(200, { ...CORS, 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
  if (req.url.endsWith('/models')) return json({ data: [{ id: 'modelo-de-teste' }] });
  const p = JSON.parse(await corpo(req)); pedidosIA.push(p);
  const pedido = p.messages.at(-1).content;
  const resposta = pedido.includes('"resumo"') ? { resumo: 'A carteira está dentro do perfil e as ordens ampliam a diversificação por setor. O principal risco é a oscilação da renda variável.' }
    : { modeloNegocio: 'A empresa vende produtos e serviços do seu setor e ganha escala com a operação.', posicionamento: 'Está entre as companhias relevantes do setor.',
      porter: { rivalidade: { nivel: 'alta', texto: 'Há vários concorrentes.' }, novosEntrantes: { nivel: 'média', texto: 'Exige capital.' }, substitutos: { nivel: 'baixa', texto: 'Poucos substitutos.' }, poderClientes: { nivel: 'média', texto: 'Clientes pulverizados.' }, poderFornecedores: { nivel: 'baixa', texto: 'Muitos fornecedores.' } },
      vantagens: ['Escala de operação.', 'Marca conhecida.'], riscos: ['Alta de juros encarece a dívida.', 'Concorrência pode pressionar margens.', 'Mudanças regulatórias.', 'Dependência do ciclo econômico.'],
      macro: 'Juros altos reduzem a demanda e aumentam o retorno exigido.', tese: 'A margem deve subir para 87,31% no próximo ano.', // número inventado: tem de ser recusado
      cenarioFavoravel: 'A demanda cresce e as margens se mantêm.', cenarioDesfavoravel: 'A demanda cai e o endividamento sobe.', invalidacao: ['Queda de receita por dois trimestres.', 'Aumento forte da dívida.', 'Perda de participação de mercado.'] };
  json({ model: 'modelo-de-teste', choices: [{ message: { content: JSON.stringify(resposta) } }], usage: { total_tokens: 100 } });
});

const ouvir = (s) => new Promise((ok) => s.listen(0, '127.0.0.1', () => ok(s.address().port)));
const [pSite, pGit, pIA] = await Promise.all([ouvir(site), ouvir(github), ouvir(ia)]);
const BASE = `http://127.0.0.1:${pSite}`, API = `http://127.0.0.1:${pGit}`;

// ---- Infra do teste ----
const falhas = [], feitos = [];
const conferir = (cond, nome, detalhe = '') => { (cond ? feitos : falhas).push(nome + (cond || !detalhe ? '' : ` → ${detalhe}`)); if (!cond) console.log(`  ✖ ${nome}${detalhe ? `: ${detalhe}` : ''}`); };
const navegador = await chromium.launch({ channel: 'chrome', headless: true }).catch(() => chromium.launch({ headless: true }));
async function abrir({ largura = 1280, altura = 800, tema = 'light', toque = false } = {}) {
  const contexto = await navegador.newContext({ viewport: { width: largura, height: altura }, colorScheme: tema, hasTouch: toque, isMobile: toque, reducedMotion: 'reduce' });
  const pagina = await contexto.newPage();
  const erros = [];
  pagina.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });
  pagina.on('pageerror', (e) => erros.push(String(e)));
  return { contexto, pagina, erros };
}
// Abre uma rota e espera o conteúdo dela estar desenhado (o site marca a rota em #pagina).
const ir = async (pagina, rota, espera = 400) => {
  const alvo = decodeURIComponent(rota.split('#')[1] || 'inicio');
  await pagina.goto(`${BASE}/${rota}`);
  await pagina.waitForFunction((a) => document.querySelector('#pagina')?.dataset.rota === a && document.querySelector('#pagina h1, #pagina .titulo'), alvo, { timeout: 20000 });
  await pagina.waitForTimeout(espera);
};
const esperarRota = (pagina, prefixo, tempo = 20000) => pagina.waitForFunction((p) => (document.querySelector('#pagina')?.dataset.rota || '').startsWith(p), prefixo, { timeout: tempo });
const layout = (pagina) => pagina.evaluate(() => ({ rolagemLateral: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1, h1: document.querySelectorAll('#pagina h1').length, titulo: document.title }));
const captura = async (pagina, nome) => { if (!CAPTURAS) return; await mkdir(CAPTURAS, { recursive: true }); await pagina.screenshot({ path: join(CAPTURAS, `${nome}.png`), fullPage: false }); };

// ---- 1. Área pública ----
async function publico() {
  console.log('Área pública');
  const rotas = ['#inicio', '#aprender', '#aprender/fundamentos', '#artigo/juros-compostos', '#artigo/selic-cdi-e-politica-monetaria', '#indicadores', '#simuladores', '#simuladores/renda-fixa', '#simuladores/payoff', '#sobre', '#saude', '#entrar'];
  for (const [largura, altura, toque] of [[1280, 800, false], [834, 1112, true], [390, 844, true], [844, 390, true], [320, 640, true]]) {
    for (const tema of ['light', 'dark']) {
      const { contexto, pagina, erros } = await abrir({ largura, altura, tema, toque });
      for (const rota of rotas) {
        await ir(pagina, rota);
        const l = await layout(pagina);
        conferir(!l.rolagemLateral, `sem rolagem lateral ${rota} ${largura}×${altura}`, 'a página rola para o lado');
        conferir(l.h1 === 1, `um título principal ${rota} ${largura}×${altura}`, `${l.h1} h1`);
        if (largura === 390 && tema === 'dark') await captura(pagina, `publico-${rota.replace(/[#/]/g, '_')}-390`);
        if (largura === 1280 && tema === 'light') await captura(pagina, `publico-${rota.replace(/[#/]/g, '_')}-1280`);
      }
      conferir(!erros.length, `sem erros no console ${largura}×${altura} ${tema}`, erros.slice(0, 3).join(' | '));
      await contexto.close();
    }
  }
  // Conteúdo: todo artigo do índice abre, tem fontes e nenhum valor ficou sem preencher.
  const { contexto, pagina, erros } = await abrir();
  const indice = JSON.parse(await readFile(join(RAIZ, 'Portal/conteudo/indice.json'), 'utf8'));
  for (const a of indice.trilhas.flatMap((t) => t.artigos)) {
    await ir(pagina, `#artigo/${a.slug}`, 250);
    const r = await pagina.evaluate(() => ({ fontes: document.querySelectorAll('.artigo__fontes li').length, pendentes: [...document.querySelectorAll('[data-valor]')].filter((n) => n.textContent === '…' || n.textContent === '—').map((n) => n.dataset.valor), secoes: document.querySelectorAll('.prosa h2').length, quebrado: document.querySelector('.prosa')?.textContent.includes(':::') }));
    conferir(r.fontes >= 1, `artigo ${a.slug} tem fontes`);
    conferir(!r.pendentes.length, `artigo ${a.slug} sem valores pendentes`, r.pendentes.join(', '));
    conferir(r.secoes >= 3 && !r.quebrado, `artigo ${a.slug} renderizado`, `${r.secoes} seções`);
  }
  // Simulador reage à digitação.
  await ir(pagina, '#simuladores/juros-compostos');
  const antes = await pagina.textContent('.resultados dd');
  await pagina.fill('.simulador input >> nth=1', '1000');
  await pagina.waitForTimeout(500);
  conferir(antes !== await pagina.textContent('.resultados dd'), 'simulador recalcula ao digitar');
  // Rota privada sem cofre aberto leva ao login.
  await pagina.goto(`${BASE}/#carteira`); await pagina.waitForTimeout(600);
  conferir(new URL(pagina.url()).hash.startsWith('#entrar'), 'rota privada exige o cofre', pagina.url());
  conferir(!erros.length, 'sem erros no console nos artigos', erros.slice(0, 3).join(' | '));
  await contexto.close();
}

// ---- 2. Demonstração ----
async function amostra() {
  console.log('Demonstração (carteira fictícia)');
  for (const [largura, altura, toque, tema] of [[1280, 800, false, 'light'], [390, 844, true, 'dark'], [844, 390, true, 'light']]) {
    const { contexto, pagina, erros } = await abrir({ largura, altura, toque, tema });
    for (const rota of ['?amostra#carteira', '?amostra#lancar', '?amostra#lancar/historico', '?amostra#analise', '?amostra#analise/WEGE3', '?amostra#analise/ITUB4', '?amostra#analise/enviar', '?amostra#alertas', '?amostra#agente', '?amostra#ajustes']) {
      await ir(pagina, rota, 700);
      const l = await layout(pagina);
      conferir(!l.rolagemLateral, `sem rolagem lateral ${rota} ${largura}×${altura}`);
      if (CAPTURAS) await captura(pagina, `amostra-${rota.replace(/[?#/]/g, '_')}-${largura}`);
    }
    // Carteira: total coerente com as linhas; gráfico e leitura por arraste.
    await ir(pagina, '?amostra#carteira', 800);
    const c = await pagina.evaluate(() => ({ total: document.querySelector('.patrimonio__valor').textContent, linhas: document.querySelectorAll('.cotacao').length, grafico: !!document.querySelector('.grafico-preco__linha'), faiscas: document.querySelectorAll('.faisca path').length }));
    conferir(c.linhas >= 12 && c.grafico && c.faiscas >= 8, `carteira com posições e gráficos ${largura}`, JSON.stringify(c));
    const palco = await pagina.$('.grafico-preco__palco');
    await palco.scrollIntoViewIfNeeded();
    const caixa = await palco.boundingBox();
    await pagina.mouse.move(caixa.x + caixa.width * 0.3, caixa.y + caixa.height / 2);
    conferir(await pagina.evaluate(() => document.querySelector('.grafico-preco').hasAttribute('data-lendo')), `gráfico de preço lê o ponto ${largura}`);
    // Ficha do primeiro ativo.
    await pagina.click('.cotacao a'); await esperarRota(pagina, 'ativo/');
    conferir(await pagina.evaluate(() => !!document.querySelector('.estatisticas') && /Minha posição/.test(document.body.textContent)), `ficha do ativo abre ${largura}`);
    if (largura === 1280) {
      // Agente: execução completa por regras, com ordens e relatório por empresa.
      await ir(pagina, '?amostra#agente');
      await pagina.fill('#c-orcamento', '20000'); await pagina.selectOption('#c-perfil', 'arrojado');
      await pagina.click('button:has-text("Executar")');
      await esperarRota(pagina, 'relatorio/', 40000);
      await pagina.waitForTimeout(1500);
      const r = await pagina.evaluate(async () => { const { sessao } = await import('/assets/js/privado/cofre.js'); const x = sessao.dados.relatorios.at(-1); return { ordens: x.dossie.selecao.ordens, modo: x.narrativa.modo, partes: document.querySelectorAll('.relatorio__parte').length, orc: x.dossie.parametros.orcamentoComVendas, opcoes: x.dossie.opcoes.length, total: x.dossie.diagnostico.total }; });
      const gasto = r.ordens.reduce((s, o) => s + o.valor, 0);
      conferir(r.ordens.length >= 1 && r.modo === 'regras', 'agente gera ordens por regras', JSON.stringify(r.ordens.map((o) => o.ticker)));
      conferir(gasto <= r.orc + 0.01, 'ordens cabem no valor disponível', `${gasto} > ${r.orc}`);
      conferir(r.ordens.every((o) => Number.isInteger(o.quantidade) && o.pesoNaCarteira <= 0.15 + 1e-6 && o.criterios.precoTeto >= o.preco), 'ordens respeitam teto por ativo e têm preço-teto');
      conferir(r.partes >= r.ordens.length * 14 && r.opcoes >= 1, 'relatório traz as 14 partes por empresa e estruturas com opções', `${r.partes} partes`);
      await captura(pagina, 'amostra-relatorio-1280');
    }
    conferir(!erros.length, `sem erros no console na demonstração ${largura}`, erros.slice(0, 3).join(' | '));
    await contexto.close();
  }
}

// ---- 3. Cofre, login e sincronização entre dois aparelhos ----
const USUARIO = 'teste', SENHA = 'frase-de-teste-local-4184';
async function cofre() {
  console.log('Cofre, login e sincronização');
  repo.clear();
  const A = await abrir();
  await ir(A.pagina, '#entrar');
  // Senha fraca é recusada.
  await A.pagina.fill('#c-usuario', USUARIO); await A.pagina.fill('#c-senha', '12345678'); await A.pagina.fill('#c-confirma', '12345678');
  await A.pagina.click('button[type=submit]'); await A.pagina.waitForTimeout(300);
  conferir((await A.pagina.textContent('#e-senha')).length > 0, 'senha fraca recusada');
  await A.pagina.fill('#c-senha', SENHA); await A.pagina.fill('#c-confirma', SENHA);
  await A.pagina.click('button[type=submit]');
  await A.pagina.waitForSelector('.chave-recuperacao', { timeout: 20000 });
  const chave = await A.pagina.textContent('.chave-recuperacao');
  conferir(/^[A-Z0-9]{5}(-[A-Z0-9]{5}){4}$/.test(chave.trim()), 'chave de recuperação exibida', chave);
  await A.pagina.check('#c-guardei'); await A.pagina.click('button:has-text("Abrir a carteira")');
  await esperarRota(A.pagina, 'carteira');
  // Cadastro de uma ação e de um CDB pelo formulário.
  await ir(A.pagina, '#lancar/novo/acao');
  await A.pagina.fill('#c-codigo', 'wege3'); await A.pagina.dispatchEvent('#c-codigo', 'change');
  conferir((await A.pagina.inputValue('#c-nome')).includes('WEG'), 'nome preenchido pelo cadastro da CVM');
  await A.pagina.fill('#c-instituicao', 'Corretora de teste'); await A.pagina.fill('#c-precoManual', '41,20');
  await A.pagina.fill('#c-data', '2026-03-10'); await A.pagina.fill('#c-quantidade', '100'); await A.pagina.fill('#c-preco', '38,50'); await A.pagina.fill('#c-custos', '4,90');
  await A.pagina.click('button[type=submit]');
  await esperarRota(A.pagina, 'ativo/', 10000).catch(async () => { throw new Error('cadastro da ação não salvou: ' + await A.pagina.evaluate(() => [...document.querySelectorAll('[role=alert]')].map((e) => e.id + '=' + e.textContent).filter((t) => !t.endsWith('=')).join(' | '))); });
  await ir(A.pagina, '#lancar/novo/rendafixa');
  await A.pagina.fill('#c-nome', 'Banco de teste'); await A.pagina.fill('#c-percentual', '110'); await A.pagina.fill('#c-data', '2025-06-02'); await A.pagina.fill('#c-quantidade', '10000');
  await A.pagina.click('button[type=submit]');
  await esperarRota(A.pagina, 'ativo/', 10000).catch(async () => { throw new Error('cadastro do CDB não salvou: ' + await A.pagina.evaluate(() => [...document.querySelectorAll('[role=alert]')].map((e) => e.id + '=' + e.textContent).filter((t) => !t.endsWith('=')).join(' | ')) + ' | console: ' + A.erros.join(' | ')); });
  await ir(A.pagina, '#carteira', 800);
  const c1 = await A.pagina.evaluate(async () => { const { quadro } = await import('/assets/js/privado/mercado.js'); const q = await quadro(); return { total: q.avaliacao.total, linhas: q.avaliacao.linhas.map((l) => ({ nome: l.nome, valor: l.valor, lucro: l.lucro, pm: l.precoMedio })) }; });
  const acao = c1.linhas.find((l) => /WEG/.test(l.nome)), cdb = c1.linhas.find((l) => /CDB/.test(l.nome));
  conferir(Math.abs(acao.valor - 4120) < 0.01 && Math.abs(acao.pm - 38.549) < 0.001, 'ação: valor pelo preço manual e preço médio com custos', JSON.stringify(acao));
  conferir(cdb && cdb.valor > 11000 && cdb.valor < 13500, 'CDB valorizado pela curva do CDI real', JSON.stringify(cdb));
  // Nada em claro no armazenamento do navegador.
  const bruto = await A.pagina.evaluate(async () => { const { obter } = await import('/assets/js/privado/cofre.js'); return JSON.stringify([await obter('dados'), await obter('meta')]) + JSON.stringify({ ...localStorage }) ; });
  conferir(!/WEGE3|Corretora de teste|38[.,]5/.test(bruto) && !bruto.includes(SENHA), 'dados e senha não ficam em claro no aparelho');
  // Liga a nuvem (GitHub simulado) e confere o que subiu.
  await A.pagina.evaluate(async ([api, token]) => { const s = await import('/assets/js/privado/sincronia.js'); await s.conectar({ repo: 'dono/dados', token, api }); }, [API, TOKEN]);
  const noRepo = [...repo.keys()].sort().join(',');
  conferir(noRepo === 'cofre/chaves.json,cofre/dados.json,monitor.json', 'nuvem recebe chaves, dados e monitor', noRepo);
  conferir(!/WEGE3|Corretora|quantidade/.test(repo.get('cofre/dados.json').texto), 'cofre sobe cifrado');
  const monitor = JSON.parse(repo.get('monitor.json').texto);
  conferir(monitor.codigos.includes('WEGE3') && !/38\.5|100|Corretora/.test(JSON.stringify({ ...monitor, geradoEm: 0 })), 'monitor leva só códigos, sem quantidades nem preços', JSON.stringify(monitor));
  // Aparelho B: baixa o cofre com usuário e senha.
  const B = await abrir({ largura: 390, altura: 844, toque: true });
  await ir(B.pagina, '#entrar/nuvem');
  const senhaErrada = await B.pagina.evaluate(async ([api, token, u]) => { const s = await import('/assets/js/privado/sincronia.js'); try { await s.baixarCofre({ repo: 'dono/dados', token, usuario: u, senha: 'senha-errada-de-teste', api }); return 'entrou'; } catch (e) { return e.message; } }, [API, TOKEN, USUARIO]);
  conferir(/incorretos/.test(senhaErrada), 'senha errada não abre o cofre da nuvem', senhaErrada);
  await B.pagina.evaluate(async ([api, token, u, s2]) => { const s = await import('/assets/js/privado/sincronia.js'); await s.baixarCofre({ repo: 'dono/dados', token, usuario: u, senha: s2, api }); }, [API, TOKEN, USUARIO, SENHA]);
  const nB = await B.pagina.evaluate(async () => (await import('/assets/js/privado/cofre.js')).lista('ativos').length);
  conferir(nB === 2, 'aparelho B recebe a carteira', `${nB} ativos`);
  // B lança uma compra; A cria um alerta ao mesmo tempo; os dois sincronizam e convergem.
  await B.pagina.evaluate(async () => { const c = await import('/assets/js/privado/cofre.js'); const a = c.lista('ativos').find((x) => x.codigo === 'WEGE3'); await c.gravar('lancamentos', { id: 'l-b-1', ativoId: a.id, tipo: 'compra', data: '2026-10-01', quantidade: 50, preco: 40, custos: 0 }); const s = await import('/assets/js/privado/sincronia.js'); await s.sincronizar(); });
  await A.pagina.evaluate(async () => { const c = await import('/assets/js/privado/cofre.js'); await c.gravar('alertas', { id: 'al-a-1', tipo: 'abaixo', codigo: 'WEGE3', valor: 35, ativo: true }); const s = await import('/assets/js/privado/sincronia.js'); await s.sincronizar(); });
  await B.pagina.evaluate(async () => { const s = await import('/assets/js/privado/sincronia.js'); await s.sincronizar(); });
  const fim = async (p) => p.evaluate(async () => { const c = await import('/assets/js/privado/cofre.js'); return { lanc: c.lista('lancamentos').length, alertas: c.lista('alertas').length }; });
  const [fa, fb] = [await fim(A.pagina), await fim(B.pagina)];
  conferir(fa.lanc === 3 && fa.alertas === 1 && fb.lanc === 3 && fb.alertas === 1, 'edições simultâneas em dois aparelhos convergem', JSON.stringify({ fa, fb }));
  conferir(JSON.parse(repo.get('monitor.json').texto).alertas.length === 1, 'gatilho do alerta chega ao monitor');
  // Bloqueio, senha errada, senha certa, recuperação.
  await A.pagina.evaluate(async () => (await import('/assets/js/privado/cofre.js')).bloquear());
  await ir(A.pagina, '#entrar');
  await A.pagina.fill('#c-senha', 'senha-errada-de-teste'); await A.pagina.click('button[type=submit]'); await A.pagina.waitForTimeout(1800);
  conferir(/incorretos/.test(await A.pagina.textContent('form .status-pendente[role=alert]:not(.erro)')), 'login recusa senha errada');
  await A.pagina.fill('#c-senha', SENHA); await A.pagina.click('button[type=submit]');
  await esperarRota(A.pagina, 'carteira');
  conferir(true, 'login com a senha certa');
  await A.pagina.evaluate(async () => (await import('/assets/js/privado/cofre.js')).bloquear());
  const rec = await A.pagina.evaluate(async ([u, k]) => { const c = await import('/assets/js/privado/cofre.js'); await c.abrirComRecuperacao({ usuario: u, codigo: k, novaSenha: 'outra-frase-de-teste-9921' }); return c.lista('ativos').length; }, [USUARIO, chave.trim()]);
  conferir(rec === 2, 'chave de recuperação abre o cofre e redefine a senha');
  conferir(!A.erros.filter((e) => !/401|404|409/.test(e)).length && !B.erros.filter((e) => !/401|404|409/.test(e)).length, 'sem erros no console no fluxo do cofre', [...A.erros, ...B.erros].filter((e) => !/401|404|409/.test(e)).slice(0, 3).join(' | '));
  await A.contexto.close(); await B.contexto.close();
}

// ---- 4. Agente com IA simulada: aceita texto, recusa número inventado ----
async function comIA() {
  console.log('Agente com IA (provedor simulado)');
  pedidosIA.length = 0;
  const { contexto, pagina, erros } = await abrir();
  await ir(pagina, '?amostra#agente');
  await pagina.evaluate((base) => import('/assets/js/privado/cofre.js').then((c) => { c.sessao.dados.config.llm = { provedor: 'local', base, chave: 'chave-de-teste', modelo: 'modelo-de-teste' }; }), `http://127.0.0.1:${pIA}/v1`);
  await ir(pagina, '?amostra#analise'); await pagina.evaluate(() => { location.hash = '#agente'; }); await esperarRota(pagina, 'agente');
  await pagina.fill('#c-orcamento', '15000'); await pagina.selectOption('#c-perfil', 'arrojado');
  conferir(await pagina.isChecked('#c-usarIA'), 'opção de redigir com IA disponível');
  await pagina.click('button:has-text("Executar")');
  await esperarRota(pagina, 'relatorio/', 40000);
  const r = await pagina.evaluate(async () => { const { sessao } = await import('/assets/js/privado/cofre.js'); const x = sessao.dados.relatorios.at(-1); return { n: x.narrativa, ordens: x.dossie.selecao.ordens.map((o) => o.ticker) }; });
  conferir(r.n.modo === 'ia' && /diversificação/.test(r.n.resumo), 'resumo redigido pela IA é aceito');
  conferir(r.n.recusados.some((x) => /tese/.test(x.trecho) && x.numeros.includes('87,31')), 'número inventado pela IA é recusado', JSON.stringify(r.n.recusados));
  const e1 = r.n.empresas[r.ordens[0]];
  conferir(e1.qualitativoPorIA && e1.porter?.rivalidade && !/87,31/.test(e1.tese), 'parte qualitativa entra; a tese volta ao texto por regras');
  const enviado = JSON.stringify(pedidosIA);
  conferir(!/"quantidade"|"valor":|"total":\d{4,}/.test(enviado.replace(/"valor":\{/g, '')), 'pedido à IA não leva quantidades nem valores da carteira', enviado.match(/"(quantidade|valor|total)":[^,]{0,20}/)?.[0] || '');
  await pagina.waitForSelector('.relatorio__parte', { timeout: 20000 });
  conferir(await pagina.evaluate(() => /Controle da redação por IA/.test(document.body.textContent) && document.querySelectorAll('.forca').length >= 5), 'relatório mostra o controle da IA e as cinco forças');
  conferir(!erros.length, 'sem erros no console com IA', erros.slice(0, 3).join(' | '));
  await captura(pagina, 'amostra-relatorio-ia');
  await contexto.close();
}

try {
  if (!SO || SO === 'publico') await publico();
  if (!SO || SO === 'amostra') await amostra();
  if (!SO || SO === 'cofre') await cofre();
  if (!SO || SO === 'ia') await comIA();
} catch (e) { falhas.push(`exceção: ${e.stack || e}`); console.error(e); }
await navegador.close(); site.close(); github.close(); ia.close();
console.log(`\n${feitos.length} verificações certas, ${falhas.length} com problema`);
for (const f of falhas) console.log(`✖ ${f}`);
process.exit(falhas.length ? 1 : 0);

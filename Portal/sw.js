// Service worker: guarda os arquivos do portal para abrir sem sinal.
// VERSAO e ARQUIVOS são preenchidos na publicação (coleta/publicar.mjs) com o identificador do
// commit e a lista real de arquivos: cada publicação troca o cache inteiro, sem passo manual e sem
// misturar módulos de versões diferentes. Dados privados nunca passam por aqui: ficam cifrados no
// IndexedDB (assets/js/privado/cofre.js).
const VERSAO = 'financas-__VERSAO__';
const ARQUIVOS = self.__ARQUIVOS__ || ['./', 'index.html', 'manifest.webmanifest'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSAO).then((c) => c.addAll(ARQUIVOS.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((chaves) => Promise.all(chaves.filter((k) => k !== VERSAO).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return; // GitHub, Banco Central e IA passam direto
  const dados = /\/(dados|conteudo)\//.test(url.pathname);
  e.respondWith(caches.open(VERSAO).then(async (cache) => {
    const salvo = await cache.match(req, { ignoreSearch: true });
    const rede = fetch(req).then((r) => { if (r.ok) cache.put(req, r.clone()); return r; });
    // Dados e conteúdo: rede primeiro, para o número do dia; sem sinal, a última cópia.
    if (dados) return rede.catch(() => salvo || Response.error());
    // Arquivos do site: cópia primeiro, atualizando em segundo plano.
    rede.catch(() => {});
    return salvo || rede;
  }));
});

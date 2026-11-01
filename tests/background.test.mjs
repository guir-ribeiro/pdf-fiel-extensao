import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInContext, createContext } from 'node:vm';
import test from 'node:test';

const source = (file) => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const pdf = '%PDF-1.7\n' + 'test content '.repeat(20);
const extensionId = 'test-extension';
const blobUrl = 'blob:chrome-extension://' + extensionId + '/pdf-1';

function worker(options = {}) {
  const calls = [];
  const messages = [];
  const timers = [];
  const listeners = {};
  const event = (name) => ({ addListener: (fn) => { listeners[name] = fn; } });
  let offscreen = !!options.offscreen;
  const chrome = {
    runtime: {
      id: extensionId,
      getURL: (path) => 'chrome-extension://' + extensionId + '/' + path,
      getContexts: async () => offscreen ? [{ contextType: 'OFFSCREEN_DOCUMENT' }] : [],
      onMessage: event('message'),
      sendMessage: async (msg) => {
        messages.push(msg);
        if (msg.type === 'printly-blob') return { url: blobUrl };
      }
    },
    tabs: {
      get: async () => ({ url: options.url || 'https://example.com/' }),
      query: async () => [{ id: 7 }]
    },
    storage: { sync: { get: async () => ({ settings: options.settings }) } },
    debugger: {
      attach: (target, version, cb) => { calls.push('attach'); cb(); },
      detach: (target, cb) => { calls.push('detach'); cb(); },
      sendCommand: (target, method, params, cb) => {
        calls.push([method, params]);
        const failure = options.commandError?.(method, params);
        if (failure) {
          chrome.runtime.lastError = { message: failure };
          cb();
          delete chrome.runtime.lastError;
          return;
        }
        if (method === 'Page.printToPDF') cb({ stream: 'pdf-stream' });
        else if (method === 'IO.read') cb({ data: btoa(pdf), base64Encoded: true, eof: true });
        else cb({});
      }
    },
    scripting: {
      executeScript: async ({ func }) => {
        calls.push(func.name);
        if (func.name === 'preparePage') {
          if (options.prepareError) throw new Error('Falha no preparo');
          return [{ result: {
            width: 1440, height: options.height || 2400, title: 'Página de teste',
            url: 'https://example.com/', dark: true
          } }];
        }
      }
    },
    downloads: {
      onChanged: event('download'),
      search: async () => options.items || [{ byExtensionId: extensionId, url: blobUrl }],
      download: async (params) => {
        calls.push(['download', params]);
        if (options.downloadError) throw new Error('Download cancelado');
        return 42;
      }
    },
    offscreen: {
      createDocument: async () => { calls.push('offscreen'); offscreen = true; }
    },
    commands: { onCommand: event('command') },
    action: { setBadgeText() {}, setBadgeBackgroundColor() {} }
  };
  const ctx = createContext({
    chrome, atob, btoa, Uint8Array, TextEncoder, console,
    setTimeout: (fn, ms) => {
      timers.push({ fn, ms });
      if (ms <= 1000) queueMicrotask(fn);
    }
  });
  ctx.importScripts = (file) => runInContext(source(file), ctx);
  runInContext(source('background.js'), ctx);
  return { ctx, chrome, calls, messages, timers, listeners };
}

test('valida preferências corrompidas sem aceitar chaves extras', () => {
  const { ctx } = worker();
  const normalized = ctx.PrintlySettings.normalize({
    layout: 'invalid', scale: 9, stamp: 'false', stampPosition: 'header', unknown: true
  });
  assert.equal(normalized.layout, 'width');
  assert.equal(normalized.scale, 1.5);
  assert.equal(normalized.stamp, true);
  assert.equal(normalized.stampPosition, 'header');
  assert.equal('unknown' in normalized, false);
  assert.equal(ctx.PrintlySettings.normalize({ scale: -1 }).scale, 0.5);
  assert.equal(ctx.PrintlySettings.normalize({ scale: NaN }).scale, 1);
  assert.equal(ctx.PrintlySettings.normalize(null).layout, 'width');
});

test('carimbo escapa conteúdo HTML da página e mantém o fuso horário', () => {
  const { ctx } = worker();
  const template = ctx.buildStampTemplate(
    { stampTitle: true, stampUrl: true, stampDate: true },
    { title: '<script>alert(1)</script>', url: 'https://example.com/?a="x"&b=2' },
    ctx.nowStamp(), 1, 8.27
  );
  assert.ok(!template.includes('<script>'));
  assert.ok(template.includes('&lt;script&gt;'));
  assert.ok(template.includes('&amp;b=2'));
  assert.match(ctx.nowStamp(), /(?:GMT|UTC|BRT|AMT|ACT|[A-Z]{3,5})/);
});

test('nomes de arquivo evitam caracteres inválidos, pontos iniciais e nomes reservados', () => {
  const { ctx } = worker();
  assert.match(ctx.safeFilename('.. /Minha\u0000 página?:'), /^Minha página - /);
  assert.match(ctx.safeFilename('CON'), /^pagina-CON - /);
  assert.match(ctx.safeFilename('...'), /^pagina - /);
  assert.ok(!/[\\/:*?"<>|\u0000-\u001f]/.test(ctx.safeFilename('a/b:c')));
});

test('restaura a página, remove mídia e desconecta antes de iniciar o download', async () => {
  const { ctx, calls, messages } = worker();
  const result = await ctx.run(7);
  assert.equal(result.ok, true);
  const reset = calls.findIndex((c) => Array.isArray(c)
    && c[0] === 'Emulation.setEmulatedMedia' && c[1].media === '');
  const restore = calls.indexOf('restorePage');
  const detach = calls.indexOf('detach');
  const download = calls.findIndex((c) => c[0] === 'download');
  assert.ok(reset >= 0 && reset < restore && restore < detach && detach < download);
  assert.equal(calls[reset][1].features.length, 0);
  assert.ok(messages.some((m) => m.text?.startsWith('Download iniciado:')));
});

for (const failure of ['prepare', 'print', 'read']) {
  test('restaura e desconecta após falha em ' + failure, async () => {
    const { ctx, calls } = worker({
      prepareError: failure === 'prepare',
      commandError: (method) => {
        if (failure === 'print' && method === 'Page.printToPDF') return 'Printing failed';
        if (failure === 'read' && method === 'IO.read') return 'Read failed';
      }
    });
    const result = await ctx.run(7);
    assert.equal(result.ok, false);
    assert.ok(calls.includes('restorePage'));
    assert.ok(calls.includes('detach'));
    assert.ok(!calls.some((c) => c[0] === 'download'));
    if (failure === 'read') assert.ok(calls.some((c) => c[0] === 'IO.close'));
    if (failure === 'print') assert.equal(calls.filter((c) => c[0] === 'Page.printToPDF').length, 1);
  });
}

test('repete a impressão apenas quando parâmetros opcionais não são suportados', async () => {
  const { ctx, calls } = worker({
    commandError: (method, params) => method === 'Page.printToPDF' && params.generateTaggedPDF
      ? 'Invalid parameters' : null
  });
  assert.equal((await ctx.run(7)).ok, true);
  assert.equal(calls.filter((c) => c[0] === 'Page.printToPDF').length, 2);
});

test('folha única longa demais recebe paginação e nota de aviso', async () => {
  const { ctx, calls } = worker({ settings: { layout: 'single' }, height: 100000 });
  const result = await ctx.run(7);
  assert.equal(result.ok, true);
  assert.match(result.result.note, /paginada/);
  const print = calls.find((c) => c[0] === 'Page.printToPDF')[1];
  assert.ok(print.paperHeight <= 195);
});

test('bloqueia páginas protegidas sem anexar o depurador', async () => {
  for (const url of ['chrome://extensions', 'https://chromewebstore.google.com/detail/test']) {
    const { ctx, calls } = worker({ url });
    assert.equal((await ctx.run(7)).ok, false);
    assert.ok(!calls.includes('attach'));
  }
});

test('bloqueia uma segunda captura concorrente', async () => {
  const { ctx } = worker();
  const first = ctx.run(7);
  assert.equal((await ctx.run(7)).ok, false);
  assert.equal((await first).ok, true);
});

test('cancelamento de Salvar como revoga o Blob', async () => {
  const { ctx, messages } = worker({ downloadError: true });
  assert.equal((await ctx.run(7)).ok, false);
  assert.ok(messages.some((m) => m.type === 'printly-revoke' && m.url === blobUrl));
});

test('conclusão e interrupção revogam somente o Blob do download correspondente', async () => {
  const { ctx, messages } = worker({ offscreen: true });
  await ctx.releaseDownload({ id: 42, state: { current: 'complete' } });
  await ctx.releaseDownload({ id: 43, state: { current: 'interrupted' } });
  assert.equal(messages.filter((m) => m.type === 'printly-revoke').length, 2);
  assert.ok(messages.some((m) => m.kind === 'error'));
  const unrelated = worker({ offscreen: true, items: [{ byExtensionId: 'other', url: blobUrl }] });
  await unrelated.ctx.releaseDownload({ id: 44, state: { current: 'complete' } });
  assert.equal(unrelated.messages.length, 0);
});

test('listener de download existe ao iniciar o worker e não impõe timeout de 30 segundos', async () => {
  const { ctx, timers, listeners, messages } = worker({ offscreen: true });
  assert.equal(typeof listeners.download, 'function');
  await ctx.run(7);
  assert.equal(timers.some((timer) => timer.ms >= 30000), false);
  assert.ok(!messages.some((m) => m.type === 'printly-revoke'));
});

test('stream aceita dados textuais sem a flag base64 e sempre fecha o handle', async () => {
  const { ctx, chrome, calls } = worker();
  chrome.debugger.sendCommand = (target, method, params, cb) => {
    calls.push([method, params]);
    cb(method === 'IO.read' ? { data: '%PDF-text', eof: true } : {});
  };
  const bytes = await ctx.readPdfStream({ tabId: 7 }, 'handle');
  assert.equal(new TextDecoder().decode(bytes), '%PDF-text');
  assert.ok(calls.some((c) => c[0] === 'IO.close'));
});

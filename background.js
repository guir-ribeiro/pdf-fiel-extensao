/* Printly — service worker
 *
 * Estratégia de fidelidade:
 *  - usa o próprio motor de impressão do Chrome (Page.printToPDF via CDP),
 *    que gera texto vetorial e selecionável, não uma foto da tela;
 *  - força a mídia CSS "screen" (Emulation.setEmulatedMedia), então as regras
 *    @media print do site — que costumam esconder metade da página — não valem;
 *  - por padrão o papel tem a LARGURA REAL do conteúdo, então o layout não
 *    reflui para a largura de um A4 (o que jogaria sites responsivos no
 *    layout mobile).
 */

importScripts('settings.js');

const PX_PER_IN = 96;
const MAX_PAPER_IN = 195;   // limite prático de uma página PDF (200in)
const A4_WIDTH_IN = 8.27;   // referência para escalar o carimbo
const MARGIN_IN = { none: 0, small: 0.2, normal: 0.4 };
const STAMP_MARGIN_IN = 0.45;

let running = false;

/* ---------------------------------------------------------------- utils */

function say(text, kind) {
  chrome.runtime.sendMessage({ type: 'printly-status', text, kind }).catch(() => {});
}

function badge(text, color) {
  chrome.action.setBadgeBackgroundColor({ color: color || '#2f7d32' });
  chrome.action.setBadgeText({ text });
  if (text) setTimeout(() => chrome.action.setBadgeText({ text: '' }), 4000);
}

function dbg(target, method, params) {
  return new Promise((resolve, reject) => {
    chrome.debugger.sendCommand(target, method, params || {}, (result) => {
      const err = chrome.runtime.lastError;
      if (err) reject(new Error(err.message));
      else resolve(result);
    });
  });
}

function attach(target) {
  return new Promise((resolve, reject) => {
    chrome.debugger.attach(target, '1.3', () => {
      const err = chrome.runtime.lastError;
      if (err) reject(new Error(err.message));
      else resolve();
    });
  });
}

function detach(target) {
  return new Promise((resolve) => {
    chrome.debugger.detach(target, () => { void chrome.runtime.lastError; resolve(); });
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'
  }[c]));
}

function base64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToBase64(bytes) {
  let out = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    out += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(out);
}

async function getSettings() {
  const stored = await chrome.storage.sync.get('settings');
  return PrintlySettings.normalize(stored.settings);
}

/* ------------------------------------------------- preparo da página */

/* Roda dentro da aba (mundo isolado). Precisa ser autocontida. */
async function preparePage(freezeFixed) {
  // Recupera uma preparação anterior interrompida, se ainda existir nesta aba.
  if (window.__printlyRestore) window.__printlyRestore();
  const doc = document;
  const de = doc.documentElement;
  const nap = (ms) => new Promise((r) => setTimeout(r, ms));
  const docHeight = () => Math.max(
    de.scrollHeight, de.offsetHeight,
    doc.body ? doc.body.scrollHeight : 0,
    doc.body ? doc.body.offsetHeight : 0
  );

  const prevX = window.scrollX;
  const prevY = window.scrollY;
  const touched = [];
  const attributes = [];
  const seen = new Set();
  const remember = (el) => {
    if (seen.has(el)) return;
    seen.add(el);
    touched.push([el, el.getAttribute('style')]);
  };
  const rememberAttribute = (el, name) => {
    attributes.push([el, name, el.getAttribute(name)]);
  };

  // Registra a restauração ANTES de qualquer alteração: vale também se o preparo falhar.
  window.__printlyRestore = function () {
    touched.forEach(([el, prev]) => {
      if (el === de) return;
      if (prev === null) el.removeAttribute('style');
      else el.setAttribute('style', prev);
    });
    attributes.forEach(([el, name, prev]) => {
      if (prev === null) el.removeAttribute(name);
      else el.setAttribute(name, prev);
    });
    // Evita que scroll-behavior: smooth anime a volta à posição original.
    de.style.setProperty('scroll-behavior', 'auto', 'important');
    window.scrollTo(prevX, prevY);
    const rootStyle = touched.find(([el]) => el === de)[1];
    if (rootStyle === null) de.removeAttribute('style');
    else de.setAttribute('style', rootStyle);
    delete window.__printlyRestore;
  };
  remember(de);
  de.style.setProperty('scroll-behavior', 'auto', 'important');

  // 1. tira o "lazy" das mídias, para que nada saia em branco no PDF
  doc.querySelectorAll('img[loading="lazy"], iframe[loading="lazy"]').forEach((el) => {
    rememberAttribute(el, 'loading');
    try { el.loading = 'eager'; } catch (e) { /* ignora */ }
  });
  doc.querySelectorAll('img[decoding="async"]').forEach((el) => {
    rememberAttribute(el, 'decoding');
    try { el.decoding = 'sync'; } catch (e) { /* ignora */ }
  });

  // 2. percorre a página inteira para disparar IntersectionObserver / lazy-load
  const step = Math.max(240, Math.floor(window.innerHeight * 0.85));
  let pos = 0;
  let guard = 90;
  while (guard-- > 0) {
    const height = docHeight();
    const limit = Math.max(0, height - window.innerHeight);
    window.scrollTo(0, pos);
    await nap(70);
    if (pos >= limit) {
      await nap(280);
      if (docHeight() <= height) break;  // nada novo entrou: acabou
    }
    pos = Math.min(pos + step, Math.max(0, docHeight() - window.innerHeight));
  }
  window.scrollTo(0, 0);
  await nap(150);

  // 3. espera fontes e imagens (com teto, para não travar em site quebrado)
  try { await Promise.race([doc.fonts.ready, nap(4000)]); } catch (e) { /* ignora */ }
  const pending = Array.prototype.filter.call(doc.images, (img) => !img.complete);
  if (pending.length) {
    const listeners = [];
    try {
      await Promise.race([
        Promise.all(pending.map((img) => new Promise((resolve) => {
          const done = () => resolve();
          listeners.push([img, done]);
          img.addEventListener('load', done, { once: true });
          img.addEventListener('error', done, { once: true });
          if (img.complete) resolve();
        }))),
        nap(6000)
      ]);
    } finally {
      listeners.forEach(([img, done]) => {
        img.removeEventListener('load', done);
        img.removeEventListener('error', done);
      });
    }
  }
  await nap(150);

  // 4. duas correções que dependem do estilo calculado, numa passada só:
  //
  //    a) background-clip:text num elemento SEM texto nenhum. Na tela o fundo
  //       é recortado contra texto inexistente e simplesmente some; na
  //       impressão o Chrome ignora o recorte e pinta o retângulo inteiro,
  //       criando um bloco colorido que não existe na tela. Acontece com logo
  //       em <img> dentro de um <div> que herdou o CSS de um logo que antes
  //       era texto.
  //
  //    b) position:fixed vira absolute na posição em que o elemento aparece no
  //       topo da página. Sem isso, barras fixas se repetem (ou tapam
  //       conteúdo) em toda página do PDF.
  const all = doc.querySelectorAll('body *');
  const cap = Math.min(all.length, 12000);
  for (let i = 0; i < cap; i++) {
    const el = all[i];
    let cs;
    try { cs = getComputedStyle(el); } catch (e) { continue; }

    const clip = cs.webkitBackgroundClip || cs.backgroundClip;
    if (String(clip).indexOf('text') !== -1 && !(el.textContent || '').trim()) {
      remember(el);
      el.style.setProperty('background-image', 'none', 'important');
      el.style.setProperty('background-color', 'transparent', 'important');
    }

    if (freezeFixed && cs.position === 'fixed') {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      remember(el);
      el.style.setProperty('position', 'absolute', 'important');
      el.style.setProperty('top', (r.top + window.scrollY) + 'px', 'important');
      el.style.setProperty('left', (r.left + window.scrollX) + 'px', 'important');
      el.style.setProperty('right', 'auto', 'important');
      el.style.setProperty('bottom', 'auto', 'important');
      el.style.setProperty('width', r.width + 'px', 'important');
    }
  }

  return {
    width: Math.max(de.scrollWidth, doc.body ? doc.body.scrollWidth : 0, de.clientWidth),
    height: Math.max(docHeight(), de.clientHeight),
    title: doc.title || location.hostname,
    url: location.href,
    dark: !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)
  };
}

function restorePage() {
  try {
    if (window.__printlyRestore) window.__printlyRestore();
    delete window.__printlyRestore;
  } catch (e) { /* ignora */ }
}

/* ---------------------------------------------------------- carimbo */

function buildStampTemplate(settings, info, stampText, k, stampWidthIn) {
  const parts = [];
  if (settings.stampTitle && info.title) parts.push(escapeHtml(info.title));
  if (settings.stampUrl) parts.push(escapeHtml(info.url));
  if (settings.stampDate) parts.push(escapeHtml(stampText));
  if (settings.stampPages) {
    parts.push('página <span class="pageNumber"></span> de <span class="totalPages"></span>');
  }
  if (!parts.length) return null;

  // Duas armadilhas do template de cabeçalho/rodapé do Chrome:
  //
  //  - ele é desenhado em px CSS sobre a folha, então num papel largo (o modo
  //    "largura real" passa de 15 in) uma fonte de 9px vira um fiapo. Tudo
  //    escala junto com o tamanho do papel.
  //
  //  - o elemento que envolve o template pode não ter largura definida, e aí
  //    "width:100%" colapsa para o tamanho do conteúdo: display:flex com
  //    justify-content:space-between não separa nada e os campos saem colados
  //    na borda esquerda. O min-width em polegadas cobre esse caso sem
  //    estourar quando a largura do pai está correta, e os campos são
  //    separados por um caractere visível em vez de depender de flex.
  const fontPx = Math.round(10 * k);
  const padPx = Math.round(38 * k);
  const sep = '<span style="opacity:.4;">&nbsp;&nbsp;&#183;&nbsp;&nbsp;</span>';

  return '<div style="font-size:' + fontPx + 'px;'
    + 'font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;'
    + 'color:#5a5a5a;-webkit-print-color-adjust:exact;print-color-adjust:exact;'
    + 'width:100%;min-width:' + stampWidthIn.toFixed(2) + 'in;box-sizing:border-box;'
    + 'padding:0 ' + padPx + 'px;text-align:center;'
    + 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'
    + parts.join(sep)
    + '</div>';
}

function nowStamp() {
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit', timeZoneName: 'short'
    }).format(new Date());
  } catch (e) {
    return new Date().toLocaleString('pt-BR');
  }
}

function safeFilename(title) {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const stamp = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate())
    + ' ' + pad(now.getHours()) + 'h' + pad(now.getMinutes());
  let name = String(title || 'pagina')
    .replace(/[\\/:*?"<>|\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 90)
    .replace(/^[. ]+|[. ]+$/g, '');
  if (!name) name = 'pagina';
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:[. ]|$)/i.test(name)) name = 'pagina-' + name;
  return name + ' - ' + stamp + '.pdf';
}

/* ------------------------------------------------------- geração PDF */

async function readPdfStream(target, handle) {
  const chunks = [];
  let total = 0;
  try {
    for (;;) {
      const res = await dbg(target, 'IO.read', { handle, size: 1024 * 1024 });
      if (res.data) {
        const bytes = res.base64Encoded
          ? base64ToBytes(res.data)
          : new TextEncoder().encode(res.data);
        chunks.push(bytes);
        total += bytes.length;
      }
      if (res.eof) break;
    }
  } finally {
    await dbg(target, 'IO.close', { handle }).catch(() => {});
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) { out.set(c, offset); offset += c.length; }
  return out;
}

async function printToPdf(target, params) {
  // generateTaggedPDF / generateDocumentOutline só existem em Chrome recente
  try {
    return await dbg(target, 'Page.printToPDF',
      Object.assign({}, params, { generateTaggedPDF: true, generateDocumentOutline: true }));
  } catch (e) {
    if (!/invalid parameters|unknown parameter|unrecognized|not supported/i.test(e.message)) throw e;
    return await dbg(target, 'Page.printToPDF', params);
  }
}

async function capture(tabId, settings) {
  const tab = await chrome.tabs.get(tabId);
  const url = tab.url || '';
  if (/^(chrome|edge|about|devtools|view-source|chrome-extension|chrome-untrusted):/i.test(url)
      || /^https?:\/\/(chrome\.google\.com\/webstore|chromewebstore\.google\.com)/i.test(url)) {
    throw new Error('Esta página é protegida pelo navegador e não pode ser capturada.');
  }

  const target = { tabId };
  let attached = false;
  let preparationStarted = false;
  let output;

  try {
    say('Conectando ao motor de impressão...');
    try {
      await attach(target);
    } catch (e) {
      if (/already attached|Another debugger/i.test(e.message)) {
        throw new Error('Feche o DevTools (F12) desta aba e tente de novo.');
      }
      throw e;
    }
    attached = true;
    await sleep(350); // deixa o layout assentar depois da barra do depurador
    await dbg(target, 'Page.enable').catch(() => {});

    say('Carregando a página inteira...');
    preparationStarted = true;
    const injected = await chrome.scripting.executeScript({
      target: { tabId },
      func: preparePage,
      args: [!!settings.freezeFixed]
    });
    const info = injected && injected[0] && injected[0].result;
    if (!info) throw new Error('Não consegui ler o conteúdo desta aba.');

    // mídia "screen" em vez de "print": é o que torna o PDF igual à tela
    await dbg(target, 'Emulation.setEmulatedMedia', {
      media: 'screen',
      features: [{ name: 'prefers-color-scheme', value: info.dark ? 'dark' : 'light' }]
    }).catch(async () => {
      await dbg(target, 'Emulation.setEmulatedMedia', { media: 'screen' }).catch(() => {});
    });

    say('Gerando o PDF...');

    const scale = settings.scale;
    const base = MARGIN_IN[settings.margins] != null ? MARGIN_IN[settings.margins] : 0;
    const marginLeft = base, marginRight = base;

    const contentW = Math.min(Math.max(info.width, 320), 5000);
    const contentH = Math.max(info.height, 200);
    const a4 = settings.layout === 'a4';
    const landscape = a4 && settings.orientation === 'landscape';

    // 1) largura da folha
    let paperWidth;
    if (a4) {
      paperWidth = landscape ? 11.69 : 8.27;
    } else {
      paperWidth = Math.min(
        Math.max((contentW * scale) / PX_PER_IN + marginLeft + marginRight, 3),
        MAX_PAPER_IN
      );
    }

    // 2) o carimbo escala com a folha, senão some numa página larga
    const k = Math.min(6, Math.max(1, paperWidth / A4_WIDTH_IN));
    const stampText = nowStamp();
    const template = settings.stamp
      ? buildStampTemplate(settings, info, stampText, k, paperWidth - marginLeft - marginRight)
      : null;
    const useStamp = !!template;

    // 3) margens verticais, já sabendo a faixa que o carimbo precisa
    let marginTop = base, marginBottom = base;
    if (useStamp) {
      const need = STAMP_MARGIN_IN * k;
      if (settings.stampPosition === 'header') marginTop = Math.max(marginTop, need);
      else marginBottom = Math.max(marginBottom, need);
    }

    // 4) altura da folha
    let paperHeight;
    let note = '';
    if (a4) {
      paperHeight = landscape ? 8.27 : 11.69;
    } else if (settings.layout === 'single') {
      paperHeight = (contentH * scale) / PX_PER_IN + marginTop + marginBottom + 0.02;
      if (paperHeight > MAX_PAPER_IN) {
        paperHeight = paperWidth * Math.SQRT2 + marginTop + marginBottom;
        note = ' (página longa demais para folha única, foi paginada)';
      }
    } else {
      paperHeight = paperWidth * Math.SQRT2 + marginTop + marginBottom;
    }
    paperHeight = Math.min(Math.max(paperHeight, 3), MAX_PAPER_IN);

    const params = {
      landscape: false,
      printBackground: !!settings.printBackground,
      scale,
      paperWidth,
      paperHeight,
      marginTop,
      marginBottom,
      marginLeft,
      marginRight,
      preferCSSPageSize: false,
      displayHeaderFooter: useStamp,
      headerTemplate: useStamp && settings.stampPosition === 'header' ? template : '<span></span>',
      footerTemplate: useStamp && settings.stampPosition !== 'header' ? template : '<span></span>',
      transferMode: 'ReturnAsStream'
    };

    const res = await printToPdf(target, params);
    const bytes = res.stream ? await readPdfStream(target, res.stream) : base64ToBytes(res.data);
    if (!bytes || bytes.length < 100) throw new Error('O PDF saiu vazio.');

    output = { bytes, filename: safeFilename(info.title), note };
  } finally {
    if (attached) {
      await dbg(target, 'Emulation.setEmulatedMedia', { media: '', features: [] }).catch(() => {});
    }
    if (preparationStarted) {
      await chrome.scripting.executeScript({ target: { tabId }, func: restorePage }).catch(() => {});
    }
    if (attached) await detach(target);
  }

  // A página já foi restaurada e o depurador desligado antes do diálogo Salvar como.
  say('Iniciando o download...');
  await download(output.bytes, output.filename, !!settings.saveAs);
  return { filename: output.filename, size: Math.round(output.bytes.length / 1024), note: output.note };
}

/* --------------------------------------------------------- download */

async function hasOffscreenDocument() {
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [chrome.runtime.getURL('offscreen.html')]
  });
  return contexts.length > 0;
}

async function ensureOffscreen() {
  if (await hasOffscreenDocument()) return;
  try {
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['BLOBS'],
      justification: 'Criar a URL de blob usada para salvar o PDF gerado.'
    });
  } catch (e) {
    if (!/single offscreen|already/i.test(e.message)) throw e;
  }
}

async function download(bytes, filename, saveAs) {
  await ensureOffscreen();
  const reply = await chrome.runtime.sendMessage({
    type: 'printly-blob',
    base64: bytesToBase64(bytes)
  });
  if (!reply || !reply.url) {
    throw new Error(reply?.error || 'Falha ao preparar o arquivo para download.');
  }

  try {
    await chrome.downloads.download({ url: reply.url, filename, saveAs: !!saveAs });
  } catch (e) {
    // Inclui o cancelamento do diálogo: não deixa o PDF retido na memória.
    await chrome.runtime.sendMessage({ type: 'printly-revoke', url: reply.url }).catch(() => {});
    throw e;
  }
}

// Registrado no topo para funcionar também quando o Chrome reativa o worker.
// Cada download tem sua própria URL; um download não encerra o documento de outro.
chrome.downloads.onChanged.addListener((delta) => {
  if (!delta.state || !['complete', 'interrupted'].includes(delta.state.current)) return;
  releaseDownload(delta).catch(() => {});
});

async function releaseDownload(delta) {
  const [item] = await chrome.downloads.search({ id: delta.id });
  if (!item || item.byExtensionId !== chrome.runtime.id
      || !item.url?.startsWith('blob:' + chrome.runtime.getURL(''))) return;
  if (await hasOffscreenDocument()) {
    await chrome.runtime.sendMessage({ type: 'printly-revoke', url: item.url }).catch(() => {});
  }
  if (delta.state.current === 'interrupted') {
    say('O download foi interrompido. Tente capturar a página novamente.', 'error');
    badge('!', '#b3261e');
  }
}

/* ------------------------------------------------------------ fluxo */

async function run(tabId) {
  if (running) {
    say('Já existe uma captura em andamento.', 'warn');
    return { ok: false, error: 'Já existe uma captura em andamento.' };
  }
  running = true;
  try {
    const settings = await getSettings();
    const result = await capture(tabId, settings);
    say('Download iniciado: ' + result.filename + ' (' + result.size + ' KB)' + result.note, 'ok');
    badge('OK');
    return { ok: true, result };
  } catch (e) {
    const msg = e && e.message ? e.message : String(e);
    say('Erro: ' + msg, 'error');
    badge('!', '#b3261e');
    return { ok: false, error: msg };
  } finally {
    running = false;
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.type !== 'printly-capture') return;
  (async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) { sendResponse({ ok: false, error: 'Nenhuma aba ativa.' }); return; }
    sendResponse(await run(tab.id));
  })().catch((error) => sendResponse({ ok: false, error: error.message }));
  return true;
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'capturar-pdf') return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) await run(tab.id);
});

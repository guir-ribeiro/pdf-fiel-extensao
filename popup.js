const DEFAULTS = {
  layout: 'width',
  orientation: 'portrait',
  scale: 1,
  printBackground: true,
  freezeFixed: true,
  margins: 'none',
  stamp: true,
  stampPosition: 'footer',
  stampDate: true,
  stampUrl: true,
  stampTitle: false,
  stampPages: true,
  saveAs: false
};

const HINTS = {
  width: 'O papel recebe a largura exata do site, então nada é reorganizado.',
  single: 'Uma única página, do topo ao rodapé, sem quebras. Ruim para imprimir.',
  a4: 'Cabe numa folha real, mas sites responsivos podem virar layout estreito.'
};

const el = (id) => document.getElementById(id);
const CHECKS = ['printBackground', 'freezeFixed', 'stamp', 'stampDate', 'stampUrl',
  'stampTitle', 'stampPages', 'saveAs'];
const SELECTS = ['layout', 'orientation', 'margins', 'stampPosition'];

function readForm() {
  const out = { scale: Number(el('scale').value) };
  SELECTS.forEach((k) => { out[k] = el(k).value; });
  CHECKS.forEach((k) => { out[k] = el(k).checked; });
  return out;
}

function applyForm(s) {
  SELECTS.forEach((k) => { el(k).value = s[k]; });
  CHECKS.forEach((k) => { el(k).checked = !!s[k]; });
  el('scale').value = s.scale;
  refresh();
}

function refresh() {
  const layout = el('layout').value;
  el('layoutHint').textContent = HINTS[layout] || '';
  el('orientationField').hidden = layout !== 'a4';
  el('stampOptions').hidden = !el('stamp').checked;
  el('scaleOut').textContent = Math.round(Number(el('scale').value) * 100) + '%';
}

function setStatus(text, kind) {
  const node = el('status');
  node.textContent = text || '';
  node.className = 'status' + (kind ? ' ' + kind : '');
}

async function save() {
  refresh();
  await chrome.storage.sync.set({ settings: readForm() });
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === 'pdf-fiel-status') setStatus(msg.text, msg.kind);
});

document.addEventListener('change', save);
el('scale').addEventListener('input', refresh);

el('go').addEventListener('click', async () => {
  await save();
  el('go').disabled = true;
  setStatus('Preparando...');
  try {
    const res = await chrome.runtime.sendMessage({ type: 'pdf-fiel-capture' });
    if (res && !res.ok) setStatus('Erro: ' + res.error, 'error');
  } catch (e) {
    // O popup pode fechar antes da resposta; o carimbo de status já cobre isso.
  } finally {
    el('go').disabled = false;
  }
});

(async () => {
  const stored = await chrome.storage.sync.get('settings');
  applyForm(Object.assign({}, DEFAULTS, stored.settings || {}));
})();

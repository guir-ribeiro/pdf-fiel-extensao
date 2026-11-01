const HINTS = {
  width: 'A largura do papel acompanha a página para reduzir mudanças no layout.',
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
  if (msg && msg.type === 'printly-status') setStatus(msg.text, msg.kind);
});

document.addEventListener('change', () => {
  save().catch((error) => setStatus('Não foi possível salvar as opções: ' + error.message, 'error'));
});
el('scale').addEventListener('input', refresh);

el('go').addEventListener('click', async () => {
  el('go').disabled = true;
  setStatus('Preparando...');
  try {
    await save();
    const res = await chrome.runtime.sendMessage({ type: 'printly-capture' });
    if (!res) throw new Error('O serviço de captura não respondeu. Recarregue a extensão e tente novamente.');
    if (!res.ok) setStatus('Erro: ' + res.error, 'error');
  } catch (e) {
    setStatus('Erro: ' + e.message, 'error');
  } finally {
    el('go').disabled = false;
  }
});

(async () => {
  try {
    const stored = await chrome.storage.sync.get('settings');
    applyForm(PrintlySettings.normalize(stored.settings));
    el('go').disabled = false;
  } catch (error) {
    setStatus('Não foi possível carregar as opções: ' + error.message, 'error');
  }
})();

/* Documento offscreen: existe apenas porque o service worker do MV3 nao tem
   URL.createObjectURL. Aqui viram um blob URL que a API de downloads aceita. */

function base64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg) return;

  if (msg.type === 'pdf-fiel-blob') {
    try {
      const blob = new Blob([base64ToBytes(msg.base64)], { type: 'application/pdf' });
      sendResponse({ url: URL.createObjectURL(blob) });
    } catch (e) {
      sendResponse({ error: String(e && e.message ? e.message : e) });
    }
    return true;
  }

  if (msg.type === 'pdf-fiel-revoke') {
    try { URL.revokeObjectURL(msg.url); } catch (e) { /* ignora */ }
  }
});

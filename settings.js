/* Preferências compartilhadas pelo popup e pelo service worker. */
globalThis.PrintlySettings = (() => {
  const defaults = Object.freeze({
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
  });

  const choices = {
    layout: ['width', 'a4', 'single'],
    orientation: ['portrait', 'landscape'],
    margins: ['none', 'small', 'normal'],
    stampPosition: ['footer', 'header']
  };

  function normalize(stored) {
    const settings = { ...defaults };
    if (!stored || typeof stored !== 'object') return settings;
    for (const [key, fallback] of Object.entries(defaults)) {
      const value = stored[key];
      if (choices[key]) {
        if (choices[key].includes(value)) settings[key] = value;
      } else if (key === 'scale') {
        if (typeof value === 'number' && Number.isFinite(value)) {
          settings.scale = Math.min(1.5, Math.max(0.5, value));
        }
      } else if (typeof value === typeof fallback) {
        settings[key] = value;
      }
    }
    return settings;
  }

  return Object.freeze({ defaults, normalize });
})();

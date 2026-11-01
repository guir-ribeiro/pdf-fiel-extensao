# PDF Fiel

**Save web pages as PDFs while preserving their on-screen layout.**

An open source Google Chrome extension with selectable text, backgrounds,
links and optional date, time and URL stamps. No account, server or runtime
dependencies. The interface is in Brazilian Portuguese.

[Português — documentação completa](README.md) · [MIT license](LICENSE) ·
[Contributing](CONTRIBUTING.md) · [Privacy](PRIVACY.md)

## Install

Requires **Google Chrome 116+ on desktop**.

1. Select **Code → Download ZIP** on GitHub and extract it, or clone:

   ```sh
   git clone https://github.com/guir-ribeiro/pdf-fiel-extensao.git
   ```

2. Open `chrome://extensions` and enable **Developer mode**.
3. Select **Load unpacked** and choose the folder containing `manifest.json`.
4. Pin the extension, open a web page and select **Baixar PDF** (Download PDF).

No Node.js, npm installation or build step is needed to use the extension.
After updating the files, reload the extension in `chrome://extensions`.

Use **Ctrl + Shift + Y** (**⌘ + Shift + Y** on macOS) to capture with the last
saved settings. Customize it at `chrome://extensions/shortcuts`. Wait for the
automatic scrolling to finish before interacting with the page.

## Features

- Chrome's PDF printing engine, with screen CSS emulation.
- Page-width pagination, a single long sheet or portrait/landscape A4.
- Adjustable margins, backgrounds and scale (50–150%).
- Optional header/footer with date, time zone, URL, title and page numbers.
- Bounded lazy-loading preparation and fixed-element adjustments.

The browser displays a debugging notice during generation. The extension
disconnects before starting the download. Check Chrome's downloads list to
confirm that the file was saved.

## Privacy and limitations

The extension has no analytics, remote scripts or server uploads. Preferences
use `chrome.storage.sync` and may sync through your Google Account. Preparing
a page can cause the site itself to fetch lazy-loaded resources. PDFs may
contain private content and URLs; review them before sharing.
[Full privacy policy and permissions](PRIVACY.md).

Protected browser pages cannot be captured. Close the target tab's DevTools
if it conflicts. Infinite scrolling is limited to 90 steps; virtualized lists,
nested scrolling, videos, canvas and cross-origin frames may be incomplete.
Single-sheet mode falls back to pagination above roughly 195 inches. Content
width is capped at 5,000 pixels; large PDFs may exceed available memory.
Layout fidelity depends on Chrome and the website. Other browsers are not validated.

## Development and contributions

Plain JavaScript, HTML and CSS. With **Node.js 22+**:

```sh
npm run check
npm test
npm run package
```

There are no npm dependencies. Packaging additionally requires `zip`
(macOS/Linux). CI checks the code, runs tests and uploads a ZIP artifact;
it does not publish releases or submit to the Web Store. Tests mock Chrome
APIs; browser validation remains a separate step.

Contributions and issues in Portuguese or English are welcome. See
[CONTRIBUTING.md](CONTRIBUTING.md) for browser checks and
[SECURITY.md](SECURITY.md) for private vulnerability reports.

Released under the [MIT license](LICENSE), copyright Guilherme Ribeiro.

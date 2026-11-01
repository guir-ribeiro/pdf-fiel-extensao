import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extensionFiles } from './files.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFileSync(join(root, file), 'utf8');
const manifest = JSON.parse(read('manifest.json'));
const pkg = JSON.parse(read('package.json'));
assert.equal(manifest.manifest_version, 3);
assert.equal(manifest.version, pkg.version, 'As versões do pacote e manifesto devem coincidir.');
for (const file of extensionFiles) assert.ok(existsSync(join(root, file)), 'Arquivo ausente: ' + file);

const scripts = [
  ...extensionFiles.filter((file) => file.endsWith('.js')),
  ...['scripts', 'tests'].flatMap((dir) => readdirSync(join(root, dir))
    .filter((file) => file.endsWith('.mjs')).map((file) => dir + '/' + file))
];
for (const file of scripts) execFileSync(process.execPath, ['--check', join(root, file)]);

for (const file of ['popup.html', 'offscreen.html']) {
  for (const match of read(file).matchAll(/(?:src|href)="([^"]+)"/g)) {
    assert.ok(extensionFiles.includes(match[1]), 'Recurso fora do pacote: ' + match[1]);
  }
}
for (const file of readdirSync(root).filter((name) => name.endsWith('.md'))) {
  for (const match of read(file).matchAll(/\]\(([^)]+)\)/g)) {
    const link = match[1];
    if (/^(?:https?:|mailto:|#)/.test(link)) continue;
    assert.ok(existsSync(join(root, decodeURIComponent(link.split('#')[0]))),
      'Link local inválido em ' + file + ': ' + link);
  }
}
console.log('Sintaxe, manifesto, recursos e links locais verificados.');

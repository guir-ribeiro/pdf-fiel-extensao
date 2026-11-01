import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extensionFiles } from './files.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));
const archive = 'printly-' + manifest.version + '.zip';
// Remove apenas o pacote gerado, para não preservar entradas de um ZIP antigo.
rmSync(join(root, archive), { force: true });
execFileSync('zip', ['-q', archive, ...extensionFiles], { cwd: root, stdio: 'inherit' });
console.log('Pacote criado: ' + archive);

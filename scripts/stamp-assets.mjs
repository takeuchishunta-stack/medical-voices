#!/usr/bin/env node
// CSS と JS の参照URLに、中身から作った版番号を付ける。
//
// なぜ必要か: CSS と JS は組で更新されることがある。ブラウザに古い CSS が
// キャッシュされたまま新しい JS だけが読み込まれると、新しい markup が
// 素のまま描画されてレイアウトが壊れる。
// URL が変われば必ず取り直されるので、中身が変わったときだけ版番号を変える。

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ASSETS = ['css/style.css', 'js/main.js'];

const hash = createHash('sha1');
for (const asset of ASSETS) hash.update(readFileSync(join(ROOT, asset)));
const version = hash.digest('hex').slice(0, 8);

const changed = [];
for (const name of readdirSync(ROOT)) {
  if (!name.endsWith('.html')) continue;
  const path = join(ROOT, name);
  const before = readFileSync(path, 'utf8');
  let after = before;

  for (const asset of ASSETS) {
    // 既存の ?v=... があれば置き換え、無ければ付ける
    const pattern = new RegExp(asset.replace(/[/.]/g, '\\$&') + '(\\?v=[0-9a-f]+)?', 'g');
    after = after.replace(pattern, asset + '?v=' + version);
  }

  if (after !== before) {
    writeFileSync(path, after);
    changed.push(name);
  }
}

console.log(`版番号 ${version}`);
console.log(changed.length ? `  更新: ${changed.join(', ')}` : '  変更なし（既に最新の版番号）');

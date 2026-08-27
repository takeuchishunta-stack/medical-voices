#!/usr/bin/env node
// Medical Voices サイトの静的チェック。
// 公開前に「参照切れ・記事データの不備・必須メタの欠落」を検出する。依存パッケージなし。
//
// 記事は js/articles.json を main.js が読み込んで描画するため、
// HTML を見るだけでは壊れに気付けない。記事データ側も併せて検証する。

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SKIP_DIRS = new Set(['.git', 'node_modules', 'scripts', '.github', 'design-handoff']);
const ARTICLES = join(ROOT, 'js', 'articles.json');
const BLOCK_TYPES = new Set(['p', 'h', 'quote', 'qa']); // main.js の renderContent が扱う種類
const LARGE_IMAGE_BYTES = 800 * 1024;

const errors = [];
const warnings = [];

function htmlFiles(dir = ROOT) {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...htmlFiles(full));
    else if (name.endsWith('.html')) out.push(full);
  }
  return out.sort();
}

// ---- HTML ----
const pages = htmlFiles();
if (pages.length === 0) errors.push('HTMLファイルが1つも見つかりません');

for (const page of pages) {
  const rel = relative(ROOT, page);
  const html = readFileSync(page, 'utf8');

  for (const m of html.matchAll(/(?:href|src)\s*=\s*"([^"]+)"/g)) {
    const raw = m[1].trim();
    if (!raw) continue;
    if (/^(https?:|mailto:|tel:|data:|javascript:|#|\/\/)/i.test(raw)) continue;

    const target = raw.split(/[?#]/)[0];
    if (!target) continue;
    const abs = target.startsWith('/') ? join(ROOT, target) : resolve(dirname(page), target);
    if (!existsSync(abs)) errors.push(`${rel}: 参照先が存在しません -> ${raw}`);
  }

  if (!/<html[^>]*\slang=/i.test(html)) errors.push(`${rel}: <html> に lang 属性がありません`);
  if (!/<title>[^<]{1,}<\/title>/i.test(html)) errors.push(`${rel}: <title> が空、または存在しません`);
  if (!/<meta[^>]+name="viewport"/i.test(html)) errors.push(`${rel}: viewport の meta がありません（スマホ表示が崩れます）`);
  if (!/<meta[^>]+name="description"[^>]+content="[^"]{1,}"/i.test(html)) {
    warnings.push(`${rel}: meta description がありません（検索結果の説明文に影響します）`);
  }
}

// ---- 記事データ ----
const usedImages = new Set();

if (!existsSync(ARTICLES)) {
  errors.push('js/articles.json がありません（記事が1本も表示されません）');
} else {
  let articles;
  try {
    articles = JSON.parse(readFileSync(ARTICLES, 'utf8'));
  } catch (err) {
    errors.push(`js/articles.json のJSONが壊れています: ${err.message}`);
  }

  if (articles !== undefined) {
    if (!Array.isArray(articles)) {
      errors.push('js/articles.json は記事の配列である必要があります');
    } else if (articles.length === 0) {
      errors.push('js/articles.json に記事が1本もありません');
    } else {
      // image は省略可（main.js がプレースホルダーを描画する）。指定された場合だけ存在を確認する。
      const required = ['id', 'category', 'date', 'title', 'org', 'person', 'lead', 'profile', 'content'];
      const seen = new Map();

      articles.forEach((article, i) => {
        const label = `記事[${i}]${article?.id ? ` (${article.id})` : ''}`;

        if (typeof article !== 'object' || article === null) {
          errors.push(`${label}: 記事がオブジェクトではありません`);
          return;
        }

        for (const key of required) {
          const value = article[key];
          if (value === undefined || value === null || value === '') {
            errors.push(`${label}: 必須項目 "${key}" がありません`);
          }
        }

        // id は記事URL（#記事ID）になるため重複すると片方が開けなくなる。
        // 予約語（about / media）と衝突するとその静的ページを覆い隠してしまう。
        if (article.id) {
          if (seen.has(article.id)) errors.push(`${label}: id "${article.id}" が記事[${seen.get(article.id)}]と重複しています`);
          else seen.set(article.id, i);
          if (article.id === 'about' || article.id === 'media') {
            errors.push(`${label}: id "${article.id}" は予約語です（掲載について／メディア概要ページと衝突します）`);
          }
        }

        if (article.date && !/^\d{4}-\d{2}-\d{2}$/.test(article.date)) {
          errors.push(`${label}: date は YYYY-MM-DD 形式にしてください（現在: "${article.date}"）`);
        }

        if (article.image && article.imgHint) {
          warnings.push(`${label}: image と imgHint が両方指定されています（imgHint は写真が無いときのプレースホルダー文言なので、写真があるなら不要です）`);
        }

        if (article.image) {
          usedImages.add(article.image);
          const abs = join(ROOT, article.image);
          if (!existsSync(abs)) {
            errors.push(`${label}: 画像が存在しません -> ${article.image}`);
          } else if (statSync(abs).size > LARGE_IMAGE_BYTES) {
            const mb = (statSync(abs).size / 1024 / 1024).toFixed(1);
            warnings.push(`${label}: 画像が大きく表示が遅くなります -> ${article.image} (${mb}MB)`);
          }
        } else if (!article.imgHint) {
          warnings.push(`${label}: image も imgHint もありません（プレースホルダーに説明が出ません）`);
        }

        if (Array.isArray(article.content)) {
          if (article.content.length === 0) errors.push(`${label}: content が空です（本文がありません）`);
          article.content.forEach((block, j) => {
            if (typeof block !== 'object' || block === null) {
              errors.push(`${label}: content[${j}] がオブジェクトではありません`);
              return;
            }
            if (block.type && !BLOCK_TYPES.has(block.type)) {
              // main.js は未知の type を p として描画してしまうので気付けるようにする
              warnings.push(`${label}: content[${j}] の type "${block.type}" は未対応です（段落として表示されます）`);
            }
            if (block.type === 'qa') {
              if (!block.q) errors.push(`${label}: content[${j}] は qa ですが q がありません`);
              if (!block.a) errors.push(`${label}: content[${j}] は qa ですが a がありません`);
            } else if (!block.text) {
              errors.push(`${label}: content[${j}] に text がありません`);
            }
          });
        } else if (article.content !== undefined) {
          errors.push(`${label}: content は配列である必要があります`);
        }
      });

      console.log(`記事 ${articles.length}本: ${articles.map((a) => a.id).join(', ')}`);
    }
  }
}

// ---- 使われていない画像 ----
const imagesDir = join(ROOT, 'images');
if (existsSync(imagesDir)) {
  for (const name of readdirSync(imagesDir)) {
    if (name.startsWith('.')) continue;
    if (!usedImages.has(`images/${name}`)) {
      warnings.push(`images/${name} はどの記事からも参照されていません`);
    }
  }
}

// ---- 結果 ----
console.log(`チェック対象 ${pages.length} ページ: ${pages.map((p) => relative(ROOT, p)).join(', ')}\n`);
for (const w of warnings) console.log(`  [警告] ${w}`);
for (const e of errors) console.log(`  [エラー] ${e}`);

if (errors.length > 0) {
  console.log(`\n✗ エラー ${errors.length}件。公開を中止します。`);
  process.exit(1);
}
console.log(`\n✓ エラーなし${warnings.length > 0 ? `（警告 ${warnings.length}件）` : ''}。公開できます。`);

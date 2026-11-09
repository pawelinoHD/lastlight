// Builds web versions of Lastlight from index.html:
//   dist/lastlight.html  - page body for a claude.ai Artifact (the host adds <html>/<head>; js/ files are published alongside)
//   dist/site/           - a complete static website (index.html + js/) for GitHub Pages, Netlify, etc.
// Both are single-player only: multiplayer needs server.js running somewhere.
'use strict';
const fs = require('fs');
const path = require('path');

const root = __dirname;
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const flag = '<script>window.LASTLIGHT_STATIC = true;</script>\n';
const firstScript = html.indexOf('<script src=');
const staticHtml = html.slice(0, firstScript) + flag + html.slice(firstScript);

// 1) artifact body
const head = staticHtml.match(/<head>([\s\S]*?)<\/head>/)[1]
  .replace(/<meta charset[^>]*>\s*/i, '')
  .replace(/<meta name="viewport"[^>]*>\s*/i, '');
const body = staticHtml.match(/<body>([\s\S]*?)<\/body>/)[1];
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist', 'lastlight.html'), head.trim() + '\n' + body.trim() + '\n');

// 2) static site
const site = path.join(root, 'dist', 'site');
fs.rmSync(site, { recursive: true, force: true });
fs.mkdirSync(path.join(site, 'js'), { recursive: true });
fs.writeFileSync(path.join(site, 'index.html'), staticHtml);
for (const f of fs.readdirSync(path.join(root, 'js'))) if (f.endsWith('.js')) fs.copyFileSync(path.join(root, 'js', f), path.join(site, 'js', f));
fs.writeFileSync(path.join(site, '.nojekyll'), '');
console.log('Built dist/lastlight.html and dist/site/');

// Assemble a self-contained page (no extra files) from the ARTIFACT=1 build: inline JS, CSS and the icon sprite.
//   ARTIFACT=1 npx vite build && node scripts/build-single.mjs out.html
import fs from 'node:fs';
const out = process.argv[2] ?? 'dist-artifact/single.html';
const html = fs.readFileSync('dist-artifact/index.html', 'utf8');
const js = html.match(/src="\.\/(assets\/[^"]+\.js)"/)[1];
const css = html.match(/href="\.\/(assets\/[^"]+\.css)"/)[1];
const data = 'data:image/png;base64,' + fs.readFileSync('public/equipment-sprite.png').toString('base64');
let code = fs.readFileSync('dist-artifact/' + js, 'utf8');
const before = code.length;
code = code.replace(/"\.\/"\+"equipment-sprite\.png"/g, JSON.stringify(data)).replace(/\.\/equipment-sprite\.png/g, data);
if (code.length === before) throw new Error('sprite reference not found in bundle');
if (/import\(/.test(code)) console.warn('WARNING: dynamic import still present');
fs.writeFileSync(out, `<title>Iron Funyon Planner</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700&display=swap">
<style>
:root{color-scheme:dark;--bg:#17120c;--fg:#f1e6cc}
html,body{background:var(--bg);color:var(--fg);margin:0}
body{padding-left:max(0px,env(safe-area-inset-left,0px));padding-right:max(0px,env(safe-area-inset-right,0px))}
header.sticky{top:env(safe-area-inset-top,0px)}
body::before{content:"";position:fixed;inset:0 0 auto;height:env(safe-area-inset-top,0px);z-index:30;background:var(--bg)}
${fs.readFileSync('dist-artifact/' + css, 'utf8')}
</style>
<div id="root"></div>
<script type="module">
${code}
</script>
`);
console.log('wrote', out, fs.statSync(out).size, 'bytes');

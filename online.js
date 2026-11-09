// Lastlight — host online: starts the server plus a free Cloudflare quick tunnel and prints a link for friends.
'use strict';
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const PORT = 8840;
const here = __dirname;
const local = path.join(here, 'tools', 'cloudflared.exe');
let cf = fs.existsSync(local) ? local : null;
if (!cf) { try { execSync('where cloudflared', { stdio: 'ignore' }); cf = 'cloudflared'; } catch (e) { } }
if (!cf) {
  console.log('\n  cloudflared is not installed yet.');
  console.log('  Download "cloudflared-windows-amd64.exe" from');
  console.log('  https://github.com/cloudflare/cloudflared/releases/latest');
  console.log('  rename it to cloudflared.exe and put it in:  ' + path.join(here, 'tools') + '\n');
  process.exit(1);
}

const server = spawn(process.execPath, [path.join(here, 'server.js'), String(PORT), ...process.argv.slice(2)], { cwd: here, stdio: ['ignore', 'pipe', 'inherit'] });
server.stdout.on('data', d => process.stdout.write(String(d).replace(/^/gm, '  [server] ')));

const tunnel = spawn(cf, ['tunnel', '--no-autoupdate', '--url', 'http://localhost:' + PORT], { cwd: here });
let shown = false;
const scan = d => {
  const m = String(d).match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
  if (m && !shown) {
    shown = true;
    try { execSync('clip', { input: m[0] }); } catch (e) { }
    console.log('\n  ==============================================================');
    console.log('   Send this link to your friend (it is also on your clipboard):');
    console.log('\n     ' + m[0] + '\n');
    console.log('   Open it yourself too, or play at http://localhost:' + PORT);
    console.log('   The link changes every time you start this. Keep this window open.');
    console.log('  ==============================================================\n');
  }
};
tunnel.stdout.on('data', scan);
tunnel.stderr.on('data', d => { scan(d); if (/ERR|error/i.test(String(d)) && !/ICMP|ping_group/i.test(String(d))) process.stderr.write('  [tunnel] ' + d); });
setTimeout(() => { if (!shown) console.log('  Still waiting for Cloudflare to hand out a link... (check your internet connection)'); }, 20000);

// Ctrl+C / closing the window reaches the server process directly (same console), so it saves the world itself.
const stop = () => { try { tunnel.kill(); } catch (e) { } setTimeout(() => process.exit(0), 4000); };
process.on('SIGINT', stop); process.on('SIGHUP', stop);
tunnel.on('exit', code => { if (!shown) console.log('  The tunnel stopped (code ' + code + ').'); });
server.on('exit', () => { try { tunnel.kill(); } catch (e) { } process.exit(0); });

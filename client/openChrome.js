const { spawn } = require('child_process');

const url = process.argv[2];

if (!url) process.exit(0);

const CHROME_PATHS = [
  process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
  process.env.PROGRAMFILES + '\\Google\\Chrome\\Application\\chrome.exe',
  process.env['PROGRAMFILES(X86)'] + '\\Google\\Chrome\\Application\\chrome.exe',
];

const fs = require('fs');
const chrome = CHROME_PATHS.find((p) => p && fs.existsSync(p));

if (chrome) {
  spawn(chrome, [url], { stdio: 'ignore', detached: true }).unref();
} else {
  const opener = process.platform === 'win32' ? 'cmd' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
  spawn(opener, args, { stdio: 'ignore', detached: true }).unref();
}

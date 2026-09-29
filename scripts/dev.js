const path = require('path');
const fs = require('fs');
const net = require('net');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');

const CLIENT_URL = 'http://localhost:3000';
const OPEN_BROWSER = process.env.RHMS_OPEN_BROWSER !== 'false';

const NPM_CLI = process.env.npm_execpath;

function spawnNpm(args, options) {
  if (NPM_CLI && path.extname(NPM_CLI) === '.js') {
    return spawn(process.execPath, [NPM_CLI, ...args], options);
  }
  return spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', args, {
    ...options,
    shell: process.platform === 'win32',
  });
}

const COLORS = {
  server: '\x1b[36m',
  client: '\x1b[35m',
  reset: '\x1b[0m',
  dim: '\x1b[2m',
};

const targets = [
  { name: 'server', cwd: path.join(ROOT, 'server'), args: ['run', 'dev'] },
  { name: 'client', cwd: path.join(ROOT, 'client'), args: ['start'] },
];

const children = [];
let shuttingDown = false;

function pipe(name, stream, out) {
  let buffer = '';
  stream.setEncoding('utf8');
  stream.on('data', (chunk) => {
    buffer += chunk;
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop();
    for (const line of lines) {
      out.write(`${COLORS[name]}[${name}]${COLORS.reset} ${line}\n`);
    }
  });
  stream.on('end', () => {
    if (buffer.trim()) out.write(`${COLORS[name]}[${name}]${COLORS.reset} ${buffer}\n`);
  });
}

function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM');
  }
  process.exit(code);
}

function canConnect(host, port) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host });
    const done = (result) => {
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(1000);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
  });
}

async function isPortOpen(port) {
  for (const host of ['::1', '127.0.0.1', 'localhost']) {
    if (await canConnect(host, port)) return true;
  }
  return false;
}

async function openBrowserWhenReady() {
  for (let attempt = 0; attempt < 180; attempt++) {
    if (shuttingDown) return;
    if (await isPortOpen(3000)) {
      const CHROME_PATHS = [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      ];
      const chrome = CHROME_PATHS.find((p) => fs.existsSync(p));
      if (process.platform === 'win32' && chrome) {
        spawn(chrome, [CLIENT_URL], { stdio: 'ignore', detached: true }).unref();
      } else {
        const opener = process.platform === 'win32' ? 'cmd' : process.platform === 'darwin' ? 'open' : 'xdg-open';
        const args = process.platform === 'win32' ? ['/c', 'start', '', CLIENT_URL] : [CLIENT_URL];
        spawn(opener, args, { stdio: 'ignore', detached: true }).unref();
      }
      process.stdout.write(`${COLORS.dim}Opening ${CLIENT_URL}${COLORS.reset}\n`);
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  process.stdout.write(`${COLORS.dim}Client did not start on port 3000; skipping browser launch${COLORS.reset}\n`);
}

for (const target of targets) {
  const child = spawnNpm(target.args, {
    cwd: target.cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, BROWSER: 'none' },
  });

  pipe(target.name, child.stdout, process.stdout);
  pipe(target.name, child.stderr, process.stderr);

  child.on('error', (err) => {
    process.stderr.write(`${COLORS[target.name]}[${target.name}]${COLORS.reset} failed to start: ${err.message}\n`);
    shutdown(1);
  });

  child.on('exit', (code, signal) => {
    if (shuttingDown) return;
    const reason = signal ? `signal ${signal}` : `code ${code}`;
    process.stdout.write(`${COLORS[target.name]}[${target.name}]${COLORS.reset} exited (${reason})\n`);
    shutdown(typeof code === 'number' ? code : 1);
  });

  children.push(child);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

process.stdout.write(`${COLORS.dim}Starting API on http://localhost:5000 and client on ${CLIENT_URL}${COLORS.reset}\n`);

if (OPEN_BROWSER) openBrowserWhenReady();

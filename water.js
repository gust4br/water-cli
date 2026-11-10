#!/usr/bin/env node
// water: interactive hydration REPL. commands: /add 500ml, /undo, /goal 2500, /status, /help, /quit
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const FILE = path.join(__dirname, 'water.json');
const DEFAULT_GOAL = 2000;

const c = (n, s) => `\x1b[${n}m${s}\x1b[0m`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const today = () => new Date().toLocaleDateString('sv'); // YYYY-MM-DD

const db = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : {};
const save = () => fs.writeFileSync(FILE, JSON.stringify(db, null, 2));
let day = today();
const total = () => db[day].log.reduce((a, e) => a + e.ml, 0);

// "1000ml" | "1000" | "1.5l" -> ml (or NaN)
const parseMl = (s = '') => {
  const m = s.trim().toLowerCase().match(/^(\d+(?:[.,]\d+)?)\s*(ml|l)?$/);
  if (!m) return NaN;
  const n = parseFloat(m[1].replace(',', '.'));
  return Math.round(m[2] === 'l' ? n * 1000 : n);
};

const W = 30;
const bar = (ml, goal) => {
  const f = Math.min(W, Math.round((ml / goal) * W));
  return c(36, '█'.repeat(f)) + c(90, '░'.repeat(W - f));
};
const line = (ml, goal, icon) =>
  `${icon} [${bar(ml, goal)}] ${String(Math.round((ml / goal) * 100)).padStart(3)}% ${c(90, `${ml}/${goal}ml`)}`;

// rows 1-2 are pinned (bar + title); everything else scrolls
const rows = () => process.stdout.rows || 24;
const setRegion = () => process.stdout.write(`[3;${rows()}r`);
const pin = (ml, goal, icon) =>
  process.stdout.write(
    `7[1;1H[2K${line(ml, goal, icon)}[2;1H[2K${c(90, `💧 water · ${day} · /help`)}8`
  );

async function animate(from, to) {
  const { goal } = db[day];
  const spin = '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏';
  for (let i = 0; i <= 25; i++) {
    pin(Math.round(from + ((to - from) * i) / 25), goal, c(33, spin[i % 10]));
    await sleep(30);
  }
  pin(to, goal, to >= goal ? c(32, '✔') : c(36, '●'));
  if (to >= goal && from < goal) console.log(c(32, '  goal reached 🎉'));
}

async function type(s, ms = 12) {
  for (const ch of s) { process.stdout.write(ch); await sleep(ms); }
  process.stdout.write('\n');
}

const HELP = [
  ['/add <amount>', 'log water: 500ml, 500, 1.5l'],
  ['/undo', 'remove last entry'],
  ['/goal <amount>', 'change today\'s goal'],
  ['/status', 'show progress + entries'],
  ['/history', 'last 7 days'],
  ['/quit', 'exit'],
];

async function status() {
  const { goal, log } = db[day];
  for (const e of log.slice(-5)) { console.log(`  ${c(90, e.t)} ${c(36, '+' + e.ml + 'ml')}`); await sleep(40); }
  if (total() < goal) console.log(c(90, `  ${goal - total()}ml to go`));
}

async function handle(input, ask) {
  const [cmd, ...rest] = input.trim().split(/\s+/);
  const arg = rest.join(' ');
  const from = total();
  switch (cmd) {
    case '/add': {
      const ml = parseMl(arg);
      if (!(ml > 0 && ml <= 5000)) return console.log(c(31, '  usage: /add 500ml (1-5000)'));
      db[day].log.push({ ml, t: new Date().toLocaleTimeString('sv').slice(0, 5) });
      save();
      await type(c(90, `  ⎿ +${ml}ml`));
      return animate(from, total());
    }
    case '/undo': {
      const e = db[day].log.pop();
      if (!e) return console.log(c(90, '  nothing to undo'));
      save();
      await type(c(90, `  ⎿ removed ${e.ml}ml`));
      return animate(from, total());
    }
    case '/goal': {
      const ml = parseMl(arg);
      if (!(ml > 0)) return console.log(c(31, '  usage: /goal 2500ml'));
      db[day].goal = ml;
      save();
      return animate(total(), total());
    }
    case '/status': return status();
    case '/history':
      for (const d of Object.keys(db).sort().slice(-7)) {
        const t = db[d].log.reduce((a, e) => a + e.ml, 0);
        console.log(`  ${c(90, d)} [${bar(t, db[d].goal)}] ${t}/${db[d].goal}ml`);
      }
      return;
    case '/help':
      for (const [k, v] of HELP) console.log(`  ${c(36, k.padEnd(16))}${c(90, v)}`);
      return;
    case '/quit': case '/exit': process.exit(0);
    default: console.log(c(31, `  unknown command: ${cmd}`) + c(90, ' (try /help)'));
  }
}

async function main() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const it = rl[Symbol.asyncIterator]();
  const prompt = (p) => { process.stdout.write(p); return it.next().then((r) => (r.done ? process.exit(0) : r.value)); };

  console.clear();
  setRegion();
  process.stdout.write('[3;1H');
  process.stdout.on('resize', () => { setRegion(); if (db[day]) pin(total(), db[day].goal, c(36, '●')); });
  process.on('exit', () => process.stdout.write('[r[?25h'));

  // new day: ask for goal (enter = yesterday's goal)
  if (!db[day]) {
    const last = Object.keys(db).sort().pop();
    const def = last ? db[last].goal : DEFAULT_GOAL;
    console.log(c(33, `\n  new day (${day}). what's your goal?`));
    let ml;
    while (!(ml > 0)) {
      const a = (await prompt(c(32, `  goal [${def}ml] ❯ `))).trim();
      ml = a ? parseMl(a) : def;
    }
    db[day] = { goal: ml, log: [] };
    save();
  }
  console.log();
  await animate(0, total());
  await status();

  for (;;) {
    // a session left open past midnight rolls over to a new day's file entry on restart; keep simple
    const input = (await prompt(c(32, '\n❯ '))).trim();
    if (input) await handle(input);
  }
}
main();

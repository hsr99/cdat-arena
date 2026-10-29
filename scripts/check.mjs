import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
const root = new URL('../', import.meta.url);
let failed = false;
async function walk(dir) {
  for (const ent of await readdir(dir, { withFileTypes: true })) {
    if (['node_modules', '.git'].includes(ent.name) || ent.name === '.env') continue;
    const p = join(dir, ent.name);
    if (ent.isDirectory()) await walk(p);
    else {
      const text = await readFile(p, 'utf8');
      if (/(?:gsk_[A-Za-z0-9]{12,}|hf_[A-Za-z0-9]{12,}|sk-[A-Za-z0-9]{20,})/.test(text)) { console.error(`Possible credential in ${p}`); failed = true; }
      if (/\.(?:m?js)$/.test(p)) {
        const result = spawnSync(process.execPath, ['--check', p], { stdio: 'inherit' });
        if (result.status !== 0) failed = true;
      }
    }
  }
}
await walk(root.pathname);
if (failed) process.exitCode = 1;
else console.log('Syntax checks and common credential-pattern scan passed. Not a full security audit.');

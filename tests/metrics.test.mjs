import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const source = ['config.js', 'metrics.js'].map(p => readFileSync(new URL('../public/js/' + p, import.meta.url), 'utf8')).join('\n');
const ctx = vm.createContext({}); vm.runInContext(source, ctx);
test('totalScore preserves ten-metric sum and null handling', () => {
  assert.equal(vm.runInContext('totalScore(null)', ctx), 0);
  assert.equal(vm.runInContext('totalScore(Object.fromEntries(ALL_METRICS.map(m => [m, 7])))', ctx), 70);
});
test('PAC preserves first paragraph and repeated text behaviour', () => {
  assert.equal(vm.runInContext("computePAC('A bright silver archive', [])", ctx), 0.5);
  assert.equal(vm.runInContext("computePAC('bright silver archive', ['bright silver archive'])", ctx), 0);
});

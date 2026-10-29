import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { assess } from './budget.mjs';

const limits = {
  units: { small: 6, stop: 10 },
  context: { small: 60, stop: 75 },
  limit: { stop: 85 },
  maxAgeMinutes: 10,
};
const now = Date.parse('2026-10-14T12:00:00Z');
const adapter = (extra) => ({ at: '2026-10-14T11:58:00Z', ...extra });

test('without an adapter, the unit count decides', () => {
  assert.equal(assess({ units: 3, adapter: null, limits, now }).level, 0);
  assert.equal(assess({ units: 6, adapter: null, limits, now }).level, 1);
  const stop = assess({ units: 10, adapter: null, limits, now });
  assert.equal(stop.level, 2);
  assert.match(stop.line, /대리 지표/);
  assert.match(stop.line, /정지/);
});

test('a fresh adapter context overrides the unit count', () => {
  assert.equal(assess({ units: 12, adapter: adapter({ context: 30 }), limits, now }).level, 0);
  assert.equal(assess({ units: 1, adapter: adapter({ context: 64 }), limits, now }).level, 1);
  assert.equal(assess({ units: 1, adapter: adapter({ context: 80 }), limits, now }).level, 2);
});

test('usage limits stop work near their ceiling', () => {
  const result = assess({ units: 1, adapter: adapter({ context: 20, limits: [{ name: '5시간 한도', percent: 90 }] }), limits, now });
  assert.equal(result.level, 2);
  assert.match(result.line, /5시간 한도 90%/);
});

test('a stale adapter file is ignored', () => {
  const stale = { at: '2026-10-14T10:00:00Z', context: 90 };
  const result = assess({ units: 2, adapter: stale, limits, now });
  assert.equal(result.level, 0);
  assert.match(result.line, /대리 지표/);
});

test('check prints only past a threshold and never fails the commit', t => {
  const cwd = mkdtempSync(join(tmpdir(), 'budget-test-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
  git('init', '-q');
  git('config', 'user.name', 'Budget Test');
  git('config', 'user.email', 'budget@example.invalid');
  git('config', 'commit.gpgsign', 'false');
  const script = join(cwd, 'budget.mjs');
  writeFileSync(script, readFileSync(new URL('./budget.mjs', import.meta.url)));
  writeFileSync(join(cwd, '.gated-tdd.json'), JSON.stringify({ budget: { units: { small: 2, stop: 3 } } }));
  const run = (mode) => spawnSync(process.execPath, [script, mode], { cwd, encoding: 'utf8' });

  assert.equal(run('check').stdout, ''); // 세션 기록이 없으면 단위 수를 모르므로 조용하다.
  assert.equal(run('start').status, 0);
  const commit = () => git('commit', '-q', '--allow-empty', '-m', 'unit');
  commit();
  assert.equal(run('check').stdout, '');
  commit();
  assert.match(run('check').stdout, /작은 단위만/);
  commit();
  const stop = run('check');
  assert.equal(stop.status, 0);
  assert.match(stop.stdout, /이번 세션 단위 3개/);
  assert.match(run('status').stdout, /\[예산\]/);
});

test('commits that arrive by pull or branch switch are not counted', t => {
  const cwd = mkdtempSync(join(tmpdir(), 'budget-test-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
  git('init', '-q');
  git('config', 'user.name', 'Budget Test');
  git('config', 'user.email', 'budget@example.invalid');
  git('config', 'commit.gpgsign', 'false');
  const script = join(cwd, 'budget.mjs');
  writeFileSync(script, readFileSync(new URL('./budget.mjs', import.meta.url)));
  writeFileSync(join(cwd, '.gated-tdd.json'), JSON.stringify({ budget: { units: { small: 2, stop: 3 } } }));
  const run = (mode) => spawnSync(process.execPath, [script, mode], { cwd, encoding: 'utf8' });
  const commit = () => git('commit', '-q', '--allow-empty', '-m', 'unit');

  assert.equal(run('start').status, 0);
  // post-commit 훅을 거치지 않은 커밋(pull로 받은 남의 커밋)은 check가 불리지 않는다.
  commit(); commit(); commit();
  commit();
  assert.equal(run('check').stdout, '');
  assert.match(run('status').stdout, /이번 세션 단위 1개/);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// 격리된 임시 저장소에서 로그 항목 생성을 검사한다.
const script = fileURLToPath(new URL('./log-new.mjs', import.meta.url));
const STATUS = 'docs/status/feat-work.md';

function repo(t, { index, status = '# 상태: feat/work\n\n최종 갱신: 2026-01-01\n' }) {
  const cwd = mkdtempSync(join(tmpdir(), 'log-new-test-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  execFileSync('git', ['init', '-q', '-b', 'feat/work'], { cwd });
  mkdirSync(join(cwd, 'docs/log'), { recursive: true });
  mkdirSync(join(cwd, 'docs/status'), { recursive: true });
  mkdirSync(join(cwd, 'src/deep'), { recursive: true });
  if (index !== undefined) writeFileSync(join(cwd, 'docs/log/INDEX.md'), index);
  if (status !== null) writeFileSync(join(cwd, STATUS), status);
  const run = (args, dir = cwd) => spawnSync(process.execPath, [script, ...args], { cwd: dir, encoding: 'utf8' });
  const entries = () => readdirSync(join(cwd, 'docs/log')).filter(name => name !== 'INDEX.md');
  const read = (path) => readFileSync(join(cwd, path), 'utf8');
  return { cwd, run, entries, read };
}

const INDEX = '# 작업 로그\n\n| 항목 | 날짜 | 결론 | 상태 | 파일 |\n| --- | --- | --- | --- | --- |\n';
const ENTRY = /^\d{4}-\d{2}-\d{2}-A01\.md$/;

test('creates an entry named by date and ID, an index row, and a status date', t => {
  const r = repo(t, { index: INDEX });
  const result = r.run(['A01: 가입 API', '--gate', '자동']);
  assert.equal(result.status, 0, result.stderr);
  const [entry, ...rest] = r.entries();
  assert.match(entry, ENTRY);
  assert.deepEqual(rest, []);
  const stem = entry.replace(/\.md$/, '');
  assert.ok(r.read('docs/log/INDEX.md').includes(`| 자동 진행 | [${stem}](./${entry}) |`));
  assert.doesNotMatch(r.read(STATUS), /2026-01-01/);
});

test('the same ID twice on one day gets a numbered name instead of failing', t => {
  const r = repo(t, { index: INDEX });
  assert.equal(r.run(['A01: 가입 API']).status, 0);
  assert.equal(r.run(['A01: 가입 API 다시']).status, 0);
  assert.equal(r.entries().filter(name => /-A01-2\.md$/.test(name)).length, 1);
});

test('accepts a table divider reformatted by a formatter', t => {
  const r = repo(t, { index: '| 항목 | 날짜 | 결론 | 상태 | 파일 |\n|------|:-----|------|------|------|\n' });
  assert.equal(r.run(['A01: 가입 API']).status, 0);
  assert.match(r.read('docs/log/INDEX.md'), /\n\| A01 \|/);
});

test('leaves no entry file behind when the index is broken', t => {
  const r = repo(t, { index: '# 작업 로그\n' });
  assert.equal(r.run(['A01: 가입 API']).status, 1);
  assert.deepEqual(r.entries(), []);
});

test('a branch without a status file gets one from the template', t => {
  const r = repo(t, { index: INDEX, status: null });
  const result = r.run(['A01: 가입 API']);
  assert.equal(result.status, 0, result.stderr);
  assert.match(r.read(STATUS), /^# 상태: feat\/work/);
  assert.match(r.read(STATUS), /^- 확인 대기:/m);
});

test('works from a subfolder and keeps CRLF line endings', t => {
  const r = repo(t, { index: INDEX.replace(/\n/g, '\r\n') });
  const result = r.run(['A01: 가입 API'], join(r.cwd, 'src/deep'));
  assert.equal(result.status, 0, result.stderr);
  assert.match(r.entries()[0], ENTRY);
  assert.doesNotMatch(r.read('docs/log/INDEX.md').replace(/\r\n/g, ''), /\n/);
});

test('refuses to run without a branch', t => {
  const r = repo(t, { index: INDEX });
  writeFileSync(join(r.cwd, 'a.txt'), 'a');
  execFileSync('git', ['add', '.'], { cwd: r.cwd });
  execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', 'commit', '-qm', 'a'], { cwd: r.cwd });
  execFileSync('git', ['checkout', '-q', '--detach'], { cwd: r.cwd });
  assert.equal(r.run(['A01: 가입 API']).status, 1);
  assert.deepEqual(r.entries(), []);
  assert.ok(!existsSync(join(r.cwd, 'docs/status/HEAD.md')));
});

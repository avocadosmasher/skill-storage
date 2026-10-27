import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// 격리된 임시 저장소에서 로그 항목 생성을 검사한다.
const script = fileURLToPath(new URL('./log-new.mjs', import.meta.url));

function repo(t, { index, status = '# 상태\n\n최종 갱신: 2026-01-01\n' }) {
  const cwd = mkdtempSync(join(tmpdir(), 'log-new-test-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  execFileSync('git', ['init', '-q'], { cwd });
  mkdirSync(join(cwd, 'docs/log'), { recursive: true });
  mkdirSync(join(cwd, 'src/deep'), { recursive: true });
  if (index !== undefined) writeFileSync(join(cwd, 'docs/log/INDEX.md'), index);
  if (status !== null) writeFileSync(join(cwd, 'STATUS.md'), status);
  const run = (args, dir = cwd) => spawnSync(process.execPath, [script, ...args], { cwd: dir, encoding: 'utf8' });
  const entries = () => readdirSync(join(cwd, 'docs/log')).filter(name => name !== 'INDEX.md');
  const read = (path) => readFileSync(join(cwd, path), 'utf8');
  return { cwd, run, entries, read };
}

const INDEX = '# 작업 로그\n\n| 항목 | 날짜 | 결론 | 상태 | 파일 |\n| --- | --- | --- | --- | --- |\n';

test('creates an entry, an index row, and a status date', t => {
  const r = repo(t, { index: INDEX });
  const result = r.run(['A01: 가입 API', '--gate', '자동']);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(r.entries(), ['01-A01.md']);
  assert.match(r.read('docs/log/INDEX.md'), /\| A01 \| .* \| 자동 진행 \| \[01\]\(\.\/01-A01\.md\) \|/);
  assert.doesNotMatch(r.read('STATUS.md'), /2026-01-01/);
});

test('accepts a table divider reformatted by a formatter', t => {
  const r = repo(t, { index: '| 항목 | 날짜 | 결론 | 상태 | 파일 |\n|------|:-----|------|------|------|\n' });
  assert.equal(r.run(['A01: 가입 API']).status, 0);
  assert.match(r.read('docs/log/INDEX.md'), /\n\| A01 \|/);
});

test('leaves no entry file behind when the index or status is missing', t => {
  const noDivider = repo(t, { index: '# 작업 로그\n' });
  assert.equal(noDivider.run(['A01: 가입 API']).status, 1);
  assert.deepEqual(noDivider.entries(), []);
  const noStatus = repo(t, { index: INDEX, status: null });
  assert.equal(noStatus.run(['A01: 가입 API']).status, 1);
  assert.deepEqual(noStatus.entries(), []);
});

test('works from a subfolder and keeps CRLF line endings', t => {
  const r = repo(t, { index: INDEX.replace(/\n/g, '\r\n') });
  const result = r.run(['A01: 가입 API'], join(r.cwd, 'src/deep'));
  assert.equal(result.status, 0, result.stderr);
  assert.ok(existsSync(join(r.cwd, 'docs/log/01-A01.md')));
  assert.doesNotMatch(r.read('docs/log/INDEX.md').replace(/\r\n/g, ''), /\n/);
});

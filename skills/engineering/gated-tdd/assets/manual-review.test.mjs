import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

// 격리된 임시 저장소에서 승인 게이트를 검사한다. 이 테스트를 실행하는 저장소에는 승인·커밋하지 않는다.
const code = readFileSync(new URL('./manual-review.mjs', import.meta.url), 'utf8');

function repo(t, { withGate = true } = {}) {
  const cwd = mkdtempSync(join(tmpdir(), 'methodology-gate-test-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  git('init', '-q', '-b', 'feat/work');
  git('config', 'user.name', 'Gate Test');
  git('config', 'user.email', 'gate@example.invalid');
  git('config', 'commit.gpgsign', 'false');
  git('config', 'core.hooksPath', join(cwd, 'isolated-hooks'));
  const write = (path, value) => {
    mkdirSync(dirname(join(cwd, path)), { recursive: true });
    writeFileSync(join(cwd, path), value);
  };
  const remove = (path) => rmSync(join(cwd, path));
  // 게이트는 저장소 밖에서 실행해, 게이트 파일 자체가 스테이징되지 않은 상태도 시험할 수 있게 한다.
  const gatePath = join(cwd, '..', `${cwd.split(/[\\/]/).at(-1)}-gate.mjs`);
  writeFileSync(gatePath, code);
  t.after(() => rmSync(gatePath, { force: true }));
  if (withGate) write('scripts/manual-review.mjs', code);
  write('src/app.js', 'export const a = 1;\n');
  git('add', '.');
  const gate = (mode, input = '', extra = []) =>
    spawnSync(process.execPath, [gatePath, mode, ...extra], { cwd, encoding: 'utf8', input });
  const expect = (mode, status, input, extra) => {
    const result = gate(mode, input, extra);
    assert.equal(result.status, status, result.stderr || result.stdout);
    return result;
  };
  const push = (remoteBranch, oid = git('rev-parse', 'HEAD')) =>
    `refs/heads/x ${oid} refs/heads/${remoteBranch} ${'0'.repeat(40)}\n`;
  const baseline = () => { r_commit(); };
  function r_commit(message = 'commit') {
    git('commit', '-qm', message);
  }
  return { cwd, git, write, remove, gate, expect, push, commit: r_commit, baseline };
}

test('first commit with gate files needs approval, then passes', t => {
  const r = repo(t);
  r.expect('check-commit', 1);
  r.expect('approve', 0, '', ['--for', 'setup']);
  r.expect('check-commit', 0);
});

test('ordinary changes commit without approval', t => {
  const r = repo(t, { withGate: false });
  r.expect('check-commit', 0);
  r.commit();
  r.write('src/app.js', 'export const a = 2;\n');
  r.git('add', '.');
  r.expect('check-commit', 0);
});

test('protected paths need approval; approval is bound to the staged tree', t => {
  const r = repo(t, { withGate: false });
  r.commit();
  r.write('db/migrations/001_users.sql', 'create table users();\n');
  r.git('add', '.');
  const blocked = r.expect('check-commit', 1);
  assert.match(blocked.stderr, /보호 경로/);
  r.expect('approve', 0);
  r.expect('check-commit', 0);
  r.write('db/migrations/001_users.sql', 'create table users(id int);\n');
  r.git('add', '.');
  r.expect('check-commit', 1);
});

test('config adds protected paths', t => {
  const r = repo(t, { withGate: false });
  r.commit();
  r.write('src/auth/session.js', 'export {};\n');
  r.git('add', '.');
  r.expect('check-commit', 0);
  r.git('reset', '-q');
  r.write('.gated-tdd.json', JSON.stringify({ decide: ['src/auth/**'] }));
  r.git('add', '.gated-tdd.json');
  r.expect('approve', 0);
  r.commit('config');
  r.git('add', '.');
  const blocked = r.expect('check-commit', 1);
  assert.match(blocked.stderr, /src\/auth\/session\.js: 보호 경로/);
});

test('adding tests is free; changing or deleting existing test lines is guarded', t => {
  const r = repo(t, { withGate: false });
  r.write('src/app.test.js', "test('a', () => {});\n");
  r.git('add', '.');
  r.expect('check-commit', 0);
  r.commit();
  r.write('src/app.test.js', "test('a', () => {});\ntest('b', () => {});\n");
  r.git('add', '.');
  r.expect('check-commit', 0);
  r.commit();
  r.write('src/app.test.js', "test('a changed', () => {});\ntest('b', () => {});\n");
  r.git('add', '.');
  assert.match(r.expect('check-commit', 1).stderr, /기존 테스트의 줄 변경·삭제/);
  r.git('checkout', '-q', '--', '.');
  r.git('reset', '-q', '--hard');
  r.remove('src/app.test.js');
  r.git('add', '.');
  assert.match(r.expect('check-commit', 1).stderr, /기존 테스트 삭제/);
});

test('skip or only added to tests is guarded', t => {
  const r = repo(t, { withGate: false });
  r.write('src/app.test.js', "test('a', () => {});\n");
  r.git('add', '.');
  r.commit();
  r.write('src/app.test.js', "test('a', () => {});\ntest.skip('b', () => {});\n");
  r.git('add', '.');
  assert.match(r.expect('check-commit', 1).stderr, /skip·only/);
});

test('guarded mode lists reasons without blocking', t => {
  const r = repo(t, { withGate: false });
  r.commit();
  r.write('package.json', '{}\n');
  r.git('add', '.');
  const result = r.expect('guarded', 0);
  assert.match(result.stdout, /package\.json: 보호 경로/);
});

test('approve refuses unstaged changes', t => {
  const r = repo(t, { withGate: false });
  r.commit();
  r.write('src/app.js', 'unstaged\n');
  r.expect('approve', 1);
});

test('push to feature branches passes; protected branches and their deletion are blocked', t => {
  const r = repo(t, { withGate: false });
  r.commit();
  r.expect('check-push', 0, r.push('feat/work'));
  assert.match(r.expect('check-push', 1, r.push('main')).stderr, /main/);
  r.expect('check-push', 1, r.push('master'));
  r.expect('check-push', 1, r.push('main', '0'.repeat(40)));
  r.expect('check-push', 0, r.push('feat/old', '0'.repeat(40)));
});

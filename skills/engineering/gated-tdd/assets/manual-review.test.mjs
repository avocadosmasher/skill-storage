import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, copyFileSync, existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
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
  if (withGate) write('scripts/gated-tdd/manual-review.mjs', code);
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

test('directPush allows fast-forward pushes that only touch those paths', t => {
  const r = repo(t, { withGate: false });
  r.write('.gated-tdd.json', JSON.stringify({ directPush: ['content/posts/**'] }));
  r.git('add', '.');
  r.commit();
  const base = r.git('rev-parse', 'HEAD');
  const update = (oid = r.git('rev-parse', 'HEAD'), remoteOid = base) =>
    `refs/heads/main ${oid} refs/heads/main ${remoteOid}\n`;

  r.write('content/posts/첫-글.md', '# 첫 글\n');
  r.git('add', '.');
  r.commit();
  r.expect('check-push', 0, update());

  r.write('src/app.js', 'export const a = 2;\n');
  r.git('add', '.');
  r.commit();
  assert.match(r.expect('check-push', 1, update()).stderr, /outside directPush: src\/app\.js/);
});

test('directPush still blocks gate files, new branches, deletion, and non-fast-forward', t => {
  const r = repo(t, { withGate: false });
  r.write('.gated-tdd.json', JSON.stringify({ directPush: ['content/**', '.gated-tdd.json'] }));
  r.git('add', '.');
  r.commit();
  const base = r.git('rev-parse', 'HEAD');
  const update = (oid, remoteOid) => `refs/heads/main ${oid} refs/heads/main ${remoteOid}\n`;

  r.write('.gated-tdd.json', JSON.stringify({ directPush: ['**'] }));
  r.git('add', '.');
  r.commit();
  assert.match(r.expect('check-push', 1, update(r.git('rev-parse', 'HEAD'), base)).stderr, /\.gated-tdd\.json/);

  r.expect('check-push', 1, update(base, '0'.repeat(40)));
  r.expect('check-push', 1, update('0'.repeat(40), base));

  r.git('checkout', '-q', base);
  r.write('content/a.md', 'a\n');
  r.git('add', '.');
  r.commit();
  const diverged = r.git('rev-parse', 'HEAD');
  r.git('checkout', '-q', 'feat/work');
  assert.match(r.expect('check-push', 1, update(diverged, r.git('rev-parse', 'HEAD'))).stderr, /fast-forward/);
});

test('non-ASCII paths are checked by their real names, even with core.quotePath on', t => {
  const r = repo(t, { withGate: false });
  r.git('config', 'core.quotePath', 'true');
  r.write('가입.test.js', "test('a', () => {});\n");
  r.git('add', '.');
  r.expect('check-commit', 0); // 새 테스트는 자유
  r.commit();
  r.write('가입.test.js', "test('a changed', () => {});\n");
  r.git('add', '.');
  assert.match(r.expect('check-commit', 1).stderr, /가입\.test\.js: 기존 테스트의 줄 변경·삭제/);
  r.git('reset', '-q', '--hard');
  r.write('설정/서버.pem', 'secret\n');
  r.git('add', '.');
  assert.match(r.expect('check-commit', 1).stderr, /설정\/서버\.pem: 보호 경로/);
});

test('moving a test or protected file out of its pattern is still guarded', t => {
  const r = repo(t, { withGate: false });
  r.write('src/app.test.js', "test('a', () => {});\n");
  r.write('db/migrations/001.sql', 'create table a();\n');
  r.git('add', '.');
  r.commit();
  r.write('archive/.keep', '');
  r.git('mv', 'src/app.test.js', 'archive/app.txt');
  assert.match(r.expect('check-commit', 1).stderr, /src\/app\.test\.js -> archive\/app\.txt: 기존 테스트 이동·삭제/);
  r.git('reset', '-q', '--hard');
  r.write('db/old/.keep', '');
  r.git('mv', 'db/migrations/001.sql', 'db/old/001.txt');
  assert.match(r.expect('check-commit', 1).stderr, /001\.txt: 보호 경로/);
});

test('changing a binary snapshot next to a test is guarded; adding one is free', t => {
  const r = repo(t, { withGate: false });
  const png = (tail) => Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, ...tail]);
  r.write('e2e/home.spec.ts-snapshots/home.png', png([1, 2, 3]));
  r.git('add', '.');
  r.expect('check-commit', 0);
  r.commit();
  r.write('e2e/home.spec.ts-snapshots/home.png', png([9, 9, 9]));
  r.git('add', '.');
  assert.match(r.expect('check-commit', 1).stderr, /home\.png: 기존 테스트의 바이너리 변경/);
});

// 원격 보호 브랜치를 흉내 낸다: 빈 원격 저장소를 만들고, main에 보호 대상 변경을 쌓아 올린다(PR로 병합된 것에 해당).
function withMain(t, r) {
  const origin = `${r.cwd}-origin.git`;
  execFileSync('git', ['init', '-q', '--bare', origin]);
  t.after(() => rmSync(origin, { recursive: true, force: true }));
  r.git('remote', 'add', 'origin', origin);
  r.write('src/app.test.js', "test('a', () => {});\n");
  r.write('package.json', '{"v":1}\n');
  r.git('add', '.');
  r.commit('base');
  r.git('branch', 'main');
  r.git('switch', '-q', 'main');
  r.write('package.json', '{"v":2}\n');
  r.write('db/migrations/001.sql', 'create table a();\n');
  r.write('src/app.test.js', "test('a changed on main', () => {});\n");
  r.git('add', '.');
  r.commit('approved on main');
  r.git('push', '-q', 'origin', 'main');
  r.git('switch', '-q', 'feat/work');
  r.write('src/feature.js', 'export {};\n');
  r.git('add', '.');
  r.commit('feature');
}

test('merging the remote main brings in its approved changes without a new approval', t => {
  const r = repo(t, { withGate: false });
  withMain(t, r);
  r.git('merge', '-q', '--no-ff', '--no-commit', 'origin/main');
  r.expect('check-commit', 0);
});

test('merging a local branch that is not on the remote main is still checked', t => {
  const r = repo(t, { withGate: false });
  withMain(t, r);
  r.git('switch', '-q', 'main');
  r.write('db/migrations/002.sql', 'drop table a;\n');
  r.git('add', '.');
  r.commit('not reviewed');
  r.git('switch', '-q', 'feat/work');
  r.git('merge', '-q', '--no-ff', '--no-commit', 'main');
  assert.match(r.expect('check-commit', 1).stderr, /002\.sql: 보호 경로/);
});

test('during a trusted merge, files the main side did not change or that were edited are still checked', t => {
  const r = repo(t, { withGate: false });
  withMain(t, r);
  // 기능 브랜치에서 판정받아 바꾼 의존성을 병합하며 옛 내용으로 되돌린다. main은 이 파일을 바꾸지 않았다.
  r.write('Dockerfile', 'FROM node:22\n');
  r.git('add', '.');
  r.commit('approved on feature');
  r.git('merge', '-q', '--no-ff', '--no-commit', 'origin/main');
  r.git('rm', '-q', 'Dockerfile');
  assert.match(r.expect('check-commit', 1).stderr, /Dockerfile: 보호 경로/);
  r.git('reset', '-q', '--hard');
  // main에서 들어온 마이그레이션을 병합하며 고친다.
  r.git('merge', '-q', '--no-ff', '--no-commit', 'origin/main');
  r.write('db/migrations/001.sql', 'create table b();\n');
  r.git('add', '.');
  assert.match(r.expect('check-commit', 1).stderr, /001\.sql: 보호 경로/);
});

test('hooks reports whether each hook reaches the gate, also when chained from another tool', t => {
  const r = repo(t, { withGate: false });
  const hooks = ['pre-commit', 'pre-merge-commit', 'pre-push', 'post-commit'];
  for (const hook of hooks) {
    r.write(`.githooks/${hook}`, '');
    copyFileSync(new URL(`./githooks/${hook}`, import.meta.url), join(r.cwd, '.githooks', hook));
    chmodSync(join(r.cwd, '.githooks', hook), 0o755);
  }
  r.git('config', 'core.hooksPath', '.githooks');
  assert.match(r.expect('hooks', 1).stdout, /merge\.ff: \(없음\) \(필요: false\)/);
  r.git('config', 'merge.ff', 'false');
  r.git('config', 'pull.ff', 'only');
  assert.match(r.expect('hooks', 0).stdout, /pre-commit: 연결됨[\s\S]*post-commit: 연결됨/);

  // 다른 훅 도구가 자리를 쓰는 경우: 그 도구의 훅 맨 앞에 게이트 호출 한 줄을 넣는다. 확인 중에는 뒤 명령이 돌지 않는다.
  for (const hook of hooks) {
    r.write(`.husky/${hook}`, `#!/bin/sh\n.githooks/${hook} "$@" || exit $?\necho ran > other-tool-${hook}.txt\n`);
    chmodSync(join(r.cwd, '.husky', hook), 0o755);
  }
  r.git('config', 'core.hooksPath', '.husky');
  r.expect('hooks', 0);
  assert.ok(!existsSync(join(r.cwd, 'other-tool-pre-push.txt')));
  r.write('.husky/pre-push', '#!/bin/sh\nnpm test\n');
  assert.match(r.expect('hooks', 1).stdout, /pre-push: 연결 안 됨/);
});

test('through the real hooks, a clean merge of the remote main commits and a local unreviewed merge does not', t => {
  const r = repo(t);
  withMain(t, r);
  for (const hook of ['pre-commit', 'pre-merge-commit', 'pre-push', 'post-commit']) {
    r.write(`.githooks/${hook}`, '');
    copyFileSync(new URL(`./githooks/${hook}`, import.meta.url), join(r.cwd, '.githooks', hook));
    chmodSync(join(r.cwd, '.githooks', hook), 0o755);
  }
  r.git('add', '.');
  r.commit('hooks');
  r.git('config', 'core.hooksPath', '.githooks');
  const merge = (ref) => spawnSync('git', ['merge', ref, '-m', `merge ${ref}`], { cwd: r.cwd, encoding: 'utf8' });
  const clean = merge('origin/main');
  assert.equal(clean.status, 0, clean.stderr);
  assert.equal(r.git('log', '-1', '--format=%s'), 'merge origin/main');

  r.git('switch', '-q', 'main');
  r.write('db/migrations/002.sql', 'drop table a;\n');
  r.git('add', '.');
  r.git('-c', 'core.hooksPath=', 'commit', '-qm', 'not reviewed');
  r.git('switch', '-q', 'feat/work');
  const local = merge('main');
  assert.notEqual(local.status, 0);
  assert.match(local.stderr, /002\.sql: 보호 경로/);
});

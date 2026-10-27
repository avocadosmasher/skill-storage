import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// 격리된 임시 저장소와 원격에서 세션 시작 상태 출력을 검사한다.
const script = fileURLToPath(new URL('./status.mjs', import.meta.url));

function repo(t) {
  const base = mkdtempSync(join(tmpdir(), 'status-test-'));
  t.after(() => rmSync(base, { recursive: true, force: true }));
  const cwd = join(base, 'work');
  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  execFileSync('git', ['init', '-q', '--bare', join(base, 'origin.git')]);
  execFileSync('git', ['init', '-q', '-b', 'main', cwd]);
  git('config', 'user.name', 'Status Test');
  git('config', 'user.email', 'status@example.invalid');
  git('config', 'commit.gpgsign', 'false');
  git('config', 'core.hooksPath', join(base, 'no-hooks'));
  git('remote', 'add', 'origin', join(base, 'origin.git'));
  const write = (path, value) => {
    mkdirSync(dirname(join(cwd, path)), { recursive: true });
    writeFileSync(join(cwd, path), value);
  };
  const commit = (message) => { git('add', '-A'); git('commit', '-qm', message); };
  const status = (branch, waiting) => write(`docs/status/${branch.replace(/\//g, '-')}.md`,
    `# 상태: ${branch}\n\n최종 갱신: 2026-10-27\n\n## 지금\n\n- 마지막 커밋: x\n${waiting}\n- 다음 할 일: 계속\n`);
  write('README.md', 'app\n');
  commit('init');
  git('push', '-q', 'origin', 'main');
  const run = () => {
    const result = spawnSync(process.execPath, [script], { cwd, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout;
  };
  return { cwd, git, write, commit, status, run };
}

test('shows this branch in full and the waiting items of other branches', t => {
  const r = repo(t);
  r.git('switch', '-qc', 'feat/b');
  r.status('feat/b', '- 판정 대기: PLAN-B\n- 확인 대기: 없음');
  r.commit('b');
  r.git('switch', '-q', 'main');
  r.git('switch', '-qc', 'feat/a');
  r.status('feat/a', '- 판정 대기: 없음\n- 확인 대기: A03 가입 흐름');
  r.commit('a');
  const out = r.run();
  assert.match(out, /## 이 브랜치: feat\/a \(docs\/status\/feat-a\.md\)[\s\S]*확인 대기: A03 가입 흐름/);
  assert.match(out, /- feat\/b: 판정 대기: PLAN-B \/ 확인 대기: 없음 \/ 다음 할 일: 계속/);
});

test('sees branches that exist only on the remote, and skips merged ones', t => {
  const r = repo(t);
  r.git('switch', '-qc', 'feat/other-pc');
  r.status('feat/other-pc', '- 판정 대기: 없음\n- 확인 대기: B02 결제');
  r.commit('other');
  r.git('push', '-q', 'origin', 'feat/other-pc');
  r.git('switch', '-q', 'main');
  r.git('branch', '-qD', 'feat/other-pc');
  r.git('switch', '-qc', 'feat/done');
  r.status('feat/done', '- 판정 대기: 없음\n- 확인 대기: 없음');
  r.commit('done');
  r.git('switch', '-q', 'main');
  r.git('merge', '-q', '--ff-only', 'feat/done');
  r.git('push', '-q', 'origin', 'main');
  const out = r.run();
  assert.match(out, /## 이 브랜치: main \(보호 브랜치\)/);
  assert.match(out, /- feat\/other-pc \(원격에만 있음\): .*확인 대기: B02 결제/);
  assert.doesNotMatch(out, /feat\/done/);
});

test('lists parked work from stash and park branches until it is removed', t => {
  const r = repo(t);
  r.git('switch', '-qc', 'feat/a');
  r.write('src/half.js', 'half\n');
  r.git('stash', 'push', '-u', '-m', 'gated-tdd 보류: A03 급한 버그');
  const sha = r.git('rev-parse', 'stash@{0}');
  let out = r.run();
  assert.match(out, /## 미뤄 둔 작업\n\n- stash@\{0\} \w{7} On feat\/a: gated-tdd 보류: A03 급한 버그 \(이 PC에만 있음\)/);
  r.git('push', '-q', 'origin', `${sha}:refs/heads/park/A03`);
  r.git('fetch', '-q', 'origin');
  out = r.run();
  assert.match(out, /gated-tdd 보류: A03 급한 버그 \(park\/A03에도 있음\)/);
  // 이 PC의 stash가 사라져도 원격의 park 브랜치가 남아 있으면 계속 보인다.
  r.git('stash', 'drop', '-q');
  out = r.run();
  assert.match(out, /- park\/A03 \w{7} \(원격에만 있음\)/);
});

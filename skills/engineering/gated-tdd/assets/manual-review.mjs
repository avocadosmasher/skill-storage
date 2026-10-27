// 승인 게이트. 단위마다 커밋하되(설계 003), 보호 대상 변경만 사용자 판정 기록을 요구하고
// 보호 브랜치(main 등)로의 push는 막아 PR로만 들어가게 한다.
//
//   approve [--for <ID>]  스테이징 트리와 기준 커밋을 판정 기록으로 남긴다
//                         (사용자 "통과" 후, 또는 판정받은 계획의 보호 대상 변경 칸 범위 안일 때만)
//   guarded               스테이징된 변경 중 보호 대상과 그 이유를 보여 준다
//   check-commit          pre-commit: 보호 대상 변경이 있으면 승인 기록과 대조한다
//   check-push            pre-push: 보호 브랜치로 가는 push와 그 삭제를 막는다
//                         (directPush 경로만 바꾸는 fast-forward push는 통과)
import { execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, posix } from 'node:path';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).replace(/\n$/, '');
const fail = (message) => { throw new Error(message); };

// 게이트 자체는 설정과 무관하게 항상 보호한다. 게이트를 고치는 것도 결정이다.
const GATE_FILES = ['scripts/manual-review.mjs', 'scripts/budget.mjs', '.githooks/**', '.gated-tdd.json'];
const DEFAULTS = {
  decide: [
    '**/migrations/**', '**/migrate/**', '*.sql', 'schema.prisma',
    'package.json', 'requirements*.txt', 'pyproject.toml', 'go.mod', 'Cargo.toml', 'Gemfile', 'pom.xml', 'build.gradle*',
    '.env*', '*.pem', '*.key',
    'Dockerfile*', 'docker-compose*.yml', 'docker-compose*.yaml', '*.tf', '.github/workflows/**',
  ],
  tests: ['*.test.*', '*.spec.*', 'test_*.py', '*_test.py', '*_test.go', '**/__tests__/**', '**/tests/**', '**/test/**',
    '**/__snapshots__/**', '**/*-snapshots/**'],
  protectedBranches: ['main', 'master'],
  // 블로그 글처럼 개발 절차 밖에서 main으로 바로 올리던 경로. 기본은 없음.
  directPush: [],
};
const SKIP_PATTERN = /\b(?:it|test|describe|context)\.(?:skip|only|todo)\b|\b(?:xit|xdescribe|fit|fdescribe)\s*\(|@pytest\.mark\.(?:skip|xfail)|\bt\.Skip(?:Now)?\(|@Disabled\b|@Ignore\b|\bskip\s*:\s*true\b/;

function globToRegExp(glob) {
  let out = '';
  for (let i = 0; i < glob.length; i += 1) {
    const c = glob[i];
    if (c === '*' && glob[i + 1] === '*') {
      if (glob[i + 2] === '/') { out += '(?:.*/)?'; i += 2; } else { out += '.*'; i += 1; }
    } else if (c === '*') out += '[^/]*';
    else if (c === '?') out += '[^/]';
    else out += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${out}$`);
}
// 슬래시가 없는 패턴은 .gitignore처럼 어느 폴더의 파일 이름에도 맞춘다.
const matches = (path, globs) => globs.some(glob => globToRegExp(glob).test(glob.includes('/') ? path : posix.basename(path)));

function loadConfig(root) {
  const file = join(root, '.gated-tdd.json');
  const custom = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
  return { ...DEFAULTS, ...custom };
}

const head = () => {
  try { return git('rev-parse', '--verify', 'HEAD'); }
  catch {
    // 첫 커밋 전에는 HEAD가 브랜치 이름만 가리킨다.
    const ref = git('symbolic-ref', 'HEAD');
    if (git('for-each-ref', '--format=%(refname)', ref)) fail('Cannot resolve existing HEAD.');
    return null;
  }
};

// 보호 브랜치로 가는 push가 directPush 경로만 바꾸는 fast-forward인지. 아니면 막을 이유를 돌려준다.
function directPushBlocker(config, localOid, remoteOid) {
  const zero = /^0+$/;
  if (!config.directPush.length) return 'no directPush paths';
  if (zero.test(localOid)) return 'branch deletion';
  if (zero.test(remoteOid)) return 'new branch';
  try { git('cat-file', '-e', `${remoteOid}^{commit}`); } catch { return 'remote commit not fetched'; }
  try { git('merge-base', '--is-ancestor', remoteOid, localOid); } catch { return 'not a fast-forward'; }
  const range = `${remoteOid}..${localOid}`;
  if (git('rev-list', '--merges', range)) return 'merge commit';
  const files = [...new Set(git('-c', 'core.quotePath=false', 'log', '--format=', '--name-only', range).split('\n').filter(Boolean))];
  const outside = files.filter(path => matches(path, GATE_FILES) || !matches(path, config.directPush));
  return outside.length ? `outside directPush: ${outside.join(', ')}` : null;
}

// `git diff -z --name-status` 출력을 [{ kind, paths }]로 나눈다. 이름 변경(R)과 복사(C)는 경로가 둘이다.
// -z는 한글처럼 ASCII가 아닌 경로를 따옴표·8진수로 바꾸지 않는다(core.quotePath 설정과 무관).
function parseNameStatus(text) {
  const fields = text.split('\0');
  const entries = [];
  for (let i = 0; i < fields.length && fields[i];) {
    const kind = fields[i][0];
    const count = kind === 'R' || kind === 'C' ? 2 : 1;
    entries.push({ kind, paths: fields.slice(i + 1, i + 1 + count) });
    i += 1 + count;
  }
  return entries;
}

// 스테이징된 변경 중 사용자 판정이 필요한 것과 그 이유.
function guardedChanges(config) {
  const reasons = [];
  for (const { kind, paths } of parseNameStatus(git('diff', '--cached', '--name-status', '-M', '-z'))) {
    const path = paths.at(-1);
    const add = (why) => reasons.push(`${paths.join(' -> ')}: ${why}`);
    // 이름 변경은 옛 경로도 본다. 보호 대상을 패턴 밖으로 옮기는 것도 보호 대상 변경이다.
    if (paths.some(p => matches(p, GATE_FILES))) add('게이트 파일');
    else if (paths.some(p => matches(p, config.decide))) add('보호 경로');
    const wasTest = kind === 'R' && matches(paths[0], config.tests);
    if (!matches(path, config.tests)) {
      if (wasTest) add('기존 테스트 이동·삭제');
      continue;
    }
    if (kind === 'D') { add('기존 테스트 삭제'); continue; }
    const isNew = kind === 'A' || (kind === 'R' && !wasTest) || kind === 'C';
    const diff = isNew ? '' : git('-c', 'core.quotePath=false', 'diff', '--cached', '-U0', '-M', '--', ...paths);
    if (/^Binary files /m.test(diff)) { add('기존 테스트의 바이너리 변경'); continue; }
    const removed = diff.split('\n').some(l => l.startsWith('-') && !l.startsWith('---'));
    if (removed) add('기존 테스트의 줄 변경·삭제');
    const addedText = isNew
      ? git('show', `:${path}`)
      : diff.split('\n').filter(l => l.startsWith('+') && !l.startsWith('+++')).join('\n');
    if (SKIP_PATTERN.test(addedText)) add('테스트 skip·only 추가');
  }
  return reasons;
}

try {
  const mode = process.argv[2];
  const root = git('rev-parse', '--show-toplevel');
  const approvalPath = git('rev-parse', '--git-path', 'manual-review.json');
  const config = loadConfig(root);

  if (mode === 'approve') {
    if (git('diff', '--name-only')) fail('Unstaged changes remain. Stage reviewed files first.');
    const forIndex = process.argv.indexOf('--for');
    const approval = {
      base: head(),
      tree: git('write-tree'),
      for: forIndex === -1 ? null : process.argv[forIndex + 1],
      at: new Date().toISOString(),
    };
    writeFileSync(approvalPath, JSON.stringify(approval) + '\n');
    appendFileSync(git('rev-parse', '--git-path', 'manual-review.log'), JSON.stringify(approval) + '\n');
    console.log('User review recorded for the staged tree.');
  } else if (mode === 'guarded') {
    const reasons = guardedChanges(config);
    console.log(reasons.length ? reasons.join('\n') : '보호 대상 변경 없음');
  } else if (mode === 'check-commit') {
    const reasons = guardedChanges(config);
    if (reasons.length) {
      const approval = existsSync(approvalPath) ? JSON.parse(readFileSync(approvalPath, 'utf8')) : null;
      if (!approval || head() !== approval.base || git('write-tree') !== approval.tree) {
        fail(`Guarded change needs a recorded user decision:\n  ${reasons.join('\n  ')}`);
      }
    }
  } else if (mode === 'check-push') {
    const updates = readFileSync(0, 'utf8').trim();
    for (const line of updates ? updates.split('\n') : []) {
      const [, localOid, remoteRef, remoteOid] = line.trim().split(/\s+/);
      const branch = remoteRef.replace(/^refs\/heads\//, '');
      if (!config.protectedBranches.includes(branch)) continue;
      const blocker = directPushBlocker(config, localOid, remoteOid);
      if (blocker) {
        fail(`Push to protected branch "${branch}" is blocked (${blocker}). Open a PR and let the user merge it.`);
      }
    }
  } else {
    fail('Usage: node scripts/manual-review.mjs approve [--for ID]|guarded|check-commit|check-push');
  }
} catch (error) {
  console.error(`Manual review gate blocked: ${error.message}`);
  if (process.argv[2] !== 'check-push') {
    console.error('Record approval only after an explicit user PASS, or when the staged change is within a guarded-change cell of an approved plan. Otherwise report the decision with its options and trade-offs.');
  }
  process.exitCode = 1;
}

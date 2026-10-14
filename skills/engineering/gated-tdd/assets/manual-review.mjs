// 승인 게이트. 단위마다 커밋하되(설계 003), 보호 대상 변경만 사용자 판정 기록을 요구하고
// 보호 브랜치(main 등)로의 push는 막아 PR로만 들어가게 한다.
//
//   approve [--for <ID>]  스테이징 트리와 기준 커밋을 판정 기록으로 남긴다 (사용자 "통과" 후에만)
//   guarded               스테이징된 변경 중 보호 대상과 그 이유를 보여 준다
//   check-commit          pre-commit: 보호 대상 변경이 있으면 승인 기록과 대조한다
//   check-push            pre-push: 보호 브랜치로 가는 push와 그 삭제를 막는다
import { execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';

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
  tests: ['*.test.*', '*.spec.*', 'test_*.py', '*_test.py', '*_test.go', '**/__tests__/**', '**/tests/**', '**/test/**'],
  protectedBranches: ['main', 'master'],
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
const matches = (path, globs) => globs.some(glob => globToRegExp(glob).test(glob.includes('/') ? path : basename(path)));

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

// 스테이징된 변경 중 사용자 판정이 필요한 것과 그 이유.
function guardedChanges(config) {
  const reasons = [];
  const lines = git('diff', '--cached', '--name-status', '-M').split('\n').filter(Boolean);
  for (const line of lines) {
    const [status, ...paths] = line.split('\t');
    const path = paths.at(-1);
    const kind = status[0];
    const add = (why) => reasons.push(`${path}: ${why}`);
    if (matches(path, GATE_FILES)) add('게이트 파일');
    else if (matches(path, config.decide)) add('보호 경로');
    if (!matches(path, config.tests)) continue;
    if (kind === 'D') { add('기존 테스트 삭제'); continue; }
    const diff = kind === 'A' ? '' : git('diff', '--cached', '-U0', '-M', '--', ...paths);
    const removed = diff.split('\n').some(l => l.startsWith('-') && !l.startsWith('---'));
    if (removed) add('기존 테스트의 줄 변경·삭제');
    const addedText = kind === 'A'
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
      const [, , remoteRef] = line.trim().split(/\s+/);
      const branch = remoteRef.replace(/^refs\/heads\//, '');
      if (config.protectedBranches.includes(branch)) {
        fail(`Push to protected branch "${branch}" is blocked. Open a PR and let the user merge it.`);
      }
    }
  } else {
    fail('Usage: node scripts/manual-review.mjs approve [--for ID]|guarded|check-commit|check-push');
  }
} catch (error) {
  console.error(`Manual review gate blocked: ${error.message}`);
  if (process.argv[2] !== 'check-push') {
    console.error('Report the decision with its options and trade-offs; wait for explicit user PASS before recording approval.');
  }
  process.exitCode = 1;
}

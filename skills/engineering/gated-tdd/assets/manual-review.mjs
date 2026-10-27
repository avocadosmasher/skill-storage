// 승인 게이트. 단위마다 커밋하되(설계 003), 보호 대상 변경만 사용자 판정 기록을 요구하고
// 보호 브랜치(main 등)로의 push는 막아 PR로만 들어가게 한다.
//
//   approve [--for <ID>]  스테이징 트리와 기준 커밋을 판정 기록으로 남긴다
//                         (사용자 "통과" 후, 또는 판정받은 계획의 보호 대상 변경 칸 범위 안일 때만)
//   guarded               스테이징된 변경 중 보호 대상과 그 이유를 보여 준다
//   check-commit          pre-commit·pre-merge-commit: 보호 대상 변경이 있으면 승인 기록과 대조한다
//                         (원격 보호 브랜치를 병합할 때 그 브랜치가 바꾼 내용 그대로인 파일은 뺀다)
//   check-push            pre-push: 보호 브랜치로 가는 push와 그 삭제를 막는다
//                         (directPush 경로만 바꾸는 fast-forward push는 통과)
//   hooks                 훅 네 개가 실제로 이 게이트를 부르는지, 병합 설정이 맞는지 확인한다
import { execFileSync, spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, posix } from 'node:path';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).replace(/\n$/, '');
const fail = (message) => { throw new Error(message); };

// 게이트 자체는 설정과 무관하게 항상 보호한다. 게이트를 고치는 것도 결정이다.
const GATE_FILES = ['scripts/gated-tdd/**', '.githooks/**', '.gated-tdd.json'];
const HOOKS = ['pre-commit', 'pre-merge-commit', 'pre-push', 'post-commit'];
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

const objectAt = (spec) => { try { return git('rev-parse', '--verify', '-q', spec); } catch { return null; } };

// 병합 중이면, 병합해 들어오는 커밋이 모두 원격 보호 브랜치(origin/main 등)에 이미 있을 때만 그 커밋들을 돌려준다.
// 원격 보호 브랜치에는 사용자가 PR로 고른 것만 들어간다. 로컬 main이나 다른 작업 브랜치는 믿지 않는다.
// 충돌 뒤 git commit(pre-commit)에서는 MERGE_HEAD 파일로, 충돌 없는 병합(pre-merge-commit)에서는
// 아직 그 파일이 없어 git이 넘기는 GITHEAD_<커밋> 환경 변수로 병합해 들어오는 커밋을 안다.
function trustedMergeParents(config) {
  const file = git('rev-parse', '--git-path', 'MERGE_HEAD');
  const shas = existsSync(file)
    ? readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean)
    : Object.keys(process.env).map(key => /^GITHEAD_([0-9a-f]{40,64})$/.exec(key)?.[1]).filter(Boolean);
  if (!shas.length) return [];
  const trusted = git('remote').split('\n').filter(Boolean)
    .flatMap(remote => config.protectedBranches.map(branch => `refs/remotes/${remote}/${branch}`))
    .filter(ref => objectAt(ref));
  const inTrusted = (sha) => trusted.some(ref => {
    try { git('merge-base', '--is-ancestor', sha, ref); return true; } catch { return false; }
  });
  return shas.every(inTrusted) ? shas : [];
}

// 스테이징된 변경 중 사용자 판정이 필요한 것과 그 이유.
function guardedChanges(config) {
  const reasons = [];
  // 믿을 수 있는 병합이면, 스테이징된 내용이 병합해 들어온 쪽과 같고 그쪽이 실제로 바꾼 파일은 이미 판정받은 변경이다.
  // 들어온 쪽이 바꾸지 않은 파일(옛 내용으로 되돌리기)이나 충돌을 풀며 손댄 파일은 그대로 검사한다.
  const parents = trustedMergeParents(config);
  const bases = parents.map(sha => [sha, git('merge-base', 'HEAD', sha)]);
  const fromMain = (path) => bases.some(([sha, base]) => {
    const incoming = objectAt(`${sha}:${path}`);
    return objectAt(`:${path}`) === incoming && incoming !== objectAt(`${base}:${path}`);
  });
  const changes = parseNameStatus(git('diff', '--cached', '--name-status', parents.length ? '--no-renames' : '-M', '-z'));
  for (const { kind, paths } of changes.filter(({ paths }) => !(parents.length && paths.every(fromMain)))) {
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
  } else if (mode === 'hooks') {
    // 훅 관리 도구(husky 등)와 같이 써도 판단할 수 있게, 설정 대신 실제 실행으로 본다.
    // 확인 중에는 .githooks의 각 훅이 표시만 출력하고 멈춘다.
    const problems = [];
    for (const hook of HOOKS) {
      const result = spawnSync('git', ['hook', 'run', '--ignore-missing', hook], {
        cwd: root, encoding: 'utf8', input: '', env: { ...process.env, GATED_TDD_PROBE: '1' },
      });
      const connected = `${result.stdout}${result.stderr}`.includes(`gated-tdd:${hook}`);
      console.log(`${hook}: ${connected ? '연결됨' : '연결 안 됨'}`);
      if (!connected) problems.push(hook);
    }
    const setting = (key) => { try { return git('config', key); } catch { return ''; } };
    for (const [key, want] of [['merge.ff', 'false'], ['pull.ff', 'only']]) {
      const value = setting(key);
      console.log(`${key}: ${value || '(없음)'}${value === want ? '' : ` (필요: ${want})`}`);
      if (value !== want) problems.push(key);
    }
    if (problems.length) fail(`Gate is not fully connected: ${problems.join(', ')}`);
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
    fail('Usage: node scripts/gated-tdd/manual-review.mjs approve [--for ID]|guarded|check-commit|check-push|hooks');
  }
} catch (error) {
  console.error(`Manual review gate blocked: ${error.message}`);
  if (!['check-push', 'hooks'].includes(process.argv[2])) {
    console.error('Record approval only after an explicit user PASS, or when the staged change is within a guarded-change cell of an approved plan. Otherwise report the decision with its options and trade-offs.');
  }
  process.exitCode = 1;
}

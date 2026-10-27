// 예산 신호 (설계 006). 단위 경계(커밋 직후)에서 컨텍스트·사용 한도·세션 단위 수를 보고
// 임계치를 넘었을 때만 한 줄을 출력한다. 에이전트는 git commit 출력에서 이 줄을 읽는다.
//
//   start   세션 시작: 기준 커밋과 시각을 .git/gated-tdd-session.json에 남긴다
//   check   post-commit 훅: 방금 만든 커밋을 세션 기록에 더하고, 임계치를 넘었을 때만 "[예산] ..." 출력.
//           항상 0으로 끝난다
//   status  지금 수치와 판단을 항상 출력한다
//
// 정확한 수치는 도구별 어댑터가 .git/gated-tdd-budget.json에 쓴다:
//   { "at": "<ISO 시각>", "context": 68, "limits": [{ "name": "5시간 한도", "percent": 41 }] }
// 어댑터가 없거나 오래되었으면 대리 지표(세션 시작 이후 이 작업 폴더에서 만든 커밋 수)를 쓴다.
// pull이나 브랜치 전환으로 들어온 커밋은 post-commit 훅을 거치지 않으므로 세지 않는다.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
const readJson = (path) => (existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null);

const DEFAULTS = {
  units: { small: 6, stop: 10 },
  context: { small: 60, stop: 75 },
  limit: { stop: 85 },
  maxAgeMinutes: 10,
};

function config(root) {
  const custom = readJson(join(root, '.gated-tdd.json'))?.budget ?? {};
  return {
    units: { ...DEFAULTS.units, ...custom.units },
    context: { ...DEFAULTS.context, ...custom.context },
    limit: { ...DEFAULTS.limit, ...custom.limit },
    maxAgeMinutes: custom.maxAgeMinutes ?? DEFAULTS.maxAgeMinutes,
  };
}

function headOrNull() {
  try { return git('rev-parse', '--verify', 'HEAD'); } catch { return null; }
}

function unitsSince(base) {
  if (!headOrNull()) return 0;
  try { return Number(git('rev-list', '--count', base ? `${base}..HEAD` : 'HEAD')); }
  catch { return null; } // 기준 커밋이 사라졌으면(리베이스 등) 단위 수를 모른다.
}

export function assess({ units, adapter, limits: cfg, now = Date.now() }) {
  const fresh = adapter && Number.isFinite(Date.parse(adapter.at))
    && now - Date.parse(adapter.at) <= cfg.maxAgeMinutes * 60_000;
  const parts = [];
  let level = 0; // 0 계속, 1 작은 단위만, 2 정지
  const raise = (to) => { level = Math.max(level, to); };

  const context = fresh && Number.isFinite(adapter.context) ? adapter.context : null;
  if (context !== null) {
    parts.push(`컨텍스트 ${Math.round(context)}%`);
    if (context >= cfg.context.stop) raise(2); else if (context >= cfg.context.small) raise(1);
  }
  for (const limit of fresh ? adapter.limits ?? [] : []) {
    if (!Number.isFinite(limit.percent)) continue;
    parts.push(`${limit.name} ${Math.round(limit.percent)}%`);
    if (limit.percent >= cfg.limit.stop) raise(2);
  }
  if (units !== null) {
    parts.unshift(`이번 세션 단위 ${units}개`);
    // 정확한 컨텍스트 수치가 있으면 단위 수는 참고로만 보여 준다.
    if (context === null) {
      if (units >= cfg.units.stop) raise(2); else if (units >= cfg.units.small) raise(1);
    }
  }
  const source = context === null ? '대리 지표: 단위 수' : '어댑터';
  const action = ['계속', '작은 단위만 진행', 'STATUS.md 인계 후 정지 (새 세션 권장)'][level];
  return { level, line: `[예산] ${parts.join(', ') || '수치 없음'} (${source}) → ${action}` };
}

function main() {
  const mode = process.argv[2];
  const root = git('rev-parse', '--show-toplevel');
  const sessionPath = git('rev-parse', '--git-path', 'gated-tdd-session.json');
  if (mode === 'start') {
    writeFileSync(sessionPath, JSON.stringify({ base: headOrNull(), startedAt: new Date().toISOString(), commits: [] }) + '\n');
    console.log('예산: 세션 시작을 기록했습니다.');
    return;
  }
  if (mode !== 'check' && mode !== 'status') {
    console.error('사용법: node scripts/budget.mjs start|check|status');
    process.exitCode = 1;
    return;
  }
  const session = readJson(sessionPath);
  if (mode === 'check' && Array.isArray(session?.commits)) {
    const commit = headOrNull();
    if (commit && !session.commits.includes(commit)) {
      session.commits.push(commit);
      writeFileSync(sessionPath, JSON.stringify(session) + '\n');
    }
  }
  // 예전 형식의 세션 기록(commits 없음)은 기준 커밋 이후 커밋 수로 센다.
  const units = !session ? null : Array.isArray(session.commits) ? session.commits.length : unitsSince(session.base);
  const adapter = readJson(git('rev-parse', '--git-path', 'gated-tdd-budget.json'));
  const result = assess({ units, adapter, limits: config(root) });
  if (mode === 'status' || result.level > 0) console.log(result.line);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { main(); }
  catch (error) {
    // 예산 확인이 실패해도 커밋 흐름은 막지 않는다.
    console.error(`[예산] 확인 실패: ${error.message}`);
  }
}

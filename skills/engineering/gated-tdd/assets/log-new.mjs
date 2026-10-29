#!/usr/bin/env node
// 작업 로그 항목을 하나 만든다: 항목 파일 생성 + 메뉴판(INDEX.md) 한 줄 추가 + 이 브랜치 상태 파일 날짜 갱신.
// 손으로 세 군데를 고치면 언젠가 어긋나므로 한 번에 처리한다.
// 여러 브랜치가 동시에 진행해도 겹치지 않게, 항목 파일은 날짜·작업·ID로 이름 짓고 상태 파일은 브랜치마다 따로 둔다.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
// 하위 폴더에서 실행해도 저장소 루트 기준으로 쓴다.
process.chdir(git('rev-parse', '--show-toplevel'));

const LOG_DIR = 'docs/log';
const INDEX = join(LOG_DIR, 'INDEX.md');
const branch = git('branch', '--show-current');
if (!branch) {
  console.error('브랜치가 아닌 곳(detached HEAD)에서는 기록하지 않습니다. 작업 브랜치로 옮긴 뒤 실행합니다.');
  process.exit(1);
}
const STATUS = `docs/status/${branch.replace(/[\\/]/g, '-')}.md`;

function arg(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

const title = process.argv[2];
const USAGE = '사용법: node scripts/gated-tdd/log-new.mjs "<제목>" [--gate 결정|확인|자동] [--id D09] [--summary "결론 한 줄"] [--status 기록]';
if (!title || title.startsWith('--')) {
  console.error(USAGE);
  process.exit(1);
}

// 게이트 등급마다 기본 상태가 다르다. 자동 단위는 판정을 기다리지 않는다.
const GATE_STATUS = { 결정: '판정 대기', 확인: '확인 대기', 자동: '자동 진행' };
const gate = arg('gate');
if (gate !== undefined && !(gate in GATE_STATUS)) {
  console.error(`--gate는 결정, 확인, 자동 중 하나입니다.\n${USAGE}`);
  process.exit(1);
}

// 제목 "<ID>: <제목>"에서 ID를 잘라 낸다. ID 뒤에 em-dash나 하이픈을 쓴 예전 형식도 읽는다.
const id = arg('id') ?? title.split(/:\s+|\s+\u2014\s+|\s+-\s+/)[0];
const summary = arg('summary') ?? '(결론 한 줄을 채운다: 무엇이 문제였고 어떻게 정했는지)';
const status = arg('status') ?? GATE_STATUS[gate] ?? '판정 대기';
const today = new Date().toISOString().slice(0, 10);

const slug = (arg('id') ?? title)
  .replace(/(:\s|\s+\u2014).*$/, '').replace(/[/\s]+/g, '-').replace(/[^0-9A-Za-z가-힣\-·]/g, '').slice(0, 40) || 'entry';
// 행 ID(A01 등)는 계획마다 다시 시작하므로 작업 이름을 붙인다. 작업 이름은 브랜치의 첫 마디를 뺀 것(feat/login → login).
// ID에 이미 들어 있으면(SPEC-login, FIX-오타) 붙이지 않는다.
const work = (branch.includes('/') ? branch.slice(branch.indexOf('/') + 1) : branch)
  .replace(/[/\s]+/g, '-').replace(/[^0-9A-Za-z가-힣\-·]/g, '');
const hasWork = slug.toLowerCase().includes(work.toLowerCase());
const item = hasWork ? id : `${work} ${id}`;
// 순번 대신 날짜로 이름 짓는다. 순번은 두 브랜치가 같은 번호를 만들어 병합 때 부딪힌다.
const named = hasWork ? slug : `${work}-${slug}`;
let stem = `${today}-${named}`;
for (let n = 2; existsSync(join(LOG_DIR, `${stem}.md`)); n += 1) stem = `${today}-${named}-${n}`;
const file = `${stem}.md`;
const path = join(LOG_DIR, file);

// 파일을 고치기 전에 모두 확인한다. 중간에 실패해 항목 파일만 남으면 다시 실행할 때 기록이 어긋난다.
// 표 구분선은 Prettier 등이 `|------|:---|`처럼 바꿔도 읽는다. 줄바꿈(CRLF/LF)은 원래 파일을 따른다.
if (!existsSync(INDEX)) {
  console.error(`${INDEX}가 없습니다. 도입 때 만드는 파일입니다(SKILL.md 1절).`);
  process.exit(1);
}
const indexText = readFileSync(INDEX, 'utf8');
const eol = indexText.includes('\r\n') ? '\r\n' : '\n';
const index = indexText.split(eol);
const divider = index.findIndex(line => /^\|\s*:?-{3,}:?\s*\|/.test(line));
if (divider === -1) {
  console.error(`${INDEX}에서 표 머리 구분선(| --- |)을 찾지 못했습니다.`);
  process.exit(1);
}

writeFileSync(path, `# ${title} (${today}, ${status})

- 게이트: ${gate ?? ''} (사유: )
- 시작 기준:
- 문제·요청: 
- Red: 
- 수정: 
- 자동 검사: 
- 남은 제약: 
`, 'utf8');

// 메뉴판은 최신이 위. 표 머리(구분선) 바로 다음 줄에 끼운다.
index.splice(divider + 1, 0, `| ${item} | ${today} | ${summary} | ${status} | [${stem}](./${file}) |`);
writeFileSync(INDEX, index.join(eol), 'utf8');

// 이 브랜치의 상태 파일이 없으면(새 브랜치) 틀을 만든다. 칸은 에이전트가 채운다.
if (existsSync(STATUS)) {
  writeFileSync(STATUS, readFileSync(STATUS, 'utf8').replace(/^최종 갱신: .*$/m, `최종 갱신: ${today}`), 'utf8');
} else {
  mkdirSync(dirname(STATUS), { recursive: true });
  writeFileSync(STATUS, `# 상태: ${branch}

최종 갱신: ${today}

## 지금

- 마지막 커밋:
- 판정 대기: 없음
- 확인 대기: 없음
- 다음 할 일:

## 자동 진행 내역 (마지막 정지 보고 이후)

## 최근 3건 (최신이 위)

## 미뤄 둔 작업
`, 'utf8');
  console.log(`이 브랜치의 상태 파일을 만들었습니다: ${STATUS}`);
}

console.log(`만들었습니다: ${path}`);
console.log(`메뉴판에 줄을 넣었습니다: ${INDEX}`);
console.log(`남은 일: 항목 파일을 채우고, 메뉴판의 결론 한 줄과 ${STATUS}의 "지금"·"최근 3건"을 갱신한다.`);

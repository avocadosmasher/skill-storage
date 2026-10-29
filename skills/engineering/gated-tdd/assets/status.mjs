#!/usr/bin/env node
// 세션 시작에 보는 상태 (설계 022). 이 브랜치의 상태 파일 전체, 다른 브랜치의 대기 항목, 미뤄 둔 작업을 한 번에 보여 준다.
// 상태 파일은 브랜치마다 따로 있어(docs/status/<브랜치>.md) 병합 때 부딪히지 않는다.
// 다른 브랜치의 파일은 체크아웃하지 않고 git에서 바로 읽는다. 원격에만 있는 브랜치(다른 PC의 작업)도 본다.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).replace(/\n$/, '');
const tryGit = (...args) => { try { return git(...args); } catch { return null; } };
const lines = (text) => (text ? text.split('\n').filter(Boolean) : []);
const statusPath = (branch) => `docs/status/${branch.replace(/[\\/]/g, '-')}.md`;
const WAITING = /^- (판정 대기|확인 대기|다음 할 일):/;

const root = git('rev-parse', '--show-toplevel');
const configFile = join(root, '.gated-tdd.json');
const protectedBranches = (existsSync(configFile) && JSON.parse(readFileSync(configFile, 'utf8')).protectedBranches)
  || ['main', 'master'];
const current = git('branch', '--show-current');

const refs = lines(git('for-each-ref', '--format=%(refname)', 'refs/heads', 'refs/remotes'));
// 원격 브랜치가 지워진 로컬 브랜치. GitHub의 squash·rebase 병합은 main의 조상이 되지 않아 병합 여부를 알 수 없으므로 따로 표시한다.
const gone = new Set(lines(git('for-each-ref', '--format=%(refname)%09%(upstream:track)', 'refs/heads'))
  .filter(line => line.endsWith('[gone]')).map(line => line.split('\t')[0]));
const nameOf = (ref) => (ref.startsWith('refs/heads/') ? ref.slice('refs/heads/'.length) : ref.split('/').slice(3).join('/'));
// 이름마다 ref 하나. 로컬에 있으면 로컬을, 없으면 원격을 쓴다.
const branches = new Map();
for (const ref of refs) {
  const name = nameOf(ref);
  const local = ref.startsWith('refs/heads/');
  if (!name || name === 'HEAD') continue;
  if (local || !branches.has(name)) branches.set(name, { ref, remoteOnly: !local });
}
// 보호 브랜치(로컬이든 원격이든)에 이미 들어간 브랜치는 끝난 작업이다.
const protectedRefs = refs.filter(ref => protectedBranches.includes(nameOf(ref)));
const merged = (ref) => protectedRefs.some(target => tryGit('merge-base', '--is-ancestor', ref, target) !== null);

const out = [];
const file = statusPath(current || 'HEAD');
if (!current) out.push('## 이 브랜치: (브랜치 아님, detached HEAD)', '', '작업 브랜치로 옮긴 뒤 이어 간다.');
else if (protectedBranches.includes(current)) out.push(`## 이 브랜치: ${current} (보호 브랜치)`, '', '아래에서 이어 갈 브랜치를 고르거나 새 작업 브랜치를 만든다.');
else if (existsSync(join(root, file))) out.push(`## 이 브랜치: ${current} (${file})`, '', readFileSync(join(root, file), 'utf8').trim());
else out.push(`## 이 브랜치: ${current}`, '', `상태 파일 없음. 첫 기록(log-new.mjs) 때 ${file}가 만들어진다.`);

const others = [];
for (const [name, { ref, remoteOnly }] of branches) {
  if (name === current || protectedBranches.includes(name) || name.startsWith('park/') || merged(ref)) continue;
  const text = tryGit('show', `${ref}:${statusPath(name)}`);
  if (text === null) continue;
  const waiting = text.split(/\r?\n/).filter(line => WAITING.test(line)).map(line => line.slice(2));
  const note = remoteOnly ? ' (원격에만 있음)' : gone.has(ref) ? ' (원격 브랜치가 지워짐: PR이 병합됐으면 끝난 작업)' : '';
  others.push(`- ${name}${note}: ${waiting.join(' / ') || '대기 항목 칸 없음'}`);
}
out.push('', '## 다른 브랜치의 대기', '', ...(others.length ? others : ['없음']));

// 미뤄 둔 작업: 이 PC의 stash와, 다른 곳에서도 보이게 올려 둔 park/<브랜치>-<ID> 브랜치. 둘 다 지우기 전까지 여기 남는다.
const parked = [];
// 개인 stash나 다른 도구의 백업(lint-staged 등)은 미뤄 둔 작업이 아니다. 보류 절차가 붙이는 이름만 본다.
const stashes = lines(git('stash', 'list', '--format=%H%x09%gd%x09%gs')).filter(entry => entry.includes('gated-tdd 보류:'));
const parks = [...branches].filter(([name]) => name.startsWith('park/'))
  .map(([name, { ref, remoteOnly }]) => ({ name, sha: git('rev-parse', ref), remoteOnly }));
for (const entry of stashes) {
  const [sha, at, subject] = entry.split('\t');
  const pushed = parks.find(park => park.sha === sha);
  parked.push(`- ${at} ${sha.slice(0, 7)} ${subject}${pushed ? ` (${pushed.name}에도 있음)` : ' (이 PC에만 있음)'}`);
}
for (const park of parks.filter(park => !stashes.some(entry => entry.startsWith(park.sha)))) {
  parked.push(`- ${park.name} ${park.sha.slice(0, 7)}${park.remoteOnly ? ' (원격에만 있음)' : ''}`);
}
out.push('', '## 미뤄 둔 작업', '', ...(parked.length ? parked : ['없음']));

console.log(out.join('\n'));

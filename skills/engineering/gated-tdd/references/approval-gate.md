# 승인 게이트와 예산 신호

## 파일

이 스킬의 `assets/`에 실제 파일이 있다. 저장소로 복사해 쓴다. 스크립트는 프로젝트 파일과 이름이 겹치지 않게
`scripts/gated-tdd/`에 모은다. 게이트 자체의 테스트(`assets/*.test.mjs`)는 이 스킬을 고칠 때 쓰는 것이라 복사하지 않는다.
복사하면 vitest·jest처럼 `*.test.*`를 모두 모아 돌리는 테스트 도구가 그 파일까지 돌려 프로젝트 테스트가 실패한다.

| 스킬 안 파일 | 저장소 위치 | 역할 |
| --- | --- | --- |
| `assets/manual-review.mjs` | `scripts/gated-tdd/manual-review.mjs` | `approve`: 판정 기록 / `guarded`: 보호 대상 변경 목록 / `check-commit`·`check-push`: 훅 검사 / `hooks`: 훅 연결 확인 |
| `assets/budget.mjs` | `scripts/gated-tdd/budget.mjs` | `start`: 세션 시작 기록 / `check`: 임계치 초과 시 한 줄 / `status`: 항상 출력 |
| `assets/log-new.mjs` | `scripts/gated-tdd/log-new.mjs` | 로그 항목 + INDEX 한 줄 + 이 브랜치 상태 파일 날짜, `--gate`로 상태 기본값 |
| `assets/status.mjs` | `scripts/gated-tdd/status.mjs` | 세션 시작 상태: 이 브랜치 상태 파일, 다른 브랜치의 대기 항목, 미뤄 둔 작업 |
| `assets/githooks/pre-commit` | `.githooks/pre-commit` | `check-commit` 호출 |
| `assets/githooks/pre-merge-commit` | `.githooks/pre-merge-commit` | 충돌 없는 병합에서 `check-commit` 호출 |
| `assets/githooks/pre-push` | `.githooks/pre-push` | `check-push` 호출 |
| `assets/githooks/post-commit` | `.githooks/post-commit` | `budget.mjs check` 호출. 커밋을 막지 않음 |

훅은 작업 폴더의 게이트가 아니라 마지막 커밋에 있는 게이트(`HEAD:scripts/gated-tdd/manual-review.mjs`)로 검사한다.
게이트를 고치다 만 채로 두어도 검사가 꺼지지 않는다. 게이트 변경은 커밋된 다음부터 적용된다.
설정 `.gated-tdd.json`도 작업 폴더에서 읽지 않는다. 커밋 검사는 스테이징된 설정(바꿨다면 그 변경 자체가 판정 대상)을,
push 검사와 연결 확인은 마지막 커밋의 설정을 읽는다. 스테이징하지 않은 설정 수정으로 보호 목록을 비워도 검사가 꺼지지 않는다.

## 설치

스크립트와 훅은 Node.js 18 이상과 git 2.36 이상(`git hook run`)으로 돈다. `node --version`, `git --version`으로 확인하고,
없거나 낮으면 도입 결정 보고에 쓴다. Node를 쓰지 않는 저장소도 커밋할 때마다 Node가 필요해진다.

1. 위 표대로 복사하고, 훅 파일 네 개를 스테이징한 뒤 이름을 하나씩 적어 실행 권한을 준다.
   `git update-index --chmod=+x .githooks/pre-commit .githooks/pre-merge-commit .githooks/pre-push .githooks/post-commit`.
   `*`를 쓰지 않는다. PowerShell은 git 명령의 `*`를 파일 이름으로 펼치지 않아 명령이 실패한다.
   `git ls-files -s .githooks`의 네 줄이 모두 `100755`로 시작하는지 확인한다. 권한 없이 커밋되면 macOS·Linux에서 clone한 사람의 훅이 알림 없이 돌지 않는다.
2. 아래 "훅 자리"대로 훅을 켠다.
3. `git config merge.ff false`, `git config pull.ff only`. 앞의 것은 fast-forward 병합(새 커밋 없이 브랜치를 앞으로 옮김)이
   훅을 하나도 거치지 않는 것을 막고, 뒤의 것은 그 때문에 `git pull`이 병합 커밋을 만들지 않게 한다. clone마다 해야 하므로 `AGENTS.md`의 채택 선언에 적는다.
4. `.gitattributes`에 `docs/log/INDEX.md merge=union`과 `.githooks/* text eol=lf`를 더한다(SKILL.md 1절).
5. 저장소의 포맷터·린터·타입 검사(Prettier, ESLint, tsc, lint-staged 등)를 도입 브랜치에서 돌려 본다. `scripts/gated-tdd/`가 걸리면
   그 도구의 제외 목록(`.prettierignore`, ESLint `ignores`, tsconfig `exclude` 등)에 넣는다. 포맷터가 마크다운도 다루면
   `docs/log/INDEX.md`도 넣는다. 표 열 너비를 다시 맞추면 모든 줄이 바뀌어, 병합 때 `merge=union`이 INDEX 줄을 두 벌로 남긴다.
   게이트 파일을 포맷터가 고치면 매번 판정을 요구하고 스킬 원본과도 어긋난다. 제외 목록 파일이 보호 대상이면 도입 판정에 함께 넣는다.
6. `.gated-tdd.json`을 저장소에 맞게 만든다(아래). 사용자가 확정한다.
7. `node scripts/gated-tdd/manual-review.mjs hooks`로 훅 네 개가 모두 `연결됨`이고 두 설정이 맞는지 확인한다.
8. 도입 커밋은 게이트 파일 자체가 보호 대상이므로 사용자 판정 후 `approve --for 도입`으로 커밋한다.
   판정 기록은 스테이징된 트리에 대한 것이므로 `git add` 다음에 `approve`를 실행한다.

## 훅 자리

git은 훅마다 실행할 파일을 한 자리에서만 찾는다(`core.hooksPath`, 없으면 `.git/hooks`). husky, lefthook, pre-commit 같은
훅 관리 도구도 이 자리를 쓴다. 게이트가 그 자리를 가져가면 기존 도구의 lint·테스트가 조용히 꺼지고, 그 도구가 다시 설치되면
(`npm install` 등) 이번에는 게이트가 꺼진다. 그래서 도구 이름 목록으로 판단하지 않고 자리가 비었는지를 본다.

- 자리가 쓰이고 있다: `git config core.hooksPath`에 `.githooks`가 아닌 값이 있거나, `.git/hooks`에 `.sample`로 끝나지 않는 파일
  (Git LFS의 훅 등)이 있다. 저장소에 훅 도구 설정 파일(`.husky/`, `lefthook.yml`, `.pre-commit-config.yaml` 등)이 있거나,
  `.githooks/`에 이 스킬의 훅이 아닌 파일이 이미 있어도 쓰이는 것으로 본다. 기존 `.githooks/` 파일은 덮어쓰지 않는다.
- 비었으면: `git config core.hooksPath .githooks`.
- 쓰이고 있으면: 자리를 바꾸지 않는다. 그 도구의 훅 네 개(`pre-commit`, `pre-merge-commit`, `pre-push`, `post-commit`)
  맨 앞에서 `.githooks/<훅>`을 부르게 한다. 인자(`"$@"`)와 표준 입력을 그대로 넘기고, 실패하면 그 훅도 실패하게 한다.
  husky면 `.husky/<훅>` 파일 맨 위에 `.githooks/<훅> "$@" || exit $?` 한 줄을 넣는다(없는 훅은 그 한 줄로 새로 만든다).
  그 밖의 도구는 그 도구의 설정 방식으로 같은 일을 하고, 어떻게 넣을지 확실하지 않으면 도입 보고에서 사용자에게 묻는다.
  이때 `AGENTS.md`의 "새로 clone하면" 줄에는 `core.hooksPath` 대신 그 도구를 켜는 명령을 쓴다.
- **pre-push의 표준 입력**: git은 무엇을 어디로 올리는지 pre-push의 표준 입력으로 넘긴다. 게이트는 이것을 보고 main push를 막으므로,
  입력이 빠지면 main push가 그대로 통과한다.
  - lefthook은 그 명령에 `use_stdin: true`를 둔다.
  - pre-commit(Python) 프레임워크는 입력을 자기가 읽고 훅에 넘기지 않는다. 그 도구에 pre-push를 맡기지 않는다.
    그 도구가 pre-push를 쓰지 않으면 `.git/hooks/pre-push`를 `exec .githooks/pre-push "$@"` 한 줄로 만들고 "새로 clone하면" 줄에도 적는다.
    그 도구가 pre-push도 쓰면 도입 보고에서 묻는다.
  - 같은 입력이 필요한 다른 pre-push(Git LFS 등)와 한 파일에 이어 붙이면, 게이트가 입력을 다 읽어 뒤 명령이 빈 입력을 받는다.
    입력을 변수에 담아 두 번 넘긴다: `input=$(cat)`, `printf '%s\n' "$input" | .githooks/pre-push "$@" || exit $?`, 그다음 원래 명령에도 `printf '%s\n' "$input" |`를 붙인다.
- 어느 쪽이든 7단계의 `hooks` 확인이 기준이다. 확인할 때 `.githooks`의 각 훅은 표시만 출력하고 종료 코드 3으로 멈추므로,
  같은 훅에 이어진 다른 도구의 명령(lint, 테스트)은 돌지 않는다. 확인은 세 가지를 본다. 게이트가 불리는지(`연결 안 됨`),
  게이트의 실패가 git까지 전달되는지(`실패가 전달되지 않음`: 이어 붙인 줄에 `|| exit $?`가 없는 경우 등),
  pre-push에 push 정보가 넘어오는지(`push 정보가 전달되지 않음`).

## 무엇을 막나

- `pre-commit`, `pre-merge-commit`: 스테이징된 변경이 아래에 해당하면, 그 트리에 대한 판정 기록(`approve`)이 있어야 커밋된다.
  - 게이트 파일: `scripts/gated-tdd/**`, `.githooks/**`, `.gated-tdd.json` (설정과 무관하게 항상)
  - 보호 경로: `decide`에 맞는 파일
  - 테스트 파일(`tests`에 맞음)의 기존 줄 변경·삭제, 파일 삭제, skip·only 추가, 스냅숏 이미지 같은 바이너리 파일 변경. 새 테스트를 덧붙이는 것은 자유다.
  - 이름 변경은 옛 경로와 새 경로를 모두 본다. 보호 경로나 테스트를 패턴 밖으로 옮기는 것도 보호 대상 변경이다.
- `pre-push`: `protectedBranches`로 가는 push와 그 브랜치 삭제. 작업 브랜치 push는 자유다.
  예외: 올리는 커밋이 모두 `directPush` 경로만 바꾸는 fast-forward면 통과한다. 게이트 파일, 병합 커밋, 새 브랜치,
  강제 push는 경로와 무관하게 막는다.

### main을 병합할 때

작업 브랜치에 main을 병합하면, main에 이미 들어간 보호 대상 변경(다른 PR에서 판정받은 의존성, 마이그레이션 등)이
스테이징된 변경으로 다시 보인다. 그래서 병합해 들어오는 커밋이 **모두 믿는 원격의 보호 브랜치(`origin/main` 등)에 있을 때만**
파일마다 아래 두 조건이 모두 맞으면 검사에서 뺀다. 믿는 원격은 `trustedRemote`(기본 `origin`) 하나다. 협업자의 fork처럼
나중에 더한 원격의 `main`에는 리뷰받지 않은 커밋이 있을 수 있다.

1. 스테이징된 내용이 병합해 들어오는 쪽의 내용과 같다(충돌을 풀며 손대지 않았다).
2. 병합해 들어오는 쪽이 실제로 그 파일을 바꿨다(공통 조상과 다르다).

로컬 main이나 다른 작업 브랜치를 병합하면 아무것도 빼지 않는다. 원격 보호 브랜치에는 사용자가 PR로 고른 것만 들어가지만,
로컬 브랜치에는 판정받지 않은 커밋이 있을 수 있다. 2번 조건은 main이 바꾸지 않은 파일을 옛 내용으로 되돌리는 병합을 막는다.
양쪽이 모두 고친 파일(main에서 바뀐 `package.json`에 이 브랜치도 의존성을 더함, main에서 바뀐 테스트에 이 브랜치도 줄을 더함)은
병합 결과가 양쪽 어느 것과도 달라 판정이 필요하다. 판정 ID는 `MERGE-main-<날짜>`이고 보고 방법은 SKILL.md 5절에 있다.

rebase, cherry-pick, revert, fast-forward 병합은 `pre-commit`도 `pre-merge-commit`도 거치지 않는다. 그래서 설치에서
`merge.ff false`를 켜고, SKILL.md 5절에서 이 명령들을 쓰지 않게 한다. 훅은 로컬에서만 돌므로 무료 요금제의 비공개 저장소처럼
서버 쪽 보호가 없는 곳에서는 이 규칙과 PR 병합 선택이 마지막 방어선이다.

계획 작업 표의 보호 대상 변경 칸에 적어 판정받은 변경은 그 계획 판정으로 `approve`한다(SKILL.md 3절 8단계).
훅은 칸의 범위를 검사하지 않는다. 범위 대조는 에이전트가 하고, 애매하면 결정으로 올린다.

판정 기록은 `.git/manual-review.json`(마지막 판정)과 `.git/manual-review.log`(이력)에 남고 버전 관리하지 않는다.
훅은 대화를 읽지 못하므로 실제 사용자 판정 확인은 에이전트의 책임이다. 미스테이징·미추적 변경은 검사하지 않는다.
경로는 `.gitignore`처럼 맞춘다: 슬래시가 없는 패턴은 어느 폴더의 파일 이름에도 맞고, `**`는 여러 폴더에 맞는다.

## `.gated-tdd.json`

없으면 기본값을 쓴다. 적은 키는 기본값을 통째로 바꾼다(`decide`를 적으면 기본 목록 대신 그 목록을 쓴다).

```json
{
  "decide": [
    "**/migrations/**", "**/migrate/**", "*.sql", "schema.prisma",
    "package.json", "requirements*.txt", "pyproject.toml", "go.mod", "Cargo.toml", "Gemfile", "pom.xml", "build.gradle*",
    ".env*", "*.pem", "*.key",
    "Dockerfile*", "docker-compose*.yml", "docker-compose*.yaml", "*.tf", ".github/workflows/**"
  ],
  "tests": ["*.test.*", "*.spec.*", "test_*.py", "*_test.py", "*_test.go", "**/__tests__/**", "**/tests/**", "**/test/**",
    "**/__snapshots__/**", "**/*-snapshots/**"],
  "protectedBranches": ["main", "master"],
  "trustedRemote": "origin",
  "directPush": [],
  "budget": {
    "units": { "small": 6, "stop": 10 },
    "context": { "small": 60, "stop": 75 },
    "limit": { "stop": 85 },
    "maxAgeMinutes": 10
  }
}
```

인증·권한처럼 저장소마다 위치가 다른 보호 대상은 `decide`에 직접 더한다(예: `"src/auth/**"`).
그 코드가 아직 없으면 그 영역을 처음 만드는 기능의 계획에서 더한다. `.gated-tdd.json` 변경을 그 행의 보호 대상 변경 칸에
적어 계획 보고에서 판정받는다(초기 개발은 골격의 "게이트 설정" 행).

`trustedRemote`는 PR이 병합되는 원격이다. fork에서 작업하고 PR을 원래 저장소로 보내는 흐름이면 그 원격 이름(예: `"upstream"`)으로 바꾼다.

`directPush`는 개발 절차 밖에서 main으로 바로 올리던 경로다(예: 블로그 글 `"content/posts/**"`). 기본은 비어 있다.
코드처럼 실행되거나 빌드에 영향을 주는 파일(MDX, 설정, 스크립트)은 넣지 않는다. 넣어야 하면 그 위험을 도입 보고에 쓴다.

## 예산 신호

`post-commit` 훅이 커밋 직후 `budget.mjs check`를 실행한다. 어떤 에이전트든 `git commit` 출력을 읽으므로
도구와 무관하게 전달된다. 임계치를 넘지 않으면 아무것도 출력하지 않는다.

| 수치 | 출처 | 규칙 (기본값) |
| --- | --- | --- |
| 컨텍스트 사용률 | 어댑터 | 60% 이상 작은 단위만, 75% 이상 정지 |
| 사용 한도 사용률 | 어댑터 | 85% 이상 정지 |
| 이번 세션 단위 수 | `budget.mjs start` 이후 이 작업 폴더에서 만든 커밋 수 (pull로 받은 커밋은 세지 않음) | 컨텍스트 수치가 없을 때만 판단에 씀. 6개 이상 작은 단위만, 10개 이상 정지 |

### 어댑터 계약

에이전트 도구가 사용량을 알 수 있으면, 어댑터가 커밋 전에 `.git/gated-tdd-budget.json`을 쓴다.
`maxAgeMinutes`보다 오래된 파일은 무시한다.

```json
{ "at": "2026-10-14T12:00:00Z", "context": 68, "limits": [{ "name": "5시간 한도", "percent": 41 }] }
```

- Claude Code: 선택 설치 mod `gated-tdd-budget`이 `git commit`을 실행하는 Bash·PowerShell 호출 직전에 이 파일을 쓴다. 사용자에게 마켓플레이스 추가(`claude plugin marketplace add avocadosmasher/skill-storage`, 이미 했으면 생략)와 `claude plugin install gated-tdd-budget@avocadosmasher`를 안내한다. 작업 폴더에서 위로 찾은 저장소에만 쓴다.
- 사용량을 알 방법이 없는 도구(현재 Codex 훅 입력에는 사용량 필드가 없음)는 대리 지표만 쓴다.

## 예전 배치에서 옮기기

skill-storage 1.9.0 전에 도입한 저장소는 스크립트가 `scripts/` 바로 아래에(`scripts/manual-review.mjs`), 상태가 저장소 맨 위
`STATUS.md`에 있다. 세션 시작에서 이 배치를 보면 다른 작업 전에 한 번 옮긴다. 게이트 파일이 바뀌므로 결정 보고 한 번(판정 ID `도입-갱신`)으로 받는다.
작업은 main에서 딴 `chore/gated-tdd-update` 브랜치에서 하고, 통과하면 도입처럼 바로 PR을 연다. 진행 중인 기능 브랜치는 이 PR이 병합된 뒤 옮긴다(아래).

1. `git mv`로 `scripts/manual-review.mjs`, `scripts/budget.mjs`, `scripts/log-new.mjs`를 `scripts/gated-tdd/`로 옮기고,
   이 스킬의 `assets/`에서 새 버전과 `status.mjs`로 덮어쓴다. `scripts/manual-review.test.mjs`, `scripts/budget.test.mjs`는 지운다.
2. `.githooks/`를 새 훅 네 개로 바꾸고 설치 1~5단계를 한다(실행 권한, 훅 자리, 병합 설정, `.gitattributes`, 포맷터 제외).
3. main의 `STATUS.md`는 `git rm`으로 지운다. main의 상태는 끝난 작업의 기록이라 옮길 브랜치가 없다. 미뤄 둔 작업처럼 남길 줄이 있으면
   `docs/status/chore-gated-tdd-update.md`에 옮겨 적는다.
4. `AGENTS.md`의 채택 선언과 `CLAUDE.md` 첫 줄을 SKILL.md 1절의 새 문구로 바꾼다.
5. 기존 로그 파일(`01-...`)은 그대로 둔다. 새 항목부터 새 이름을 쓴다.
6. `hooks` 확인이 통과하면 보고한다.

옮기는 커밋은 새 훅이 검사한다. 마지막 커밋에 새 게이트가 아직 없으므로 이 한 번은 작업 폴더의 새 게이트로 검사한다.

**진행 중인 기능 브랜치**는 옮기기 PR이 병합된 뒤, 그 브랜치에서 처음 세션을 열 때 옮긴다.
1. 병합 전에 그 브랜치의 `STATUS.md` 내용을 확인해 둔다(`git show HEAD:STATUS.md`).
2. `git fetch` 후 `git merge origin/main`. 그 브랜치가 `STATUS.md`를 고쳤으면 main은 지웠으므로 충돌이 난다.
3. 확인해 둔 내용을 `docs/status/<그 브랜치>.md`로 옮겨 적고(칸 이름은 SKILL.md 1절에 맞춤) `STATUS.md`는 지운 채로 병합을 끝낸다.
   새 스크립트와 훅은 원격 main에서 그대로 들어온 것이라 다시 판정받지 않는다.

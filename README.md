# skill-storage

직접 만들어 매일 쓰는 에이전트 스킬 모음입니다.

스킬은 작고, 고치기 쉽고, 서로 조합해 쓸 수 있게 만듭니다. Claude Code를 기준으로 쓰지만 Codex 등 [Agent Skills](https://agentskills.io) 표준을 읽는 에이전트에서도 동작합니다. 가져가서 자기 방식대로 고쳐 쓰세요.

## 설치

두 가지 방법이 있습니다. **플러그인**(Claude Code, Codex)은 전체 묶음을 읽기 전용으로 설치하고 업데이트를 받아 쓰는 방식이고, **skills.sh**는 스킬 파일을 내 프로젝트에 복사해 직접 고쳐 쓰는 방식입니다. 에이전트마다 둘 중 하나만 고르세요. 둘 다 설치하면 같은 스킬이 두 번 잡힙니다.

<details>
<summary><strong>Claude Code</strong></summary>

```bash
claude plugin marketplace add avocadosmasher/skill-storage
claude plugin install skill-storage@avocadosmasher
```

세션 안에서는 `/plugin marketplace add avocadosmasher/skill-storage` → `/plugin install skill-storage@avocadosmasher`.

설치된 스킬은 `skill-storage:gated-tdd`처럼 플러그인 이름이 앞에 붙습니다. 업데이트는 `claude plugin marketplace update avocadosmasher`로 받거나, `/plugin` → Marketplaces에서 자동 업데이트를 켭니다.

Claude Code에서만 쓰는 선택 설치 mod는 [아래 절](#선택-설치-mod-claude-code-전용)에 따로 정리했습니다.

</details>

<details>
<summary><strong>Codex</strong></summary>

```bash
codex plugin marketplace add avocadosmasher/skill-storage
codex plugin add skill-storage@avocadosmasher
```

Codex는 이 저장소의 Claude Code 마켓플레이스 매니페스트를 그대로 읽습니다. 업데이트는 `codex plugin marketplace upgrade avocadosmasher`로 받습니다. 마켓플레이스를 새로 받으면 설치된 플러그인도 새 버전으로 바뀝니다.

</details>

<details>
<summary><strong>skills.sh (Codex, 그 밖의 에이전트)</strong></summary>

```bash
npx skills@latest add avocadosmasher/skill-storage
```

설치할 스킬과 에이전트를 고를 수 있습니다. 스킬 하나만 받으려면 `--skill=<이름>`을 붙입니다.

</details>

<details>
<summary><strong>직접 복사</strong></summary>

스킬 폴더를 통째로 복사합니다. 폴더 안의 `assets/`, `scripts/`, `references/`까지 함께 가져가야 합니다.

```
skills/engineering/gated-tdd       → ~/.claude/skills/gated-tdd
skills/engineering/capture-compare → ~/.claude/skills/capture-compare
```

Codex 등은 `~/.agents/skills/`에 같은 방식으로 복사합니다.

</details>

## 선택 설치: mod (Claude Code 전용)

일부 스킬에는 Claude Code의 화면이나 동작을 돕는 mod가 따로 있습니다. 스킬은 mod 없이도 동작하고, mod는 있으면 더 편해지는 보조 장치입니다.

mod는 설치한 세션에서 파일을 읽고 쓰는 등 스킬보다 넓은 권한으로 동작합니다. 그래서 `skill-storage`에 넣지 않고 마켓플레이스의 별도 플러그인으로 두었습니다. `skill-storage`를 설치해도 따라 들어가지 않으니 코드를 확인하고 원하는 것만 설치하세요. Codex와 skills.sh 설치에는 해당하지 않습니다.

| mod | 하는 일 | 함께 쓰는 스킬 | 쓰는 권한 |
| --- | --- | --- | --- |
| [idea-bank-viewer](./mods/idea-bank-viewer/) | `/ideas`로 저장한 아이디어를 패널에서 훑어보고 검색한다 | `idea-banking` | 파일 읽기(아이디어 폴더), 환경 변수 읽기(`IDEA_BANK_PATH`, `HOME`, `USERPROFILE`). 파일 쓰기·프로세스 실행·네트워크는 쓰지 않는다 |
| [gated-tdd-budget](./mods/gated-tdd-budget/) | `git commit` 직전에 컨텍스트 사용률과 사용 한도를 `.git/gated-tdd-budget.json`에 남겨, 예산 신호가 단위 수 대신 실제 수치로 판단하게 한다 | `gated-tdd` | 세션 사용량 읽기, 파일 읽기(작업 폴더에서 위로 `.git` 찾기), 파일 쓰기(`.git/gated-tdd-budget.json` 하나). 프로세스 실행·네트워크·환경 변수는 쓰지 않는다 |

### 설치

1. 마켓플레이스를 추가합니다. 위 "설치"에서 이미 했다면 건너뜁니다.
   ```bash
   claude plugin marketplace add avocadosmasher/skill-storage
   ```
2. 원하는 mod만 설치합니다. 세션 안에서는 `/plugin install <mod 이름>@avocadosmasher`.
   ```bash
   claude plugin install idea-bank-viewer@avocadosmasher
   claude plugin install gated-tdd-budget@avocadosmasher
   ```
3. Claude Code를 다시 시작합니다. 세션을 유지하려면 `/reload-plugins`를 실행합니다.
4. 동작을 확인합니다.
   - `idea-bank-viewer`: `/ideas`를 입력하면 아이디어 패널이 열립니다.
   - `gated-tdd-budget`: `gated-tdd`를 도입한 저장소에서 커밋한 뒤 `node scripts/budget.mjs status`를 실행하면 `(어댑터)`가 보입니다.

설치하기 전에 mod가 실제로 부르는 기능을 직접 확인할 수 있습니다. 저장소를 받은 뒤 `claude plugin validate mods/<mod 이름>`을 실행하면 위 표의 권한과 같은 호출 목록이 나옵니다.

### 업데이트와 제거

```bash
claude plugin marketplace update avocadosmasher        # 새 버전 목록 받기
claude plugin update <mod 이름>@avocadosmasher          # 받은 뒤 다시 시작해야 반영됨
claude plugin uninstall <mod 이름>@avocadosmasher       # 제거
```

### 동작하지 않을 때

- 설치나 업데이트 뒤 다시 시작했는지 확인합니다.
- Claude Code 버전에 따라 mod(함수 훅)를 켜려면 환경 변수 `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1`이 필요할 수 있습니다.
- mod마다 자세한 사용법과 한계는 함께 쓰는 스킬의 설명 페이지에 있습니다: [idea-banking](./docs/productivity/idea-banking.md), [gated-tdd](./docs/engineering/gated-tdd.md).

## 왜 이 스킬들이 있나

### 에이전트가 "다 됐다"고 하는데 실제로는 안 된다

자동 테스트가 통과해도 화면이나 실제 동작은 사람이 봐야 압니다. 그렇다고 모든 단계를 승인하면 내용을 보지 않고 넘기게 됩니다. [`gated-tdd`](./skills/engineering/gated-tdd/SKILL.md)는 작은 작업을 테스트 먼저 만들어 단위마다 커밋하고, 사람에게는 AI가 대신 정할 수 없는 결정과 직접 해볼 수 있는 기능 묶음의 확인만 묻습니다. 마이그레이션이나 테스트 기대값 변경처럼 보호 대상인 변경을 판정 없이 커밋하거나 main에 직접 push하면 git 훅이 막습니다.

### 시각적인 결정을 말로 주고받느라 왕복이 길어진다

"화살표를 좀 더 굵게"처럼 말로 설명하면 서로 머릿속 그림이 다릅니다. [`capture-compare`](./skills/engineering/capture-compare/SKILL.md)는 코드를 고치기 전에 후보 3~4개를 같은 조건에서 캡처해 한 장에 나란히 보여 주고 고르게 합니다.

### 계획에 "네, 좋아요"만 하다가 나중에 뒤집힌다

에이전트가 만든 계획에 고개만 끄덕이면 정작 중요한 결정은 아무도 내리지 않은 채 넘어갑니다. [`grill-me-plus`](./skills/productivity/grill-me-plus/SKILL.md)는 되돌리기 어려운 결정부터 하나씩 묻고, 답할 지식이 없는 질문은 배우거나 조사 과제로 남기게 하며, 정한 것은 바로 `DECISIONS.md`에 적습니다.

## 스킬 목록

**User-invoked** 스킬은 사용자가 `/이름`으로 직접 실행할 때만 동작합니다. **Model-invoked** 스킬은 사용자가 실행할 수도 있고, 상황이 맞으면 에이전트가 알아서 불러 씁니다.

### Engineering

코드 작업에 매일 쓰는 스킬.

**Model-invoked**

- **[gated-tdd](./skills/engineering/gated-tdd/SKILL.md)**: 작은 작업 단위로 테스트를 먼저 만들고 단위마다 커밋하되, 사용자는 AI가 대신 정할 수 없는 결정과 직접 해볼 수 있는 기능 묶음만 판정하는 개발 절차. 나머지는 기록과 알림을 남기고 자동으로 진행한다. 승인 게이트·예산 신호 스크립트, git 훅, 작업 기록 스크립트 포함.
- **[capture-compare](./skills/engineering/capture-compare/SKILL.md)**: 시각 결정 전에 후보 여러 개를 같은 조건에서 캡처해 비교 시트(PNG)로 보여 주고 고르게 하는 절차. Playwright 스크립트 포함.
- **[archify](./skills/engineering/archify/SKILL.md)**: 아이디어, 계획, 코드베이스를 탐색 가능한 인터랙티브 HTML 다이어그램(아키텍처·워크플로·시퀀스·데이터플로·라이프사이클)으로 만든다. Mermaid 입력을 그대로 베끼지 않고 새로 그리며 PNG/JPEG/WebP/SVG/WebM로도 내보낸다. tt-a1i의 `archify`를 그대로 옮겼다([CREDITS](./skills/engineering/archify/CREDITS.md)).
- **[find-skills](./skills/engineering/find-skills/SKILL.md)**: 사용자가 원하는 기능이 이미 설치할 수 있는 스킬로 있는지 `npx skills` CLI로 찾아보고, 설치 수와 출처를 확인해 추천한다. Vercel의 `skills` 저장소에 있는 스킬을 그대로 옮겼다([CREDITS](./skills/engineering/find-skills/CREDITS.md)).

### Productivity

코드 밖의 업무에 쓰는 스킬.

**Model-invoked**

- **[eli5](./skills/productivity/eli5/SKILL.md)**: 아무것도 모르는 사람에게 설명하듯, 큰 그림과 아주 적은 글로 된 HTML 페이지를 만들어 주제를 설명한다. Thariq Shihipar의 커뮤니티 플러그인을 그대로 옮겼다([CREDITS](./skills/productivity/eli5/CREDITS.md)).
- **[grill-me-plus](./skills/productivity/grill-me-plus/SKILL.md)**: 계획이나 설계를 위험한 결정부터 집요하게 캐물어 공통 이해에 이르고, 정한 결정을 `DECISIONS.md`에 바로바로 기록한다. Matt Pocock의 `grill-me`를 바탕으로 했다([CREDITS](./skills/productivity/grill-me-plus/CREDITS.md)).
- **[jasoseo-coach](./skills/productivity/jasoseo-coach/SKILL.md)**: 헤드헌터 관점으로 자기소개서를 함께 쓰고 검토한다. 재료 수집, JD 리서치, 초안, 글자수 관리, 검토 루프, 면접 예상 질문까지.
- **[idea-banking](./skills/productivity/idea-banking/SKILL.md)**: 떠오른 도구·스킬·자동화·학습 아이디어를 원문 그대로 로컬 Markdown 파일에 바로 기록하고, 나중에 검색·비교·구체화한다. `/ideas` 패널 mod를 따로 설치할 수 있다.
- **[thinking-aloud-writing](./skills/productivity/thinking-aloud-writing/SKILL.md)**: 공부 자료·Git 저장소·개발 기록·기존 초안으로 기술 블로그 글을 함께 기획하고 쓴다. 독자가 이해할 순서로 구성을 잡고, 빈틈은 인터뷰로 채우며, 질문을 던지고 답을 회수하는 설명과 친근한 구어체로 쓴다.

## 저장소 구조

```
skills/
  engineering/     코드 작업용 (정식 공개, 플러그인에 포함)
  productivity/    코드 밖 업무용 (정식 공개, 플러그인에 포함)
  misc/            보관용, 공개 목록과 플러그인에서 제외
  in-progress/     베타, 공개는 하되 플러그인에서 제외
  deprecated/      더 쓰지 않음
mods/                  선택 설치하는 Claude Code mod (마켓플레이스의 별도 플러그인)
docs/<분류>/<스킬>.md   사람이 읽는 스킬 설명
.claude-plugin/        플러그인과 마켓플레이스 정의
.agents/               이 저장소를 관리하는 규칙과 설계 결정
```

이슈와 제안의 기준은 [SCOPE.md](./SCOPE.md)를 봐 주세요.

## 라이선스

[MIT](./LICENSE)

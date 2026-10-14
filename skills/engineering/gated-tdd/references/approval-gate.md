# 승인 게이트와 예산 신호

## 파일

이 스킬의 `assets/`에 실제 파일이 있다. 저장소로 복사해 쓴다.

| 스킬 안 파일 | 저장소 위치 | 역할 |
| --- | --- | --- |
| `assets/manual-review.mjs` | `scripts/manual-review.mjs` | `approve`: 판정 기록 / `guarded`: 보호 대상 변경 목록 / `check-commit`·`check-push`: 훅 검사 |
| `assets/manual-review.test.mjs` | `scripts/manual-review.test.mjs` | 격리된 임시 저장소에서 게이트 동작 검증 (`node --test`) |
| `assets/budget.mjs` | `scripts/budget.mjs` | `start`: 세션 시작 기록 / `check`: 임계치 초과 시 한 줄 / `status`: 항상 출력 |
| `assets/budget.test.mjs` | `scripts/budget.test.mjs` | 예산 판단과 출력 검증 |
| `assets/githooks/pre-commit` | `.githooks/pre-commit` | `check-commit` 호출 |
| `assets/githooks/pre-push` | `.githooks/pre-push` | `check-push` 호출 |
| `assets/githooks/post-commit` | `.githooks/post-commit` | `budget.mjs check` 호출. 커밋을 막지 않음 |
| `assets/log-new.mjs` | `scripts/log-new.mjs` | 로그 항목 + INDEX 한 줄 + STATUS 날짜, `--gate`로 상태 기본값 |

## 설치

1. 위 표대로 복사하고 훅에 실행 권한을 준다(`chmod +x .githooks/*`).
2. `git config core.hooksPath .githooks`. 기존 훅 경로가 있으면 통합한다.
3. `.gated-tdd.json`을 저장소에 맞게 만든다(아래). 사용자가 확정한다.
4. `node --test scripts/manual-review.test.mjs scripts/budget.test.mjs`로 확인한다.
5. 도입 커밋은 게이트 파일 자체가 보호 대상이므로 사용자 판정 후 `approve --for 도입`으로 커밋한다.

## 무엇을 막나

- `pre-commit`: 스테이징된 변경이 아래에 해당하면, 그 트리에 대한 판정 기록(`approve`)이 있어야 커밋된다.
  - 게이트 파일: `scripts/manual-review.mjs`, `scripts/budget.mjs`, `.githooks/**`, `.gated-tdd.json` (설정과 무관하게 항상)
  - 보호 경로: `decide`에 맞는 파일
  - 테스트 파일(`tests`에 맞음)의 기존 줄 변경·삭제, 파일 삭제, skip·only 추가. 새 테스트를 덧붙이는 것은 자유다.
- `pre-push`: `protectedBranches`로 가는 push와 그 브랜치 삭제. 작업 브랜치 push는 자유다.

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
  "tests": ["*.test.*", "*.spec.*", "test_*.py", "*_test.py", "*_test.go", "**/__tests__/**", "**/tests/**", "**/test/**"],
  "protectedBranches": ["main", "master"],
  "budget": {
    "units": { "small": 6, "stop": 10 },
    "context": { "small": 60, "stop": 75 },
    "limit": { "stop": 85 },
    "maxAgeMinutes": 10
  }
}
```

인증·권한처럼 저장소마다 위치가 다른 보호 대상은 `decide`에 직접 더한다(예: `"src/auth/**"`).

## 예산 신호

`post-commit` 훅이 커밋 직후 `budget.mjs check`를 실행한다. 어떤 에이전트든 `git commit` 출력을 읽으므로
도구와 무관하게 전달된다. 임계치를 넘지 않으면 아무것도 출력하지 않는다.

| 수치 | 출처 | 규칙 (기본값) |
| --- | --- | --- |
| 컨텍스트 사용률 | 어댑터 | 60% 이상 작은 단위만, 75% 이상 정지 |
| 사용 한도 사용률 | 어댑터 | 85% 이상 정지 |
| 이번 세션 단위 수 | `budget.mjs start` 이후 커밋 수 | 컨텍스트 수치가 없을 때만 판단에 씀. 6개 이상 작은 단위만, 10개 이상 정지 |

### 어댑터 계약

에이전트 도구가 사용량을 알 수 있으면, 어댑터가 커밋 전에 `.git/gated-tdd-budget.json`을 쓴다.
`maxAgeMinutes`보다 오래된 파일은 무시한다.

```json
{ "at": "2026-10-14T12:00:00Z", "context": 68, "limits": [{ "name": "5시간 한도", "percent": 41 }] }
```

- Claude Code: 선택 설치 mod `gated-tdd-budget`이 `git commit`을 실행하는 Bash 호출 직전에 이 파일을 쓴다. 사용자에게 `claude plugin install gated-tdd-budget@avocadosmasher`를 안내한다. 작업 폴더에서 위로 찾은 저장소에만 쓴다.
- 사용량을 알 방법이 없는 도구(현재 Codex 훅 입력에는 사용량 필드가 없음)는 대리 지표만 쓴다.

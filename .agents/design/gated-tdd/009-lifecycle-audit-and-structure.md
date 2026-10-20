# 009. 작업 유형별 절차는 한 스킬 안에서 references로 나눈다

- 날짜: 2026-10-16
- 상태: 채택
- 반영: skill-storage 1.7.0

## 배경

사용자가 두 가지를 물었다. 요구사항 수집이나 기능 명세 추출처럼 계획 이전 단계를 이 스킬이 다루는지, 그리고 계획 파일이 `<기능>-개발계획.md`뿐인데 프로젝트를 처음 시작할 때부터 써도 되는지였다.
이어서 "초기 개발, 유지보수 개발 등에서 부족한 부분을 정의하고 개선하고 싶다"고 요청했다. 필요하면 `find-skills`로 다른 스킬을 찾아 참고해도 된다고 했다.

1.6.0까지의 스킬은 "무엇을 만들지 정해진 기능을, 테스트 도구가 갖춰진 저장소에서 새로 만드는" 경우에 맞춰져 있었다. 점검 결과는 아래와 같다.

| ID | 영역 | 빈 곳 |
| --- | --- | --- |
| G1 | 초기 개발 | 요구사항 수집과 명세. 2절 계획이 "만들 것이 정해짐"을 전제했고 명세 문서 위치가 없었다 |
| G2 | 초기 개발 | 프로젝트 전체 분해. 계획이 기능 단위뿐이라 기능 사이의 의존과 순서를 담을 상위 층이 없었다 |
| G3 | 초기 개발 | 빈 저장소 부트스트랩. 도입 절차가 테스트 도구가 이미 있다고 가정했다 |
| G4 | 초기 개발 | 버리는 실험(spike). "위험한 외부 연동은 최소 실험" 한 줄뿐이었다 |
| M1 | 유지보수 | 버그 수정 흐름. 재현 루프, 최소화, 가설, 맞는 위치의 회귀 테스트가 없었다 |
| M2 | 유지보수 | 작업 크기별 강도. 저장소 규칙으로 채택하면 작은 수정도 계획 문서를 거쳐야 했다 |
| M3 | 유지보수 | 테스트 없는 기존 코드. 기존 동작을 고정하는 특성화 테스트 단계가 없었다 |
| M4 | 유지보수 | 동작을 바꾸지 않는 큰 리팩터링의 작업 유형과 완료 기준이 없었다 |
| M5 | 유지보수 | 일상적 의존성 업데이트가 기본 보호 경로(`package.json` 등) 때문에 매번 결정 게이트에 걸렸다([003](./003-commit-before-approval.md)의 다시 볼 신호) |

`find-skills`로 찾아 비교한 외부 스킬(설치 수는 2026-10-16 skills.sh 기준):

| 스킬 | 설치 수 | 가져온 아이디어 |
| --- | --- | --- |
| [obra/superpowers@brainstorming](https://skills.sh/obra/superpowers/brainstorming) | 392.6K | 열린 질문 하나로 시작, 되읽어 주기, 추측 표시, AI 기본값을 소리 내어 적기, 작업 크기 3단계, 명세 승인 전 짓지 않기, spike |
| [addyosmani/agent-skills@spec-driven-development](https://skills.sh/addyosmani/agent-skills/spec-driven-development) | 56.5K | 전제를 먼저 나열, 모호한 요구를 확인 가능한 성공 기준으로 바꾸기, capability map(모듈, 의존 방향, 빌드 순서) |
| [mattpocock/skills@diagnosing-bugs](https://skills.sh/mattpocock/skills/diagnosing-bugs) | 783.2K | 버그 수정의 재현 루프, 최소화, 가설 3~5개, 맞는 seam의 회귀 테스트 ([011](./011-maintenance-backlog.md)에서 참고) |
| [obra/superpowers@systematic-debugging](https://skills.sh/obra/superpowers/systematic-debugging) | 293.7K | 원인 조사 전 수정 금지 ([011](./011-maintenance-backlog.md)에서 참고) |
| [mattpocock/skills@improve-codebase-architecture](https://github.com/mattpocock/skills/tree/main/skills/engineering/improve-codebase-architecture) | - | 최근 자주 바뀐 곳부터 보는 리팩터링 후보 탐색 ([011](./011-maintenance-backlog.md)에서 참고) |

## 선택지

1. **한 스킬에 두고, 작업 유형별 상세는 `references/`에 둔다.** (채택)
   - 장점: SKILL.md에는 작업 유형 판별 표만 늘어난다. 1.5.0에서 상세를 `references/`로 옮겨 SKILL.md를 줄인 방향(자동 압축 뒤 다시 들어가는 스킬 본문 상한)과 맞다.
   - 장점: 게이트, 래칫, 보고 형식을 유형마다 다시 정의하지 않고 그대로 쓴다.
   - 단점: 에이전트가 유형 판별을 틀리면 상세 파일을 열지 않는다.
2. **명세는 별도 스킬로 분리한다.**
   - 장점: 명세 대화만 따로 쓸 수 있다.
   - 단점: SCOPE.md의 "기존 스킬을 조합해 할 수 있는 일이면 새 스킬을 만들지 않는다"와 긴장이 생긴다. 명세 승인을 결정 게이트로 다루려면 결국 gated-tdd의 게이트 언어가 필요하다.
3. **외부 스킬이 설치되어 있으면 호출하라는 안내만 넣는다.**
   - 장점: 변경이 가장 작다.
   - 단점: `brainstorming`은 "명세가 통과하면 writing-plans만 호출", `spec-driven-development`는 "명세, 계획, 작업, 구현 단계마다 사람 검토"처럼 자체 게이트를 갖고 있다. 이 스킬의 3등급 게이트와 래칫([001](./001-approval-boundary-by-questions.md), [002](./002-three-gates-and-ratchet.md))과 부딪힌다.

## 결정

1을 고른다. 사용자가 추천안을 그대로 골랐다.

- SKILL.md에 작업 유형 표(초기 개발, 기능 개발, 유지보수)를 둔다. 처음에는 2절 맨 앞이었고, [013](./013-simulation-fixes.md)에서 0절 세션 시작으로 옮겼다.
- 초기 개발 상세는 `references/init-dev.md`에 둔다([010](./010-init-dev-spec-and-skeleton.md)).
- 유형별 파일 이름은 사용자가 정했다: 초기 개발 `init-dev.md`, 유지보수 `maintenance.md`(만들 때). 처음에는 `greenfield.md`였다. 그런데 초기 개발의 신호에 "기존 저장소지만 명세가 없음"도 들어 있어 greenfield(빈 땅)와 범위가 맞지 않았다. 표의 "초기 개발"과 이름이 바로 이어지지 않는 문제도 있었다.
- 기능 개발은 파일을 따로 두지 않는다. SKILL.md 2절의 계획과 3절의 사이클이 기능 개발 절차이고, 다른 유형도 결국 그 절차로 들어온다. 초기 개발은 기능별 계획으로 끝나고, 유지보수는 지금 기능 개발과 같다. 따로 떼면 모든 유형이 파일 하나를 더 열어야 한다.
- 외부 스킬은 들여오지 않고, 아이디어만 이 스킬의 게이트 언어로 다시 쓴다.

## 버린 것과 미룬 것

- 외부 스킬 벤더링: 위 3과 같은 이유로 버렸다.
- 유지보수 영역(M1~M5)은 사용자가 이번 범위에서 빼고 기록만 남기기로 했다. [011](./011-maintenance-backlog.md)에 보류로 둔다. 그때까지 작업 유형 표의 유지보수 행은 "기능 개발과 같음"이다.

## 다시 볼 신호

- 에이전트가 빈 저장소나 명세 없는 다기능 요청에서 `references/init-dev.md`를 열지 않고 바로 계획을 세운다. (유형 판별 신호가 약함)
- 작업 유형이 늘어나 SKILL.md의 판별 표가 길어진다. (판별 자체를 references로 옮길지 검토)

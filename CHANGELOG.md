# skill-storage

## 1.4.0

- Productivity 분류에 `idea-banking`을 추가했습니다 (model-invoked): 떠오른 아이디어를 원문 그대로 로컬 Markdown 파일에 바로 기록하고, 나중에 검색·비교·구체화합니다. 저장 위치는 환경 변수 `IDEA_BANK_PATH`로 정하고, 없으면 홈 폴더의 `idea-bank/`를 씁니다.
- 마켓플레이스에 선택 설치용 mod `idea-bank-viewer` 0.2.0을 별도 플러그인으로 추가했습니다: `/ideas`로 `idea-banking`의 기록을 패널에서 훑어보고 검색합니다. `skill-storage`를 설치해도 따라 들어가지 않고, `claude plugin install idea-bank-viewer@avocadosmasher`로 직접 설치해야 합니다. 이유는 [ADR 0002](./.agents/adr/0002-optional-mods-as-separate-plugins.md)에 있습니다.

## 1.3.1

- `gated-tdd`의 작업 결과 보고 형식을 바꿨습니다. 개조식·두괄식을 모든 사용자 대상 응답에 적용하도록 명시했고, 4절("수동 테스트 가이드 형식")을 "작업 결과 보고 형식"으로 바꿔 판정 종류를 둘로 나눴습니다: 방향·스펙 판정에는 선택한 안·버린 대안·trade-off를 적는 "판단 재료", 실행해서 보는 판정에는 조작과 기대 결과를 적는 "확인 방법". 스킬 규칙을 인용하는 메타 설명과 같은 사실의 중복 서술을 금지했습니다.
- `gated-tdd` 보고의 목록 형식을 정했습니다: 상위는 번호, 하위는 bullet(•), em dash로 잇지 않고 화살표는 방향이 있는 짝에만 씁니다.
- `gated-tdd` 보고에 시각 정보 규칙을 더했습니다: 대안 비교는 표, 일부만 끝난 하위 작업은 체크리스트, 수치 전후는 화살표 한 줄로 씁니다. 시각 결정과 구조 설명은 `capture-compare`·`archify`가 설치되어 있을 때만 연계하고, 없으면 직접 캡처하거나 코드 블록 흐름도로 대신합니다.

## 1.3.0

- Engineering 분류에 `find-skills`를 추가했습니다 (model-invoked): 사용자가 원하는 기능이 이미 설치할 수 있는 스킬로 있는지 `npx skills` CLI로 찾아보고, 설치 수와 출처를 확인해 추천합니다. [vercel-labs/skills](https://github.com/vercel-labs/skills)의 `skills/find-skills` 스킬을 그대로 들여왔습니다. 벤더링한 파일은 원문(영어)을 유지합니다. 출처와 범위는 스킬 폴더의 `CREDITS.md`에 있습니다.

## 1.2.0

- Engineering 분류에 `archify`를 추가했습니다 (model-invoked): 아이디어, 계획, 코드베이스를 탐색 가능한 인터랙티브 HTML 다이어그램(아키텍처·워크플로·시퀀스·데이터플로·라이프사이클)으로 만듭니다. [tt-a1i/archify](https://github.com/tt-a1i/archify)의 스킬 패키지를 런타임에 필요한 범위로 그대로 들여왔습니다. 벤더링한 파일은 원문(영어)을 유지합니다. 출처와 범위는 스킬 폴더의 `CREDITS.md`에 있습니다.
- AGENTS.md에 "외부에서 가져온 콘텐츠" 규칙을 추가했습니다: 업스트림을 그대로 들여온 스킬은 따로 요청이 없으면 한국어·em-dash 금지 규칙을 적용하지 않고 원문을 유지합니다.

## 1.1.0

- Productivity 분류에 스킬 세 개를 추가했습니다.
  - `eli5` (model-invoked): 큰 그림 위주의 HTML 페이지로 주제를 쉽게 설명합니다. Thariq Shihipar의 `eli5@claude-community` 플러그인을 그대로 옮겼고, 출처와 원본 라이선스는 스킬 폴더의 `CREDITS.md`에 있습니다.
  - `grill-me-plus` (model-invoked): Matt Pocock의 `grill-me`를 바탕으로, 위험도 순서로 묻고 결정을 `DECISIONS.md`에 기록합니다. 출처와 원본 라이선스는 스킬 폴더의 `CREDITS.md`에 있습니다.
  - `jasoseo-coach` (model-invoked): 헤드헌터 관점의 자기소개서 작성·검토 코치입니다.

## 1.0.0

- 저장소를 플러그인 하나(`skill-storage`)와 분류 폴더(`skills/<분류>/`) 구조로 바꿨습니다. 설치된 스킬 이름이 `gated-tdd-kit:gated-tdd`에서 `skill-storage:gated-tdd`로 바뀝니다. 이유는 [ADR 0001](./.agents/adr/0001-single-plugin-bucket-layout.md)에 있습니다.
- `gated-tdd`, `capture-compare`를 Engineering 분류로 공개합니다.

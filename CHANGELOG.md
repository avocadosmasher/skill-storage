# skill-storage

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

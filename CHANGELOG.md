# skill-storage

## 1.1.0

- Productivity 분류에 스킬 세 개를 추가했습니다.
  - `eli5` (model-invoked): 큰 그림 위주의 HTML 페이지로 주제를 쉽게 설명합니다. Thariq Shihipar의 `eli5@claude-community` 플러그인을 그대로 옮겼고, 출처와 원본 라이선스는 스킬 폴더의 `CREDITS.md`에 있습니다.
  - `grill-me-plus` (model-invoked): Matt Pocock의 `grill-me`를 바탕으로, 위험도 순서로 묻고 결정을 `DECISIONS.md`에 기록합니다. 출처와 원본 라이선스는 스킬 폴더의 `CREDITS.md`에 있습니다.
  - `jasoseo-coach` (model-invoked): 헤드헌터 관점의 자기소개서 작성·검토 코치입니다.

## 1.0.0

- 저장소를 플러그인 하나(`skill-storage`)와 분류 폴더(`skills/<분류>/`) 구조로 바꿨습니다. 설치된 스킬 이름이 `gated-tdd-kit:gated-tdd`에서 `skill-storage:gated-tdd`로 바뀝니다. 이유는 [ADR 0001](./.agents/adr/0001-single-plugin-bucket-layout.md)에 있습니다.
- `gated-tdd`, `capture-compare`를 Engineering 분류로 공개합니다.

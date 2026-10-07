# Engineering

코드 작업에 매일 쓰는 스킬.

## User-invoked

사용자가 `/이름`으로 직접 실행할 때만 동작합니다 (Claude Code: `disable-model-invocation: true`, Codex: `agents/openai.yaml`의 `policy.allow_implicit_invocation: false`).

아직 없습니다.

## Model-invoked

사용자가 실행할 수도 있고, 상황이 맞으면 에이전트가 알아서 불러 씁니다.

- **[gated-tdd](./gated-tdd/SKILL.md)**: 작은 작업 단위로 테스트를 먼저 만들고, 사용자가 "통과"라고 판정해야만 커밋하는 개발 절차. 승인 게이트 스크립트, git 훅, 작업 기록 스크립트 포함.
- **[capture-compare](./capture-compare/SKILL.md)**: 시각 결정 전에 후보 여러 개를 같은 조건에서 캡처해 비교 시트(PNG)로 보여 주고 고르게 하는 절차. Playwright 스크립트 포함.

# Model-invoked와 User-invoked

모든 `SKILL.md`는 누가 실행할 수 있느냐에 따라 둘 중 하나다.

- **User-invoked**: 사람이 `/이름`을 입력할 때만 실행된다.
  - `SKILL.md` frontmatter에 `disable-model-invocation: true` (Claude Code)
  - `agents/openai.yaml`에 `policy.allow_implicit_invocation: false` (Codex)
  - `description`은 **사람이 읽는** 한 줄 요약으로 쓴다. 슬래시 명령 목록에서 보이는 문구이므로 "~라고 하면 사용한다" 같은 트리거 목록은 빼낸다.
- **Model-invoked** (기본값): 모델도 사람도 실행할 수 있다.
  - `disable-model-invocation`과 `policy` 블록을 넣지 않는다.
  - `description`은 **모델이 읽는** 문구다. 모델이 알맞은 순간에 꺼내 쓰도록 "사용자가 ~를 원하거나, ~를 말하면 사용한다" 같은 트리거 문구를 넉넉히 쓴다.

어느 쪽으로 할지는 *모델이 스스로 꺼내 써서 도움이 되는가?*로 정한다.

두 설정은 항상 같이 맞춘다. 한 에이전트에서만 user-invoked인 스킬은 만들지 않는다.

## 스킬끼리 호출

- User-invoked 스킬은 model-invoked 스킬을 부를 수 있다. 반대로, 어떤 스킬도 user-invoked 스킬을 부를 수 없다.
- 다른 스킬을 쓰게 할 때는 "Skill 도구로 `<이름>`을 호출한다"라고 명시한다. `../다른-스킬/파일.md` 같은 폴더 간 참조나, 모델이 알아서 해석하길 바라는 `/이름` 언급은 쓰지 않는다.
- 필요한 스킬이 user-invoked라면 "사용자에게 `/이름`을 실행하라고 안내한다"라고 쓴다.
- Skill 도구는 한 번에 스킬 하나만 받는다. 두 개가 필요하면 두 번 호출하라고 쓴다.

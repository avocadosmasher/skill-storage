# Productivity

코드 밖의 업무에 매일 쓰는 스킬.

## User-invoked

사용자가 `/이름`으로 직접 실행할 때만 동작합니다 (Claude Code: `disable-model-invocation: true`, Codex: `agents/openai.yaml`의 `policy.allow_implicit_invocation: false`).

아직 없습니다.

## Model-invoked

사용자가 실행할 수도 있고, 상황이 맞으면 에이전트가 알아서 불러 씁니다.

- **[eli5](./eli5/SKILL.md)**: 아무것도 모르는 사람에게 설명하듯, 큰 그림과 아주 적은 글로 된 HTML 페이지를 만들어 주제를 설명한다. Thariq Shihipar의 커뮤니티 플러그인을 그대로 옮겼다([CREDITS](./eli5/CREDITS.md)).
- **[grill-me-plus](./grill-me-plus/SKILL.md)**: 계획이나 설계를 위험한 결정부터 집요하게 캐물어 공통 이해에 이르고, 정한 결정을 `DECISIONS.md`에 바로바로 기록한다.
- **[jasoseo-coach](./jasoseo-coach/SKILL.md)**: 헤드헌터 관점으로 자기소개서를 함께 쓰고 검토한다. 재료 수집, JD 리서치, 초안, 글자수 관리, 검토 루프, 면접 예상 질문까지.
- **[idea-banking](./idea-banking/SKILL.md)**: 떠오른 아이디어를 원문 그대로 로컬 Markdown 파일에 바로 기록하고, 나중에 검색·비교·구체화한다.
- **[thinking-aloud-writing](./thinking-aloud-writing/SKILL.md)**: 공부 자료·Git 저장소·개발 기록·기존 초안으로 기술 블로그 글을 함께 기획하고, 빈틈은 인터뷰로 채워 질문 중심의 친근한 문체로 쓴다.

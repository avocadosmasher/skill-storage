이 저장소는 에이전트 스킬 모음이다. 저장소 전체가 Claude Code 플러그인 하나(`skill-storage`)이고, 동시에 그 플러그인 하나만 담은 마켓플레이스(`avocadosmasher`)다.

## 분류 폴더

스킬은 `skills/` 아래 분류 폴더에 둔다.

- `engineering/`: 매일 쓰는 코드 작업 스킬
- `productivity/`: 매일 쓰는 코드 밖 업무 스킬
- `misc/`: 보관만 하고 자주 쓰지 않음, 공개 목록에 넣지 않음
- `in-progress/`: 베타. 공개는 하되 플러그인에 넣지 않음
- `deprecated/`: 더 쓰지 않음. 보통은 삭제하고, 대체한 스킬을 CHANGELOG에 적는다

`engineering/`과 `productivity/`는 **정식 공개** 분류다. 정식 공개 스킬은 모두 아래 세 곳에 있어야 하고, 나머지 분류의 스킬은 어디에도 없어야 한다.

1. 최상위 `README.md`의 스킬 목록 (스킬 이름은 그 `SKILL.md`로 링크)
2. `.claude-plugin/plugin.json`의 `skills` 배열 (플러그인은 정식 공개 스킬만 정확히 담는다)
3. `docs/<분류>/<스킬명>.md` 설명 페이지

## 스킬을 추가·이름 변경·삭제할 때

- 해당 분류 폴더의 `README.md` 목록을 고친다. 모든 분류 `README.md`는 스킬마다 한 줄 설명을 달고 이름을 `SKILL.md`로 링크한다.
- 정식 공개 분류면 위 세 곳을 함께 고친다. docs 페이지는 [.agents/writing-docs.md](./.agents/writing-docs.md)를 따른다.
- 스킬마다 `SKILL.md` 옆에 `agents/openai.yaml`(Codex 메타데이터)을 둔다.
- `CHANGELOG.md`에 무엇이 바뀌었는지 적고, 릴리스할 때 `.claude-plugin/plugin.json`의 `version`을 올린다. 설치한 사용자는 `version`이 바뀌어야 업데이트를 받는다.
- 매니페스트를 고친 뒤에는 `claude plugin validate .`로 확인한다. "CLAUDE.md at the plugin root is not loaded" 경고는 예상된 것이다: 이 CLAUDE.md는 저장소를 고치는 에이전트용이지 플러그인 사용자용이 아니다. 그 밖의 경고와 오류는 고친다.

## 스킬 작성 규칙

- 모든 스킬은 user-invoked 아니면 model-invoked다. 구분과 설정은 [.agents/invocation.md](./.agents/invocation.md)를 따른다.
- 다른 스킬을 쓰게 할 때는 `../다른-스킬/파일.md`처럼 폴더를 넘어 참조하지 않는다. "Skill 도구로 `<이름>`을 호출한다"처럼 스킬 이름으로 지시한다.
- 스킬이 쓰는 파일은 그 스킬 폴더 안에 둔다: `assets/`(복사해 쓰는 파일), `scripts/`(실행하는 스크립트), `references/`(참고 예시).
- 사용자 대상 문서와 스킬 본문은 한국어로 쓴다. 트리거를 돕는 영어 문장은 description에 덧붙여도 된다.

## em-dash 금지

이 저장소의 어떤 글에도 em-dash(U+2014)를 쓰지 않는다. `SKILL.md`, docs, `README.md`, `CHANGELOG.md`, ADR, 코드 주석 모두 해당한다. 문장이 em-dash를 원하는 자리에서는 문자만 기계적으로 바꾸지 말고, 그 문장에 실제로 맞는 쉼표, 콜론, 마침표, 괄호, 접속 표현으로 다시 쓴다.

코드가 예전 형식의 입력을 읽으려고 이 문자를 다뤄야 하면 문자를 직접 쓰지 않고 `\u2014`로 표기한다.

## 설계 결정

구조에 관한 결정은 `.agents/adr/`에 번호를 붙여 남긴다. 이슈와 제안을 받는 기준은 [SCOPE.md](./SCOPE.md), 거절한 아이디어는 `.out-of-scope/`에 주제별 파일로 남긴다.

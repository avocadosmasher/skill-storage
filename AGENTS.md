이 저장소는 에이전트 스킬 모음이다. 저장소 전체가 Claude Code 플러그인 하나(`skill-storage`)이고, 동시에 그 플러그인과 선택 설치용 mod들을 담은 마켓플레이스(`avocadosmasher`)다.

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

## mod

스킬을 돕는 Claude Code mod(함수 훅 플러그인)는 `mods/<mod 이름>/`에 두고, `skill-storage`에 합치지 않고 `.claude-plugin/marketplace.json`에 별도 플러그인으로 등록한다. 사용자가 골라서 설치하게 하기 위해서다([ADR 0002](./.agents/adr/0002-optional-mods-as-separate-plugins.md)).

- 함께 쓰는 스킬이 정식 공개 분류에 있을 때만 등록하고, 최상위 `README.md`와 그 스킬의 docs 페이지에 설치 방법을 적는다.
- 최상위 `README.md`의 mod 표에 그 mod가 쓰는 권한을 적는다. `claude plugin validate mods/<mod 이름>`이 보여 주는 호출(`$.fs`, `$.process`, `$.env` 등)과 맞춘다.
- mod를 고치면 `claude plugin test mods/<mod 이름>`과 `claude plugin validate mods/<mod 이름>`을 실행하고, mod의 `plugin.json` `version`을 올린다. `skill-storage`의 `version`과는 따로 간다.
- 개인 경로 같은 자기 환경 값을 기본값으로 넣지 않는다.

## 스킬 작성 규칙

- 모든 스킬은 user-invoked 아니면 model-invoked다. 구분과 설정은 [.agents/invocation.md](./.agents/invocation.md)를 따른다.
- 다른 스킬을 쓰게 할 때는 `../다른-스킬/파일.md`처럼 폴더를 넘어 참조하지 않는다. "Skill 도구로 `<이름>`을 호출한다"처럼 스킬 이름으로 지시한다.
- 스킬이 쓰는 파일은 그 스킬 폴더 안에 둔다: `assets/`(복사해 쓰는 파일), `scripts/`(실행하는 스크립트), `references/`(참고 예시).
- 사용자 대상 문서와 스킬 본문은 한국어로 쓴다. 트리거를 돕는 영어 문장은 description에 덧붙여도 된다. (벤더링한 외부 콘텐츠는 예외: 아래 "외부에서 가져온 콘텐츠" 참고)

## 외부에서 가져온 콘텐츠

업스트림 저장소를 그대로 들여온 스킬(예: 외부 프로젝트의 SKILL.md, 코드, references/ 문서)은 따로 요청이 없으면 원문을 그대로 유지한다. 한국어 전용 규칙과 em-dash 금지를 포함해 이 저장소의 글쓰기 규칙은 이런 벤더링 콘텐츠에는 적용하지 않는다. 업스트림이 새 버전을 낼 때마다 번역과 교정을 다시 해야 하는 비용이 그 이득보다 크기 때문이다.

- 이 예외는 벤더링한 파일 자체(가져온 SKILL.md 본문, references/, 코드와 주석 등)에만 적용된다. 이 저장소가 직접 쓰는 글, 즉 최상위 README.md, 분류별 README.md, docs/<분류>/<스킬명>.md, CHANGELOG.md는 그대로 한국어와 em-dash 금지 규칙을 따른다.
- 사용자가 특정 벤더링 스킬의 번역이나 교정을 명시적으로 요청하면 그때 고친다.

## em-dash 금지

이 저장소의 어떤 글에도 em-dash(U+2014)를 쓰지 않는다. `SKILL.md`, docs, `README.md`, `CHANGELOG.md`, ADR, 코드 주석 모두 해당한다. 문장이 em-dash를 원하는 자리에서는 문자만 기계적으로 바꾸지 말고, 그 문장에 실제로 맞는 쉼표, 콜론, 마침표, 괄호, 접속 표현으로 다시 쓴다. 벤더링한 외부 콘텐츠는 "외부에서 가져온 콘텐츠" 절의 예외를 따른다.

코드가 예전 형식의 입력을 읽으려고 이 문자를 다뤄야 하면 문자를 직접 쓰지 않고 `\u2014`로 표기한다.

## 설계 결정

구조에 관한 결정은 `.agents/adr/`에 번호를 붙여 남긴다. 이슈와 제안을 받는 기준은 [SCOPE.md](./SCOPE.md), 거절한 아이디어는 `.out-of-scope/`에 주제별 파일로 남긴다.

## 스킬 설계 기록

스킬 하나의 동작 설계는 `.agents/design/<스킬>/`에 남긴다([ADR 0003](./.agents/adr/0003-skill-design-records.md)). 형식은 [.agents/design/README.md](./.agents/design/README.md)를 따른다.

- 스킬을 고치기 전에 `.agents/design/<스킬>/README.md`가 있으면 먼저 읽는다. 바꾸려는 부분과 관련된 결정 파일만 연다.
- 바꾸려는 내용이 현재 원칙이나 채택된 결정과 부딪히면, 고치기 전에 사용자에게 그 결정과 충돌한다고 알린다.
- 선택지가 있었던 결정이나 방향을 바꾼 결정은 그 대화에서 바로 결정 파일로 남기고, 그 스킬의 `README.md` 결정 목록과 현재 원칙을 같은 변경에서 고친다.

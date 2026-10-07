# 저장소 전체를 플러그인 하나로 두고, 스킬은 분류 폴더로 나눈다

- 날짜: 2026-10-07
- 상태: 채택

## 배경

처음에는 저장소를 여러 플러그인을 담는 마켓플레이스로 만들었다. 함께 쓰는 스킬끼리 플러그인 하나로 묶었다(`plugins/gated-tdd-kit/skills/{gated-tdd,capture-compare}`). 스킬이 늘어나면 플러그인도 늘어나고, 사용자는 플러그인마다 따로 설치해야 한다.

공개 저장소로 운영하면서 [mattpocock/skills](https://github.com/mattpocock/skills)의 방식을 따르기로 했다.

## 결정

- 저장소 전체가 Claude Code 플러그인 하나(`skill-storage`)다. `.claude-plugin/marketplace.json`이 `source: "./"`로 자기 자신을 가리켜, 저장소가 플러그인 하나만 담은 마켓플레이스(`avocadosmasher`)가 된다.
- 스킬은 `skills/<분류>/<스킬>/`에 둔다. 분류는 `engineering`, `productivity`(정식 공개), `misc`, `in-progress`, `deprecated`(비공개)다.
- `.claude-plugin/plugin.json`의 `skills` 배열에 정식 공개 스킬의 경로를 하나씩 적는다. 그래서 비공개 분류의 스킬은 플러그인에 들어가지 않는다.
- skills.sh(`npx skills add`)로도 설치할 수 있다. 이 경로는 `skills/` 아래의 `SKILL.md`를 찾아 고칠 수 있는 사본을 만든다.

## 결과

- 사용자는 플러그인 하나만 설치하면 정식 공개 스킬을 모두 받는다.
- 설치된 스킬 이름이 `gated-tdd-kit:gated-tdd`에서 `skill-storage:gated-tdd`로 바뀐다.
- 스킬 하나만 원하는 사용자는 skills.sh의 `--skill=<이름>`이나 폴더 복사를 쓴다.
- 스킬을 추가할 때마다 `plugin.json`, 최상위 README, 분류 README, docs 페이지를 함께 고쳐야 한다(`AGENTS.md`의 규칙).

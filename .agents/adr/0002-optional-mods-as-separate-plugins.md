# 스킬을 돕는 mod는 마켓플레이스의 별도 플러그인으로 두고 선택해서 설치하게 한다

- 날짜: 2026-10-13
- 상태: 채택 ([ADR 0001](./0001-single-plugin-bucket-layout.md)의 "마켓플레이스는 플러그인 하나만 담는다"를 보완)

## 배경

`idea-banking` 스킬로 저장한 아이디어를 훑어보는 `/ideas` 패널을 Claude Code mod(`idea-bank-viewer`)로 만들었다. mod는 스킬이 아니라 함수 훅 모듈을 가진 플러그인이고, 설치한 세션에서 파일 읽기 같은 `$` 기능을 쓸 수 있다. 다른 사람이 만든 mod를 그대로 설치하는 것은 스킬보다 위험하므로, 스킬 묶음을 설치했다고 mod까지 따라 들어가면 안 된다.

## 결정

- 스킬 묶음은 그대로 `skill-storage` 플러그인 하나다.
- mod는 `mods/<mod 이름>/`에 두고, `.claude-plugin/marketplace.json`에 별도 플러그인으로 등록한다(`"source": "./mods/<mod 이름>"`). 사용자가 `claude plugin install <mod 이름>@avocadosmasher`로 직접 골라 설치해야만 들어간다.
- mod는 함께 쓰는 스킬이 정식 공개 분류에 있을 때만 마켓플레이스에 등록한다. 스킬 없이 쓸 수 없는 mod는 스킬과 같은 설정(예: 환경 변수)을 읽게 해 둘이 같은 데이터를 보게 한다.
- mod는 `version`을 따로 가진다. `skill-storage`의 `version`과 함께 올리지 않는다.

## 결과

- `skill-storage`만 설치한 사용자에게는 mod가 생기지 않는다.
- mod를 원하는 사용자는 설치 명령을 한 줄 더 실행한다. 최상위 README와 해당 스킬의 docs 페이지에 설치 방법을 적는다.
- mod는 Claude Code 전용이다. Codex와 skills.sh 설치에는 해당하지 않는다.
- 마켓플레이스에 플러그인이 둘 이상이 되므로, `skill-storage`를 설치할 때 이름을 정확히 적어야 한다(README의 명령 그대로).

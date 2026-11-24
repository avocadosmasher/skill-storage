# 시나리오 형식

시나리오는 값만 담은 ES 모듈(`.mjs`, `export default {…}`)이다. 회사 주소·실명이 들어가는 시나리오는 스킬 폴더와 git 저장소 밖에 둔다.

## 최상위

| 키 | 기본값 | 뜻 |
| --- | --- | --- |
| `name` | (필수) | 출력 폴더 이름 앞부분 |
| `viewport` | `{width:1920, height:1080, dpr:1}` | 녹화하는 화면 크기(CSS px)와 배율. 프레임 = width×dpr. 100%가 기본, 글자를 키우려면 `{width:1280, height:720, dpr:1.5}`(150%) |
| `output` | `{fps:30}` | 영상 프레임률 |
| `vars` | `{}` | `${이름}`으로 url·선택자·자막·가리기에 넣는 값. `--var k=v`로 덮어씀 |
| `redact` | `[]` | 페이지에서 흐리게 가릴 것: `{url: 정규식, selector?: CSS, text?: 글자, pattern?: 정규식, required: true}`. `text`·`pattern`은 그 글자(모양)를 품은 가장 안쪽 요소를 흐림 (이메일 예시는 표 아래). url이 맞는 페이지에서 `required` 규칙이 10초 안에 0개면 녹화를 멈춘다 |
| `redactFixed` | `[]` | 편집에서 칠할 고정 영역 `{x,y,w,h}` (CSS px, 예비 수단) |
| `flow` | 없음 | 브릿지 카드의 흐름 띠: `{stages: [단계 이름…], numbered?: [번호 붙일 단계], span?: [처음, 끝], note?: 괄호 아래 글}` |
| `intro` / `outro` | 없음 | 영상 맨 앞·맨 뒤 카드 `{kicker?, title, sub?, active?: "all" \| [단계 이름], ms}` |
| `steps` | (필수) | 단계 목록 |

실명·이메일은 파일에 쓰지 말고 `text: "${me}"` + `--var me="…"`로 넘긴다. 이메일은 모양으로 가린다(가상 도메인은 제외):

```js
{ url: "servicedesk/customer", pattern: String.raw`[\w.+-]+@(?!sorim-virtual)[\w-]+\.[a-z]{2,}` }
```

## 단계

단계 하나 = 동작 0~1개 + 선택 항목.

| 키 | 모양 | 뜻 |
| --- | --- | --- |
| `id` | 문자열 | 없으면 `s1, s2…` |
| `scene` | 문자열 | 장면 이름 (생략하면 직전 값). 미리보기·길이 표에 쓰임 |
| `page` | 이름 | 조작·녹화할 탭. 처음 나오는 이름이면 새 탭. 생략하면 직전 탭 |
| `goto` | URL | 이동 (이동 중 프레임은 찍지 않음) |
| `click` | target 또는 `{target, opens?, navigates?}` | 누름. `opens:"이름"`이면 새 탭을 그 이름으로 잡고 이후 단계의 page가 됨. `navigates:true`면 같은 탭 이동으로 보고 가리기 확인 전까지 프레임을 찍지 않음 |
| `fill` | `{target, value}` | 입력 칸 채우기 |
| `paste` | `{target, value}` | 리치 편집기: 누른 뒤 붙여 넣기 |
| `type` | `{target, value, then?}` | 누른 뒤 한 글자씩 입력, `then:"Enter"` 같은 키 |
| `press` | 키 이름 | 키 누르기 |
| `select` | `{target, value}` | `<select>` 고르기 |
| `scroll` | `{to: target, align: 0.25, speed: 500}` 또는 `{by: px, speed}` | 부드러운 스크롤. 대상이 아직 없으면(지연 로딩) 500px씩 내려가며 찾음(`search`, 기본 6000px). `scroller`로 스크롤 영역 지정 가능 |
| `wait` | `{ms?, until?, timeout, reloadEvery?, edit, keep}` | 오래 걸리는 기다림. `edit`: `"keep"` \| `"cut"`(앞뒤 `keep` ms만 남김) \| `{speed: 8}` |
| `expect` | `{url?: 정규식, text?, selector?, js?: 식, timeout}` | 동작 뒤 기대 화면. 안 나오면 중단하고 `fail/`에 화면·snapshot·URL을 남김 |
| `caption` | 문자열 | 이 단계 동안의 자막. 번호는 `①②…`로 직접 씀 |
| `highlight` | `[{target, n?, color?, all?, limit?}]` | 강조 상자. `n`은 왼쪽 위 번호(자막의 ①과 맞아야 함). `all`이면 화면 안의 여러 개 |
| `hold` | ms | 동작 뒤 멈춰 있는 시간. 기본: 자막이 있으면 max(2800, 글자 수×110+1000), 없으면 1500. 상자는 이 구간에만 보임 |
| `capture` | `{var, from: "url" \| target, match: 정규식}` | 화면에서 값을 읽어 변수에 넣음 (예: 새 티켓 번호) |
| `dryRun` | `"skip"` | 시험 실행에서 건너뜀 (되돌릴 수 없는 단계) |
| `bridge` | `{kicker?, title, sub?, active?, ms: 2500}` | 이 단계 앞에 넣는 장면 카드(흐린 이전 화면 + 제목 + 흐름 띠, `active` 단계가 주황). 카드가 이어지면 깜빡임 없이 바로 바뀜 |

자막에 `${since:<단계 id>}`를 쓰면 그 단계가 시작된 뒤 흐른 시간("1분 15초", 5초 단위)이 들어간다. 예: 티켓을 보낸 단계부터 노트가 달릴 때까지.

target: CSS 문자열, `"text=글자"`, 또는 `{css?, text?}` (css에 맞는 것 중 글자를 포함한 요소; 글자가 똑같은 것 → 글자로 시작하는 것 → 가장 짧은 것 순으로 고름).

## 실행 옵션

`--var k=v`(여러 번), `--space <id>`(demo-recorder가 만든 공간만), `--out <폴더>`, `--from <단계 id>`(그 단계부터; 앞 단계가 만든 값은 `--var`로)

녹화 중 안전장치: 이동(goto)·새 탭·`expect.url`이 있는 클릭·다시 읽기 동안에는 가리기를 다시 확인할 때까지 프레임을 찍지 않는다. 가리기 규칙의 변수가 비어 있거나, `required` 규칙이 10초 안에 0개면 멈춘다. 변수를 넣은 뒤 `text`가 빈 글자면 멈춘다.

## 검사 (`validate`)

모르는 키, id 중복, 한 단계에 동작 둘, 자막 번호와 상자 번호 불일치, `wait.edit` 값 오류를 막는다.

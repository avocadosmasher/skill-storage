# 1.2 그림을 diagram-design으로 그리는 법

1.2 "전체 워크플로와 이번 작업의 위치" 그림은 diagram-design 스킬로 그린 SVG를 보고서에 그대로 붙인다. 손으로 쓴 HTML 상자(`.wf`)보다 선을 자유롭게 그을 수 있고, 확대해도 선명하고, 그림 속 글을 고르고 찾을 수 있다. 이 파일은 diagram-design에 넘길 값과, 그린 뒤 보고서에 붙이는 순서를 정한다.

diagram-design은 이 스킬에 들어 있지 않은 별도 스킬이다(MIT, https://github.com/cathrynlavery/diagram-design). Skill 도구 목록에 `diagram-design`이 없으면 이 파일은 건너뛰고 디자인 명세 3.3의 `.wf` 그림을 쓴다. 설치를 사용자에게 권할 수는 있지만 직접 설치하지 않는다.

## 1. diagram-design에 넘길 것

Skill 도구로 `diagram-design`을 호출하고 아래를 그대로 전한다. 스타일은 diagram-design의 프로필 기능으로 넘긴다.

- `~/.diagram-design/profiles/result-report.md`가 있으면 "(f) 저장한 프로필 불러오기"로 그 프로필을 이번 그림의 스타일로 쓴다. 설치된 diagram-design의 `style-guide.md`를 덮어쓰지 않고, 저장소에 `.diagram-design` 표시 파일도 만들지 않는다
- 없으면 "(d) 토큰 붙여넣기"로 2절 값을 넣고, 저장할지 물으면 이름 `result-report` 프로필로 저장한다

- 그림 종류: Architecture. 층을 위에서 아래로 둔다: 사용자 쪽 → 흐름 → 실행 → 도구 · 연동 → 저장 · 외부(3~5층). 층마다 이름을 단 패널(containment)로 묶는다
- 크기: `doc-inline`(viewBox 폭 960). 높이는 내용에 맞춘다. 보고서 본문 폭(약 764px)에 줄여 들어가므로 칸 이름은 12px 아래로 내리지 않는다
- 글꼴: Font source `system`. Google Fonts를 쓰지 않는다
- 칸 하나: 이름(14자 안) + 설명 한 줄(35자 안) + 코드 이름 하나(고정폭). 디자인 명세 3.3의 칸 글 길이와 같다. 글 크기 · 색은 3절 아래 표를 따른다
- 층 사이 이동(`.wf`의 "▼ 이유")은 패널에서 패널로 긋는 세로 화살표와 이유 라벨로, 층 안 보충 한 줄(`.wf`의 "↺ …")은 그 패널 맨 아래 글 한 줄로 둔다
- 순서가 있는 흐름은 ①②③ 번호를 붙이고 화살표로 잇는다
- 칸 색은 3절의 "누가 언제 만들었나" 다섯 가지만 쓴다. 층 패널은 무채색(채움 `paper-2` `#fafafa`, 테두리 `rule-solid` `#d5d9e0`)이다. 패널에 색을 넣으면 칸 색의 뜻이 흐려진다
- 선은 출발 · 도착이 아닌 층 패널을 가로지르지 않는다. 층을 건너뛰는 선(예: 흐름 층에서 맨 아래 저장 층으로)은 패널 바깥 여백으로 돌린다. 가로지르면 그 층을 거쳐 가는 것처럼 읽힌다. diagram-design의 `verify_geometry.py`는 칸 뒤로 지나가는 선만 잡고 층 패널은 보지 않으므로 눈으로 확인한다
- 화살표는 모두 `muted`(회색)로 긋는다. diagram-design이 HTTP · 외부 호출에 쓰는 `link`(파랑)는 "이번 작업" 칸의 파랑과 헷갈리므로 쓰지 않는다
- 층은 내용에 맞게 3~5개. 저장과 외부가 둘 다 크면 두 층으로 나눠도 된다. 코드 이름이 없는 칸(외부 서비스 등)은 코드 줄 대신 주소나 제품 이름을 적거나 비운다
- 범례는 SVG 안에 그리지 않는다. 보고서의 HTML 범례(`.legend2`)가 맡는다
- 아이콘은 diagram-design의 선 아이콘만, 무채색(`muted`)으로. 브랜드 로고는 쓰지 않는다
- 강조색(`accent`)을 따로 쓰지 않는다. 이 그림의 파랑은 "이번 작업" 칸의 색이다
- 그림 제목(`<title>`)과 한 문장 설명(`<desc>`)을 채운다. diagram-design의 접근성 규칙 그대로다

## 2. 스타일 토큰 (diagram-design style guide에 붙일 값)

| 역할 | 값 |
| --- | --- |
| `paper` | `#ffffff` |
| `paper-2` | `#fafafa` |
| `ink` | `#222222` |
| `ink-strong` | `#111111` |
| `muted` | `#666666` |
| `soft` | `#777777` |
| `rule` | `#eeeeee` |
| `rule-solid` | `#d5d9e0` |
| `accent` | `#2f6fd6` |
| `accent-tint` | `#eaf2ff` |
| `link` | `#1d4f9e` |
| 글꼴(이름 · 본문) | `'Noto Sans KR', 'Malgun Gothic', system-ui, sans-serif` |
| 글꼴(코드 이름) | `Consolas, ui-monospace, monospace` |
| Font source | `system` |

## 3. 칸 색 (보고서 틀의 색과 같은 값)

칸의 `fill`과 `stroke`는 아래 값을 그대로 쓴다. 검사 스크립트가 이 채움 색으로 범례와 맞는지 본다.

| 뜻 | 범례 클래스 | 채움 | 테두리 | 이름 글자 |
| --- | --- | --- | --- | --- |
| 이번 작업(나) | `b-mine` | `#eaf2ff` | `#2f6fd6` 2px | `#1d4f9e` |
| 이번 기간에 동료가 만든 것 | `b-peer` | `#fcebf6` | `#d98cbf` 2px | `#9c3f7c` |
| 함께 만든 것 | `b-both` | `#efeafc` | `#9a82d6` 2px | `#5b3fa8` |
| 이전에 이미 있던 것 | `b-past` | `#f1f1f1` | `#d6d6d6` 1px | `#666666` |
| 아직 안 한 것 | `b-next` | `#ffffff` | `#c8c8c8` 1px 점선 `4,3` | `#999999` |

함께 만든 칸에는 누가 무엇을 했는지 한 줄을 설명 아래에 더한다. 혼자 하는 프로젝트면 `b-peer` · `b-both`를 쓰지 않는다.

칸 안 글과 층 패널 머리글 (보고서 틀의 `.wf`와 같은 값). 크기는 viewBox 960 기준이고, 보고서 본문 폭에서는 약 0.8배로 보인다. 단계를 한 줄에 5개 넘게 두면 칸이 좁아 설명 35자가 들어가지 않으므로, 설명을 줄이거나 단계를 두 줄로 나눈다:

| 자리 | 크기 · 굵기 | 색 | 글꼴 |
| --- | --- | --- | --- |
| 칸 이름 | 14px · 600 | 위 표의 "이름 글자". 아직 안 한 것은 대비를 위해 `#767676` | 이름 글꼴 |
| 칸 설명 | 12px · 400 | `#777777` | 이름 글꼴 |
| 코드 이름 | 12px · 400 (좁은 단계 칸은 10px까지) | `#555555` | 코드 글꼴. 한글이 섞이면 이름 글꼴 |
| 누가 무엇을(함께 칸) | 12px · 400 | `#6b55b0` | 이름 글꼴 |
| 층 패널 이름 · 부제 | 13px · 700 / 400 | `#444444` / `#888888` | 이름 글꼴 |
| 화살표 라벨 | 12px · 400 | `#666666` | 이름 글꼴 |

## 4. 보고서에 붙이기

1. diagram-design 폴더에서 검사 두 개를 통과시킨다: `python3 scripts/self_check.py --offline <그림.html>`, `python3 scripts/verify_geometry.py <그림.html>`. Windows에서는 `python3` 대신 `python`이다
2. SVG만 꺼낸다: `python3 scripts/export_svg.py --system-fonts <그림.html> <그림.svg>`. 파일 이름은 영문 소문자와 하이픈으로 둔다(한글 이름은 SVG id를 만들지 못해 실패한다). 꺼낸 SVG의 id는 `<파일 이름>-root`가 되고, 그림 HTML의 CSS가 SVG 안 `<style>`로 옮겨진다(그대로 둔다)
3. `<그림.svg>`에서 첫 줄 `<?xml ...?>`을 지우고, `<svg ...>`부터 `</svg>`까지를 틀의 `<div class="scroll">` 안에 그대로 넣는다. SVG 안의 내용은 고치지 않는다
4. `.legend2`에는 그림에 실제로 쓴 칸 색만 남긴다
5. `<figcaption>`에 그림을 한 줄로 설명한다. 그림 원본(diagram-design HTML)이 저장소에 있으면 그 경로를 `<code>`로 적는다
6. 틀의 `.wf` 블록은 지운다. 한 보고서에 1.2 그림은 하나다

## 5. 붙인 SVG에 허용하는 것과 막는 것

검사 스크립트가 아래를 본다.

- 허용: `<figure class="fig">` 안의 SVG 하나. SVG 안의 `<style>`(규칙이 모두 그 SVG의 `#id`로 시작할 때. 내보내기가 넣는 `@media print { #…-root … }`처럼 `@` 블록 안의 규칙도 같은 조건), SVG 안의 `style="..."` · `class="..."`
- 필수: SVG에 `id`, `role="img"`, `aria-labelledby`, 첫 자식 `<title>`, 그리고 `<desc>`
- 막음: figure 밖의 SVG, `<img>` · `<iframe>`, SVG 안의 `<script>` · `<foreignObject>` · `<image>` · `on…=` 속성 · 외부 주소(`http`로 시작하는 `href` · `url()`) · `@import` · `@font-face`

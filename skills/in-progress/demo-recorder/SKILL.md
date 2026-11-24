---
name: demo-recorder
description: 브라우저 시연을 시나리오대로 ego lite에서 조작하며 페이지 화면만 녹화하고, 자막·강조 상자·번호·커서·장면 사이 브릿지 카드(아키텍처 흐름 띠)·기다림 자르기/배속을 입혀 MP4와 SRT로 만든다. 사용자가 데모 영상·시연 영상·화면 녹화 자동화·PoC 시연·공모전 제출 영상·"유즈케이스 흐름으로 보여 주기"를 요청하거나, 웹 앱 사용 흐름이나 에이전트·파이프라인 처리 과정을 영상으로 남기려 할 때, 녹화라는 말을 쓰지 않더라도 사용한다. 로그인된 실제 브라우저(ego lite)가 필요하다.
---

# demo-recorder

시나리오 파일 하나로 "조작 → 녹화 → 미리보기 → 영상"을 만든다. 경로의 `<skill>`은 이 파일이 있는 폴더다.

## 준비물

- ego lite (`ego-browser`), Node 22+, `uv`
- 편집 도구는 설치 없이 `uv run --no-project --with imageio-ffmpeg --with pillow`로 받아 씀 (처음 한 번 약 40MB)
- 한글 자막 글꼴: Windows 맑은 고딕(`C:/Windows/Fonts/malgunbd.ttf`)

## 먼저 읽을 것

- `references/demo-guidelines.md`: 사용자 피드백에서 나온 원칙(읽을 시간, 번호가 가리지 않기, 장면 순서 = 흐름 순서, 브릿지, 숫자로 말하기, 보여 주는 방식). 시나리오를 쓰기 전과 결과를 보여 주기 전에 이 목록으로 점검한다
- `references/structures/`: 영상 구조 모음. 지금은 `usecase-flow.md`(입력 하나가 처리 단계를 지나 결과가 되는 과정, 사용자의 기본 구조)와 뼈대 `assets/scenarios/template-usecase-flow.mjs`. 맞는 구조가 없으면 사용자와 장면 순서를 먼저 정하고, 자리 잡으면 이 폴더에 새 구조 문서로 남긴다

## 흐름

0. **구성 정하기**: 무엇을 어떤 순서로 보여 줄지 구조를 고르고(`references/structures/`), 장면 표(장면, 화면, 흐름 띠, 핵심)를 사용자와 맞춘다. 흐름 띠를 쓰면 장면 순서를 그 흐름 순서로 짠다
1. **화면 살피기**: ego로 대상 페이지를 열어 선택자를 정한다(`ego-browser skill` 안내를 따름). 버튼은 `aria-label`·`data-*` 속성, 제목은 `{css:"h2", text:"…"}`처럼 고른다.
2. **시나리오 쓰기**: 형식은 `references/scenario-format.md`, 예시는 `assets/scenarios/example.mjs`(단순)·`assets/scenarios/template-usecase-flow.mjs`(브릿지·흐름 띠·기다림·걸린 시간까지 갖춘 뼈대). 회사 주소·실명이 들어가면 스킬 폴더·git 저장소 밖에 둔다. 실명은 파일에 쓰지 말고 `text: "${me}"` + `--var me=…`로, 이메일은 `pattern`(모양)으로 가린다. 가리기 규칙에 쓰인 변수는 `run.mjs`·`timeline.json`에 `***`로 남고, 값은 실행 뒤 지워지는 임시 파일로만 넘어간다. 단, 셸 명령 기록에는 남는다.
3. **검사**: `node <skill>/scripts/cli.mjs validate <시나리오>`
4. **시험 실행**(녹화 없이 단계만, 단계마다 화면 1장): `node <skill>/scripts/cli.mjs dry <시나리오> [--var k=v] [--space <id>]`
   - 되돌릴 수 없는 단계(티켓 만들기 등)는 `dryRun:"skip"`이라 실행되지 않는다
5. **미리보기 시트**: `uv run --no-project --with imageio-ffmpeg --with pillow python <skill>/scripts/editor/dr_edit.py preview <출력폴더>` → `preview.png`를 열어 사용자에게 보여 주고 자막 문구·상자·가리기 범위를 확인받는다. `⚠`가 붙은 칸은 상자가 움직였거나 다른 요소에 가려진 것이다
6. **녹화**: 사용자에게 "ego 창을 화면 앞에 두고 가리지 말 것"을 알린 뒤 `node <skill>/scripts/cli.mjs record <시나리오> …`. 되돌릴 수 없는 단계가 있으면 이 실행 전에 사용자 승인을 받는다
   - 되돌릴 수 없는 단계 뒤에서 실패하면 다시 처음부터 하지 말고 `--from <단계 id> --var key=<만든 값>`으로 그 단계부터 다시 찍는다
   - 되돌릴 수 없는 단계 뒤의 화면은 시험 실행에서 볼 수 없으므로, 같은 가리기 규칙으로 그 화면(기존 데이터)을 여는 작은 시나리오를 먼저 녹화해 확인한다
7. **가리기 확인**: `… scripts/editor/dr_edit.py transitions <출력폴더>` → `transitions.png`(페이지가 바뀌거나 캡처가 멈췄다 다시 시작한 직후 3장씩)와 `preview`(실제 프레임)를 열어 이름·이메일·아바타가 흐린지 본다. 새면 영상을 만들지 말고 가리기 규칙을 고쳐 다시 녹화
8. **영상**: `… scripts/editor/dr_edit.py render <출력폴더>` → `video.mp4`(1920×1080 30fps, 자막 입힘) + `video.srt`
   - 자막 없는 영상: `--no-burn` / 작게: `--scale 0.667` / 기다림 처리 바꾸기(다시 녹화 없이): `--wait-edit cut|keep|speed:8` / 파일 이름: `--name v2.mp4`
   - 미리보기·영상 명령은 자막이 2초보다 짧게 보이거나 영상이 5분을 넘으면 `경고:`를 낸다. 경고가 없을 때 보여 준다
   - 강조 번호는 페이지 배율에 맞춰 크기를 정하고 상자 왼쪽 위 바깥에 둔다(내용을 가리지 않게)
   - 페이지 로딩 중 멈춘 화면(캡처를 일부러 멈춘 구간)은 0.5초만 남긴다. 그대로 두려면 `--keep-gaps`
9. **확인**: 영상에서 몇 장을 뽑아 본다(`ffmpeg -i video.mp4 -vf "fps=1/4,scale=480:-1,tile=4x4" -frames:v 1 sheet.jpg`, ffmpeg는 `imageio_ffmpeg.get_ffmpeg_exe()`)
10. **마무리**: 사용자가 브라우저 작업을 끝내라고 하면 `node <skill>/scripts/cli.mjs finish <spaceId>`. 산출물 위치를 알린다. 영상·프레임은 저장소에 넣지 않는다

출력 폴더 기본값은 `~/ego/demo-recorder-out/<이름>-<날짜시각>/`(`DEMO_RECORDER_OUT`로 바꿈). 프로젝트 안에 두려면 git 제외 폴더를 쓴다: `.gitignore`에 `.demo-recorder/`를 넣고 `--out <repo>/.demo-recorder/out/<이름>`, 시나리오는 `<repo>/.demo-recorder/scenarios/`. 완성 영상만 제출 폴더로 복사한다. git이 추적하는 폴더면 CLI가 거부한다(프레임이 커밋되지 않게).

## 출력 폴더

`run.mjs`(ego 실행 파일, 가리기 변수는 빠짐), `frames/`(가린 뒤의 화면), `timeline.json`(단계별 시각·상자 위치·커서·기다림 구간), `preview.png`, `preview/`, `video.mp4`, `video.srt`, 실패하면 `fail/`(screen.jpg, snapshot.txt, url.txt)

## 실패했을 때

- `기대 화면이 … 나오지 않았습니다`: `fail/screen.jpg`와 `snapshot.txt`를 읽고 시나리오의 `expect`나 선택자를 고친다. 새 task space로 피하지 말고 `--space <id>`로 같은 공간에서 다시
- `화면 캡처가 3초 넘게 실패`: ego 창이 가려졌거나 최소화됨. 앞으로 꺼내고 다시
- `가리기 대상이 화면에 없습니다`: 가리기 선택자가 안 맞음. 조용히 넘어가지 않으려고 멈춘 것이니 선택자를 고친다
- `스크롤 대상을 찾지 못함`: 글자가 정확한지, 지연 로딩이면 `search`를 늘린다
- `가리기 규칙의 변수가 비어 있습니다`: `--var`를 빠뜨림. 가려지지 않은 채 찍히지 않도록 멈춘 것
- `demo-recorder가 만든 공간이 아닙니다`: `--space`에는 demo-recorder가 만든 task space 번호만 쓴다(사용자 탭을 닫지 않기 위해)
- `fail/screen.jpg`·`snapshot.txt`는 가린 뒤 화면이지만 snapshot 글에는 이름이 들어 있을 수 있다. 공유하지 않는다
- 텍스트 `expect`가 엉뚱한 곳(빵부스러기 메뉴 등)에 맞아 일찍 통과할 수 있다. 화면에 하나뿐인 글자를 쓴다

## 알려진 한계

- 녹화 중 ego 창이 화면에 보여야 한다(Chrome이 가려진 창을 그리지 않음)
- ego가 screencast ack를 막아 `Page.captureScreenshot`을 반복 호출한다(약 20fps). 영상은 30fps로 다시 맞춘다
- 상자 위치는 멈춘 구간(hold)에서 앞뒤 두 번 잰다. 멈춘 동안 화면이 움직이면 미리보기에 경고만 한다
- 커서는 실제 마우스가 아니라 편집에서 그린 것이다(누르기 전 0.45초 이동 + 누를 때 물결)
- "기다리는 동안 다른 탭 소개"는 따로 없다. 기다림 단계 앞에 다른 탭 단계를 두고 남은 기다림을 `cut`/`speed`로 처리한다

## 개발

- 테스트: `node --test <skill>/scripts/tests/schema.test.mjs`, `uv run --no-project --with pillow python -m unittest discover -s <skill>/scripts/tests`
- 구조: `scripts/cli.mjs`(명령) → `recorder/runner.mjs`(ego 안에서 단계 실행) + `capture.mjs`(캡처 루프) + `pagekit.mjs`(페이지 안 함수) + `schema.mjs`(검사) / `editor/dr_edit.py`(미리보기·렌더) + `timemap.py` + `draw.py`

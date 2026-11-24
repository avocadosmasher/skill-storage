# demo-recorder 설계

브라우저 시연을 시나리오대로 조작하며 페이지 화면만 녹화하고, 편집에서 자막·강조 상자·번호·커서·브릿지 카드를 입혀 영상으로 만드는 스킬. 사람이 캡처 도구로 찍고 편집 앱으로 자르던 일을, 다시 찍어도 같은 결과가 나오는 파일(시나리오) 하나로 바꾸는 것이 의도다. 2026-11-24 한 PoC의 공모전 데모 영상을 만들며 처음 썼다.

## 현재 원칙

1. 녹화는 실제 로그인된 브라우저(ego lite)를 조작한다. 요청을 가짜로 바꾸거나 새 브라우저를 띄우지 않는다 ([001](./001-capture-with-ego-screenshots.md))
2. 개인정보는 캡처 전에 페이지에서 흐리게 하고, 실명은 파일에 쓰지 않는다 ([002](./002-redact-in-page-before-capture.md))
3. 화면 위 설명(자막·상자·번호·커서·카드)은 편집에서 그린다. 문구를 고쳐도 다시 녹화하지 않는다 ([003](./003-draw-overlays-in-post.md))
4. 영상 구성은 보는 사람이 따라오는 쪽으로: 읽을 시간, 가리지 않는 번호, 흐름 순서대로의 장면, 장면 사이 다리 ([004](./004-viewer-first-composition.md))

## 결정 목록

| 번호 | 결정 | 상태 |
| --- | --- | --- |
| [001](./001-capture-with-ego-screenshots.md) | 녹화는 ego lite 조작 + `Page.captureScreenshot` 반복, 화면 크기는 에뮬레이션으로 고정 | 채택 |
| [002](./002-redact-in-page-before-capture.md) | 가리기는 페이지에서, 캡처 전에. 가리기 변수는 파일에 `***` | 채택 |
| [003](./003-draw-overlays-in-post.md) | 시나리오(.mjs) → 녹화기(Node, ego 안) → 시간표(JSON) → 편집기(Python, Pillow·ffmpeg) | 채택 |
| [004](./004-viewer-first-composition.md) | 사용자 피드백으로 정한 영상 구성 원칙과 기본 구조(유즈케이스 흐름) | 채택 |

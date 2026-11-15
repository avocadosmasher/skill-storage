# 003. 1.2 그림은 diagram-design으로 그린 SVG를 기본으로 붙인다

- 날짜: 2026-11-16
- 상태: 채택
- 반영: Unreleased

## 배경

한 프로젝트의 중간 결과 보고서를 이 스킬로 만든 뒤, 사용자가 1.2의 HTML 상자 그림(`.wf`)보다 층별 패널 · 아이콘 · 번호 단계가 있는 아키텍처 그림을 원했다. 같은 내용을 스킬 네 개(archify, diagram-design, excalidraw-diagram-generator, cocoon architecture-diagram)로 샌드박스에서 그려 견준 결과, 사용자가 diagram-design을 골랐다. 그림을 PNG로 넣어 보니 두 그림이 같은 것을 보여 중복이었고, 검사 스크립트가 `<img>` · `<svg>`를 실패로 막았다. 디자인 명세의 글은 "이미지"만 금지하고 SVG를 말하지 않아, 문서와 검사가 어긋나 있었다.

사용자 질문 두 가지: 이미지가 아니라 그림 자체로 넣을 수 있는가, diagram-design을 이 스킬에 편입해도 라이선스 문제가 없는가.

## 선택지

- **A. PNG 이미지를 넣도록 허용**: 쉽지만 확대하면 흐리고, 그림 속 글을 고르거나 찾을 수 없고, 파일이 따로 남는다.
- **B. diagram-design SVG를 그림 부품에 그대로 붙임, diagram-design은 별도 스킬로 불러 씀**: 선명하고 한 파일로 끝난다. diagram-design 코드를 복사하지 않아 라이선스 고지 의무가 없고 업스트림 업데이트를 그대로 따른다. diagram-design이 설치되어 있어야 한다.
- **C. B와 같지만 diagram-design의 규칙 · 아이콘을 이 스킬로 복사**: 의존성이 없지만 MIT 고지를 함께 넣어야 하고 업데이트를 직접 해야 한다.

## 결정

B. 원문 확인(2026-11-16): diagram-design은 MIT(Copyright (c) 2025 Cathryn Lavery), 아이콘은 Tabler Icons(MIT) · Simple Icons(CC0). 불러 쓰기만 하므로 고지할 것이 없다.

- 틀에 그림 부품 `figure.fig`(범례 `.legend2` + `.scroll` 안의 SVG + `figcaption`)를 더하고 CSS를 v2로 올렸다. 모바일에서는 SVG를 760px로 고정하고 옆으로 밀어 본다.
- `references/diagram-style.md`: diagram-design에 넘길 값(Architecture, `doc-inline`, Font source `system`, 무채색 층 패널, 범례는 SVG 밖), 스타일 토큰, 칸 색 다섯 가지의 채움 · 테두리 값, `export_svg.py --system-fonts`로 SVG를 꺼내 붙이는 순서, 허용 · 금지 목록.
- 칸 색의 뜻(누가 언제 만들었나)은 그대로 둔다. 층 패널에 색을 넣지 않는 이유는 칸 색의 뜻이 흐려지기 때문이다.
- `.wf`는 지우지 않고 diagram-design이 없을 때 쓰는 대안으로 남긴다. 한 보고서에 1.2 그림은 하나다.
- 검사 스크립트: figure 안의 SVG 하나만 허용하고, id · `role="img"` · `aria-labelledby` · 첫 자식 `<title>` · `<desc>`를 요구한다. SVG 안의 script · foreignObject · image · on… 속성 · 외부 주소 · `@import` · `@font-face`를 막고, SVG 안 `<style>` 규칙은 그 SVG의 `#id`로 시작해야 한다. 칸 채움 색으로 쓴 칸 색을 찾아 범례와 맞춘다(아직 안 한 것은 점선 테두리 색 `#c8c8c8`로 찾는다). em dash · 이모지 검사는 SVG 글에도 적용한다.
- 화살표 선이 출발 · 도착이 아닌 층 패널이나 칸을 가로지르면 실패로 막는다. 첫 실제 그림에서 "노트 서비스 → 변환 기록" 선이 외부 서비스 층을 지나가, 사용자가 "그 영역을 데이터가 실제로 지나간다고 오해할 수 있다"고 짚었다. diagram-design의 `verify_geometry.py`는 칸 뒤로 지나가는 선만 보고 층 패널은 보지 않아 이 그림을 통과시켰다. 규칙 글만으로는 다시 생길 수 있어 검사로 막았다.

## 버린 것과 미룬 것

- A는 선명도와 한 파일 원칙 때문에 버렸다.
- C는 업데이트 비용 때문에 버렸다. diagram-design이 사라지거나 크게 바뀌면 다시 본다.
- SVG 안 글 길이(칸 이름 14자 · 설명 35자)를 기계로 재는 일은 미뤘다. diagram-design의 `self_check.py`가 칸 넘침을 재고, 글 길이는 diagram-style.md에 규칙으로만 둔다.

## 다시 볼 신호

- diagram-design이 설치되지 않은 환경이 잦아 `.wf`가 기본처럼 쓰인다.
- 붙인 SVG가 보고서 폭에서 글이 너무 작아 읽기 어렵다는 말이 나온다(`doc-inline` 폭 960을 다시 본다).
- diagram-design의 SVG 구조가 바뀌어 검사의 `<style>` 범위 규칙이나 칸 색 찾기가 맞지 않는다.

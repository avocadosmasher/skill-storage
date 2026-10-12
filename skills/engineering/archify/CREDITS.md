# Credits

이 스킬은 [tt-a1i](https://github.com/tt-a1i)가 만든 [`archify`](https://github.com/tt-a1i/archify) 저장소의 `archify/` 스킬 패키지를 그대로 들여온 것입니다. 원본은 커밋 [`58ab0b9`](https://github.com/tt-a1i/archify/commit/58ab0b9)(2026-10-10)를 기준으로 가져왔습니다. `archify` 자체는 Cocoon AI의 `architecture-diagram-generator`(v1.0, MIT)를 바탕으로 만들어졌습니다.

업스트림은 이 스킬 패키지 말고도 웹사이트, 뷰어, 벤치마크, 테스트 스위트 등 훨씬 큰 저장소입니다. 이 저장소에는 다이어그램을 그리는 런타임에 필요한 부분만 가져왔습니다. `test/`, `package.json`/`package-lock.json`(개발 의존성), 렌더링된 예시 `.html` 쇼케이스, 검증기·브랜드 마크를 재생성하는 빌드용 스크립트(`scripts/generate-validators.mjs`, `scripts/generate-brand-marks.mjs`)는 빼고, 그 결과물(`renderers/shared/generated-validators.mjs`, `renderers/shared/generated-brand-marks.mjs`)만 포함했습니다.

가져온 파일은 [AGENTS.md](../../../AGENTS.md)의 "외부에서 가져온 콘텐츠" 규칙에 따라 원문(영어, em-dash 포함)을 그대로 유지합니다. 이 저장소에서 더한 것은 Codex용 메타데이터 `agents/openai.yaml`과 이 파일뿐입니다.

업스트림이 업데이트되면 다시 같은 방식으로 받아와야 합니다. `archify`는 자체 업데이트 알림 기능(`skill-release.json`, `scripts/check-update.mjs`)을 포함하고 있는데, 이 알림은 업스트림 자신의 배포 채널(`https://tt-a1i.github.io/archify/...`)을 가리키며 이 저장소의 복사본과는 무관합니다.

## 원본 라이선스

원본은 **MIT**입니다. 저작권 표기는 `LICENSE` 파일에 그대로 들어 있습니다.

```
MIT License

Copyright (c) 2026 tt-a1i (Archify)
Copyright (c) 2025 Cocoon AI

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

서드파티 구성 요소(폰트, 아이콘 세트 등)의 추가 출처는 `THIRD_PARTY_NOTICES.md`에 있습니다.

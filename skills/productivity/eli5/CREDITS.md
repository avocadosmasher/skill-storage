# Credits

이 스킬은 [Thariq Shihipar](https://github.com/ThariqS)가 만든 `eli5` 플러그인의 스킬을 그대로 옮긴 것입니다. 원본은 Anthropic의 커뮤니티 플러그인 마켓플레이스 [`anthropics/claude-plugins-community`](https://github.com/anthropics/claude-plugins-community/tree/863e70d/eli5)(`eli5@claude-community`, 커밋 `863e70d`, 2026-08-21)에 있습니다.

`SKILL.md`는 원본과 한 글자도 다르지 않습니다. 이 저장소에서 더한 것은 Codex용 메타데이터 `agents/openai.yaml`과 이 파일뿐입니다.

원본을 직접 설치하려면:

```bash
claude plugin marketplace add anthropics/claude-plugins-community
claude plugin install eli5@claude-community
```

## 원본 라이선스

원본 플러그인의 `plugin.json`은 라이선스를 **MIT**로, 저작자를 Thariq Shihipar로 밝히고 있습니다(원본에 별도의 저작권 줄은 없습니다). 원본이 들어 있는 저장소 전체는 [Apache License 2.0](https://github.com/anthropics/claude-plugins-community/blob/863e70d/LICENSE)입니다. 두 라이선스 모두 출처와 라이선스 문구를 밝히는 조건으로 재배포를 허용합니다. MIT 허가 문구는 다음과 같습니다.

```
MIT License

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

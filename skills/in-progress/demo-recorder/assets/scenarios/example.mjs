// 공개용 예시: 위키백과 문서를 열어 제목을 강조하고 목차 항목으로 천천히 내려간다.
// node <skill>/scripts/cli.mjs dry <skill>/assets/scenarios/example.mjs
export default {
  name: "example",
  viewport: { width: 1280, height: 720, dpr: 1.5 },
  steps: [
    { id: "e1", scene: "첫 화면", page: "main", goto: "https://en.wikipedia.org/wiki/Screencast",
      expect: { selector: "#firstHeading", timeout: 20000 },
      caption: "① 문서 제목입니다",
      highlight: [{ target: { css: "#firstHeading" }, n: 1 }] },
    { id: "e2", scroll: { by: 600, speed: 400 }, caption: "천천히 아래로 내립니다" },
    { id: "e3", scroll: { to: { css: "h2" }, align: 0.2, speed: 400 },
      caption: "첫 번째 절 제목으로 갑니다",
      highlight: [{ target: { css: "h2" } }] },
  ],
};

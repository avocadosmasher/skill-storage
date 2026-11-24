// 뼈대: 유즈케이스 흐름 구조 (references/structures/usecase-flow.md)
// 복사해서 <…> 자리를 채운다. 회사 주소·실명이 들어가면 스킬 폴더·git 저장소 밖에 둔다.
// 이 파일 그대로는 validate만 통과하는 견본이다(주소가 example.org).
const BASE = "https://example.org";

export default {
  name: "usecase-flow-template",
  viewport: { width: 1920, height: 1080, dpr: 1 },
  flow: {
    // 아키텍처 단계: 왼쪽→오른쪽 = 처리 순서 = 장면 순서
    stages: ["입력", "받기", "단계 A", "단계 B", "단계 C", "결과"],
    numbered: ["단계 A", "단계 B", "단계 C", "결과"],
    span: ["받기", "결과"],
    note: "<서비스 이름> · <지켜야 할 규칙 한 줄>",
  },
  intro: { kicker: "<제품 이름> · 시연", title: "<입력 하나가 결과가 되기까지>", sub: "모든 값은 지어낸 가상 데이터입니다", active: "all", ms: 4000 },
  outro: { kicker: "정리", title: "<보는 사람에게 남길 한 문장>", sub: "<근거 한 줄>", active: "all", ms: 4500 },
  vars: { key: "" },
  redact: [
    // 실명은 파일에 쓰지 말고 --var me="…" 로: { url: "<사이트>", text: "${me}" }
    // 이메일은 모양으로: { url: "<사이트>", pattern: String.raw`[\w.+-]+@(?!<가상도메인>)[\w-]+\.[a-z]{2,}` }
  ],
  steps: [
    // 장면 1. 입력
    { id: "i1", scene: "입력", page: "form", goto: `${BASE}/`, expect: { text: "Example" },
      caption: "<어디에서 무엇을 입력하는지>",
      bridge: { ms: 3000, kicker: "장면 1", title: "<입력이 들어옵니다>", sub: "<입력 화면 이름>", active: ["입력"] } },
    // 되돌릴 수 없는 제출: dryRun "skip", 새 번호는 capture로
    // { id: "i9", click: "<보내기 버튼>", dryRun: "skip", expect: { url: "<결과 주소 정규식>" },
    //   capture: { var: "key", from: "url", match: "(<번호 정규식>)" }, caption: "<보내면 무엇이 생기는지>" },

    // 장면 2. 받기·처리 대기 (기다림은 잘라 내고, 단계가 차례로 켜지게)
    { id: "w1", scene: "받기", page: "log", goto: `${BASE}/`, expect: { text: "Example" },
      caption: "<처리 기록 화면 소개>",
      bridge: { ms: 3000, kicker: "장면 2", title: "<서비스가 입력을 받습니다>", sub: "<받는 방법 한 줄>", active: ["받기"] } },
    { id: "w2", wait: { ms: 3000, edit: "cut", keep: [2000, 2500] }, sweep: ["단계 A", "결과"],
      caption: "<단계가 도는 동안 기다립니다 (편집으로 줄임)>", hold: 300 },
    { id: "w3", caption: "<입력을 보낸 지 약 ${since:i1} 만에 결과가 나왔습니다 (영상은 기다림을 줄임)>" },

    // 장면 3…n. 처리 단계마다 (흔적이 남는 화면, 흐름 순서 그대로)
    { id: "a1", scene: "단계 A", scroll: { by: 300, speed: 400 },
      caption: "1 단계 A: <이 단계가 하는 일>",
      bridge: { ms: 3000, kicker: "장면 3", title: "1 단계 A: <한 줄>", sub: "<흔적이 보이는 화면>", active: ["단계 A"] } },
    { id: "b1", scene: "단계 B·C", scroll: { by: 300, speed: 400 },
      caption: "2 단계 B: <한 줄>",
      bridge: { ms: 3000, kicker: "장면 4", title: "2~3 <묶어서 한 줄>", sub: "<화면 이름>를 위에서 아래로", active: ["단계 B", "단계 C"] } },
    { id: "b2", scroll: { by: 300, speed: 400 }, caption: "3 단계 C: <한 줄>" },

    // 장면 n+1. 결과물 (사용자가 실제로 받는 화면)
    { id: "r1", scene: "결과", scroll: { by: -600, speed: 500 },
      caption: "<사용자가 받는 결과>",
      bridge: { ms: 3000, kicker: "장면 5", title: "4 결과: <누구에게 도착>", sub: "<결과 화면 한 줄>", active: ["결과"] } },

    // 장면 n+2. 운영 도구 (선택, 흐름 밖: 둘러보기만)
    { id: "o1", scene: "운영 도구", scroll: { by: 200, speed: 400 },
      caption: "<운영 화면에서 할 수 있는 일>",
      bridge: { ms: 3000, kicker: "장면 6", title: "운영 도구: <이름>", sub: "흐름 밖에서 <무엇을> 봅니다", active: [], done: "all" } },
  ],
};

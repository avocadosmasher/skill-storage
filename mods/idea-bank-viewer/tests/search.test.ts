import { expect, test } from 'claude-code/testing'

const card = (meta: Record<string, unknown>, body: string) =>
  `---\n${JSON.stringify({ schema_version: 1, kind: 'app', tags: [], related_ids: [], source: '', status: 'inbox', ...meta }, null, 2)}\n---\n${body}`

const FILES: Record<string, string> = {
  '/bank/ideas/IB-20261013-120000-aaaa.md': card(
    { id: 'IB-20261013-120000-aaaa', title: '캐릭터 TTS', summary: '낭독 서비스', tags: ['음성', 'Tts'], created_at: '2026-10-13T12:00:00+09:00', updated_at: '2026-10-13T12:00:00+09:00' },
    '\n# 캐릭터 TTS\n\n## 사용자 원문\n\n책을 읽어주는 서비스.\n\n## AI 첨언 (미검증 제안)\n\n저작권 확인 필요.',
  ),
  '/bank/ideas/IB-20261012-120000-bbbb.md': card(
    { id: 'IB-20261012-120000-bbbb', title: '독서 기록 앱', summary: '읽은 책 기록', tags: ['책'], created_at: '2026-10-12T12:00:00+09:00', updated_at: '2026-10-12T12:00:00+09:00' },
    '\n# 독서 기록 앱\n\n## 사용자 원문\n\n읽은 책을 기록한다.',
  ),
  '/bank/ideas/IB-20261011-120000-cccc.md': card(
    { id: 'IB-20261011-120000-cccc', title: '자동 정산', summary: '영수증 정산', created_at: '2026-10-11T12:00:00+09:00', updated_at: '2026-10-11T12:00:00+09:00' },
    '\n# 자동 정산\n\n## 사용자 원문\n\n영수증을 모아 정산.',
  ),
}

const PANE_PROPS = {
  title: '아이디어 뱅크',
  isFocused: true,
  bodyColumns: 60,
  placement: 'dock' as const,
  scroll: { offset: 0, bodyRows: 40 },
  view: {},
}

const A = 'idea:IB-20261013-120000-aaaa'
const B = 'idea:IB-20261012-120000-bbbb'
const C = 'idea:IB-20261011-120000-cccc'

test('search filters the list by title, summary, tags and body', { options: { bankPath: '/bank' } }, async ($, on) => {
  const tail = (path: string) => path.replace(/\\/g, '/').replace(/^[A-Za-z]:/, '')
  on('fs.exists', async (_$, e) => ({ value: tail(e.path) === '/bank/ideas' }))
  on('fs.list', async () => ({
    value: Object.keys(FILES).map(path => ({ name: path.split('/').pop()!, kind: 'file' as const, size: 1, mtimeMs: 1, isLink: false })),
  }))
  on('fs.read', async (_$, e) => ({ value: FILES[tail(e.path)]! }))

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'idea-bank-viewer', surface, component: 'Pane', requestId: 'idea-bank', props: PANE_PROPS })
    const type = (text: string) => ui.input({ key: 'search', text, kind: 'change' })

    expect(await ui.find({ key: A })).toBeDefined()
    expect(await ui.find({ key: B })).toBeDefined()
    expect(await ui.find({ key: C })).toBeDefined()

    // 태그 (대소문자 무시)
    await type('tts')
    expect(await ui.find({ key: A })).toBeDefined()
    expect(await ui.find({ key: B })).toBeUndefined()
    expect(await ui.find({ key: C })).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: /1개/ })).toBeDefined()

    // 본문 (AI 첨언 포함)
    await type('저작권')
    expect(await ui.find({ key: A })).toBeDefined()
    expect(await ui.find({ key: B })).toBeUndefined()

    // 요약
    await type('영수증')
    expect(await ui.find({ key: C })).toBeDefined()
    expect(await ui.find({ key: A })).toBeUndefined()

    // 여러 단어는 AND
    await type('책 기록')
    expect(await ui.find({ key: B })).toBeDefined()
    expect(await ui.find({ key: A })).toBeUndefined()
    await type('책 정산')
    expect(await ui.find({ key: B })).toBeUndefined()
    expect(await ui.find({ key: C })).toBeUndefined()

    // 결과 없음 안내
    await type('없는단어')
    expect(await ui.find({ type: 'Text', text: /검색 결과가 없습니다/ })).toBeDefined()

    // 지우면 전체 복귀
    await ui.press({ key: 'clear-search' })
    expect(await ui.find({ key: A })).toBeDefined()
    expect(await ui.find({ key: B })).toBeDefined()
    expect(await ui.find({ key: C })).toBeDefined()
    await ui.unmount()
  }
})

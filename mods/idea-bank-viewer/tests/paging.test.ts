import { expect, test } from 'claude-code/testing'

const days = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'))
const idOf = (dd: string) => `IB-202610${dd}-120000-a0${dd}`

const card = (dd: string) =>
  `---\n${JSON.stringify(
    {
      schema_version: 1, id: idOf(dd), title: `아이디어 ${dd}`, summary: `요약 ${dd}`, kind: 'app', tags: [], related_ids: [],
      source: '', status: 'inbox', created_at: `2026-10-${dd}T12:00:00+09:00`, updated_at: `2026-10-${dd}T12:00:00+09:00`,
    },
    null,
    2,
  )}\n---\n\n# 아이디어 ${dd}\n\n## 사용자 원문\n\n본문 ${dd}${dd === '03' ? ' 특별' : ''}`

const FILES: Record<string, string> = Object.fromEntries(days.map(dd => [`/bank/ideas/${idOf(dd)}.md`, card(dd)]))

const PANE_PROPS = {
  title: '아이디어 뱅크',
  isFocused: true,
  bodyColumns: 60,
  placement: 'dock' as const,
  scroll: { offset: 0, bodyRows: 40 },
  view: {},
}

const row = (dd: string) => `idea:${idOf(dd)}`

test('lists 10 ideas per page with next/prev and a page indicator', { options: { bankPath: '/bank' } }, async ($, on) => {
  const tail = (path: string) => path.replace(/\\/g, '/').replace(/^[A-Za-z]:/, '')
  on('fs.exists', async (_$, e) => ({ value: tail(e.path) === '/bank/ideas' }))
  on('fs.list', async () => ({
    value: Object.keys(FILES).map(path => ({ name: path.split('/').pop()!, kind: 'file' as const, size: 1, mtimeMs: 1, isLink: false })),
  }))
  on('fs.read', async (_$, e) => ({ value: FILES[tail(e.path)]! }))

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'idea-bank-viewer', surface, component: 'Pane', requestId: 'idea-bank', props: PANE_PROPS })

    // 1페이지: 최신 10개 (12 ~ 03)
    expect(await ui.find({ type: 'Text', text: /1 \/ 2 페이지/ })).toBeDefined()
    expect(await ui.find({ key: row('12') })).toBeDefined()
    expect(await ui.find({ key: row('03') })).toBeDefined()
    expect(await ui.find({ key: row('02') })).toBeUndefined()
    expect(await ui.find({ key: 'prev-page' })).toBeUndefined()

    // 2페이지: 나머지 2개
    await ui.press({ key: 'next-page' })
    expect(await ui.find({ type: 'Text', text: /2 \/ 2 페이지/ })).toBeDefined()
    expect(await ui.find({ key: row('02') })).toBeDefined()
    expect(await ui.find({ key: row('01') })).toBeDefined()
    expect(await ui.find({ key: row('12') })).toBeUndefined()
    expect(await ui.find({ key: 'next-page' })).toBeUndefined()

    // 상세 보기에서 돌아와도 보던 페이지 유지
    await ui.press({ key: row('01') })
    await ui.press({ key: 'back' })
    expect(await ui.find({ type: 'Text', text: /2 \/ 2 페이지/ })).toBeDefined()
    expect(await ui.find({ key: row('01') })).toBeDefined()

    // 이전 페이지
    await ui.press({ key: 'prev-page' })
    expect(await ui.find({ type: 'Text', text: /1 \/ 2 페이지/ })).toBeDefined()
    expect(await ui.find({ key: row('12') })).toBeDefined()

    // 검색어가 바뀌면 1페이지로 돌아가고, 결과가 한 페이지면 페이지 이동이 사라진다
    await ui.press({ key: 'next-page' })
    await ui.input({ key: 'search', text: '아이디어', kind: 'change' })
    expect(await ui.find({ type: 'Text', text: /1 \/ 2 페이지/ })).toBeDefined()
    await ui.input({ key: 'search', text: '특별', kind: 'change' })
    expect(await ui.find({ key: row('03') })).toBeDefined()
    expect(await ui.find({ key: 'next-page' })).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: /페이지/ })).toBeUndefined()
    await ui.press({ key: 'clear-search' })
    await ui.unmount()
  }
})

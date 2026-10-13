import { expect, mock, test } from 'claude-code/testing'

const card = (meta: Record<string, unknown>, body: string) =>
  `---\n${JSON.stringify({ schema_version: 1, kind: 'app', tags: [], related_ids: [], source: '', ...meta }, null, 2)}\n---\n${body}`

const FILES: Record<string, string> = {
  '/bank/ideas/IB-20261013-120937-aaaa.md': card(
    {
      id: 'IB-20261013-120937-aaaa',
      title: '캐릭터 TTS',
      summary: '캐릭터 파일로 낭독자를 꾸미는 TTS 서비스',
      status: 'inbox',
      created_at: '2026-10-13T12:09:37+09:00',
      updated_at: '2026-10-14T09:00:00+09:00',
    },
    '\n# 캐릭터 TTS\n\n## 사용자 원문\n\n책을 올리면 읽어주는 서비스.\n\n## AI 첨언 (미검증 제안)\n\n음성 복제 약관 확인 필요.' +
      '\n\n## 추가 기록 · 2026-10-14T09:00:00+09:00\n\n## 구체화\n문제: 긴 글을 눈으로 읽기 힘듦',
  ),
  '/bank/ideas/IB-20261001-100000-bbbb.md': card(
    {
      id: 'IB-20261001-100000-bbbb',
      title: '보관된 것',
      summary: '예전에 보관한 아이디어',
      status: 'archived',
      created_at: '2026-10-01T10:00:00+09:00',
      updated_at: '2026-10-01T10:00:00+09:00',
    },
    '\n# 보관된 것\n\n## 사용자 원문\n\n옛날 생각',
  ),
  '/bank/ideas/IB-20261002-100000-cccc.md': 'not a card',
}

const PANE_PROPS = {
  title: '아이디어 뱅크',
  isFocused: true,
  bodyColumns: 60,
  placement: 'dock' as const,
  scroll: { offset: 0, bodyRows: 40 },
  view: {},
}

test('lists ideas by summary and splits original from AI notes', { options: { bankPath: '/bank' } }, async ($, on) => {
  const tail = (path: string) => path.replace(/\\/g, '/').replace(/^[A-Za-z]:/, '')
  on('fs.exists', async ($, e) => ({ value: tail(e.path) === '/bank/ideas' }))
  on('fs.list', async () => ({
    value: Object.keys(FILES).map(path => ({ name: path.split('/').pop()!, kind: 'file' as const, size: 1, mtimeMs: 1, isLink: false })),
  }))
  on('fs.read', async ($, e) => {
    const text = FILES[tail(e.path)]
    if (text === undefined) throw new Error('ENOENT')
    return { value: text }
  })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'idea-bank-viewer', surface, component: 'Pane', requestId: 'idea-bank', props: PANE_PROPS })

    const row = await ui.find({ key: 'idea:IB-20261013-120937-aaaa' })
    expect(row?.text).toContain('캐릭터 파일로 낭독자를 꾸미는 TTS 서비스')
    expect(await ui.find({ key: 'idea:IB-20261001-100000-bbbb' })).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: /읽지 못한 카드 1개/ })).toBeDefined()

    await ui.press({ key: 'archived' })
    expect(await ui.find({ key: 'idea:IB-20261001-100000-bbbb' })).toBeDefined()
    await ui.press({ key: 'archived' })

    await ui.press({ key: 'idea:IB-20261013-120937-aaaa' })
    const original = await ui.find({ key: 'sec:0' })
    const assistant = await ui.find({ key: 'sec:1' })
    const note = await ui.find({ key: 'sec:2' })
    expect(original?.text).toContain('사용자 원문')
    expect(original?.text).toContain('책을 올리면 읽어주는 서비스.')
    expect(original?.text).not.toContain('음성 복제')
    expect(assistant?.text).toContain('AI 첨언 (미검증 제안)')
    expect(assistant?.text).toContain('음성 복제 약관 확인 필요.')
    expect(note?.text).toContain('추가 기록 · 2026-10-14 09:00')
    expect(note?.text).toContain('문제: 긴 글을 눈으로 읽기 힘듦')
    expect(await ui.find({ key: 'sec:3' })).toBeUndefined()

    await ui.press({ key: 'back' })
    expect(await ui.find({ key: 'idea:IB-20261013-120937-aaaa' })).toBeDefined()
    await ui.unmount()
  }
})

test('says where it looked when the bank folder is missing', { options: { bankPath: '/nowhere' } }, async ($, on) => {
  on('fs.exists', async () => ({ value: false }))
  const ui = await $.ui.mount({ plugin: 'idea-bank-viewer', surface: 'terminal', component: 'Pane', requestId: 'idea-bank', props: PANE_PROPS })
  expect(await ui.find({ type: 'Text', text: /아이디어 폴더를 찾지 못했습니다/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '/nowhere/ideas' })).toBeDefined()
  await ui.unmount()
})

test('falls back to IDEA_BANK_PATH when bankPath is empty', async ($, on) => {
  mock.env(on, { IDEA_BANK_PATH: '/from-env', HOME: '/home/me' })
  on('fs.exists', async () => ({ value: false }))
  const ui = await $.ui.mount({ plugin: 'idea-bank-viewer', surface: 'terminal', component: 'Pane', requestId: 'idea-bank', props: PANE_PROPS })
  expect(await ui.find({ type: 'Text', text: '/from-env/ideas' })).toBeDefined()
  await ui.unmount()
})

test('falls back to idea-bank in the home folder when nothing is set', async ($, on) => {
  mock.env(on, { HOME: '/home/me' })
  on('fs.exists', async () => ({ value: false }))
  const ui = await $.ui.mount({ plugin: 'idea-bank-viewer', surface: 'terminal', component: 'Pane', requestId: 'idea-bank', props: PANE_PROPS })
  expect(await ui.find({ type: 'Text', text: '/home/me/idea-bank/ideas' })).toBeDefined()
  await ui.unmount()
})

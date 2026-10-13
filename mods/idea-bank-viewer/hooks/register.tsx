import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import { KIND_LABEL, STATUS_COLOR, STATUS_LABEL, matchesQuery, newestFirst, parseCard, shortDate } from './cards'
import type { Idea, Section, SectionKind } from './cards'

const PANE = 'idea-bank'
const TITLE = '아이디어 뱅크'
const PAGE_SIZE = 10
const selected = atom({ plugin: 'idea-bank-viewer', key: 'selected' } as const, null)
const showArchived = atom({ plugin: 'idea-bank-viewer', key: 'showArchived' } as const, false)
const query = atom({ plugin: 'idea-bank-viewer', key: 'query' } as const, '')
const page = atom({ plugin: 'idea-bank-viewer', key: 'page' } as const, 0)
const refresh = atom({ plugin: 'idea-bank-viewer', key: 'refresh' } as const, 0)

const SECTION_STYLE: Record<SectionKind, { label: string; color: string; border: string }> = {
  original: { label: '사용자 원문', color: 'suggestion', border: 'round' },
  assistant: { label: 'AI 첨언 (미검증 제안)', color: 'warning', border: 'dashed' },
  note: { label: '추가 기록', color: 'subtle', border: 'single' },
}

type Loaded = { ideas: Idea[]; unreadable: number; isMissing: boolean }

async function loadIdeas($: EngineInterface, bank: string): Promise<Loaded> {
  const dir = `${bank.replace(/[\\/]+$/, '')}/ideas`
  if (!(await $.fs.exists(dir))) return { ideas: [], unreadable: 0, isMissing: true }
  const files = (await $.fs.list(dir)).filter(f => f.kind === 'file' && /^IB-.+\.md$/.test(f.name))
  const parsed = await Promise.all(
    files.map(f =>
      $.fs
        .read(`${dir}/${f.name}`)
        .then(text => (typeof text === 'string' ? parseCard(text) : undefined))
        .catch(() => undefined),
    ),
  )
  const ideas = parsed.filter((idea): idea is Idea => idea !== undefined).sort(newestFirst)
  return { ideas, unreadable: parsed.length - ideas.length, isMissing: false }
}

// idea-banking 스킬과 같은 순서: 설정값, IDEA_BANK_PATH, 홈 폴더의 idea-bank
async function bankPath($: EngineInterface, configured: string): Promise<string> {
  if (configured.trim()) return configured.trim()
  const fromEnv = (await $.env.get('IDEA_BANK_PATH'))?.trim()
  if (fromEnv) return fromEnv
  const home = (await $.env.get('USERPROFILE')) ?? (await $.env.get('HOME')) ?? ''
  return `${home.replace(/[\\/]+$/, '')}/idea-bank`
}

function toTop($: EngineInterface) {
  void $.ui.scroll({ in: PANE, to: 'start' }).catch(() => undefined)
}

export const register: Register = (on, options) => {
  const configured = String(options.bankPath ?? '')

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'ideas',
      description: 'idea-banking에 저장한 아이디어 목록을 패널로 연다',
    })
    return next(e)
  })

  on('command.run', { command: 'ideas' }, async $ => {
    await $.ui.open({ id: PANE, title: TITLE, focus: true })
    return { text: '아이디어 뱅크 패널을 열었습니다.' }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button, Markdown, Input } = $.ui.resolve(e)
    await read($, refresh)
    const pick = await read($, selected)
    const withArchived = await read($, showArchived)
    const search = (await read($, query)) ?? ''
    const requestedPage = (await read($, page)) ?? 0
    const bank = await bankPath($, configured)
    const { ideas, unreadable, isMissing } = await loadIdeas($, bank)

    if (isMissing) {
      return (
        <Box flexDirection="column">
          <Text color="warning">아이디어 폴더를 찾지 못했습니다.</Text>
          <Text dimColor>{bank}/ideas</Text>
          <Text dimColor>/config 의 idea-bank-viewer bankPath나 환경 변수 IDEA_BANK_PATH를 확인하세요.</Text>
        </Box>
      )
    }

    const idea = pick === null ? undefined : ideas.find(one => one.id === pick)

    if (idea) {
      const row = (label: string, value: string, color?: string) => (
        <Box key={`meta:${label}`} flexDirection="row">
          <Box width={8}>
            <Text dimColor>{label}</Text>
          </Box>
          <Text {...(color ? { color } : {})}>{value}</Text>
        </Box>
      )
      const hasAssistant = idea.sections.some(s => s.kind === 'assistant')
      const section = (s: Section, i: number) => {
        const style = SECTION_STYLE[s.kind]
        return (
          <Box key={`sec:${i}`} flexDirection="column" borderStyle={style.border} borderColor={style.color} paddingX={1} marginTop={1}>
            <Text bold color={style.color}>
              {style.label}
              {s.when ? ` · ${shortDate(s.when)}` : ''}
            </Text>
            {s.kind === 'original' ? <Text>{s.text}</Text> : <Markdown text={s.text} />}
          </Box>
        )
      }

      return (
        <Box flexDirection="column">
          <Box flexDirection="row" gap={1}>
            <Button key="back" hotkey="b" autoFocus onPress={() => update($, selected, () => null).then(() => toTop($))}>
              ← 목록
            </Button>
            <Button key="refresh" hotkey="r" onPress={() => update($, refresh, n => (n ?? 0) + 1)}>
              새로고침
            </Button>
          </Box>
          <Box flexDirection="column" marginTop={1}>
            <Text bold>{idea.title}</Text>
            {idea.summary !== '' && <Text dimColor>{idea.summary}</Text>}
          </Box>
          <Box flexDirection="column" borderStyle="single" borderColor="subtle" paddingX={1} marginTop={1}>
            <Text bold dimColor>
              메타데이터
            </Text>
            {row('상태', STATUS_LABEL[idea.status] ?? idea.status, STATUS_COLOR[idea.status])}
            {row('종류', KIND_LABEL[idea.kind] ?? idea.kind)}
            {idea.tags.length > 0 && row('태그', idea.tags.map(tag => `#${tag}`).join('  '), 'suggestion')}
            {row('기록', shortDate(idea.createdAt))}
            {idea.updatedAt !== idea.createdAt && row('수정', shortDate(idea.updatedAt))}
            {idea.source !== '' && row('출처', idea.source)}
            {idea.relatedIds.length > 0 && row('관련', idea.relatedIds.join(', '))}
            {row('ID', idea.id)}
          </Box>
          {idea.sections.map(section)}
          {!hasAssistant && (
            <Box marginTop={1}>
              <Text dimColor>AI 첨언 없음</Text>
            </Box>
          )}
        </Box>
      )
    }

    const shown = withArchived ? ideas : ideas.filter(one => one.status !== 'archived')
    const hidden = ideas.length - shown.length
    const visible = shown.filter(one => matchesQuery(one, search))
    const searching = search.trim() !== ''
    const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE))
    const current = Math.min(Math.max(requestedPage, 0), pageCount - 1)
    const pageItems = visible.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE)
    const goTo = (n: number) => update($, page, () => n).then(() => toTop($))

    const columns = (e as unknown as { props?: { bodyColumns?: number } }).props?.bodyColumns ?? 60
    const divider = '─'.repeat(Math.max(10, columns - 6))
    const resetPage = () => update($, page, () => 0)

    return (
      <Box flexDirection="column">
        <Box key="toolbar" flexDirection="column" borderStyle="round" borderColor="subtle" paddingX={1}>
          <Box flexDirection="row" justifyContent="space-between">
            <Text bold>
              아이디어 {visible.length}개{hidden > 0 ? ` (보관 ${hidden}개 숨김)` : ''}
            </Text>
            <Box flexDirection="row" gap={1}>
              <Button key="refresh" hotkey="r" onPress={() => update($, refresh, n => (n ?? 0) + 1)}>
                새로고침
              </Button>
              <Button key="archived" hotkey="a" onPress={() => update($, showArchived, isOn => !isOn).then(resetPage)}>
                {withArchived ? '보관 숨기기' : '보관 포함'}
              </Button>
            </Box>
          </Box>
          <Box flexDirection="row" gap={1}>
            <Input
              key="search"
              label="검색"
              placeholder="제목·요약·태그·본문"
              value={search}
              onInput={value => void update($, query, () => value).then(resetPage)}
              onSubmit={value => void update($, query, () => value).then(resetPage)}
            />
            {searching && (
              <Button key="clear-search" onPress={() => update($, query, () => '').then(resetPage)}>
                검색 지우기
              </Button>
            )}
          </Box>
        </Box>
        {unreadable > 0 && <Text color="warning">읽지 못한 카드 {unreadable}개는 목록에서 빠졌습니다.</Text>}
        <Box key="list" flexDirection="column" borderStyle="round" borderColor="subtle" paddingX={1}>
          {visible.length === 0 && <Text dimColor>{searching ? '검색 결과가 없습니다.' : '저장된 아이디어가 없습니다.'}</Text>}
          {pageItems.map((one, i) => (
            <Box key={`row:${one.id}`} flexDirection="column">
              {i > 0 && <Text dimColor>{divider}</Text>}
              <Button
                key={`idea:${one.id}`}
                plain
                {...(i < 9 ? { hotkey: String(i + 1) } : {})}
                {...(i === 0 ? { autoFocus: true as const } : {})}
                onPress={() => update($, selected, () => one.id).then(() => toTop($))}
              >
                {one.summary || one.title}
              </Button>
              <Box flexDirection="row" gap={1} paddingLeft={3}>
                <Text color={STATUS_COLOR[one.status] ?? 'subtle'}>● {STATUS_LABEL[one.status] ?? one.status}</Text>
                <Text dimColor>{KIND_LABEL[one.kind] ?? one.kind}</Text>
                <Text dimColor>{shortDate(one.createdAt)}</Text>
              </Box>
            </Box>
          ))}
        </Box>
        {pageCount > 1 && (
          <Box key="pager" flexDirection="row" justifyContent="center" gap={2}>
            {current > 0 && (
              <Button key="prev-page" hotkey="p" onPress={() => goTo(current - 1)}>
                ← 이전
              </Button>
            )}
            <Text dimColor>
              {current + 1} / {pageCount} 페이지
            </Text>
            {current < pageCount - 1 && (
              <Button key="next-page" hotkey="n" onPress={() => goTo(current + 1)}>
                다음 →
              </Button>
            )}
          </Box>
        )}
      </Box>
    )
  })
}

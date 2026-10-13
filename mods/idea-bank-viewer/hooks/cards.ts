export type SectionKind = 'original' | 'assistant' | 'note'

export type Section = { kind: SectionKind; when?: string; text: string }

export type Idea = {
  id: string
  title: string
  summary: string
  kind: string
  tags: string[]
  source: string
  relatedIds: string[]
  status: string
  createdAt: string
  updatedAt: string
  sections: Section[]
}

const ORIGINAL = '## 사용자 원문'
const ASSISTANT = '## AI 첨언 (미검증 제안)'
const NOTE = /^## 추가 기록 · (.+)$/

export const STATUS_LABEL: Record<string, string> = {
  inbox: '기록됨',
  exploring: '검토 중',
  ready: '다음 행동 정함',
  active: '실행 중',
  done: '완료',
  archived: '보관',
}

export const KIND_LABEL: Record<string, string> = {
  skill: '스킬',
  agent: 'Agent',
  app: '앱',
  automation: '자동화',
  learning: '학습',
  content: '콘텐츠',
  other: '기타',
}

const str = (value: unknown) => (typeof value === 'string' ? value : '')

export function parseCard(raw: string): Idea | undefined {
  const text = raw.replace(/\r\n/g, '\n')
  if (!text.startsWith('---\n')) return undefined
  const close = text.indexOf('\n---\n', 3)
  if (close < 0) return undefined

  let meta: Record<string, unknown>
  try {
    const parsed: unknown = JSON.parse(text.slice(4, close))
    if (parsed === null || typeof parsed !== 'object') return undefined
    meta = parsed as Record<string, unknown>
  } catch {
    return undefined
  }
  const id = str(meta.id)
  const title = str(meta.title)
  if (!id || !title) return undefined

  return {
    id,
    title,
    summary: str(meta.summary),
    kind: str(meta.kind),
    tags: Array.isArray(meta.tags) ? meta.tags.filter(t => typeof t === 'string') : [],
    source: str(meta.source),
    relatedIds: Array.isArray(meta.related_ids) ? meta.related_ids.filter(t => typeof t === 'string') : [],
    status: str(meta.status),
    createdAt: str(meta.created_at),
    updatedAt: str(meta.updated_at),
    sections: splitSections(text.slice(close + 5)),
  }
}

// Only the three headers idea_bank.py writes split sections: notes often carry their own `##` headings.
function splitSections(body: string): Section[] {
  const sections: Section[] = []
  let current: { kind: SectionKind; when?: string; lines: string[] } | undefined
  let seenOriginal = false
  let seenAssistant = false
  const flush = () => {
    if (current) sections.push({ kind: current.kind, when: current.when, text: trimBlank(current.lines) })
  }

  for (const line of body.split('\n')) {
    const note = NOTE.exec(line)
    if (line === ORIGINAL && !seenOriginal) {
      flush()
      seenOriginal = true
      current = { kind: 'original', lines: [] }
    } else if (line === ASSISTANT && current?.kind === 'original' && !seenAssistant) {
      flush()
      seenAssistant = true
      current = { kind: 'assistant', lines: [] }
    } else if (note && seenOriginal) {
      flush()
      current = { kind: 'note', when: note[1], lines: [] }
    } else if (current) {
      current.lines.push(line)
    }
  }
  flush()
  return sections
}

function trimBlank(lines: string[]): string {
  let start = 0
  let end = lines.length
  while (start < end && lines[start]!.trim() === '') start++
  while (end > start && lines[end - 1]!.trim() === '') end--
  return lines.slice(start, end).join('\n')
}

export const STATUS_COLOR: Record<string, string> = {
  inbox: 'subtle',
  exploring: 'warning',
  ready: 'suggestion',
  active: 'success',
  done: 'success',
  archived: 'subtle',
}

export function shortDate(iso: string): string {
  return iso.slice(0, 16).replace('T', ' ')
}

export function newestFirst(a: Idea, b: Idea): number {
  return (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0) || b.id.localeCompare(a.id)
}

export function matchesQuery(idea: Idea, query: string): boolean {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (terms.length === 0) return true
  const haystack = [idea.title, idea.summary, ...idea.tags, ...idea.sections.map(s => s.text)].join('\n').toLowerCase()
  return terms.every(term => haystack.includes(term))
}

// gated-tdd 스킬의 budget.mjs가 읽는 어댑터 파일을 만드는 순수 함수들.
// 파일 계약: { "at": ISO 시각, "context"?: 0~100, "limits": [{ "name", "percent" }] }

import type { SessionUsage } from 'claude-code'

export const BUDGET_FILE = 'gated-tdd-budget.json'

// `git commit`, `git -c k=v commit`, `git -C dir commit`, `a && git commit` 등을 잡는다.
// `git commit-tree`나 문자열 안의 "commit" 같은 것은 잡지 않는다.
const GIT_COMMIT = /(?:^|[;&|(\s])git(?:\s+(?:-[cC]\s+\S+|--[\w-]+(?:=\S+)?))*\s+commit(?![\w-])/

export function isGitCommit(command: string): boolean {
  return GIT_COMMIT.test(command)
}

const LIMIT_NAMES: Record<string, string> = {
  five_hour: '5시간 한도',
  seven_day: '7일 한도',
  spend_limit: '지출 한도',
}

export type BudgetFile = {
  at: string
  context?: number
  limits: { name: string; percent: number }[]
}

export function toBudgetFile(usage: Pick<SessionUsage, 'context' | 'rateLimits'>, now: number): BudgetFile {
  const file: BudgetFile = {
    at: new Date(now).toISOString(),
    limits: usage.rateLimits.map(limit => ({ name: LIMIT_NAMES[limit.kind] ?? limit.kind, percent: limit.percentUsed })),
  }
  // 압축 직후처럼 사용률이 비어 있으면 빼 둔다. budget.mjs는 그때 단위 수로 판단한다.
  if (typeof usage.context.percent === 'number') file.context = usage.context.percent
  return file
}

// 한 단계 위 폴더. 루트(`/`, `C:\`)에서는 undefined.
export function parentOf(dir: string): string | undefined {
  const trimmed = dir.replace(/[\\/]+$/, '')
  if (trimmed === '' || /^[A-Za-z]:$/.test(trimmed)) return undefined
  const cut = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'))
  if (cut < 0) return undefined
  const parent = trimmed.slice(0, cut)
  if (parent === '') return '/'
  return /^[A-Za-z]:$/.test(parent) ? `${parent}\\` : parent
}

const isAbsolute = (path: string) => /^(?:[\\/]|[A-Za-z]:[\\/])/.test(path)

// 워크트리나 서브모듈의 `.git` 파일("gitdir: <경로>")이 가리키는 git 디렉터리.
export function gitDirFromFile(text: string, dir: string): string | undefined {
  const target = /^gitdir:\s*(.+?)\s*$/m.exec(text)?.[1]
  if (!target) return undefined
  return isAbsolute(target) ? target : `${dir}/${target}`
}

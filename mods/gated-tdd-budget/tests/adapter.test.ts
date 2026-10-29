import type { On } from 'claude-code'
import { expect, test } from 'claude-code/testing'

// 엔진은 경로를 그 OS의 절대 경로로 바꿔 넘긴다(Windows에서 /repo/.git은 C:\repo\.git). 비교 전에 맞춘다.
const posix = (path: string) => path.replace(/^[A-Za-z]:/, '').replace(/\\/g, '/')

// 테스트의 on 훅은 플러그인 아래에서 엔진 역할을 한다: 작업 폴더, 파일, 사용량, 셸 도구 자체.
function engine(on: On, { cwd = '/repo/src', gitAt = '/repo/.git', percent = 68 as number | undefined } = {}) {
  const events: string[] = []
  const written: Record<string, string> = {}
  on('session.cwd', async () => ({ value: cwd }))
  on('fs.exists', async ($, e) => ({ value: posix(e.path) === gitAt }))
  on('fs.stat', async () => ({ value: { kind: 'dir', size: 0, mtimeMs: 0, isLink: false } }))
  on('fs.write', async ($, e) => {
    events.push('write')
    written[posix(e.path)] = e.text
    return { value: undefined }
  })
  on('session.usage', async () => ({
    value: {
      startedAt: 0,
      context: { window: 200000, ...(percent === undefined ? {} : { tokens: 1, percent }) },
      rateLimits: [{ kind: 'five_hour', percentUsed: 41 }],
    },
  }))
  on('tool.call', { tool: 'Bash' }, async () => {
    events.push('bash')
    return { result: { stdout: '', stderr: '', interrupted: false } }
  })
  on('tool.call', { tool: 'PowerShell' }, async () => {
    events.push('powershell')
    return { result: { stdout: '', stderr: '', interrupted: false } }
  })
  return { events, written }
}

test('writes the budget file before git commit runs', async ($, on) => {
  const { events, written } = engine(on)
  await $.tool.call({ tool: 'Bash', command: 'git commit -m "A02"' })
  expect(events).toEqual(['write', 'bash'])
  const file = JSON.parse(written['/repo/.git/gated-tdd-budget.json'] ?? 'null')
  expect(file.context).toBe(68)
  expect(file.limits).toEqual([{ name: '5시간 한도', percent: 41 }])
})

test('writes the budget file before a PowerShell git commit too', async ($, on) => {
  const { events, written } = engine(on)
  await $.tool.call({ tool: 'PowerShell', command: 'git add -A; git commit -m "A02"' })
  expect(events).toEqual(['write', 'powershell'])
  expect(JSON.parse(written['/repo/.git/gated-tdd-budget.json'] ?? 'null').context).toBe(68)
})

test('leaves other commands alone', async ($, on) => {
  const { events } = engine(on)
  await $.tool.call({ tool: 'Bash', command: 'npm test' })
  expect(events).toEqual(['bash'])
})

test('outside a repository the commit still runs and nothing is written', async ($, on) => {
  const { events } = engine(on, { gitAt: '/nowhere/.git' })
  await $.tool.call({ tool: 'Bash', command: 'git commit -m x' })
  expect(events).toEqual(['bash'])
})

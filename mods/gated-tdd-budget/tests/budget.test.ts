import { expect, test } from 'claude-code/testing'

import { gitDirFromFile, isGitCommit, parentOf, toBudgetFile } from '../hooks/budget'

test('recognizes git commit commands and nothing else', async () => {
  for (const command of [
    'git commit -m "A02: 가입 API"',
    'git -c user.name=x commit -qm msg',
    'git -C app commit --amend',
    'npm test && git add . && git commit -m x',
    '(cd app; git commit -m x)',
  ]) expect(isGitCommit(command)).toBe(true)
  for (const command of ['git status', 'git commit-tree HEAD^{tree}', 'echo "git commits"', 'git log --grep commit', 'mygit commit'])
    expect(isGitCommit(command)).toBe(false)
})

test('turns session usage into the budget file contract', async () => {
  const file = toBudgetFile(
    {
      context: { window: 200000, tokens: 136000, percent: 68 },
      rateLimits: [
        { kind: 'five_hour', percentUsed: 41.5 },
        { kind: 'seven_day', percentUsed: 12 },
        { kind: 'something_new', percentUsed: 3 },
      ],
    },
    Date.parse('2026-10-14T12:00:00Z'),
  )
  expect(file).toEqual({
    at: '2026-10-14T12:00:00.000Z',
    context: 68,
    limits: [
      { name: '5시간 한도', percent: 41.5 },
      { name: '7일 한도', percent: 12 },
      { name: 'something_new', percent: 3 },
    ],
  })
})

test('leaves context out when the session has no reading yet', async () => {
  const file = toBudgetFile({ context: { window: 200000 }, rateLimits: [] }, 0)
  expect('context' in file).toBe(false)
  expect(file.limits).toEqual([])
})

test('walks up folders and stops at the root', async () => {
  expect(parentOf('/home/me/app')).toBe('/home/me')
  expect(parentOf('/home')).toBe('/')
  expect(parentOf('/')).toBe(undefined)
  expect(parentOf('C:\\work\\app')).toBe('C:\\work')
  expect(parentOf('C:\\work')).toBe('C:\\')
  expect(parentOf('C:\\')).toBe(undefined)
})

test('follows a worktree .git file', async () => {
  expect(gitDirFromFile('gitdir: /repo/.git/worktrees/wt\n', '/wt')).toBe('/repo/.git/worktrees/wt')
  expect(gitDirFromFile('gitdir: ../.git/modules/sub\n', '/repo/sub')).toBe('/repo/sub/../.git/modules/sub')
  expect(gitDirFromFile('not a pointer', '/x')).toBe(undefined)
})

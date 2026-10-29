import type { EngineInterface, Register } from 'claude-code'

import { BUDGET_FILE, gitDirFromFile, isGitCommit, parentOf, toBudgetFile } from './budget'

// 작업 폴더에서 위로 올라가며 git 디렉터리를 찾는다. 저장소 밖이면 undefined.
async function findGitDir($: EngineInterface): Promise<string | undefined> {
  let dir: string | undefined = await $.session.cwd()
  while (dir) {
    const dotGit = `${dir.replace(/[\\/]$/, '')}/.git`
    if (await $.fs.exists(dotGit)) {
      const stat = await $.fs.stat(dotGit)
      if (stat.kind === 'dir') return dotGit
      if (stat.kind === 'file') {
        const text = await $.fs.read(dotGit)
        return typeof text === 'string' ? gitDirFromFile(text, dir) : undefined
      }
    }
    dir = parentOf(dir)
  }
  return undefined
}

export const register: Register = on => {
  // git commit을 실행하는 셸 호출(Bash, Windows의 PowerShell) 직전에 사용량을 남긴다. 커밋 직후
  // post-commit 훅의 budget.mjs가 이 파일을 읽는다. 무엇이 실패해도 커밋은 그대로 실행한다.
  on('tool.call', { tool: ['Bash', 'PowerShell'] }, async ($, e, next) => {
    if (isGitCommit(e.command)) {
      try {
        const gitDir = await findGitDir($)
        if (gitDir) {
          const usage = await $.session.usage()
          await $.fs.write(`${gitDir}/${BUDGET_FILE}`, JSON.stringify(toBudgetFile(usage, Date.now())) + '\n')
        }
      } catch {
        // 어댑터가 실패하면 budget.mjs는 대리 지표(단위 수)로 판단한다.
      }
    }
    return next(e)
  }).catch(($, e, next) =>
    // 이 훅은 커밋을 막는 장치가 아니다. 무엇이 실패해도 커밋은 그대로 실행한다.
    next(e),
  )
}

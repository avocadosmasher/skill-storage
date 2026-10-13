export type IdeaId = string

declare module 'claude-code' {
  interface PluginState {
    'idea-bank-viewer': { selected: IdeaId | null; showArchived: boolean; refresh: number; query: string; page: number }
  }
}

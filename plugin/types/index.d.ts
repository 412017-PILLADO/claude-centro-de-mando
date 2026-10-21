export type Repo = { branch: string | null; changed: number }

export type Session = Repo & { cwd: string; name: string }

export type Project = Repo & { cwd: string; name: string; lastUsed: number }

export type AgentRow = {
  id: string
  type: string
  description: string
  startedAt: number
  endedAt: number | null
  isOk: boolean
}

export type Usage = {
  percent: number | null
  tokens: number | null
  window: number
  limits: { kind: string; percentUsed: number }[]
}

export type Ticket = {
  key: string
  summary: string
  status: string
  /** statusCategory de Jira: 'new' (por hacer), 'indeterminate' (en curso) o 'done'. */
  category: string
  priority: string
  updated: string
  url: string
}

/** `isOff`: la persona apagó Tickets en los Ajustes de la app; la sección no se muestra. */
export type Tickets = { items: Ticket[]; error: string | null; loadedAt: number | null; isLoading: boolean; isOff?: boolean }

export type Meeting = {
  id: string
  title: string
  /** ISO 8601 con zona horaria. */
  start: string
  end: string
  /** Link para entrar (Meet, Zoom o Teams); vacío si la reunión no tiene. */
  joinUrl: string
  calendarUrl: string
}

export type Meetings = { items: Meeting[]; error: string | null; loadedAt: number | null }

declare module 'claude-code' {
  interface PluginState {
    'centro-de-mando': {
      session: Session | null
      agents: AgentRow[]
      projects: Project[]
      usage: Usage | null
      tickets: Tickets
      meetings: Meetings
    }
  }
}

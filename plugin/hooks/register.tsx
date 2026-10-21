import { atom, read, update } from 'claude-code'
import type { EngineInterface, McpToolResult, Register } from 'claude-code'

import type { AgentRow, Meeting, Meetings, Project, Repo, Session, Ticket, Tickets, Usage } from '../types'

const PANE = 'centro-de-mando'
const TITLE = 'Centro de mando'
const STORE_PROJECTS = 'projects'
const STORE_JIRA_CLOUD = 'jiraCloudId'
const MAX_PROJECTS = 12
const MAX_TICKETS = 10
const JQL = 'assignee = currentUser() AND statusCategory != Done ORDER BY updated DESC'
const EDITING_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit', 'Bash', 'PowerShell'])

const NO_TICKETS: Tickets = { items: [], error: null, loadedAt: null, isLoading: false }
const NO_MEETINGS: Meetings = { items: [], error: null, loadedAt: null }
const MAX_MEETINGS = 20

const session = atom({ plugin: 'centro-de-mando', key: 'session' } as const, null)
const agents = atom({ plugin: 'centro-de-mando', key: 'agents' } as const, [])
const projects = atom({ plugin: 'centro-de-mando', key: 'projects' } as const, [])
const usage = atom({ plugin: 'centro-de-mando', key: 'usage' } as const, null)
const tickets = atom({ plugin: 'centro-de-mando', key: 'tickets' } as const, NO_TICKETS)
const meetings = atom({ plugin: 'centro-de-mando', key: 'meetings' } as const, NO_MEETINGS)

// Lo que se comparte hacia afuera (la ventana flotante lee estos archivos).
const HEARTBEAT_MS = 30_000
const TICKETS_EVERY_MS = 10 * 60_000
let activity: 'working' | 'waiting' | 'closed' = 'waiting'
let startedAt = 0
// Último prompt o última respuesta: distingue "terminó recién" de "quedó abierta hace horas".
let lastActivityAt = 0

// Las conversaciones sueltas de la app de escritorio corren en una carpeta temporal.
const isScratch = (cwd: string) => /[\\/]scratch-workspaces[\\/]/i.test(cwd)

const folderName = (cwd: string) =>
  isScratch(cwd) ? 'Conversación suelta' : (cwd.split(/[\\/]/).filter(Boolean).pop() ?? cwd)

// Carpetas que no son proyectos: Windows, AppData y temporales.
const isSystemFolder = (cwd: string) =>
  /^[a-z]:[\\/]windows([\\/]|$)/i.test(cwd) || /[\\/]appdata[\\/]/i.test(cwd) || isScratch(cwd)

const samePath = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

// --- git ---------------------------------------------------------------

async function gitInfo($: EngineInterface, cwd: string): Promise<Repo> {
  const head = await $.process
    .run(['git', 'rev-parse', '--abbrev-ref', 'HEAD'], { cwd, timeoutMs: 5000 })
    .catch(() => null)
  if (!head || head.exitCode !== 0) {
    return { branch: null, changed: 0 }
  }
  const status = await $.process
    .run(['git', 'status', '--porcelain'], { cwd, timeoutMs: 10000 })
    .catch(() => null)
  const changed = status ? status.stdout.split('\n').filter(line => line.trim()).length : 0

  return { branch: head.stdout.trim(), changed }
}

// --- sesión y status line ----------------------------------------------

async function paintStatus($: EngineInterface) {
  const current = await read($, session)
  if (current === null) {
    return
  }
  const used = await read($, usage)
  const branch = current.branch ? ` · ⎇ ${current.branch}` : ''
  const changed = current.changed > 0 ? ` · ✎ ${current.changed}` : ''
  const context = used?.percent != null ? ` · ◔ ${Math.round(used.percent)}%` : ''
  $.ui.status(`📁 ${current.name}${branch}${changed}${context}`)
  await publishSession($)
}

async function refreshSession($: EngineInterface, cwd: string) {
  const current: Session = { cwd, name: folderName(cwd), ...(await gitInfo($, cwd)) }
  await update($, session, () => current)
  await paintStatus($)
}

async function refreshUsage($: EngineInterface) {
  const figures = await $.session.usage().catch(() => null)
  if (figures === null) {
    return
  }
  const next: Usage = {
    percent: figures.context.percent ?? null,
    tokens: figures.context.tokens ?? null,
    window: figures.context.window,
    limits: figures.rateLimits.map(one => ({ kind: one.kind, percentUsed: one.percentUsed })),
  }
  await update($, usage, () => next)
  await paintStatus($)
}

// --- proyectos ---------------------------------------------------------

async function savedProjects($: EngineInterface) {
  const saved = ((await $.store.get(STORE_PROJECTS)) as Project[] | undefined) ?? []

  return saved.filter(one => !isSystemFolder(one.cwd))
}

async function rememberProject($: EngineInterface, cwd: string, now: number) {
  if (isSystemFolder(cwd)) {
    return
  }
  const others = (await savedProjects($)).filter(one => !samePath(one.cwd, cwd))
  const mine: Project = { cwd, name: folderName(cwd), branch: null, changed: 0, lastUsed: now }
  await $.store.set(STORE_PROJECTS, [mine, ...others].slice(0, MAX_PROJECTS))
}

async function refreshProjects($: EngineInterface) {
  const fresh = await Promise.all(
    (await savedProjects($)).map(async one => ({ ...one, ...(await gitInfo($, one.cwd)) })),
  )
  await update($, projects, () => fresh)
  await publishProjects($)
}

async function openClaudeIn($: EngineInterface, cwd: string) {
  const viaTerminal = await $.process
    .run(['wt', '-d', cwd, 'claude'], { timeoutMs: 10000 })
    .catch(() => null)
  if (viaTerminal?.exitCode === 0) {
    $.ui.toast(`Claude abierto en ${folderName(cwd)}`)
    return
  }
  const viaCmd = await $.process
    .run(['cmd', '/c', 'start', '', '/D', cwd, 'cmd', '/k', 'claude'], { timeoutMs: 10000 })
    .catch(() => null)
  $.ui.toast(
    viaCmd?.exitCode === 0
      ? `Claude abierto en ${folderName(cwd)}`
      : `No pude abrir una terminal en ${folderName(cwd)}`,
  )
}

// --- jira --------------------------------------------------------------

function resultText(result: McpToolResult) {
  return result.content
    .map(block => (block.type === 'text' ? block.text : ''))
    .join('\n')
}

// Cada persona conecta Jira y Calendar a su manera (un id en la app de escritorio,
// "claude.ai …" en la terminal, un nombre propio en su configuración): se busca el
// servidor por la herramienta que expone, y se recuerda.
const serverCache = new Map<string, string>()

async function findServer($: EngineInterface, tool: string, description?: RegExp) {
  const cached = serverCache.get(tool)
  if (cached) {
    return cached
  }
  const found = (await $.tool.list()).find(
    one => one.mcp && one.name.endsWith(`__${tool}`) && (!description || description.test(one.description)),
  )
  if (!found) {
    return null
  }
  const server = found.name.slice('mcp__'.length, found.name.lastIndexOf('__'))
  serverCache.set(tool, server)

  return server
}

async function jiraServer($: EngineInterface) {
  const server = await findServer($, 'searchJiraIssuesUsingJql')
  if (server === null) {
    throw new Error('Jira no está conectado en Claude')
  }

  return server
}

async function jiraCloudId($: EngineInterface) {
  const saved = (await $.store.get(STORE_JIRA_CLOUD)) as string | undefined
  if (saved) {
    return saved
  }
  const result = await $.mcp.call(await jiraServer($), 'getAccessibleAtlassianResources')
  const found = /"id"\s*:\s*"([0-9a-f-]{36})"/i.exec(resultText(result))?.[1]
  if (!found) {
    throw new Error('No encontré tu sitio de Jira')
  }
  await $.store.set(STORE_JIRA_CLOUD, found)

  return found
}

type JiraIssue = {
  key: string
  webUrl?: string
  fields: {
    summary?: string
    status?: { name?: string; statusCategory?: { key?: string } }
    priority?: { name?: string }
    updated?: string
  }
}

function parseIssues(result: McpToolResult): JiraIssue[] {
  const structured = result.structuredContent as { issues?: { nodes?: JiraIssue[] } } | undefined
  if (structured?.issues?.nodes) {
    return structured.issues.nodes
  }
  const text = resultText(result)
  const start = text.indexOf('{"issues"')
  if (start < 0) {
    throw new Error(text.slice(0, 120) || 'Respuesta vacía de Jira')
  }
  const parsed = JSON.parse(text.slice(start)) as { issues?: { nodes?: JiraIssue[] } }

  return parsed.issues?.nodes ?? []
}

async function refreshTickets($: EngineInterface) {
  await update($, tickets, old => ({ ...old, isLoading: true }))
  try {
    const result = await $.mcp.call(await jiraServer($), 'searchJiraIssuesUsingJql', {
      cloudId: await jiraCloudId($),
      jql: JQL,
      fields: ['summary', 'status', 'priority', 'updated'],
      maxResults: 50,
      responseContentFormat: 'markdown',
    })
    if (result.isError) {
      throw new Error(resultText(result).slice(0, 120))
    }
    const items: Ticket[] = parseIssues(result)
      .slice(0, MAX_TICKETS)
      .map(one => ({
        key: one.key,
        summary: one.fields.summary ?? '',
        status: one.fields.status?.name ?? '',
        category: one.fields.status?.statusCategory?.key ?? '',
        priority: one.fields.priority?.name ?? '',
        updated: one.fields.updated ?? '',
        url: one.webUrl ?? '',
      }))
    const loadedAt = await $.clock.now()
    await update($, tickets, () => ({ items, error: null, loadedAt, isLoading: false }))
    await publishTickets($)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await update($, tickets, old => ({ ...old, error: message, isLoading: false }))
  }
}

// --- reuniones (Google Calendar) ---------------------------------------

// Los conectores de claude.ai pueden aparecer con un id en el nombre de la herramienta
// (mcp__f36a4d31-…__list_events), que $.mcp.call no reconoce: se prueba también el nombre de /mcp,
// y si ninguno contesta, la herramienta por su nombre completo, como la llama el modelo.
const CALENDAR_BY_NAME = 'claude.ai Google Calendar'
let calendarServer: string | null = null

const message = (error: unknown) => (error instanceof Error ? error.message : String(error))

async function callCalendar($: EngineInterface, args: Record<string, unknown>): Promise<McpToolResult | null> {
  const spelled = await findServer($, 'list_events', /calendar/i)
  if (spelled === null) {
    return null
  }
  const candidates = [...new Set([calendarServer, spelled, CALENDAR_BY_NAME].filter((one): one is string => !!one))]
  const errors: string[] = []
  for (const server of candidates) {
    try {
      const result = await $.mcp.call(server, 'list_events', args)
      if (!result.isError) {
        calendarServer = server
        return result
      }
      errors.push(`${server}: ${resultText(result).slice(0, 120)}`)
    } catch (error) {
      errors.push(`${server}: ${message(error)}`)
    }
  }
  calendarServer = null
  // Por la herramienta solo si ya está permitida: nunca abre un diálogo de permiso.
  const tool = `mcp__${spelled}__list_events` as const
  try {
    const { decision } = await $.tool.check({ tool, input: args })
    if (decision === 'allow') {
      const answer = await $.tool.call({ tool, ...args })
      if ('deny' in answer && answer.deny) {
        throw new Error(answer.deny)
      }
      const text = answer.text ?? ''
      if (!answer.isError) {
        return { content: [{ type: 'text', text }], isError: false }
      }
      errors.push(`${tool}: ${text.slice(0, 120)}`)
    } else {
      errors.push(`${tool}: sin permiso (${decision}); permití esa herramienta en la configuración`)
    }
  } catch (error) {
    errors.push(`${tool}: ${message(error)}`)
  }
  throw new Error(errors.join(' | '))
}

type CalendarEvent = {
  id?: string
  summary?: string
  status?: string
  start?: { dateTime?: string }
  end?: { dateTime?: string }
  conferenceUrl?: string
  hangoutLink?: string
  location?: string
  description?: string
  htmlLink?: string
  attendees?: { self?: boolean; responseStatus?: string }[]
}

const JOIN_LINK = /https:\/\/(?:meet\.google\.com|[\w-]+\.zoom\.us|zoom\.us|teams\.microsoft\.com|teams\.live\.com)\/[^\s"'<>)]+/i

function joinUrlOf(event: CalendarEvent) {
  return (
    event.conferenceUrl ??
    event.hangoutLink ??
    JOIN_LINK.exec(event.location ?? '')?.[0] ??
    JOIN_LINK.exec(event.description ?? '')?.[0] ??
    ''
  )
}

function parseEvents(result: McpToolResult): CalendarEvent[] {
  const structured = result.structuredContent as { events?: CalendarEvent[] } | undefined
  if (structured?.events) {
    return structured.events
  }
  const text = resultText(result)
  const start = text.indexOf('{')
  if (start < 0) {
    throw new Error(text.slice(0, 120) || 'Respuesta vacía del calendario')
  }

  return (JSON.parse(text.slice(start)) as { events?: CalendarEvent[] }).events ?? []
}

async function refreshMeetings($: EngineInterface) {
  try {
    // Sin rango: el conector trae desde ahora hasta 7 días.
    const result = await callCalendar($, { orderBy: 'startTime', pageSize: 30 })
    if (result === null) {
      await failMeetings($, 'Google Calendar no está conectado')
      return
    }
    const now = await $.clock.now()
    const fresh: Meeting[] = parseEvents(result)
      .filter(one => one.start?.dateTime && one.end?.dateTime && one.status !== 'cancelled')
      .filter(one => !one.attendees?.some(person => person.self && person.responseStatus === 'declined'))
      .map(one => ({
        id: one.id ?? `${one.summary}-${one.start?.dateTime}`,
        title: one.summary ?? '(sin título)',
        start: one.start?.dateTime ?? '',
        end: one.end?.dateTime ?? '',
        joinUrl: joinUrlOf(one),
        calendarUrl: one.htmlLink ?? '',
      }))
    // Una reunión que ya empezó no vuelve en la consulta: se conserva hasta que termine.
    const previous = (await read($, meetings)).items
    const ongoing = previous.filter(
      one => Date.parse(one.end) > now && !fresh.some(other => other.id === one.id),
    )
    const items = [...ongoing, ...fresh]
      .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
      .slice(0, MAX_MEETINGS)
    await update($, meetings, () => ({ items, error: null, loadedAt: now }))
    await writeShared($, 'reuniones.json', { loadedAt: now, items })
  } catch (error) {
    await failMeetings($, error instanceof Error ? error.message : String(error))
  }
}

// El error va aparte: una sesión que falla no pisa las reuniones que trajo otra.
async function failMeetings($: EngineInterface, message: string) {
  await update($, meetings, old => ({ ...old, error: message }))
  await writeShared($, 'reuniones-error.json', { at: await $.clock.now(), error: message })
}

// --- formato -----------------------------------------------------------

function ago(ms: number) {
  const minutes = Math.round(ms / 60000)
  if (minutes < 1) return 'recién'
  if (minutes < 60) return `hace ${minutes} min`
  const hours = Math.round(minutes / 60)
  if (hours < 48) return `hace ${hours} h`

  return `hace ${Math.round(hours / 24)} d`
}

function meetingWhen(start: number, end: number, now: number) {
  if (start <= now) return end > now ? 'en curso' : 'terminó'
  const minutes = Math.round((start - now) / 60000)
  if (minutes < 60) return `en ${minutes} min`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `en ${hours} h`

  return `en ${Math.round(hours / 24)} d`
}

const thousands = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)}k` : String(n))

function bar(percent: number, width = 20) {
  const filled = Math.max(0, Math.min(width, Math.round((percent / 100) * width)))

  return '█'.repeat(filled) + '░'.repeat(width - filled)
}

const shorten = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text)

// --- archivos compartidos (~/.claude/centro) ---------------------------

async function sharedDir($: EngineInterface) {
  const home = (await $.env.get('USERPROFILE')) ?? (await $.env.get('HOME'))
  if (!home) {
    throw new Error('Sin carpeta de usuario')
  }

  return `${home.replace(/\\/g, '/')}/.claude/centro`
}

async function writeShared($: EngineInterface, name: string, value: unknown) {
  try {
    await $.fs.write(`${await sharedDir($)}/${name}`, JSON.stringify(value, null, 2))
  } catch {
    // Compartir es opcional: nunca rompe el panel.
  }
}

async function publishSession($: EngineInterface) {
  const id = await $.session.id().catch(() => null)
  const current = await read($, session)
  if (id === null || current === null) {
    return
  }
  const list = await read($, agents)
  await writeShared($, `sesiones/${id}.json`, {
    id,
    ...current,
    status: activity,
    startedAt,
    lastActivityAt: lastActivityAt || startedAt,
    updatedAt: await $.clock.now(),
    usage: await read($, usage),
    agents: list.filter(one => one.endedAt === null || list.indexOf(one) >= list.length - 5),
  })
}

async function publishProjects($: EngineInterface) {
  await writeShared($, 'proyectos.json', { updatedAt: await $.clock.now(), items: await read($, projects) })
}

async function publishTickets($: EngineInterface) {
  const state = await read($, tickets)
  if (state.loadedAt !== null && state.error === null) {
    await writeShared($, 'tickets.json', { loadedAt: state.loadedAt, items: state.items })
  }
}

// --- hooks -------------------------------------------------------------

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    const cwd = started.cwd ?? e.cwd
    await $.command.register({
      name: 'centro',
      description: 'Abre el Centro de mando y actualiza proyectos, tickets y uso',
    })
    void (async () => {
      startedAt = await $.clock.now()
      await rememberProject($, cwd, startedAt)
      await refreshSession($, cwd)
      await refreshUsage($)
      await refreshProjects($)
      await refreshTickets($)
      await refreshMeetings($)
    })()
    void $.ui.open({ id: PANE, title: TITLE })
    $.clock.every(HEARTBEAT_MS, () => void publishSession($))
    $.clock.every(TICKETS_EVERY_MS, () => {
      void refreshTickets($)
      void refreshMeetings($)
    })

    return started
  })

  on('prompt.submit', async ($, e, next) => {
    activity = 'working'
    lastActivityAt = await $.clock.now()
    void publishSession($)

    return next(e)
  })

  on('session.end', async ($, e, next) => {
    activity = 'closed'
    await publishSession($)

    return next(e)
  })

  on('command.run', { command: 'centro' }, async $ => {
    await $.ui.open({ id: PANE, title: TITLE })
    await refreshSession($, await $.session.cwd())
    await refreshUsage($)
    await Promise.all([refreshProjects($), refreshTickets($), refreshMeetings($)])

    return { text: 'Centro de mando actualizado.' }
  })

  on('tool.call', async ($, e, next) => {
    const ran = await next(e)
    if (EDITING_TOOLS.has(e.tool)) {
      void refreshSession($, await $.session.cwd())
    }

    return ran
  })

  on('agent.spawn', async ($, e, next) => {
    const started = await next(e)
    if (started.agentId) {
      const row: AgentRow = {
        id: started.agentId,
        type: e.subagentType || 'general-purpose',
        description: e.description,
        startedAt: await $.clock.now(),
        endedAt: null,
        isOk: true,
      }
      await update($, agents, list => [...list, row].slice(-30))
      void publishSession($)
    }

    return started
  })

  on('turn.complete', async ($, e, next) => {
    const agentId = e.agentId
    if (!agentId) {
      activity = 'waiting'
      lastActivityAt = await $.clock.now()
      void refreshUsage($)
      return next(e)
    }
    const row = (await read($, agents)).find(one => one.id === agentId && one.endedAt === null)
    if (row) {
      const endedAt = await $.clock.now()
      const isOk = e.reason === 'answer'
      await update($, agents, all =>
        all.map(one => (one.id === agentId ? { ...one, endedAt, isOk } : one)),
      )
      $.ui.toast(`${isOk ? '✓' : '✗'} ${row.type}: ${row.description}`)
      void publishSession($)
    }

    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button, Link } = $.ui.resolve(e)
    const now = await $.clock.now()
    const current = await read($, session)
    const used = await read($, usage)
    const agentList = await read($, agents)
    const projectList = await read($, projects)
    const ticketState = await read($, tickets)
    const nextMeeting = (await read($, meetings)).items.find(one => Date.parse(one.end) > now)
    const running = agentList.filter(one => one.endedAt === null)
    const finished = agentList.filter(one => one.endedAt !== null).slice(-6).reverse()
    const percent = used?.percent ?? null
    const contextColor = percent === null ? 'subtle' : percent >= 85 ? 'error' : percent >= 60 ? 'warning' : 'success'

    return (
      <Box flexDirection="column" gap={1}>
        <Box flexDirection="column">
          <Text bold>Esta sesión</Text>
          {current === null && <Text dimColor>Cargando…</Text>}
          {current !== null && (
            <Box flexDirection="column">
              <Text>📁 {current.name}</Text>
              <Text dimColor>{current.cwd}</Text>
              {current.branch === null ? (
                <Text dimColor>No es un repo git</Text>
              ) : (
                <Text>
                  ⎇ {current.branch}
                  {'  '}
                  <Text color={current.changed > 0 ? 'warning' : 'success'}>
                    {current.changed > 0 ? `✎ ${current.changed} sin commitear` : '✓ limpio'}
                  </Text>
                </Text>
              )}
            </Box>
          )}
        </Box>

        <Box flexDirection="column">
          <Text bold>Contexto y uso</Text>
          {used === null && <Text dimColor>Sin datos todavía.</Text>}
          {used !== null && (
            <Box flexDirection="column">
              <Text>
                <Text color={contextColor}>{bar(percent ?? 0)}</Text>{' '}
                {percent === null ? '—' : `${Math.round(percent)}%`}
                <Text dimColor>
                  {' '}
                  {used.tokens === null ? '' : `${thousands(used.tokens)} / `}
                  {thousands(used.window)} tokens
                </Text>
              </Text>
              {used.limits.map(one => (
                <Text key={one.kind} dimColor>
                  Límite {one.kind}: {Math.round(one.percentUsed)}%
                </Text>
              ))}
            </Box>
          )}
        </Box>

        {nextMeeting && (
          <Box flexDirection="column">
            <Text bold>Próxima reunión</Text>
            <Text>
              {nextMeeting.title}{' '}
              <Text dimColor>{meetingWhen(Date.parse(nextMeeting.start), Date.parse(nextMeeting.end), now)}</Text>{' '}
              {nextMeeting.joinUrl && <Link href={nextMeeting.joinUrl}>Unirse</Link>}
            </Text>
          </Box>
        )}

        <Box flexDirection="column">
          <Box flexDirection="row" justifyContent="space-between">
            <Text bold>Mis tickets</Text>
            <Button key="refresh-tickets" label={ticketState.isLoading ? 'Cargando…' : 'Actualizar'} onPress={() => refreshTickets($)} />
          </Box>
          {ticketState.error !== null && <Text color="error">Jira: {shorten(ticketState.error, 80)}</Text>}
          {ticketState.loadedAt !== null && ticketState.items.length === 0 && (
            <Text dimColor>No tenés tickets abiertos asignados. 🎉</Text>
          )}
          {ticketState.loadedAt === null && ticketState.error === null && <Text dimColor>Cargando tickets…</Text>}
          {ticketState.items.map(one => (
            <Box key={one.key} flexDirection="column">
              <Text>
                {one.url ? <Link href={one.url}>{one.key}</Link> : one.key}{' '}
                <Text dimColor>[{one.status}]</Text>
              </Text>
              <Box flexDirection="row" justifyContent="space-between">
                <Text dimColor>{shorten(one.summary, 60)}</Text>
                <Button
                  key={`work-${one.key}`}
                  label="Trabajar"
                  onPress={() =>
                    $.prompt.fill({
                      text: `Trabajá en el ticket ${one.key} (${one.summary}). Primero leelo completo en Jira, después ubicá el código involucrado y proponeme un plan antes de cambiar nada.`,
                    })
                  }
                />
              </Box>
            </Box>
          ))}
          {ticketState.loadedAt !== null && <Text dimColor>Actualizado {ago(now - ticketState.loadedAt)}</Text>}
        </Box>

        <Box flexDirection="column">
          <Text bold>Subagentes</Text>
          {agentList.length === 0 && <Text dimColor>Ninguno en esta sesión.</Text>}
          {running.map(one => (
            <Text key={one.id}>
              <Text color="claude">● {one.type}</Text> {one.description}{' '}
              <Text dimColor>{Math.round((now - one.startedAt) / 1000)}s</Text>
            </Text>
          ))}
          {finished.map(one => (
            <Text key={one.id} dimColor>
              <Text color={one.isOk ? 'success' : 'error'}>{one.isOk ? '✓' : '✗'}</Text> {one.type}:{' '}
              {one.description} ({Math.round(((one.endedAt ?? now) - one.startedAt) / 1000)}s)
            </Text>
          ))}
        </Box>

        <Box flexDirection="column">
          <Box flexDirection="row" justifyContent="space-between">
            <Text bold>Proyectos recientes</Text>
            <Button key="refresh-projects" label="Actualizar" onPress={() => refreshProjects($)} />
          </Box>
          {projectList.length === 0 && (
            <Text dimColor>Se van sumando a medida que abrís sesiones en cada carpeta.</Text>
          )}
          {projectList.map(one => (
            <Box key={one.cwd} flexDirection="row" justifyContent="space-between">
              <Text>
                {current !== null && samePath(one.cwd, current.cwd) ? '▸ ' : '  '}
                {one.name}
                {one.branch !== null && <Text dimColor> ⎇ {one.branch}</Text>}
                {one.changed > 0 && <Text color="warning"> ✎{one.changed}</Text>}
                <Text dimColor> · {ago(now - one.lastUsed)}</Text>
              </Text>
              <Box flexDirection="row" gap={1}>
                <Button key={`claude-${one.cwd}`} label="Claude" onPress={() => openClaudeIn($, one.cwd)} />
                <Link href={`vscode://file/${one.cwd.replace(/\\/g, '/')}`}>VS Code</Link>
              </Box>
            </Box>
          ))}
        </Box>
      </Box>
    )
  })
}

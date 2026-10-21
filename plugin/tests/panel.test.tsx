import { expect, mock, test } from 'claude-code/testing'

const PANE = {
  component: 'Pane',
  requestId: 'centro-de-mando',
  props: { title: 'Centro de mando', isFocused: true, bodyColumns: 60 },
} as const

const SURFACES = ['terminal', 'desktop'] as const

const text = (body: string) => ({ isError: false, content: [{ type: 'text' as const, text: body }] })

test('el panel muestra un subagente en curso en cada superficie', async ($, on) => {
  mock.clock(on, { now: 1_000_000 })
  on('agent.spawn', () => ({ model: 'haiku', agentId: 'agente-1' }))

  await $.agent.spawn({ prompt: 'Buscá el login', subagentType: 'Explore', description: 'Buscar login' })

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ plugin: 'centro-de-mando', surface, ...PANE })
    expect(await ui.find({ type: 'Text', text: /Explore/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Proyectos recientes/ })).toBeDefined()
    await ui.unmount()
  }
})

test('/centro trae los tickets de Jira y el uso de contexto', async ($, on) => {
  mock.clock(on, { now: 1_000_000 })
  mock.store(on)
  on('env.get', () => ({ value: 'C:/Users/demo' }))
  on('fs.write', () => ({ value: undefined }))
  on('session.cwd', () => ({ value: 'C:/proyectos/demo' }))
  on('tool.list', () => ({ value: [{ name: 'mcp__mi_jira__searchJiraIssuesUsingJql', description: 'Search issues with JQL', mcp: true }] }))
  on('process.run', () => ({ value: { exitCode: 1, stdout: '', stderr: '' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.status', () => ({ value: undefined }))
  on('session.usage', () => ({
    value: {
      startedAt: 0,
      context: { tokens: 50_000, window: 200_000, percent: 25 },
      rateLimits: [],
      cost: { usd: 0.42 },
    },
  }))
  on('mcp.call', (_$, e) => {
    if (e.tool === 'getAccessibleAtlassianResources') {
      return { value: text('[aviso][{"id":"00000000-0000-4000-8000-000000000000","name":"sitio"}]') }
    }
    const issues = {
      issues: {
        nodes: [
          {
            key: 'DEMO-1',
            webUrl: 'https://example.atlassian.net/browse/DEMO-1',
            fields: { summary: 'Arreglar el login', status: { name: 'EN CURSO' } },
          },
        ],
      },
    }

    return { value: text(`[aviso]${JSON.stringify(issues)}`) }
  })

  await $.command.run({ command: 'centro' })

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ plugin: 'centro-de-mando', surface, ...PANE })
    expect(await ui.find({ type: 'Text', text: /Arreglar el login/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /25%/ })).toBeDefined()
    await ui.unmount()
  }
})

test('comparte el estado de la sesión en ~/.claude/centro para la ventana flotante', async ($, on) => {
  const written: Record<string, string> = {}
  mock.clock(on, { now: 1_000_000 })
  mock.store(on)
  on('env.get', () => ({ value: 'C:/Users/demo' }))
  on('session.id', () => ({ value: 'sesion-1' }))
  on('session.cwd', () => ({ value: 'C:/proyectos/demo' }))
  on('fs.write', (_$, e) => {
    written[e.path.split('\\').join('/')] = e.text
    return { value: undefined }
  })
  on('process.run', () => ({ value: { exitCode: 1, stdout: '', stderr: '' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.status', () => ({ value: undefined }))
  on('session.usage', () => ({
    value: { startedAt: 0, context: { tokens: 1000, window: 200_000, percent: 1 }, rateLimits: [] },
  }))
  on('mcp.call', () => ({ value: text('error') }))

  await $.command.run({ command: 'centro' })

  const file = written['C:/Users/demo/.claude/centro/sesiones/sesion-1.json']
  expect(file).toBeDefined()
  const shared = JSON.parse(file ?? '{}') as { name: string; status: string; usage: { percent: number } }
  expect(shared.name).toBe('demo')
  expect(shared.status).toBe('waiting')
  expect(shared.usage.percent).toBe(1)
  expect(written['C:/Users/demo/.claude/centro/proyectos.json']).toBeDefined()
})

test('trae las reuniones del calendario y comparte el link para unirse', async ($, on) => {
  const written: Record<string, string> = {}
  mock.clock(on, { now: Date.parse('2026-10-19T11:50:00-03:00') })
  mock.store(on)
  on('env.get', () => ({ value: 'C:/Users/demo' }))
  on('session.id', () => ({ value: 'sesion-1' }))
  on('session.cwd', () => ({ value: 'C:/proyectos/demo' }))
  on('fs.write', (_$, e) => {
    written[e.path.split('\\').join('/')] = e.text
    return { value: undefined }
  })
  on('process.run', () => ({ value: { exitCode: 1, stdout: '', stderr: '' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.status', () => ({ value: undefined }))
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 200_000 }, rateLimits: [] } }))
  on('tool.list', () => ({
    value: [{ name: 'mcp__f36a4d31__list_events', description: 'Returns events on the given calendar', mcp: true }],
  }))
  on('mcp.call', (_$, e) => {
    if (e.server !== 'f36a4d31' || e.tool !== 'list_events') {
      return { value: text('error') }
    }
    const events = {
      events: [
        {
          id: 'daily-1',
          summary: 'Daily del equipo',
          status: 'confirmed',
          start: { dateTime: '2026-10-19T12:00:00-03:00' },
          end: { dateTime: '2026-10-19T12:30:00-03:00' },
          conferenceUrl: 'https://meet.google.com/abc-defg-hij',
          htmlLink: 'https://www.google.com/calendar/event?eid=1',
        },
        {
          id: 'rechazada',
          summary: 'Otra',
          start: { dateTime: '2026-10-19T15:00:00-03:00' },
          end: { dateTime: '2026-10-19T16:00:00-03:00' },
          attendees: [{ self: true, responseStatus: 'declined' }],
        },
        { id: 'todo-el-dia', summary: 'Feriado', start: {}, end: {} },
      ],
    }
    return { value: text(JSON.stringify(events)) }
  })

  await $.command.run({ command: 'centro' })

  const shared = JSON.parse(written['C:/Users/demo/.claude/centro/reuniones.json'] ?? '{}') as {
    items: { title: string; joinUrl: string }[]
  }
  expect(shared.items.length).toBe(1)
  expect(shared.items[0]?.title).toBe('Daily del equipo')
  expect(shared.items[0]?.joinUrl).toBe('https://meet.google.com/abc-defg-hij')

  const ui = await $.ui.mount({ plugin: 'centro-de-mando', surface: 'terminal', ...PANE })
  expect(await ui.find({ type: 'Text', text: /Daily del equipo/ })).toBeDefined()
  await ui.unmount()
})

test('con Tickets apagado en la app no consulta Jira y publica los conectores', async ($, on) => {
  const written: Record<string, string> = {}
  const calls: string[] = []
  mock.clock(on, { now: 1_000_000 })
  mock.store(on)
  on('env.get', () => ({ value: 'C:/Users/demo' }))
  on('fs.read', (_$, e) => {
    if (e.path.endsWith('config-plugin.json')) {
      return { value: JSON.stringify({ tickets: { activa: false }, reuniones: { activa: true } }) }
    }
    throw new Error('ENOENT')
  })
  on('fs.write', (_$, e) => {
    written[e.path.replace(/\\/g, '/')] = e.text
    return { value: undefined }
  })
  on('session.cwd', () => ({ value: 'C:/proyectos/demo' }))
  on('tool.list', () => ({ value: [{ name: 'mcp__mi_jira__searchJiraIssuesUsingJql', description: 'Search issues with JQL', mcp: true }] }))
  on('process.run', () => ({ value: { exitCode: 1, stdout: '', stderr: '' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.status', () => ({ value: undefined }))
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 200_000 }, rateLimits: [] } }))
  on('mcp.call', (_$, e) => {
    calls.push(e.tool)
    return { value: text('error') }
  })

  await $.command.run({ command: 'centro' })

  expect(calls.includes('searchJiraIssuesUsingJql')).toBe(false)
  const connectors = JSON.parse(written['C:/Users/demo/.claude/centro/conectores.json'] ?? '{}') as { jira: boolean; calendario: boolean }
  expect(connectors.jira).toBe(true)
  expect(connectors.calendario).toBe(false)
  const ui = await $.ui.mount({ plugin: 'centro-de-mando', surface: 'terminal', ...PANE })
  expect(await ui.find({ type: 'Text', text: /Mis tickets/ })).toBeUndefined()
  await ui.unmount()
})

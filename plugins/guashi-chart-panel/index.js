// Host half of the chart panel.
//
// The gua_bazi / gua_ziwei / gua_qimen tools write the latest chart JSON to snapshotPath.
// This Host half exposes a small RPC endpoint so the Client half can read it:
//
//   action 'status' -> { rev }                  (cheap poll)
//   action 'latest' -> { rev, type, chart, at } (full snapshot; type = bazi | ziwei | qimen)
//
// It never computes charts itself.
import { readFile, stat } from 'node:fs/promises'

export const name = 'guashi-chart-panel'
export const inject = ['connection']

const ENDPOINT = 'guashi-chart/dispatch'

function failure(message) {
  return { ok: false, error: { code: 'GUASHI_CHART_ERROR', message, details: {} } }
}

export function apply(ctx, config) {
  const snapshotPath = (config && config.snapshotPath) || 'D:/DSH_GuaShi/client/chart-panel/latest.json'

  async function revision() {
    try {
      const s = await stat(snapshotPath)
      return `${s.mtimeMs}-${s.size}`
    } catch {
      return null
    }
  }

  async function status() {
    return { rev: await revision() }
  }

  async function latest() {
    try {
      const text = await readFile(snapshotPath, 'utf8')
      const data = JSON.parse(text)
      return { rev: await revision(), ...data }
    } catch {
      return { rev: null, type: null, chart: null }
    }
  }

  async function dispatch(payload) {
    const action = payload && payload.action
    if (action === 'status') return { ok: true, value: await status() }
    if (action === 'latest') return { ok: true, value: await latest() }
    return failure('未知的命盘操作')
  }

  ctx.connection.fetch.register({
    path: `/api/${ENDPOINT}`,
    methods: ['POST'],
    requestBody: 'buffered',
    fetch: async (request) => {
      if ((request.headers.get('content-type') || '').split(';')[0].trim().toLowerCase() !== 'application/json') {
        return new Response('content type must be application/json', { status: 415 })
      }
      let message
      try {
        message = await request.json()
      } catch {
        return new Response('body is not JSON', { status: 400 })
      }
      const rpcId = message && typeof message.rpcId === 'string' ? message.rpcId : 'invalid-request'
      if (!message || message.type !== 'client-request' || message.method !== ENDPOINT) {
        return Response.json({ type: 'server-response', rpcId, result: failure('无效的 RPC 请求') })
      }
      try {
        const result = await dispatch(message.payload)
        return Response.json({ type: 'server-response', rpcId, result })
      } catch (error) {
        return Response.json({ type: 'server-response', rpcId, result: failure(error?.message || String(error)) })
      }
    },
  })
}


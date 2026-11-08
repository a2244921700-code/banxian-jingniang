// 小型公共工具：工具定义辅助、时间解析、路径规范化、文本截断。
//
// 工具注册用的对象形状与 dsh 的 `ctx.tools.register` 约定一致：
//   { name, description, parameters, output, execute(args, exec) }
// parameters 是「属性名 -> { type, description, enum?, required? }」的映射，
// 由 defineTool 组装成 JSON Schema。
//
// 本文件不是 Cordis 插件，不 import 任何 Harness 运行时模块，便于单独测试。

// 工具输出统一走 JSON 文本：注册表只要求 render，schema 留空（与其它 dsh 工具包一致）。
const JSON_OUTPUT_SCHEMA = {}

/** 统一的 JSON 输出：模型看到一份格式化 JSON 文本。 */
export const jsonOutput = {
  schema: JSON_OUTPUT_SCHEMA,
  render: (_args, value) => [
    { type: 'text', text: JSON.stringify(value, null, 2) },
  ],
}

/**
 * 把工具返回值洗成「无损 JSON」：Date → ISO 字符串，NaN/Infinity → null，
 * undefined/函数 → 省略（数组里改为 null），BigInt → 字符串，循环引用 → null。
 *
 * 为什么要有这一步：宿主会校验工具返回的对象能否无损转成 JSON，
 * 而历法引擎的 almanac / trueSolarTime 里带着 Date（节气时刻、真太阳时），
 * 虽然 render 时 JSON.stringify 能过，但原始返回值过不了校验，整次调用就被判失败。
 */
export function toJsonSafe(value, seen = new WeakSet()) {
  if (value === null) return null
  const type = typeof value
  if (type === 'number') return Number.isFinite(value) ? value : null
  if (type === 'string' || type === 'boolean') return value
  if (type === 'bigint') return value.toString()
  if (type === 'undefined' || type === 'function' || type === 'symbol') return undefined
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString()
  }
  if (Array.isArray(value)) {
    return value.map((item) => {
      const cleaned = toJsonSafe(item, seen)
      return cleaned === undefined ? null : cleaned
    })
  }
  if (type === 'object') {
    if (seen.has(value)) return null
    seen.add(value)
    const out = {}
    for (const [key, item] of Object.entries(value)) {
      const cleaned = toJsonSafe(item, seen)
      if (cleaned !== undefined) out[key] = cleaned
    }
    seen.delete(value)
    return out
  }
  return undefined
}

export class ToolArgsError extends Error {
  constructor(violations) {
    super(`参数不合法：${violations.join('；')}`)
    this.name = 'ToolArgsError'
    this.code = 'INVALID_ARGS'
    this.violations = violations
  }
}

function matchesType(value, type) {
  if (type === 'integer') return Number.isSafeInteger(value)
  if (type === 'number') return typeof value === 'number' && Number.isFinite(value)
  if (type === 'array') return Array.isArray(value)
  if (type === 'object') return typeof value === 'object' && value !== null && !Array.isArray(value)
  if (type === 'null') return value === null
  return typeof value === type
}

/**
 * 组装一个工具定义。`parameters` 里每个属性的 `required: true` 会被收进
 * JSON Schema 的 required 数组，其余键原样作为 schema。
 */
export function defineTool(options) {
  const properties = {}
  const required = []
  for (const [key, metadata] of Object.entries(options.parameters ?? {})) {
    const { required: isRequired, ...schema } = metadata
    properties[key] = schema
    if (isRequired) required.push(key)
  }
  const execute = options.execute
  return {
    name: options.name,
    description: options.description,
    ...(options.timeoutMs ? { timeoutMs: options.timeoutMs } : {}),
    parameters: {
      type: 'object',
      properties,
      ...(required.length > 0 ? { required } : {}),
    },
    output: jsonOutput,
    async execute(args, exec) {
      const violations = []
      if (typeof args !== 'object' || args === null || Array.isArray(args)) {
        throw new ToolArgsError(['参数必须是一个对象'])
      }
      for (const key of required) {
        if (!Object.hasOwn(args, key)) violations.push(`缺少必填参数 ${key}`)
      }
      for (const [key, schema] of Object.entries(properties)) {
        if (!Object.hasOwn(args, key) || args[key] === undefined) continue
        const value = args[key]
        if (!matchesType(value, schema.type)) {
          violations.push(`${key} 应为 ${schema.type}`)
        } else if (schema.enum !== undefined && !schema.enum.includes(value)) {
          violations.push(`${key} 只能是：${schema.enum.join('、')}`)
        }
      }
      if (violations.length > 0) throw new ToolArgsError(violations)
      return toJsonSafe(await execute(args, exec))
    },
  }
}

/** 失败结果：工具不抛异常，返回带 error 的对象，模型能读懂并改。 */
export function fail(error, extra = {}) {
  return { ok: false, error: String(error), ...extra }
}

export function truncate(text, maxChars) {
  const value = String(text ?? '')
  if (!Number.isFinite(maxChars) || maxChars <= 0 || value.length <= maxChars) {
    return { text: value, truncated: false }
  }
  return { text: value.slice(0, maxChars) + '\n……（已截断）', truncated: true }
}

export function normalizeCwd(value) {
  if (typeof value !== 'string' || value.trim() === '') return ''
  return value
    .trim()
    .replace(/\//g, '\\')
    .replace(/\\+$/, '')
    .toLowerCase()
}

/**
 * 解析模型传来的时间参数：
 * - 缺省 -> 现在（北京时间）
 * - 'YYYY-MM-DD' / 'YYYY-MM-DD HH:mm[:ss]' -> 按 +08:00 解释
 * - 其它 -> 交给 Date 解析（ISO 带偏移最稳）
 * 返回 Date，非法时抛 ToolArgsError。
 */
export function parseDateTime(input) {
  if (input === undefined || input === null || String(input).trim() === '') {
    return new Date()
  }
  const text = String(input).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const date = new Date(`${text}T00:00:00+08:00`)
    if (!Number.isNaN(date.getTime())) return date
  }
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/.test(text)) {
    const withOffset = text.replace(' ', 'T') + '+08:00'
    const date = new Date(withOffset)
    if (!Number.isNaN(date.getTime())) return date
  }
  const date = new Date(text)
  if (Number.isNaN(date.getTime())) {
    throw new ToolArgsError([`datetime 无法解析：${text}（请用 2026-10-25T21:30:00+08:00 这类格式）`])
  }
  return date
}

/** 当前会话 id（用于卦案记录来源；拿不到就 null）。 */
export function currentSessionId(exec) {
  try {
    const id = exec?.agent?.session?.header?.id
    return typeof id === 'string' ? id : null
  } catch {
    return null
  }
}

/** YYYY-MM-DD HH:mm:ss（北京时间固定 UTC+8），不依赖本机时区设置。 */
export function formatBeijing(date) {
  const offsetMs = 8 * 60 * 60 * 1000
  const local = new Date(date.getTime() + offsetMs)
  const p = (n) => String(n).padStart(2, '0')
  return {
    date: `${local.getUTCFullYear()}-${p(local.getUTCMonth() + 1)}-${p(local.getUTCDate())}`,
    time: `${p(local.getUTCHours())}:${p(local.getUTCMinutes())}:${p(local.getUTCSeconds())}`,
    local: `${local.getUTCFullYear()}-${p(local.getUTCMonth() + 1)}-${p(local.getUTCDate())} ${p(local.getUTCHours())}:${p(local.getUTCMinutes())}:${p(local.getUTCSeconds())}`,
    iso: date.toISOString(),
  }
}

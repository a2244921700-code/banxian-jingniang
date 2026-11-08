// gua_now —— 实时取时取地。
//
// 起卦前先知道「此刻此地」：日期、农历、干支四柱、节气、真太阳时、城市与经纬度。
// 时柱与梅花时间卦要用到时辰，奇门/六壬要节气与日柱，方位要经纬度；
// 所以这个工具是其余排盘工具的入口，不是装饰。
//
// 定位策略：用户明确给的地点 > IP 定位（10 分钟缓存）> 配置默认地点。
// 全部失败也照常返回时间，只是把 location.source 标成 config，并在 note 里说清楚，
// 不许假装有精确定位。

import { execFile } from 'node:child_process'
import { defineTool, fail } from './tool-utils.js'

// 常用城市经纬度：用户说「我在杭州」时不必依赖网络。
const CITY_COORDS = {
  北京: [39.9042, 116.4074], 上海: [31.2304, 121.4737], 广州: [23.1291, 113.2644],
  深圳: [22.5431, 114.0579], 杭州: [30.2741, 120.1551], 南京: [32.0603, 118.7969],
  成都: [30.5728, 104.0668], 重庆: [29.5630, 106.5516], 武汉: [30.5928, 114.3055],
  西安: [34.3416, 108.9398], 天津: [39.3434, 117.3616], 苏州: [31.2989, 120.5853],
  长沙: [28.2282, 112.9388], 郑州: [34.7466, 113.6254], 青岛: [36.0671, 120.3826],
  厦门: [24.4798, 118.0894], 福州: [26.0745, 119.2965], 济南: [36.6512, 117.1201],
  合肥: [31.8206, 117.2272], 昆明: [25.0389, 102.7183], 沈阳: [41.8057, 123.4315],
  大连: [38.9140, 121.6147], 哈尔滨: [45.8038, 126.5350], 长春: [43.8171, 125.3235],
  南昌: [28.6820, 115.8579], 南宁: [22.8170, 108.3665], 贵阳: [26.6470, 106.6302],
  石家庄: [38.0428, 114.5149], 太原: [37.8706, 112.5489], 兰州: [36.0611, 103.8343],
  乌鲁木齐: [43.8256, 87.6168], 拉萨: [29.6520, 91.1721], 呼和浩特: [40.8426, 111.7492],
  银川: [38.4872, 106.2309], 西宁: [36.6171, 101.7782], 海口: [20.0440, 110.1999],
  三亚: [18.2528, 109.5119], 香港: [22.3193, 114.1694], 澳门: [22.1987, 113.5439],
  台北: [25.0330, 121.5654], 无锡: [31.4912, 120.3119], 宁波: [29.8683, 121.5440],
  温州: [27.9949, 120.6994], 佛山: [23.0218, 113.1219], 东莞: [23.0207, 113.7518],
  珠海: [22.2707, 113.5767], 常州: [31.8107, 119.9741], 徐州: [34.2058, 117.2841],
}

const GEO_ENDPOINTS = [
  {
    url: 'https://ipapi.co/json/',
    pick: (data) => ({
      city: data.city,
      region: data.region,
      country: data.country_name,
      latitude: num(data.latitude),
      longitude: num(data.longitude),
    }),
  },
  {
    url: 'https://ipinfo.io/json',
    pick: (data) => {
      const [lat, lon] = String(data.loc ?? '').split(',')
      return {
        city: data.city,
        region: data.region,
        country: data.country,
        latitude: num(lat),
        longitude: num(lon),
      }
    },
  },
]

function num(value) {
  const n = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''))
  return Number.isFinite(n) ? n : null
}

function curlJson(url, timeoutMs) {
  return new Promise((resolve, reject) => {
    execFile(
      'curl',
      ['-sS', '-L', '--max-time', String(Math.ceil(timeoutMs / 1000)), '-A', 'dsh-guashi-agent/1.0', url],
      { windowsHide: true, timeout: timeoutMs + 2000 },
      (error, stdout) => {
        if (error) return reject(error)
        try {
          resolve(JSON.parse(String(stdout)))
        } catch (parseError) {
          reject(parseError)
        }
      },
    )
  })
}

async function fetchJson(url, timeoutMs) {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { 'user-agent': 'dsh-guashi-agent/1.0', accept: 'application/json' },
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return await response.json()
  } catch {
    // Host 进程的 fetch 可能被代理/网络策略挡住，退到系统 curl。
    return await curlJson(url, timeoutMs)
  }
}

export function createTimeTool(config) {
  const cfg = config ?? {}
  const cache = { at: 0, value: null }

  function defaultLocation() {
    const fallback = cfg.defaultLocation ?? {
      city: '上海',
      region: '上海',
      country: '中国',
      latitude: 31.2304,
      longitude: 121.4737,
    }
    return { source: 'config', note: '未能联网定位，使用配置的默认地点估算真太阳时。', ...fallback }
  }

  async function resolveLocation(explicit, refresh) {
    if (explicit && (explicit.latitude != null || explicit.longitude != null)) {
      return {
        source: 'user',
        city: explicit.city ?? '指定地点',
        region: '',
        country: '',
        latitude: num(explicit.latitude),
        longitude: num(explicit.longitude),
        note: '用户指定经纬度。',
      }
    }
    if (explicit && typeof explicit.city === 'string' && explicit.city.trim() !== '') {
      const city = explicit.city.trim()
      const hit = CITY_COORDS[city] ?? CITY_COORDS[city.replace(/市$/, '')]
      if (hit) {
        return {
          source: 'user',
          city,
          region: '',
          country: '中国',
          latitude: hit[0],
          longitude: hit[1],
          note: '用户指定城市，经纬度取自内置城市表。',
        }
      }
      return {
        source: 'user',
        city,
        region: '',
        country: '',
        latitude: null,
        longitude: null,
        note: '用户指定城市但库里没有该市经纬度，真太阳时按东经 120 度估算。',
      }
    }
    if (!refresh && cache.value && Date.now() - cache.at < 10 * 60 * 1000) {
      return cache.value
    }
    for (const endpoint of GEO_ENDPOINTS) {
      try {
        const data = await fetchJson(endpoint.url, 4000)
        const picked = endpoint.pick(data)
        if (picked.latitude != null && picked.longitude != null) {
          const value = {
            source: 'ip',
            city: picked.city ?? '未知',
            region: picked.region ?? '',
            country: picked.country ?? '',
            latitude: picked.latitude,
            longitude: picked.longitude,
            note: '由 IP 定位，城市级精度，仅供定时辰与方位参考。',
          }
          cache.at = Date.now()
          cache.value = value
          return value
        }
      } catch {
        // 换下一个来源
      }
    }
    return defaultLocation()
  }

  const tool = defineTool({
    name: 'gua_now',
    description:
      '取「此刻此地」：当前日期时间（北京时间）、农历、干支四柱、节气、月建、旬空、真太阳时，以及所在城市与经纬度（用于定时辰与方位）。起卦、排奇门、起六壬之前先调它；用户说了地点就传 location，否则自动 IP 定位（失败会明说并退回默认地点）。',
    parameters: {
      location: {
        type: 'object',
        description:
          '用户明确说的地点：{ city?: "杭州", latitude?: 30.27, longitude?: 120.15 }。经纬度优先，城市名次之。不传则自动定位。',
      },
      refresh: {
        type: 'boolean',
        description: '是否绕过 10 分钟定位缓存重新定位。默认 false。',
      },
    },
    timeoutMs: 20_000,
    async execute(args) {
      const { getAlmanac, trueSolarTime } = await import('./engine/almanac.js')
      const now = new Date()
      const location = await resolveLocation(args.location, args.refresh === true)
      const longitude = Number.isFinite(location.longitude) ? location.longitude : 120
      let almanac
      try {
        almanac = getAlmanac(now, { longitude })
      } catch (error) {
        return fail(`历法引擎出错：${error?.message ?? error}`, { now: now.toISOString(), location })
      }
      let solar = null
      try {
        solar = trueSolarTime(now, longitude)
      } catch {
        solar = null
      }
      const beijing = formatParts(now)
      const hints = []
      if (almanac?.solarTerm?.current?.name) {
        hints.push(
          `当前节气：${almanac.solarTerm.current.name}（${almanac.solarTerm.current.at ?? '时刻未知'}）` +
            (almanac.solarTerm.next?.name ? `，下一节气：${almanac.solarTerm.next.name}。` : '。'),
        )
      }
      const g = almanac?.ganzhi ?? {}
      const gname = (value) => (typeof value === 'string' ? value : value?.name) ?? '?'
      if (g.day) {
        hints.push(
          `四柱：${gname(g.year)}年 ${gname(g.month)}月 ${gname(g.day)}日 ${gname(g.hour)}时；` +
            `月建${almanac.monthBranch ?? '?'}，旬空${(almanac.xunKong ?? []).join('') || '?'}。`,
        )
      }
      if (solar?.local) {
        hints.push(`真太阳时约 ${solar.local}（较北京时间 ${solar.offsetMinutes >= 0 ? '+' : ''}${solar.offsetMinutes} 分钟）。`)
      }
      if (location.source === 'config') hints.push(location.note ?? '未能定位，使用默认地点。')
      return {
        ok: true,
        now: {
          iso: now.toISOString(),
          local: beijing.local,
          date: beijing.date,
          time: beijing.time,
          week: '星期' + '日一二三四五六'[now.getUTCDay()],
          timezone: 'Asia/Shanghai',
          epochMs: now.getTime(),
        },
        location,
        almanac: { ...almanac, trueSolarTime: solar },
        hints,
      }
    },
  })

  return tool
}

// 北京时间拆分（不依赖宿主机时区）。
function formatParts(date) {
  const local = new Date(date.getTime() + 8 * 60 * 60 * 1000)
  const p = (n) => String(n).padStart(2, '0')
  const year = local.getUTCFullYear()
  const month = p(local.getUTCMonth() + 1)
  const day = p(local.getUTCDate())
  const hour = p(local.getUTCHours())
  const minute = p(local.getUTCMinutes())
  const second = p(local.getUTCSeconds())
  return { date: `${year}-${month}-${day}`, time: `${hour}:${minute}:${second}`, local: `${year}-${month}-${day} ${hour}:${minute}:${second}` }
}

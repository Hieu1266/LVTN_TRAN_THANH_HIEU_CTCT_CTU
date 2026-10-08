'use server'

import { cookies } from 'next/headers'

export type ConfigMap = Record<string, string>

export type SaveResult = {
  config: ConfigMap
  applied: 'k8s' | 'db_only'
  restarted: boolean
}

type ActionResult<T> = { ok: true; data: T } | { ok: false; message: string }

// Đọc lúc chạy (không phải lúc build) nên đổi được bằng env/ConfigMap của Deployment frontend.
function configServiceUrl() {
  return (
    process.env.CONFIG_SERVICE_URL ??
    (process.env.NODE_ENV === 'production' ? 'http://config-service:8005' : 'http://localhost:8005')
  )
}

async function callConfigService<T>(
  serviceName: string,
  method: 'GET' | 'PUT',
  opts: { restart?: boolean; body?: unknown } = {},
): Promise<ActionResult<T>> {
  // Cookie `token` là httpOnly → chỉ code phía server mới đọc được.
  // config_service tự kiểm tra chữ ký JWT và role = admin, nên không cần khóa admin nào trong bundle.
  const token = (await cookies()).get('token')?.value
  if (!token) return { ok: false, message: 'Chưa đăng nhập' }

  const url = new URL(`${configServiceUrl()}/config/${encodeURIComponent(serviceName)}`)
  if (method === 'PUT' && opts.restart !== undefined) {
    url.searchParams.set('restart', String(opts.restart))
  }

  try {
    const res = await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: method === 'PUT' ? JSON.stringify(opts.body) : undefined,
      cache: 'no-store',
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return { ok: false, message: data.detail || `Lỗi từ config_service (HTTP ${res.status})` }
    }
    return { ok: true, data: data as T }
  } catch {
    return { ok: false, message: 'Không kết nối được config_service' }
  }
}

export async function getServiceConfigAction(serviceName: string): Promise<ActionResult<ConfigMap>> {
  const r = await callConfigService<{ config: ConfigMap }>(serviceName, 'GET')
  return r.ok ? { ok: true, data: r.data.config } : r
}

export async function saveServiceConfigAction(
  serviceName: string,
  config: ConfigMap,
  restart: boolean,
): Promise<ActionResult<SaveResult>> {
  return callConfigService<SaveResult>(serviceName, 'PUT', { restart, body: { config } })
}
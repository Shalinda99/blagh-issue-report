import { KEYCLOAK_BASE, KEYCLOAK_CLIENT_ID } from '../config/keycloak'
const CLIENT_ID = KEYCLOAK_CLIENT_ID

const STORAGE_KEY = 'blagh_user'
const TOKEN_KEY = 'blagh_token'
const REFRESH_TOKEN_KEY = 'blagh_refresh_token'

function decodeJwtPayload(token) {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(base64))
  } catch {
    return {}
  }
}

export async function login(username, password) {
  const tokenUrl = `${KEYCLOAK_BASE}/protocol/openid-connect/token`
  const formData = new URLSearchParams()
  formData.append('grant_type', 'password')
  formData.append('username', username)
  formData.append('password', password)
  formData.append('client_id', CLIENT_ID)

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formData.toString(),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.error_description || 'Authentication failed')
  }

  const data = await response.json()
  const claims = decodeJwtPayload(data.access_token)

  const rawUsername = claims.preferred_username || username
  const user = {
    id: claims.sub || username,
    name: claims.name || rawUsername,
    email: claims.email || `${rawUsername}@csi.internal`,
    role: claims.realm_access?.roles?.find(r => !r.startsWith('default-roles')) || 'User',
    username: rawUsername,
    avatar: rawUsername.substring(0, 2).toUpperCase(),
  }

  localStorage.setItem(TOKEN_KEY, data.access_token)
  if (data.refresh_token) localStorage.setItem(REFRESH_TOKEN_KEY, data.refresh_token)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
  syncReporterConfig(user)
  return user
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
  localStorage.removeItem(STORAGE_KEY)
  if (window.__BLAGH_CONFIG) {
    window.__BLAGH_CONFIG.user = null
  }
}

export function getUser() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY)
}

export function isAuthenticated() {
  const token = getToken()
  if (!token) return false
  try {
    const claims = decodeJwtPayload(token)
    return claims.exp ? claims.exp * 1000 > Date.now() : false
  } catch {
    return false
  }
}

export function showWidget() {
  if (document.getElementById('csi-capture-banner')) return
  const host = document.getElementById('csi-widget-host')
  if (host) host.style.display = ''
}

export function hideWidget() {
  const host = document.getElementById('csi-widget-host')
  if (host) host.style.display = 'none'
}

export function syncReporterConfig(user) {
  window.__BLAGH_CONFIG = window.__BLAGH_CONFIG || {}
  window.__BLAGH_CONFIG.user = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  }
}

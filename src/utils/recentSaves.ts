import type { FrameProject } from '../types'
import { preloadProjectAssets } from './assets'
import { renderProject } from '../render/renderer'

const DB_NAME = 'circle-frame-studio-local'
const DB_VERSION = 1
const STORE_NAME = 'recent-saves'
export const MAX_RECENT_SAVES = 10

export type RecentSaveSource = 'png' | 'json'

export interface RecentSaveRecord {
  id: string
  schemaVersion: 1
  appVersion: string
  savedAt: number
  source: RecentSaveSource
  title: string
  previewDataUrl: string
  project: unknown
}

let dbPromise: Promise<IDBDatabase> | null = null

function openDb() {
  if (dbPromise) return dbPromise
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('이 브라우저는 로컬 저장 내역을 지원하지 않습니다.'))
      return
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
        store.createIndex('savedAt', 'savedAt')
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('로컬 저장소를 열지 못했습니다.'))
  })
  return dbPromise
}

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('로컬 저장소 요청에 실패했습니다.'))
  })
}

function transactionDone(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('로컬 저장소 쓰기에 실패했습니다.'))
    transaction.onabort = () => reject(transaction.error ?? new Error('로컬 저장소 쓰기가 취소되었습니다.'))
  })
}

async function createPreview(project: FrameProject) {
  const canvas = document.createElement('canvas')
  canvas.width = 320
  canvas.height = 320
  await preloadProjectAssets(project)
  renderProject(canvas, project)
  // WebP keeps the thumbnail compact while preserving transparency in modern browsers.
  const webp = canvas.toDataURL('image/webp', .78)
  return webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/png')
}

function makeId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export async function listRecentSaves(): Promise<RecentSaveRecord[]> {
  const db = await openDb()
  const tx = db.transaction(STORE_NAME, 'readonly')
  const records = await requestResult(tx.objectStore(STORE_NAME).getAll()) as RecentSaveRecord[]
  return records
    .sort((a, b) => b.savedAt - a.savedAt)
    .slice(0, MAX_RECENT_SAVES)
}

export async function addRecentSave(project: FrameProject, source: RecentSaveSource) {
  const snapshot = structuredClone(project)
  const record: RecentSaveRecord = {
    id: makeId(),
    schemaVersion: 1,
    appVersion: project.version,
    savedAt: Date.now(),
    source,
    title: project.design?.name || 'Circle Frame',
    previewDataUrl: await createPreview(project),
    project: snapshot,
  }

  const db = await openDb()
  const writeTx = db.transaction(STORE_NAME, 'readwrite')
  writeTx.objectStore(STORE_NAME).put(record)
  await transactionDone(writeTx)

  const all = await listRecentSaves()
  const allTx = db.transaction(STORE_NAME, 'readonly')
  const everyRecord = await requestResult(allTx.objectStore(STORE_NAME).getAll()) as RecentSaveRecord[]
  everyRecord.sort((a, b) => b.savedAt - a.savedAt)
  const overflow = everyRecord.slice(MAX_RECENT_SAVES)
  if (overflow.length) {
    const pruneTx = db.transaction(STORE_NAME, 'readwrite')
    const store = pruneTx.objectStore(STORE_NAME)
    overflow.forEach(item => store.delete(item.id))
    await transactionDone(pruneTx)
  }

  return { record, records: all.slice(0, MAX_RECENT_SAVES) }
}

export async function deleteRecentSave(id: string) {
  const db = await openDb()
  const tx = db.transaction(STORE_NAME, 'readwrite')
  tx.objectStore(STORE_NAME).delete(id)
  await transactionDone(tx)
}

export async function clearRecentSaves() {
  const db = await openDb()
  const tx = db.transaction(STORE_NAME, 'readwrite')
  tx.objectStore(STORE_NAME).clear()
  await transactionDone(tx)
}

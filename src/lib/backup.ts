const FORMAT = 'nextstop-backup'
const isBackupKey = (k: string) => k.startsWith('nextstop.') || k === 'theme'

export function createBackup(): string {
  const data: Record<string, string> = {}
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)!
    if (isBackupKey(k)) data[k] = localStorage.getItem(k)!
  }
  return JSON.stringify({ format: FORMAT, version: 1, exportedAt: new Date().toISOString(), data }, null, 2)
}

/** Shares the backup file (iOS: Save to Files), falling back to a download. */
export async function exportBackup() {
  const name = `nextstop-backup-${new Date().toISOString().slice(0, 10)}.json`
  const file = new File([createBackup()], name, { type: 'application/json' })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] })
      return
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
      // Fall through to a plain download.
    }
  }
  const url = URL.createObjectURL(file)
  const a = Object.assign(document.createElement('a'), { href: url, download: name })
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/** Restores a backup file into localStorage; the caller should reload so the stores re-read it. */
export async function importBackup(file: File) {
  const parsed = JSON.parse(await file.text()) as { format?: string; data?: Record<string, unknown> }
  if (parsed.format !== FORMAT || !parsed.data || typeof parsed.data !== 'object') throw new Error('Not a NextStop backup file')
  const entries = Object.entries(parsed.data).filter(([k, v]) => isBackupKey(k) && typeof v === 'string')
  for (const [, v] of entries) if ((v as string).length > 1_000_000) throw new Error('Backup file is invalid')
  for (const [k, v] of entries) localStorage.setItem(k, v as string)
  return entries.length
}

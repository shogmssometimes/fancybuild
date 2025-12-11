import React, { useRef } from 'react'

function downloadJSON(filename: string, data: any) {
  const text = JSON.stringify(data, null, 2)
  const blob = new Blob([text], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 5000)
}

function pad(n: number) {
  return n < 10 ? '0' + n : String(n)
}

function formatMMDDYY(d: Date) {
  const mm = pad(d.getMonth() + 1)
  const dd = pad(d.getDate())
  const yy = String(d.getFullYear()).slice(-2)
  return `${mm}${dd}${yy}`
}

function formatHHMMSS(d: Date) {
  return `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
}

export default function ImportExportJSON({ filenamePrefix = 'collapse-data' }: { filenamePrefix?: string }) {
  const fileRef = useRef<HTMLInputElement | null>(null)

  const handleExportAll = () => {
    try {
      const data: Record<string, any> = {}
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (!key) continue
        const raw = localStorage.getItem(key)
        if (raw === null) continue
        try {
          data[key] = JSON.parse(raw)
        } catch {
          data[key] = raw
        }
      }

      const now = new Date()
      const mmddyy = formatMMDDYY(now)
      const hhmmss = formatHHMMSS(now)
      const filename = `${filenamePrefix}-${mmddyy}-${hhmmss}.json`
      const payload = {
        meta: { app: 'cvttweb', exportedAt: mmddyy, exportedAtISO: now.toISOString() },
        data,
      }
      downloadJSON(filename, payload)
    } catch (err) {
      window.alert('Export failed: ' + String(err))
    }
  }

  const handleImportClick = () => {
    fileRef.current?.click()
  }

  const handleFile = (file: File | null) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result))
        if (!parsed || typeof parsed !== 'object') throw new Error('Imported file is not a JSON object')

        // Expect the export shape { meta?, data } or a plain key->value map
        const importedData: Record<string, any> = parsed.data && typeof parsed.data === 'object' ? parsed.data : parsed

        // Create a backup of current localStorage (download immediately)
        const backup: Record<string, any> = {}
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i)
          if (!key) continue
          const raw = localStorage.getItem(key)
          if (raw === null) continue
          try {
            backup[key] = JSON.parse(raw)
          } catch {
            backup[key] = raw
          }
        }

        const now = new Date()
        const mmddyy = formatMMDDYY(now)
        const hhmmss = formatHHMMSS(now)
        const backupFilename = `${filenamePrefix}-backup-${mmddyy}-${hhmmss}.json`
        downloadJSON(backupFilename, { meta: { createdAt: mmddyy, createdAtISO: now.toISOString() }, data: backup })

        // Confirm destructive import
        const confirmMsg = 'This import will REPLACE all local app data in this browser. A backup file has been downloaded to your device. Proceed and overwrite current data?'
        if (!window.confirm(confirmMsg)) {
          window.alert('Import cancelled. No changes were made.')
          return
        }

        // Clear existing localStorage and write imported keys
        try {
          localStorage.clear()
        } catch (e) {
          // proceed anyway
        }

        Object.entries(importedData).forEach(([k, v]) => {
          try {
            localStorage.setItem(k, JSON.stringify(v))
          } catch (e) {
            localStorage.setItem(k, String(v))
          }
        })

        window.alert('Import complete. The page will reload to apply imported data.')
        window.location.reload()
      } catch (err: any) {
        window.alert('Import failed: ' + (err?.message ?? String(err)))
      }
    }
    reader.onerror = () => window.alert('Failed to read file')
    reader.readAsText(file)
  }

  return (
    <div className="ops-toolbar">
      <input ref={fileRef} type="file" accept="application/json" style={{ display: 'none' }} onChange={(e) => handleFile(e.target.files?.[0] ?? null)} />
      <button onClick={handleExportAll} title="Export all localStorage to JSON (includes meta)">Export JSON</button>
      <button onClick={handleImportClick} title="Import JSON and replace all localStorage (backup will be downloaded)">Import (Replace All)</button>
    </div>
  )
}

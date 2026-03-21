import { useLiveQuery } from 'dexie-react-hooks'

import { db } from '@/db/dropnote-db'
import type { Folder } from '@/types/note'

export function useFoldersLive(): Folder[] {
  const rows = useLiveQuery(
    async () => {
      const all = await db.folders.toArray()
      return all
        .filter((f) => !f.deletedAt)
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
    },
    [],
  )
  return rows ?? []
}

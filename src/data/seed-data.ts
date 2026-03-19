import { db } from '@/db/dropnote-db'
import { createMockNotes } from '@/data/mock-notes'
import { hasSupabaseEnv } from '@/lib/supabase'

export async function seedDatabase() {
  if (hasSupabaseEnv) return

  const flag = await db.meta.get('hasSeeded')
  if (flag) return

  const count = await db.notes.count()
  if (count > 0) {
    await db.meta.put({ key: 'hasSeeded', value: 'true' })
    return
  }

  const notes = createMockNotes()
  await db.notes.bulkAdd(notes)
  await db.meta.put({ key: 'hasSeeded', value: 'true' })
}

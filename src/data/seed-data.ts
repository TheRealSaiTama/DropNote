import { db } from '@/db/dropnote-db'
import { createMockNotes } from '@/data/mock-notes'

export async function seedDatabase() {
  const count = await db.notes.count()
  if (count > 0) return

  const notes = createMockNotes()
  await db.notes.bulkAdd(notes)
}

import { generateId, now } from '@/db/note-actions'
import type { Note } from '@/types/note'

export function createMockNotes(): Note[] {
  const t = now()

  const seeds: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>[] = [
    {
      title: 'Arrival board for the Kyoto weekender',
      content:
        'Keep the route light: station photo, dinner shortlist, and one voice memo with the first-night walk.\n\nBook the quiet hotel room, then pin this until the trip is done.',
      preview: 'Keep the route light: station photo, dinner shortlist, and one voice memo with the first-night walk...',
      pinned: true,
      archived: false,
      tags: ['travel', 'planning', 'media'],
      attachmentsCount: 0,
      deletedAt: null,
      syncStatus: 'pending' as const,
    },
    {
      title: 'Studio reset before Monday',
      content:
        'Archive the old briefs, label cables, replace the desk lamp bulb, and move invoices into one folder.',
      preview: 'Archive the old briefs, label cables, replace the desk lamp bulb, and move invoices into one folder...',
      pinned: false,
      archived: false,
      tags: ['admin', 'studio'],
      attachmentsCount: 0,
      deletedAt: null,
      syncStatus: 'pending' as const,
    },
    {
      title: 'Voice fragments worth transcribing',
      content:
        'Three quick audio notes about the sync model: local first, conflict-light, and dead simple setup.\n\nThe whole point is calm software that feels personal.',
      preview: 'Three quick audio notes about the sync model: local first, conflict-light, and dead simple setup...',
      pinned: true,
      archived: false,
      tags: ['product', 'audio'],
      attachmentsCount: 0,
      deletedAt: null,
      syncStatus: 'pending' as const,
    },
    {
      title: 'Capsule wardrobe shortlist',
      content:
        'Monochrome layers only: charcoal overshirt, washed tee, cropped trousers, clean sneakers.\n\nKeep this archived for later.',
      preview: 'Monochrome layers only: charcoal overshirt, washed tee, cropped trousers, clean sneakers...',
      pinned: false,
      archived: true,
      tags: ['style', 'archive'],
      attachmentsCount: 0,
      deletedAt: null,
      syncStatus: 'pending' as const,
    },
    {
      title: 'Reading stack for quiet Sundays',
      content:
        'Essays on memory, a photography monograph, and one long profile worth saving offline.',
      preview: 'Essays on memory, a photography monograph, and one long profile worth saving offline...',
      pinned: false,
      archived: false,
      tags: ['reading', 'reference'],
      attachmentsCount: 0,
      deletedAt: null,
      syncStatus: 'pending' as const,
    },
    {
      title: 'Kitchen loop playlist ideas',
      content:
        'Keep the morning mix calm, instrumental, and under forty minutes so repeat never feels heavy.',
      preview: 'Keep the morning mix calm, instrumental, and under forty minutes so repeat never feels heavy...',
      pinned: false,
      archived: false,
      tags: ['music', 'home'],
      attachmentsCount: 0,
      deletedAt: null,
      syncStatus: 'pending' as const,
    },
  ]

  return seeds.map((seed, i) => ({
    ...seed,
    id: generateId(),
    createdAt: t,
    updatedAt: new Date(new Date(t).getTime() - i * 3600_000).toISOString(),
  }))
}

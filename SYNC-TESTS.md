# Sync Test Checklist

Manual tests to verify cross-device sync is working correctly.

## Setup

Two devices or browsers signed in to the same Dropnote account.
Device A = originating device. Device B = secondary device.

---

## Note sync

### Create
1. On Device A, create a new note with a title and content
2. Wait for sync indicator to show "synced" on Device A
3. On Device B, click the sync indicator to force a pull
4. Confirm the note appears on Device B with correct title and content

### Update
1. On Device A, edit the content of an existing synced note
2. Wait for sync on Device A
3. On Device B, force sync
4. Confirm Device B shows the updated content

### Pin / Archive
1. On Device A, pin a note
2. Sync both devices
3. Confirm Device B shows the note as pinned

### Delete
1. On Device A, delete a note (if delete UI is available)
2. Sync both devices
3. Confirm the note disappears from Device B

---

## Attachment sync

### Upload
1. On Device A, attach an image to a note
2. Wait for sync — check browser console (dev mode) for "[sync] uploaded attachment blob"
3. On Device B, force sync
4. Confirm the attachment appears in the note with a working preview

### Audio / Generic file
1. Repeat the upload test with an mp3 and a generic file
2. Confirm audio player and file card appear correctly on Device B

### Re-download after clear
1. On Device B, clear IndexedDB (DevTools → Application → IndexedDB → delete dropnote)
2. Reload Device B and sign in again
3. Confirm all notes and attachments re-appear with working previews

---

## Attachment Deletion Sync

### Soft-delete while signed in
1. Delete an attachment while signed in
2. Confirm the attachment disappears from the UI immediately
3. Open DevTools → Application → IndexedDB and confirm the record still exists with `deletedAt` set and `syncStatus: 'pending'`

### Tombstone pushed on sync
1. After soft-deleting an attachment, trigger a sync
2. Confirm `deleted_at` is written to the Supabase attachments row, the blob is removed from Storage, and the local IndexedDB record is hard-deleted

### Remote tombstone applied on pull
1. On Device A, delete an attachment and sync
2. On Device B, force sync
3. Confirm the attachment disappears on Device B even if it was still showing before the pull

### Offline delete, then sync
1. Take Device A offline
2. Delete an attachment — confirm the soft-delete is stored locally (IndexedDB record has `deletedAt`, `syncStatus: 'pending'`)
3. Reconnect and trigger sync — confirm the tombstone is pushed to Supabase and the local record is cleaned up

### No reappearance after re-sync
1. After a tombstone has been pushed and the local IndexedDB record cleaned up, trigger another sync
2. Confirm the deleted attachment does not reappear locally or in the UI

### Unsigned user hard-delete
1. Delete an attachment while not signed in
2. Confirm the attachment blob and IndexedDB record are immediately removed — no `deletedAt` field, no sync queued

---

## Offline behavior

### Offline edit then reconnect
1. Take Device A offline (airplane mode or DevTools offline)
2. Create and edit a note
3. Confirm the note saves locally (autosave works)
4. Reconnect — confirm sync indicator transitions from "offline" to "syncing" to "synced"
5. On Device B, force sync and confirm the note appears

### Offline attachment
1. Take Device A offline
2. Drop an image onto a note
3. Confirm preview shows immediately (local blob)
4. Reconnect — confirm the attachment uploads and syncs to Device B

---

## Conflict behavior (same-note edit on two devices)

1. Take both devices offline
2. Edit the same note on Device A at time T1, then on Device B at time T2 (T2 > T1)
3. Bring both devices online
4. Whichever device syncs first pushes its version
5. The second device to sync will pull the remote version if it is newer
6. Expected result: Device B's edit (newer timestamp) wins
7. Device A's edit is overwritten on next pull if B synced first

This is intentional last-write-wins behavior. No data merging occurs.

---

## Sign-in merge behavior

### First device (new account)
1. Use the app without signing in — create several notes
2. Sign in with email magic link
3. Confirm all local notes are pushed to remote (syncStatus goes from 'pending' to 'synced')

### Second device (existing account)
1. Open Dropnote on a new device (no local data)
2. Sign in with the same account
3. Confirm all remote notes are pulled and appear locally

### Merge (both devices have local data)
1. On Device A, sign in (has local notes, remote has different notes)
2. Pull runs first: remote notes appear locally
3. Push runs second: local notes go to remote
4. Both sets of notes should now be on both devices
5. If the same note ID exists on both (impossible with nanoid, but hypothetically): remote wins if newer, local wins if newer

---

## Known limitations

- Conflict resolution is last-write-wins on `updatedAt`. Offline edits on two devices to the same note will result in one edit being lost on next sync.
- Magic link on mobile PWA may open in the browser instead of the installed app. After signing in, open the PWA — the session is shared via localStorage.
- Attachment blobs that fail to upload will retry on the next sync cycle.

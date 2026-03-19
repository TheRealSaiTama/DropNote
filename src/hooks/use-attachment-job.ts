import { useEffect, useState } from 'react'

import { getJobState, subscribeJobs } from '@/lib/attachment-queue'
import type { AttachmentJobState } from '@/types/note'

export function useAttachmentJob(attachmentId: string): AttachmentJobState {
  const [state, setState] = useState<AttachmentJobState>(() => getJobState(attachmentId))

  useEffect(() => {
    return subscribeJobs(() => {
      setState(getJobState(attachmentId))
    })
  }, [attachmentId])

  return state
}

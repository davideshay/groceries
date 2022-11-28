import { useCallback } from 'react'
import { usePouch } from 'use-pouchdb'

export function useUpdateItem() {
  const db = usePouch()

  return useCallback(
    async (updatedDoc: any) => {
      const result = await db.put(updatedDoc)
      return result
    },
    [db]
  )
}
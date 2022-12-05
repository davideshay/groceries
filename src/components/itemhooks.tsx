import { useState, useCallback, useEffect, useMemo } from 'react'
import { useLocation } from 'react-router-dom';
import { usePouch } from 'use-pouchdb'
import { cloneDeep } from 'lodash';

export function useUpdateGenericDocument() {
  const db = usePouch();
  return useCallback(
    async (updatedDoc: any) => {
      const result = await db.put(updatedDoc)
      return result
    },[db])
}

export function useCreateGenericDocument() {
  const db = usePouch();
  return useCallback(
    async (updatedDoc: any) => {
      const result = await db.post(updatedDoc)
      return result
    },[db])
}

export function useUpdateItem() {
  const db = usePouch();

  return useCallback(
    async (updatedDoc: any) => {
      const result = await db.put(updatedDoc)
      return result
    },
    [db]
  )
}

export function useUpdateCategory() {
  const db = usePouch();

  return useCallback(
    async (updatedDoc: any) => {
      const result = await db.put(updatedDoc)
      return result
    },
    [db]
  )
}

export function useUpdateListWhole() {
  const db = usePouch();

  return useCallback(
    async (updatedDoc: any) => {
      const result = await db.put(updatedDoc)
      return result
    },
    [db]
  )
}

export function useCreateList() {
  const db = usePouch();

  return useCallback(
    async (updatedDoc: any) => {
      const result = await db.post(updatedDoc)
      return result
    },
    [db]
  )
}

export function useCreateCategory() {
  const db = usePouch();

  return useCallback(
    async (updatedDoc: any) => {
      const result = await db.post(updatedDoc)
      return result
    },
    [db]
  )
}

export function useUpdateCompleted() {
  const db = usePouch();

  return useCallback(
    async (updateInfo: any) => {
      const newItemDoc = cloneDeep(updateInfo.itemDoc);
      for (let i = 0; i < newItemDoc.lists.length; i++) {
        if (updateInfo.updateAll) {
          newItemDoc.lists[i].completed = updateInfo.newStatus;
          if (updateInfo.newStatus) {newItemDoc.lists[i].boughtCount++};
        } else {
          if (newItemDoc.lists[i].listID == updateInfo.listID) {
            newItemDoc.lists[i].completed = updateInfo.newStatus;
            if (updateInfo.newStatus) {newItemDoc.lists[i].boughtCount++};
          }
        }   
      }
      const result = await db.put(newItemDoc);
      return result
    },
    [db]
  )
}

export function useUpdateItemInList() {
  const db = usePouch()

  return useCallback(
    async (updatedDoc: any) => {
      const result = await db.put(updatedDoc)
      return result
    },
    [db]
  )
}
export { type HandleIds, createHandleIds };

/**
 * Gives Warcraft handles numbers, so the mind can name what it sees without
 * holding handles. A handle keeps its id while it is kept; ids are never
 * reused, so an id of something gone names nothing.
 */
interface HandleIds<THandle, TId extends number> {
  idOf({ handle }: { handle: THandle }): TId;
  handleOf({ id }: { id: TId }): THandle | undefined;
  /** Forgets every handle not in `handles`, so Warcraft can recycle them. */
  keepOnly({ handles }: { handles: ReadonlySet<THandle> }): void;
}

function createHandleIds<THandle, TId extends number>(): HandleIds<
  THandle,
  TId
> {
  const ids = new Map<THandle, TId>();
  const handlesById = new Map<TId, THandle>();
  let lastId = 0;

  return {
    idOf({ handle }) {
      const knownId = ids.get(handle);

      if (knownId !== undefined) {
        return knownId;
      }

      lastId += 1;
      const id = lastId as TId;

      ids.set(handle, id);
      handlesById.set(id, handle);

      return id;
    },

    handleOf({ id }) {
      return handlesById.get(id);
    },

    keepOnly({ handles }) {
      const forgotten: THandle[] = [];

      for (const handle of ids.keys()) {
        if (!handles.has(handle)) {
          forgotten.push(handle);
        }
      }

      for (const handle of forgotten) {
        const id = ids.get(handle);

        ids.delete(handle);

        if (id !== undefined) {
          handlesById.delete(id);
        }
      }
    },
  };
}

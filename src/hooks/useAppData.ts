import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { db } from '../lib/db';
import type { AttendanceSession, Person } from '../types';

export interface BusEntry {
  person: Person;
  addedAt: number;
  /** Eklenme sırasına göre 1'den başlayan numara. */
  seq: number;
}

/** Tüm ekranların okuduğu tek veri kaynağı (IndexedDB canlı sorguları). */
export function useAppData() {
  // Silinen kişiler (silinme işaretli kayıtlar) hiçbir ekranda ve sayaçta yer almaz.
  const persons = useLiveQuery(() => db.persons.filter((p) => !p.deletedAt).toArray(), []);
  const bus = useLiveQuery(() => db.bus.orderBy('addedAt').toArray(), []);
  const sessions = useLiveQuery(() => db.sessions.orderBy('order').toArray(), []);
  const activeSetting = useLiveQuery(async () => ((await db.settings.get('activeSessionId'))?.value as string | undefined) ?? null, []);

  const activeSession: AttendanceSession | undefined = useMemo(() => {
    if (!sessions?.length) return undefined;
    return sessions.find((s) => s.id === activeSetting) ?? sessions[0];
  }, [sessions, activeSetting]);

  const checks = useLiveQuery(
    () => (activeSession ? db.checks.where('sessionId').equals(activeSession.id).toArray() : []),
    [activeSession?.id],
  );

  const derived = useMemo(() => {
    const personMap = new Map((persons ?? []).map((p) => [p.id, p]));
    const busIds = new Set((bus ?? []).map((b) => b.personId));
    const busEntries: BusEntry[] = [];
    (bus ?? []).forEach((b) => {
      const person = personMap.get(b.personId);
      if (person) busEntries.push({ person, addedAt: b.addedAt, seq: busEntries.length + 1 });
    });
    const checkedIds = new Set((checks ?? []).filter((c) => busIds.has(c.personId)).map((c) => c.personId));
    return { personMap, busIds, busEntries, checkedIds };
  }, [persons, bus, checks]);

  const loading = persons === undefined || bus === undefined || sessions === undefined || checks === undefined || activeSetting === undefined;

  return {
    loading,
    persons: persons ?? [],
    sessions: sessions ?? [],
    activeSession,
    ...derived,
    stats: {
      total: persons?.length ?? 0,
      onBus: derived.busEntries.length,
      boarded: derived.checkedIds.size,
      waiting: derived.busEntries.length - derived.checkedIds.size,
    },
  };
}

export type AppData = ReturnType<typeof useAppData>;

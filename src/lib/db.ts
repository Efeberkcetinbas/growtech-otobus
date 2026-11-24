import Dexie, { type Table } from 'dexie';
import type { AttendanceCheck, AttendanceSession, BusMember, Person, SettingRow, Snapshot } from '../types';

export const DB_NAME = 'growtech-otobus';

/**
 * IndexedDB şeması. Uygulama güncellemelerinde yeni sürüm eklenir (this.version(2)...);
 * mevcut sürümler asla silinmez, böylece kayıtlar korunur.
 */
export class AppDB extends Dexie {
  persons!: Table<Person, string>;
  bus!: Table<BusMember, string>;
  sessions!: Table<AttendanceSession, string>;
  checks!: Table<AttendanceCheck, [string, string]>;
  settings!: Table<SettingRow, string>;
  snapshots!: Table<Snapshot, number>;

  constructor(name = DB_NAME) {
    super(name);
    this.version(1).stores({
      persons: 'id, sourceKey, source, updatedAt',
      bus: 'personId, addedAt',
      sessions: 'id, order',
      checks: '[sessionId+personId], sessionId, personId',
      settings: 'key',
      snapshots: '++id, createdAt',
    });
  }
}

export const db = new AppDB();

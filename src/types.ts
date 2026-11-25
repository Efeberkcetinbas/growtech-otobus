/** Kayıtlar üzerinde gösterilen doğrulama / bilgi işaretleri. */
export type Flag =
  /** Birden fazla isim ve numara sıralı eşleştirildi, doğrulanmadı. */
  | 'pairing-unverified'
  /** Numara birden fazla kişi için ortak irtibat; kime ait olduğu bilinmiyor. */
  | 'shared-phone'
  /** Kişiye ait telefon yok. */
  | 'missing-phone'
  /** Telefon biçimi Türkiye numarasına uymuyor. */
  | 'invalid-phone'
  /** Tek kişiye birden fazla numara yazılmış. */
  | 'extra-phone'
  /** İsimler "-" ile ayrılmış; ayrıştırma doğrulanmalı. */
  | 'ambiguous-separator'
  /** Biniş yeri boş ya da "??", "-" gibi belirsiz. */
  | 'boarding-unknown'
  /** Ulaşım "OTOBÜD" gibi yazım hatası şüphesiyle otobüs kabul edildi. */
  | 'transport-typo'
  /** SPRİNTER gibi farklı ulaşım türünden kullanıcı onayıyla eklendi. */
  | 'transport-other'
  /** Ulaşım türü belirtilmemişken kullanıcı onayıyla eklendi. */
  | 'transport-unknown'
  /** Son Excel yüklemesinde bu kişi bulunamadı (silinmedi). */
  | 'missing-from-latest-import';

export const VERIFY_FLAGS: Flag[] = ['pairing-unverified', 'shared-phone', 'invalid-phone', 'ambiguous-separator', 'transport-typo'];

export const FLAG_LABELS: Record<Flag, string> = {
  'pairing-unverified': 'İsim–telefon eşleşmesi doğrulanmadı',
  'shared-phone': 'Ortak irtibat numarası',
  'missing-phone': 'Telefon yok',
  'invalid-phone': 'Telefon biçimi hatalı',
  'extra-phone': 'Birden fazla numarası var',
  'ambiguous-separator': 'İsim ayrımı doğrulanmalı',
  'boarding-unknown': 'Biniş yeri belirsiz',
  'transport-typo': 'Ulaşım yazımı onaylandı (ör. OTOBÜD)',
  'transport-other': 'Farklı ulaşım türü',
  'transport-unknown': 'Ulaşım belirtilmemişti',
  'missing-from-latest-import': 'Son Excel’de yok',
};

/** Excel'den gelen alanların içe aktarma anındaki değeri (çakışma tespiti için). */
export interface ImportSnapshot {
  fullName: string;
  phone: string;
  extraPhones?: string[];
  sharedPhones: string[];
  company: string;
  boardingPlace: string;
}

export interface Person {
  id: string;
  fullName: string;
  /** Kişinin kendi telefonu (string). Bilinmiyorsa boş. */
  phone: string;
  /** Kişinin kendi ek numaraları (eski kayıtlarda olmayabilir). */
  extraPhones?: string[];
  /** Kime ait olduğu bilinmeyen ortak irtibat numaraları. */
  sharedPhones: string[];
  company: string;
  /** Aynı firmadan gelen kişileri gruplar (sicil no ya da unvan). */
  companyKey: string;
  sicilNo: string;
  /** Firmanın üye kaydındaki cep telefonu. Kişisel telefonla karıştırılmaz. */
  companyPhone: string;
  boardingPlace: string;
  note: string;
  source: 'excel' | 'manual';
  /** Excel kaynağının kalıcı anahtarı (firma + isim). Elle eklenenlerde yok. */
  sourceKey?: string;
  importSnapshot?: ImportSnapshot;
  /** İçe aktarmadan sonra kullanıcı tarafından düzenlendi mi? */
  edited: boolean;
  flags: Flag[];
  /** Excel satır numarası (bilgi amaçlı). */
  sourceRow?: number;
  /**
   * Silinme zamanı. Silinen kişi listelerde görünmez ama kayıt (silinme işareti olarak)
   * saklanır: geçmiş yoklama kayıtları anlamını korur ve yeni Excel yüklemesinde
   * aynı kişi otomatik olarak geri eklenmez.
   */
  deletedAt?: number;
  /**
   * Kim kaldırdı? 'user': kullanıcı sildi (Excel'den asla otomatik geri gelmez).
   * 'import': yeni Excel'de artık otobüs katılımcısı değildi ve kullanıcı onayıyla
   * aktif listeden çıkarıldı (ileride Excel'de yine otobüsle gelirse geri alınabilir).
   */
  removedBy?: 'user' | 'import';
  /** Excel'den çıkarılma nedeni (ör. "Sarı işaretli satır"). */
  removedReason?: string;
  createdAt: number;
  updatedAt: number;
}

export interface BusMember {
  personId: string;
  addedAt: number;
}

export interface AttendanceSession {
  id: string;
  name: string;
  order: number;
  createdAt: number;
}

export interface AttendanceCheck {
  sessionId: string;
  personId: string;
  checkedAt: number;
}

export interface SettingRow {
  key: string;
  value: unknown;
}

export interface Snapshot {
  id?: number;
  createdAt: number;
  reason: string;
  data: BackupData;
}

export interface BackupData {
  app: 'growtech-otobus';
  schema: number;
  exportedAt: string;
  persons: Person[];
  bus: BusMember[];
  sessions: AttendanceSession[];
  checks: AttendanceCheck[];
  settings: SettingRow[];
}

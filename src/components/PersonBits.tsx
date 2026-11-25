import { AlertTriangle, Building2, MapPin, Phone, PhoneOff, Users } from 'lucide-react';
import { callTarget } from '../lib/person';
import { formatPhone, telHref } from '../lib/phone';
import { FLAG_LABELS, VERIFY_FLAGS, type Flag, type Person } from '../types';

export function CallButton({ person, compact = false, labelClassName = '' }: { person: Person; compact?: boolean; labelClassName?: string }) {
  const target = callTarget(person);
  if (!target) {
    return (
      <span
        className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 px-3 text-sm font-semibold text-slate-400"
        aria-label="Telefon numarası yok"
      >
        <PhoneOff className="h-5 w-5" />
        {!compact && <span className={labelClassName}>Numara yok</span>}
      </span>
    );
  }
  return (
    <a
      href={telHref(target.number)}
      aria-label={`${person.fullName} kişisini ara${target.shared ? ' (ortak irtibat)' : ''}`}
      className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-xl border border-brand-600/50 bg-white px-3 text-[15px] font-semibold text-brand-600 active:bg-brand-50"
    >
      <Phone className="h-5 w-5" />
      {!compact && <span className={labelClassName}>Ara</span>}
    </a>
  );
}

export function PhoneLine({ person }: { person: Person }) {
  const extras = person.extraPhones ?? [];
  if (person.phone || extras.length) {
    const all = [person.phone, ...extras].filter(Boolean);
    return (
      <span className="flex items-start gap-1.5 font-semibold tabular-nums">
        <Phone className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden />
        <span className="flex flex-wrap gap-x-2">
          {all.map((n, i) => (
            <span key={n} className="whitespace-nowrap">
              {i > 0 ? (
                <a href={telHref(n)} className="text-brand-600 underline underline-offset-2" aria-label={`Diğer numarayı ara: ${formatPhone(n)}`}>
                  {formatPhone(n)}
                </a>
              ) : (
                formatPhone(n)
              )}
              {i < all.length - 1 && <span className="text-slate-400"> /</span>}
            </span>
          ))}
          {person.flags.includes('pairing-unverified') && <span className="text-xs font-semibold text-[#8a5a12]">(doğrulanmadı)</span>}
        </span>
      </span>
    );
  }
  if (person.sharedPhones.length) {
    return (
      <span className="flex items-center gap-1.5 tabular-nums">
        <Users className="h-4 w-4 shrink-0 text-warn" aria-hidden />
        <span>
          <span className="text-sm text-slate-600">Ortak irtibat: </span>
          <span className="font-semibold">{person.sharedPhones.map(formatPhone).join(' / ')}</span>
        </span>
      </span>
    );
  }
  return (
    <span className="flex items-start gap-1.5 text-sm text-slate-500">
      <PhoneOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span>
        Kişisel telefon yok
        {person.companyPhone && <span className="whitespace-nowrap tabular-nums"> · Firma: {formatPhone(person.companyPhone.split(' / ')[0])}</span>}
      </span>
    </span>
  );
}

export function MetaLines({ person }: { person: Person }) {
  return (
    <>
      {person.company && (
        <span className="flex min-w-0 items-start gap-1.5 text-sm text-slate-600">
          <Building2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span className="min-w-0 break-words">{person.company}</span>
        </span>
      )}
      <span className="flex items-center gap-1.5 text-sm text-slate-600">
        <MapPin className="h-4 w-4 shrink-0" aria-hidden />
        {person.boardingPlace || <span className="text-slate-400">Biniş yeri belirtilmemiş</span>}
      </span>
    </>
  );
}

const SHOW_FLAGS: Flag[] = [...VERIFY_FLAGS, 'missing-phone', 'transport-other', 'transport-unknown', 'missing-from-latest-import'];

export function FlagBadges({ flags }: { flags: Flag[] }) {
  const shown = flags.filter((f) => SHOW_FLAGS.includes(f) && f !== 'shared-phone');
  if (!shown.length) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {shown.map((f) => (
        <span
          key={f}
          className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold ${
            VERIFY_FLAGS.includes(f) ? 'bg-warn-50 text-[#8a5a12]' : 'bg-slate-100 text-slate-600'
          }`}
        >
          {VERIFY_FLAGS.includes(f) && <AlertTriangle className="h-3 w-3" aria-hidden />}
          {FLAG_LABELS[f]}
        </span>
      ))}
    </div>
  );
}

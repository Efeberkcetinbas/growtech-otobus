import { AlertTriangle } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { formatPhone } from '../lib/phone';
import { createPerson, findSimilar, updatePerson, type SimilarMatch } from '../lib/repo';
import { toast } from '../lib/notify';
import { VERIFY_FLAGS, type Person } from '../types';
import { Button, Sheet } from './ui';
import { FlagBadges } from './PersonBits';

interface Props {
  person?: Person;
  boardingOptions: string[];
  onClose: () => void;
}

const field = 'h-12 w-full rounded-xl border border-slate-300 bg-white px-3 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/30';

export function PersonForm({ person, boardingOptions, onClose }: Props) {
  const editing = !!person;
  const [fullName, setFullName] = useState(person?.fullName ?? '');
  const [phone, setPhone] = useState(person?.phone ? formatPhone(person.phone) : '');
  const [company, setCompany] = useState(person?.company ?? '');
  const [boardingPlace, setBoardingPlace] = useState(person?.boardingPlace ?? '');
  const [note, setNote] = useState(person?.note ?? '');
  const [addToBus, setAddToBus] = useState(true);
  const [verified, setVerified] = useState(false);
  const [keepShared, setKeepShared] = useState(true);
  const [similar, setSimilar] = useState<SimilarMatch[] | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const hasVerifyFlags = !!person?.flags.some((f) => VERIFY_FLAGS.includes(f));

  async function submit(e: FormEvent, force = false) {
    e.preventDefault();
    setError('');
    if (!fullName.trim()) {
      setError('Ad soyad zorunludur.');
      return;
    }
    const identityChanged = !person || fullName.trim() !== person.fullName || phone.replace(/\D/g, '') !== person.phone.replace(/\D/g, '');
    if (!force && identityChanged) {
      const found = await findSimilar(fullName, phone, person?.id);
      if (found.length) {
        setSimilar(found);
        return;
      }
    }
    setSaving(true);
    try {
      const input = { fullName, phone, company, boardingPlace, note };
      if (person) {
        await updatePerson(person.id, { ...input, verified, keepSharedPhones: keepShared });
        toast('Bilgiler güncellendi');
      } else {
        await createPerson(input, addToBus);
        toast(addToBus ? 'Kişi eklendi ve otobüsünüze alındı' : 'Kişi eklendi');
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet
      title={editing ? 'Katılımcıyı düzelt' : 'Yeni katılımcı'}
      onClose={onClose}
      footer={
        similar ? (
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => setSimilar(null)}>Geri dön</Button>
            <Button variant="primary" disabled={saving} onClick={(e) => submit(e as unknown as FormEvent, true)}>
              Yine de kaydet
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={onClose}>Vazgeç</Button>
            <Button variant="primary" type="submit" form="person-form" disabled={saving}>
              Kaydet
            </Button>
          </div>
        )
      }
    >
      {similar ? (
        <div className="space-y-3">
          <div className="flex gap-2 rounded-xl bg-warn-50 p-3 text-[15px] text-[#6b4510]">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <p>
              Benzer kayıt bulundu. Aynı kişiyse yeni kayıt oluşturmak yerine mevcut kaydı kullanın. Farklı kişiler ortak telefon kullanabilir; gerekirse
              yine de kaydedebilirsiniz.
            </p>
          </div>
          <ul className="space-y-2">
            {similar.map(({ person: p, reason }) => (
              <li key={p.id} className="rounded-xl border border-slate-200 p-3">
                <p className="font-bold">{p.fullName}</p>
                <p className="text-sm text-slate-600">
                  {[p.phone && formatPhone(p.phone), p.company, p.boardingPlace].filter(Boolean).join(' · ')}
                </p>
                <p className="mt-1 text-xs font-semibold text-[#8a5a12]">{reason === 'name' ? 'Benzer isim' : 'Aynı telefon numarası'}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <form id="person-form" onSubmit={(e) => submit(e)} className="space-y-3" noValidate>
          {person && <FlagBadges flags={person.flags} />}
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">
              Ad soyad <span className="text-danger">*</span>
            </span>
            <input className={field} value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="off" required autoFocus={!editing} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Telefon numarası</span>
            <input className={`${field} tabular-nums`} value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" type="tel" autoComplete="off" placeholder="05xx xxx xx xx" />
          </label>
          {person && person.sharedPhones.length > 0 && (
            <div className="rounded-xl bg-warn-50 p-3 text-sm">
              <p>
                <b>Ortak irtibat:</b> {person.sharedPhones.map(formatPhone).join(' / ')} — Excel’de bu numaranın hangi kişiye ait olduğu belli değil. Numara bu kişinin ise
                yukarıdaki telefon alanına yazın.
              </p>
              <label className="mt-2 flex min-h-11 items-center gap-2">
                <input type="checkbox" className="h-5 w-5 accent-brand-600" checked={!keepShared} onChange={(e) => setKeepShared(!e.target.checked)} />
                Ortak irtibat numarasını bu kişiden kaldır
              </label>
            </div>
          )}
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Firma</span>
            <input className={field} value={company} onChange={(e) => setCompany(e.target.value)} autoComplete="off" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Biniş yeri</span>
            <input className={field} value={boardingPlace} onChange={(e) => setBoardingPlace(e.target.value)} list="boarding-options" autoComplete="off" />
            <datalist id="boarding-options">
              {boardingOptions.map((b) => (
                <option key={b} value={b} />
              ))}
            </datalist>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Açıklama</span>
            <textarea className={`${field} h-auto min-h-20 py-2`} value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
          </label>
          {person?.companyPhone && (
            <p className="text-sm text-slate-600">
              Firmanın üye kaydındaki telefon: <span className="tabular-nums">{person.companyPhone.split(' / ').map(formatPhone).join(' / ')}</span> (kişisel numara olarak kullanılmaz)
            </p>
          )}
          {hasVerifyFlags && (
            <label className="flex min-h-11 items-center gap-2 rounded-xl border border-warn/50 bg-warn-50 px-3 text-[15px] font-semibold">
              <input type="checkbox" className="h-5 w-5 accent-brand-600" checked={verified} onChange={(e) => setVerified(e.target.checked)} />
              Bilgileri kontrol ettim, doğru
            </label>
          )}
          {!editing && (
            <label className="flex min-h-11 items-center gap-2 text-[15px] font-semibold">
              <input type="checkbox" className="h-5 w-5 accent-brand-600" checked={addToBus} onChange={(e) => setAddToBus(e.target.checked)} />
              Doğrudan otobüsüme ekle
            </label>
          )}
          {error && (
            <p role="alert" className="text-sm font-semibold text-danger">
              {error}
            </p>
          )}
        </form>
      )}
    </Sheet>
  );
}

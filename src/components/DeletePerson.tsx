import { Trash2 } from 'lucide-react';
import { toast } from '../lib/notify';
import { deletePerson, restorePerson } from '../lib/repo';
import type { Person } from '../types';
import { Button, ConfirmDialog } from './ui';

export const UNDO_MS = 10_000;

/** Düzelt düğmesinin yanında duran kırmızı çöp kutusu ikonlu Sil düğmesi. */
export function DeleteButton({ person, onClick }: { person: Person; onClick: () => void }) {
  return (
    <Button
      variant="danger"
      aria-label={`${person.fullName} kişisini sil`}
      onClick={onClick}
      className="!border-danger/50 !text-danger"
      data-testid="delete-person"
    >
      <Trash2 className="h-5 w-5" />
      <span className="sr-only sm:not-sr-only">Sil</span>
    </Button>
  );
}

/** Kişinin adını gösteren silme onayı; onaylanınca siler ve 10 sn "Geri al" sunar. */
export function DeletePersonDialog({ person, onBus, onClose }: { person: Person; onBus: boolean; onClose: () => void }) {
  async function confirm() {
    onClose();
    try {
      const { busAddedAt } = await deletePerson(person.id);
      toast(
        `${person.fullName} silindi`,
        'info',
        {
          label: 'Geri al',
          run: () =>
            void restorePerson(person.id, busAddedAt)
              .then(() => toast(`${person.fullName} geri alındı`))
              .catch(() => undefined),
        },
        UNDO_MS,
      );
    } catch {
      /* guarded bildirir */
    }
  }

  return (
    <ConfirmDialog
      title="Katılımcı silinsin mi?"
      danger
      confirmLabel="Sil"
      onCancel={onClose}
      onConfirm={() => void confirm()}
      message={
        <>
          <p className="text-lg font-bold break-words" data-testid="delete-name">
            {person.fullName}
          </p>
          {person.company && <p className="text-sm break-words text-slate-600">{person.company}</p>}
          <p className="mt-3">
            Bu kişi katılımcı listesinden{onBus ? <> ve <b>otobüs listenizden</b></> : null} kaldırılacak.
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
            <li>Geçmiş yoklama kayıtları korunur.</li>
            <li>Aynı firmadaki diğer kişiler silinmez.</li>
            <li>Yeni Excel yüklendiğinde otomatik olarak geri eklenmez.</li>
            <li>Yanlışlıkla silerseniz 10 saniye içinde “Geri al”a dokunun.</li>
          </ul>
        </>
      }
    />
  );
}

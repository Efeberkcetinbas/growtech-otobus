import { AlertTriangle, CheckCircle2, Download, Eye, FileText, Loader2, Share2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { AttendanceSession } from '../types';
import type { BusInfo, PdfOutput, ReportKind } from '../lib/pdf';
import { toast } from '../lib/notify';
import { Button, Sheet } from './ui';

type Report = typeof import('../lib/pdfReport');
const loadReport = (): Promise<Report> => import('../lib/pdfReport');

const field = 'h-12 w-full rounded-xl border border-slate-300 bg-white px-3 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/30';

interface ShareState {
  out: PdfOutput;
  file: File;
  supported: boolean;
}

export function PdfSheet({ sessions, activeSessionId, onClose }: { sessions: AttendanceSession[]; activeSessionId?: string; onClose: () => void }) {
  const [info, setInfo] = useState<BusInfo>({ number: '', plate: '', supervisor: '' });
  const [kind, setKind] = useState<ReportKind>('standard');
  const [sessionId, setSessionId] = useState(activeSessionId ?? sessions[0]?.id ?? '');
  const [busy, setBusy] = useState<null | 'create' | 'download' | 'share'>(null);
  const [created, setCreated] = useState<{ out: PdfOutput; url: string } | null>(null);
  const [share, setShare] = useState<ShareState | null>(null);
  const [error, setError] = useState('');
  const touched = useRef(false);

  useEffect(() => {
    let alive = true;
    // Kayıtlı bilgi geç yüklenirse kullanıcının o arada yazdıklarının üzerine yazılmaz.
    void loadReport().then((r) => r.getBusInfo().then((i) => alive && !touched.current && setInfo(i)));
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => () => {
    if (created) URL.revokeObjectURL(created.url);
  }, [created]);

  const edit = (patch: Partial<BusInfo>) => {
    touched.current = true;
    setInfo((cur) => ({ ...cur, ...patch }));
  };

  const persistInfo = (next: BusInfo) => {
    setInfo(next);
    void loadReport().then((r) => r.saveBusInfo(next)).catch(() => toast('Otobüs bilgisi kaydedilemedi', 'error'));
  };

  /** Her işlemde PDF, o anki IndexedDB kayıtlarından yeniden üretilir. */
  async function make(action: 'create' | 'download' | 'share') {
    setBusy(action);
    setError('');
    try {
      const r = await loadReport();
      await r.saveBusInfo(info);
      const out = await r.generateReport(kind, sessionId);
      if (action === 'create') {
        if (created) URL.revokeObjectURL(created.url);
        setCreated({ out, url: URL.createObjectURL(out.blob) });
      } else if (action === 'download') {
        r.downloadPdf(out);
        toast(`${out.fileName} indirildi`);
      } else {
        const file = r.pdfFile(out);
        setShare({ out, file, supported: r.canShareFile(file) });
      }
    } catch (e) {
      setError(`PDF oluşturulamadı: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  }

  async function doShare() {
    if (!share) return;
    try {
      const r = await loadReport();
      const res = await r.sharePdf(share.file);
      if (res === 'shared') toast('PDF paylaşıldı');
      setShare(null);
    } catch (e) {
      setError(`Paylaşılamadı: ${(e as Error).message}. PDF’i indirip uygulamadan ekleyebilirsiniz.`);
      setShare({ ...share, supported: false });
    }
  }

  return (
    <Sheet title="PDF yolcu listesi" onClose={onClose}>
      <div className="space-y-4">
        <section className="space-y-2">
          <h3 className="text-sm font-bold text-brand-900">Otobüs bilgileri (isteğe bağlı)</h3>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-600">Otobüs numarası</span>
              <input className={field} value={info.number} inputMode="numeric" onChange={(e) => edit({ number: e.target.value })} onBlur={() => persistInfo(info)} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-600">Plaka</span>
              <input
                className={`${field} uppercase`}
                value={info.plate}
                autoCapitalize="characters"
                onChange={(e) => edit({ plate: e.target.value })}
                onBlur={() => persistInfo(info)}
              />
            </label>
          </div>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-600">Otobüs sorumlusu</span>
            <input className={field} value={info.supervisor} onChange={(e) => edit({ supervisor: e.target.value })} onBlur={() => persistInfo(info)} />
          </label>
        </section>

        <section className="space-y-2" role="radiogroup" aria-label="Rapor türü">
          <h3 className="text-sm font-bold text-brand-900">Rapor türü</h3>
          {(
            [
              ['standard', 'Standart Yolcu Listesi', 'Sıra no, ad soyad, firma, iletişim, biniş yeri ve toplam yolcu'],
              ['attendance', 'Yoklama Durumlu Yolcu Listesi', 'Standart listeye ek olarak seçili oturumda Bindi / Bekleniyor durumu'],
            ] as const
          ).map(([k, title, desc]) => (
            <label key={k} className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border p-3 ${kind === k ? 'border-brand-600 bg-brand-50' : 'border-slate-200'}`}>
              <input type="radio" name="report-kind" className="mt-1 h-5 w-5 shrink-0 accent-brand-600" checked={kind === k} onChange={() => setKind(k)} />
              <span>
                <span className="block font-bold">{title}</span>
                <span className="block text-sm text-slate-600">{desc}</span>
              </span>
            </label>
          ))}
          {kind === 'attendance' && (
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-600">Yoklama oturumu</span>
              <select className={field} value={sessionId} onChange={(e) => setSessionId(e.target.value)} aria-label="Yoklama oturumu seçin">
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </section>

        <p className="text-xs text-slate-500">PDF yalnızca otobüs listenizdeki kişilerden, oluşturulduğu andaki güncel bilgilerle hazırlanır. İnternet gerekmez.</p>

        <div className="grid gap-2">
          <Button variant="primary" onClick={() => void make('create')} disabled={!!busy} data-testid="pdf-create">
            {busy === 'create' ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileText className="h-5 w-5" />} PDF Oluştur
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => void make('download')} disabled={!!busy} data-testid="pdf-download">
              {busy === 'download' ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />} PDF İndir
            </Button>
            <Button onClick={() => void make('share')} disabled={!!busy} data-testid="pdf-share">
              {busy === 'share' ? <Loader2 className="h-5 w-5 animate-spin" /> : <Share2 className="h-5 w-5" />} PDF Paylaş
            </Button>
          </div>
        </div>

        {error && (
          <p role="alert" className="flex gap-2 rounded-xl bg-danger-50 p-3 text-sm font-semibold text-danger">
            <AlertTriangle className="h-5 w-5 shrink-0" /> {error}
          </p>
        )}

        {created && (
          <div className="space-y-2 rounded-xl border border-brand-600/40 bg-brand-50 p-3" data-testid="pdf-result">
            <p className="flex items-start gap-2 text-sm text-brand-900">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
              <span>
                <b>PDF hazır:</b> <span data-testid="pdf-rows">{created.out.rowCount}</span> yolcu, <span data-testid="pdf-pages">{created.out.pageCount}</span> sayfa
                <span className="block text-xs break-all text-slate-600">{created.out.fileName}</span>
              </span>
            </p>
            <a
              href={created.url}
              target="_blank"
              rel="noopener"
              className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-brand-600/50 bg-white text-[15px] font-semibold text-brand-900 active:bg-brand-50"
            >
              <Eye className="h-5 w-5" /> Önizle
            </a>
          </div>
        )}

        {share && (
          <div className="space-y-2 rounded-xl border border-warn bg-warn-50 p-3" data-testid="pdf-share-panel">
            <p className="flex items-start gap-2 text-sm text-[#6b4510]">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              <span>
                Bu PDF <b>kişisel veri</b> (ad soyad ve telefon numaraları) içerir. Yalnızca organizasyon için yetkili kişilerle paylaşın.
              </span>
            </p>
            {share.supported ? (
              <div className="grid grid-cols-2 gap-2">
                <Button onClick={() => setShare(null)}>Vazgeç</Button>
                <Button variant="primary" onClick={() => void doShare()} data-testid="pdf-share-confirm">
                  <Share2 className="h-5 w-5" /> Paylaş
                </Button>
              </div>
            ) : (
              <>
                <p className="text-sm text-slate-700" data-testid="pdf-share-unsupported">
                  Bu tarayıcı dosya paylaşımını desteklemiyor. PDF’i indirip WhatsApp veya e-postaya ek olarak ekleyebilirsiniz.
                </p>
                <Button
                  variant="primary"
                  className="w-full"
                  onClick={() => {
                    void loadReport().then((r) => r.downloadPdf(share.out));
                    setShare(null);
                  }}
                >
                  <Download className="h-5 w-5" /> PDF İndir
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </Sheet>
  );
}

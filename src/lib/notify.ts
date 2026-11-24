export type ToastKind = 'success' | 'error' | 'info';
export interface ToastAction {
  label: string;
  run: () => void;
}
export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
  action?: ToastAction;
  /** Ekranda kalma süresi (ms). */
  duration?: number;
}

type Listener = (t: Toast) => void;
const listeners = new Set<Listener>();
let counter = 0;

export function onToast(fn: Listener) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function toast(message: string, kind: ToastKind = 'success', action?: ToastAction, duration?: number) {
  const t = { id: ++counter, kind, message, action, duration };
  listeners.forEach((l) => l(t));
}

let pendingWrites = 0;
let lastWriteAt = 0;

/**
 * Devam eden veya az önce biten bir kayıt işlemi var mı? Otomatik güncelleme
 * sayfayı yeniden yüklemeden önce bunu kontrol eder; böylece yarım kalan yazma olmaz.
 */
export function isWriteActive(quietMs = 1500): boolean {
  return pendingWrites > 0 || Date.now() - lastWriteAt < quietMs;
}

/** Veri tabanı işlemini çalıştırır; hata olursa kullanıcıya bildirir ve hatayı yeniden fırlatır. */
export async function guarded<T>(label: string, op: () => Promise<T>): Promise<T> {
  pendingWrites++;
  try {
    return await op();
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    toast(`${label} kaydedilemedi: ${detail}`, 'error');
    throw e;
  } finally {
    pendingWrites--;
    lastWriteAt = Date.now();
  }
}

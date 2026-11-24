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

export function toast(message: string, kind: ToastKind = 'success', action?: ToastAction) {
  const t = { id: ++counter, kind, message, action };
  listeners.forEach((l) => l(t));
}

/** Veri tabanı işlemini çalıştırır; hata olursa kullanıcıya bildirir ve hatayı yeniden fırlatır. */
export async function guarded<T>(label: string, op: () => Promise<T>): Promise<T> {
  try {
    return await op();
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    toast(`${label} kaydedilemedi: ${detail}`, 'error');
    throw e;
  }
}

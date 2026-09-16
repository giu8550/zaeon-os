/**
 * Padrão único de "Enter envia" pros inputs de chat (backlog v2 · A1).
 *  - Enter            → envia (com preventDefault, sem quebrar linha nem submeter <form>)
 *  - Shift+Enter      → nova linha (não envia)
 *  - composição IME   → ignora (acentos/teclados asiáticos não disparam envio no meio)
 */
type EnterLikeEvent = {
  key: string;
  shiftKey?: boolean;
  preventDefault: () => void;
  nativeEvent?: { isComposing?: boolean };
  isComposing?: boolean;
};

export function isSubmitEnter(e: EnterLikeEvent): boolean {
  if (e.key !== "Enter" || e.shiftKey) return false;
  if (e.isComposing || e.nativeEvent?.isComposing) return false;
  return true;
}

/** Uso: `onKeyDown={onEnterSubmit(send)}` */
export function onEnterSubmit(submit: () => unknown) {
  return (e: EnterLikeEvent) => {
    if (!isSubmitEnter(e)) return;
    e.preventDefault();
    void submit();
  };
}

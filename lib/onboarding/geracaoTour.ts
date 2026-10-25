/**
 * #613 · a "geração" dos tours do laboratório: cada "Rever tutorial" abre uma geração nova (no localStorage, que as
 * abas dividem). Um tour começado ANTES dela (noutra aba) não pode, ao terminar, marcar como visto de novo o tour
 * que a pessoa acabou de pedir pra rever.
 */
const CHAVE = "zaeon.tour.geracao";

export const geracaoDosTours = (): string => { try { return localStorage.getItem(CHAVE) ?? "0"; } catch { return "0"; } };
export const novaGeracaoDosTours = () => { try { localStorage.setItem(CHAVE, String(Date.now())); } catch { /* ignore */ } };
/** o tour que começou na geração `g` ainda vale? (sem `g`: vale, o comportamento de antes) */
export const geracaoValida = (g?: string) => g === undefined || g === geracaoDosTours();

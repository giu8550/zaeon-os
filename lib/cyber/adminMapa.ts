/**
 * O ADMIN DO MAPA do cyberespaço (o painel de configurações da frota/áreas — components/cyber/admin): SÓ o dono
 * (pedido dele, out/2026: "dos outros usuários, apenas donmartinezcaiudoceu@gmail.com é admin"). Vale só pro mapa — o
 * resto do site segue com a allowlist de super admin (lib/auth/roles).
 */
export const ADMIN_DO_MAPA = "donmartinezcaiudoceu@gmail.com";
export const ehAdminDoMapa = (email?: string | null) => (email ?? "").trim().toLowerCase() === ADMIN_DO_MAPA;

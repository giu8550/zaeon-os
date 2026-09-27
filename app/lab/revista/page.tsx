/**
 * /lab/revista — bancada de diagramação do Modo Revista. NÃO é rota de produto.
 *
 * Existe porque conferir a diagramação pelo chat é caro e não-determinístico: depende de
 * login, de cota de modelo e de qual resposta o modelo resolveu dar naquele minuto. Aqui a
 * `StructuredAnswer` é fixa, então o que muda na tela é só o que a gente mexeu no layout.
 *
 * O PORTÃO É DE SERVIDOR, de propósito. A primeira versão checava `NODE_ENV` dentro do
 * componente cliente e devolvia "Indisponível" — o que dá 200 e uma rota que existe. Rota
 * de bancada não deve existir em produção: aqui ela 404a. (O código do componente ainda
 * entra no build; o que some é a rota. Não tem segredo nem dado de aluno nela.)
 */
import { notFound } from "next/navigation";
import Bancada from "./bancada";

export default function LabRevistaPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <Bancada />;
}

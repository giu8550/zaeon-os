// Envio de e-mail — abstração. PONTO DE PAUSA: plugar um provedor (Resend/SES/SMTP).
// Por ora: loga no servidor e, em dev, o código volta na resposta da API (ver rota).

export async function sendEduCode(to: string, code: string): Promise<boolean> {
  // TODO(pausa): integrar provedor real. Ex. Resend:
  //   await resend.emails.send({ from, to, subject, html })
  console.log(`[email] código de verificação .edu para ${to}: ${code}`);
  return true;
}

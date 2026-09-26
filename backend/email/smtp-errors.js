/** Normalise une erreur Nodemailer / SMTP pour réponse API. */
export function smtpErrorPayload(err) {
  const code = err?.code || err?.responseCode || 'SMTP_ERROR';
  const message =
    err?.response ||
    err?.message ||
    'Le serveur de messagerie a refusé ou n’a pas pu envoyer l’e-mail.';
  return { message: String(message), code: String(code) };
}

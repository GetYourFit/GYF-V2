export { CONTACT_EMAIL, CONTACT_MAILTO } from "../../../../app/lib/contact";

export type ContactDraft = { name: string; email: string; message: string };

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function contactErrors(draft: ContactDraft): Partial<Record<keyof ContactDraft, string>> {
  const name = draft.name.trim();
  const email = draft.email.trim();
  const message = draft.message.trim();
  return {
    ...(!name ? { name: "Tell us what to call you." } : {}),
    ...(!EMAIL.test(email) ? { email: "Enter a valid reply email." } : {}),
    ...(!message ? { message: "Write a message before sending." } : {}),
  };
}

export function contactPayload(draft: ContactDraft) {
  const name = draft.name.trim();
  return {
    kind: "contact" as const,
    message: `From ${name}: ${draft.message.trim()}`,
    reply_email: draft.email.trim().toLowerCase(),
  };
}

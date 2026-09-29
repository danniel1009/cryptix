"use client";

import { CircleAlert, Send } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { interpolate } from "@/lib/i18n/dictionaries";
import { useI18n } from "@/lib/i18n/provider";
import { CONTACT_LIMITS } from "@/lib/validation/schemas";
import { ContactSuccess } from "./ContactSuccess";
import { useContactForm } from "./useContactForm";

const FORM_TITLE_ID = "contact-form-title";
/** No schema limit for phones; "+62 (812) 3456-7890" is 19 characters, E.164 is at most 16. */
const WHATSAPP_INPUT_MAX_LENGTH = 24;

/**
 * The contact form card: five required fields, an off-screen honeypot, a
 * form-level alert for non-field errors and a loading submit. On success the
 * whole card is replaced by <ContactSuccess>. Validation runs client-side
 * first (same zod schema as the API) and the first invalid field is focused.
 */
export function ContactForm() {
  const { t, locale, formatNumber } = useI18n();
  const form = useContactForm({ locale });
  const { values, errors, formError, status, reference } = form;
  const submitting = status === "submitting";

  if (status === "success" && reference) {
    return <ContactSuccess reference={reference} onReset={form.reset} />;
  }

  const fieldError = (field: keyof typeof errors) => {
    const code = errors[field];
    return code ? t.validation[code] : undefined;
  };

  const alert = formError
    ? {
        message: t.form.errors[formError.code],
        detail:
          formError.code === "rate_limited"
            ? interpolate(t.contact.retryAfter, {
                seconds: formatNumber(formError.retryAfterSeconds),
              })
            : null,
      }
    : null;

  const messageCounter = (
    <span className="font-mono nums">
      {formatNumber(values.message.length)} / {formatNumber(CONTACT_LIMITS.message.max)}
    </span>
  );

  return (
    <Card padding="lg" className="h-full">
      <div className="mb-7">
        <h3 id={FORM_TITLE_ID} className="text-xl font-medium tracking-tight text-fg">
          {t.contact.formTitle}
        </h3>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">{t.contact.formNote}</p>
      </div>

      <form
        noValidate
        onSubmit={form.handleSubmit}
        aria-labelledby={FORM_TITLE_ID}
        aria-busy={submitting || undefined}
        className="relative space-y-5"
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <Input
            id="contact-name"
            name="name"
            ref={form.registerField("name")}
            label={t.contact.fields.name.label}
            placeholder={t.contact.fields.name.placeholder}
            value={values.name}
            onChange={(event) => form.setField("name", event.target.value)}
            error={fieldError("name")}
            required
            maxLength={CONTACT_LIMITS.name.max}
            autoComplete="name"
          />
          <Input
            id="contact-email"
            name="email"
            type="email"
            inputMode="email"
            ref={form.registerField("email")}
            label={t.contact.fields.email.label}
            placeholder={t.contact.fields.email.placeholder}
            value={values.email}
            onChange={(event) => form.setField("email", event.target.value)}
            error={fieldError("email")}
            required
            maxLength={CONTACT_LIMITS.email.max}
            autoComplete="email"
          />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Input
            id="contact-whatsapp"
            name="whatsapp"
            type="tel"
            inputMode="tel"
            ref={form.registerField("whatsapp")}
            label={t.contact.fields.whatsapp.label}
            placeholder={t.contact.fields.whatsapp.placeholder}
            value={values.whatsapp}
            onChange={(event) => form.setField("whatsapp", event.target.value)}
            error={fieldError("whatsapp")}
            required
            maxLength={WHATSAPP_INPUT_MAX_LENGTH}
            autoComplete="tel"
            mono
          />
          <Input
            id="contact-subject"
            name="subject"
            ref={form.registerField("subject")}
            label={t.contact.fields.subject.label}
            placeholder={t.contact.fields.subject.placeholder}
            value={values.subject}
            onChange={(event) => form.setField("subject", event.target.value)}
            error={fieldError("subject")}
            required
            maxLength={CONTACT_LIMITS.subject.max}
            autoComplete="off"
          />
        </div>

        <Textarea
          id="contact-message"
          name="message"
          ref={form.registerField("message")}
          label={t.contact.fields.message.label}
          placeholder={t.contact.fields.message.placeholder}
          value={values.message}
          onChange={(event) => form.setField("message", event.target.value)}
          error={fieldError("message")}
          hint={messageCounter}
          required
          rows={5}
          maxLength={CONTACT_LIMITS.message.max}
        />

        {/* Honeypot: off-screen, out of the tab order, hidden from AT. Bots fill it; humans cannot. */}
        <div aria-hidden="true" className="absolute left-[-10000px] top-auto h-px w-px overflow-hidden">
          <label htmlFor="contact-company">{t.form.honeypotLabel}</label>
          <input
            id="contact-company"
            type="text"
            name="company"
            tabIndex={-1}
            autoComplete="off"
            value={form.honeypot}
            onChange={(event) => form.setHoneypot(event.target.value)}
          />
        </div>

        {alert ? (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger"
          >
            <CircleAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
            <div>
              <p className="font-medium">{alert.message}</p>
              {alert.detail ? <p className="mt-1 text-danger">{alert.detail}</p> : null}
            </div>
          </div>
        ) : null}

        <div className="pt-1">
          <Button
            type="submit"
            loading={submitting}
            rightIcon={submitting ? undefined : <Send />}
            className="w-full sm:w-auto sm:min-w-[200px]"
          >
            {submitting ? t.form.submitting : t.contact.submit}
          </Button>
        </div>
      </form>
    </Card>
  );
}

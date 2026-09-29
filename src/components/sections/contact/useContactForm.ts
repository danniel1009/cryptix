"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { submitContact, type SubmitErrorCode, type SubmitResult } from "@/lib/api/client";
import type { Locale } from "@/lib/i18n/types";
import { validateContact, type ValidationErrorCode } from "@/lib/validation/schemas";

/**
 * State machine behind the contact form.
 *
 *   idle ──submit──► (client validation) ──fail──► idle + field errors (first invalid focused)
 *                          │ pass
 *                          ▼
 *                     submitting ──ok──► success (reference)
 *                          │
 *                          └──error──► idle + field errors | form-level error
 *
 * Re-entrancy is guarded by a ref, not by state: a click that lands between
 * the first submit and the re-render still sees `busyRef.current === true`,
 * whereas a `status` check in a stale closure would let it through.
 * Results that arrive after unmount are dropped (the request is aborted too).
 */

export const CONTACT_FIELDS = ["name", "email", "whatsapp", "subject", "message"] as const;
export type ContactField = (typeof CONTACT_FIELDS)[number];

export type ContactValues = Record<ContactField, string>;
export type ContactFieldErrors = Partial<Record<ContactField, ValidationErrorCode>>;
export type ContactFormStatus = "idle" | "submitting" | "success";

/** Non-field error shown in the form-level alert. */
export type ContactFormError =
  | { code: "rate_limited"; retryAfterSeconds: number }
  | { code: Exclude<SubmitErrorCode, "validation_error" | "rate_limited"> };

export const EMPTY_CONTACT_VALUES: ContactValues = {
  name: "",
  email: "",
  whatsapp: "",
  subject: "",
  message: "",
};

type FieldElement = HTMLInputElement | HTMLTextAreaElement;
type FieldRefCallback = (element: FieldElement | null) => void;

export interface UseContactFormOptions {
  /** Sent to the API so the team knows which language the visitor used. */
  locale: Locale;
}

export interface ContactFormApi {
  values: ContactValues;
  errors: ContactFieldErrors;
  formError: ContactFormError | null;
  status: ContactFormStatus;
  /** "CX-XXXXXX" once `status === "success"`. */
  reference: string | null;
  /** Honeypot value (a human never sees the field). */
  honeypot: string;
  setField: (field: ContactField, value: string) => void;
  setHoneypot: (value: string) => void;
  /** Stable ref callback per field, used to focus the first invalid one. */
  registerField: (field: ContactField) => FieldRefCallback;
  handleSubmit: (event: FormEvent<HTMLFormElement>) => void;
  /** Back to an empty, idle form (used by "Send another message"). */
  reset: () => void;
}

function isContactField(key: string): key is ContactField {
  return (CONTACT_FIELDS as readonly string[]).includes(key);
}

/** Keep only errors that belong to a rendered field (drops `_form`, `hp`, unknown keys). */
export function pickContactFieldErrors(
  errors: Partial<Record<string, ValidationErrorCode>>,
): ContactFieldErrors {
  const picked: ContactFieldErrors = {};
  for (const [key, code] of Object.entries(errors)) {
    if (code && isContactField(key)) picked[key] = code;
  }
  return picked;
}

function hasErrors(errors: ContactFieldErrors): boolean {
  return Object.keys(errors).length > 0;
}

export function useContactForm({ locale }: UseContactFormOptions): ContactFormApi {
  const [values, setValues] = useState<ContactValues>(EMPTY_CONTACT_VALUES);
  const [honeypot, setHoneypot] = useState("");
  const [errors, setErrors] = useState<ContactFieldErrors>({});
  const [formError, setFormError] = useState<ContactFormError | null>(null);
  const [status, setStatus] = useState<ContactFormStatus>("idle");
  const [reference, setReference] = useState<string | null>(null);
  // Form render timestamp; the server uses it for its fill-time heuristic.
  const [renderedAt, setRenderedAt] = useState<number>(() => Date.now());

  const busyRef = useRef(false);
  const mountedRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const fieldRefs = useRef<Partial<Record<ContactField, FieldElement | null>>>({});

  useEffect(() => {
    // Set on every mount (StrictMode mounts twice) so post-await results are never dropped forever.
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, []);

  const refCallbacks = useMemo(() => {
    const callbacks = {} as Record<ContactField, FieldRefCallback>;
    for (const field of CONTACT_FIELDS) {
      callbacks[field] = (element) => {
        fieldRefs.current[field] = element;
      };
    }
    return callbacks;
  }, []);

  const registerField = useCallback((field: ContactField) => refCallbacks[field], [refCallbacks]);

  const focusFirstInvalid = useCallback((fieldErrors: ContactFieldErrors) => {
    for (const field of CONTACT_FIELDS) {
      if (fieldErrors[field]) {
        fieldRefs.current[field]?.focus();
        return;
      }
    }
  }, []);

  const setField = useCallback((field: ContactField, value: string) => {
    setValues((previous) => ({ ...previous, [field]: value }));
    // Editing a field clears its own error; the rest stay until the next submit.
    setErrors((previous) => {
      if (!previous[field]) return previous;
      const next = { ...previous };
      delete next[field];
      return next;
    });
  }, []);

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (busyRef.current) return;

      // Client-side validation covers the VISIBLE fields only. The honeypot is
      // a server-side signal: a filled honeypot must reach the API (which
      // answers like a success and delivers nothing), not surface as an error
      // on a field nobody can see.
      const validation = validateContact({ ...values, hp: "", ts: renderedAt });
      if (!validation.success) {
        const fieldErrors = pickContactFieldErrors(validation.errors);
        setErrors(fieldErrors);
        setFormError(hasErrors(fieldErrors) ? null : { code: "unknown" });
        focusFirstInvalid(fieldErrors);
        return;
      }

      busyRef.current = true;
      setErrors({});
      setFormError(null);
      setStatus("submitting");

      const controller = new AbortController();
      abortRef.current = controller;

      const run = async () => {
        let result: SubmitResult;
        try {
          result = await submitContact(
            { ...values, hp: honeypot, ts: renderedAt },
            { locale, signal: controller.signal },
          );
        } catch {
          // submitContact resolves for every outcome by contract; this is belt and braces.
          result = { ok: false, code: "unknown" };
        } finally {
          busyRef.current = false;
          if (abortRef.current === controller) abortRef.current = null;
        }
        if (!mountedRef.current) return;

        if (result.ok) {
          setReference(result.reference);
          setStatus("success");
          return;
        }

        setStatus("idle");
        if (result.code === "validation_error") {
          const fieldErrors = pickContactFieldErrors(result.errors);
          if (hasErrors(fieldErrors)) {
            setErrors(fieldErrors);
            focusFirstInvalid(fieldErrors);
          } else {
            setFormError({ code: "unknown" });
          }
          return;
        }
        if (result.code === "rate_limited") {
          setFormError({ code: "rate_limited", retryAfterSeconds: result.retryAfterSeconds });
          return;
        }
        setFormError({ code: result.code });
      };
      void run();
    },
    [values, honeypot, renderedAt, locale, focusFirstInvalid],
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    busyRef.current = false;
    setValues(EMPTY_CONTACT_VALUES);
    setHoneypot("");
    setErrors({});
    setFormError(null);
    setStatus("idle");
    setReference(null);
    setRenderedAt(Date.now());
  }, []);

  return {
    values,
    errors,
    formError,
    status,
    reference,
    honeypot,
    setField,
    setHoneypot,
    registerField,
    handleSubmit,
    reset,
  };
}

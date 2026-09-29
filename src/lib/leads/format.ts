import "server-only";
import { CURRENCIES, getPairById, pairLabel } from "@/config/exchange";
import { siteConfig } from "@/config/site";
import { formatAmount } from "@/lib/i18n/format";
import { escapeForLog, escapeHtml, maskEmail, maskPhone } from "@/lib/security/sanitize";
import type { ContactLead, ExchangeRequestLead, Lead } from "./types";

/**
 * Human-readable renderings of a lead for the TEAM (English only — this is
 * internal tooling, not customer-facing copy). Amounts are additionally
 * formatted in the CUSTOMER's locale so the team sees exactly what the
 * customer saw ("1.000,00 USDT" for an Indonesian visitor) next to the raw
 * number, which avoids the 1.000 vs 1,000 ambiguity.
 *
 * Every user-provided value goes through `escapeHtml` in the HTML rendering.
 */

const LEAD_TYPE_LABEL: Record<Lead["type"], string> = {
  contact: "Contact message",
  exchange_request: "Exchange request",
};

interface Row {
  label: string;
  value: string;
  /** Rendered with preserved line breaks. */
  multiline?: boolean;
}

/** "1.000 USDT (1000)" — customer-locale formatting (trailing zeros dropped) plus the unambiguous raw number. */
function amountWithRaw(lead: ExchangeRequestLead, value: number, currency: ExchangeRequestLead["from"]): string {
  return `${formatAmount(lead.locale, value, currency, { compact: true })} (${value})`;
}

function pairText(lead: ExchangeRequestLead): string {
  const pair = getPairById(lead.pairId);
  return pair ? pairLabel(pair) : lead.pairId;
}

function contactRows(lead: ContactLead): Row[] {
  return [
    { label: "Name", value: lead.name },
    { label: "Email", value: lead.email },
    { label: "WhatsApp", value: lead.whatsapp },
    { label: "Subject", value: lead.subject },
    { label: "Message", value: lead.message, multiline: true },
  ];
}

function exchangeRows(lead: ExchangeRequestLead): Row[] {
  const rows: Row[] = [
    { label: "Pair", value: `${pairText(lead)} (${CURRENCIES[lead.from].name} → ${CURRENCIES[lead.to].name})` },
    { label: "Amount to send", value: amountWithRaw(lead, lead.amount, lead.from) },
    {
      label: "Estimated receive (indicative)",
      value: lead.estimatedReceive === null ? "not provided" : amountWithRaw(lead, lead.estimatedReceive, lead.to),
    },
    { label: "Full name", value: lead.fullName },
    { label: "WhatsApp", value: lead.whatsapp },
    { label: "Email", value: lead.email },
    { label: "Message", value: lead.message ?? "(none)", multiline: true },
    { label: "Consent to indicative rate", value: lead.consent ? "yes" : "no" },
  ];
  return rows;
}

function metaRows(lead: Lead): Row[] {
  return [
    { label: "Reference", value: lead.reference },
    ...(lead.suspicious ? [{ label: "Flag", value: "submitted unusually fast (possible autofill or bot) — verify before acting" }] : []),
    { label: "Received", value: lead.receivedAt },
    { label: "Language", value: lead.locale },
    { label: "IP hash", value: lead.ipHash },
    { label: "User agent", value: lead.userAgent || "(none)" },
  ];
}

function rowsFor(lead: Lead): Row[] {
  return lead.type === "contact" ? contactRows(lead) : exchangeRows(lead);
}

/** Subject line for the e-mail / webhook title. */
export function formatLeadSubject(lead: Lead): string {
  const brand = siteConfig.name;
  if (lead.type === "contact") {
    return `[${brand}] Contact message ${lead.reference}: ${lead.subject}`;
  }
  return `[${brand}] Exchange request ${lead.reference}: ${formatAmount(lead.locale, lead.amount, lead.from, { compact: true })} → ${lead.to}`;
}

/** Plain-text body: the primary format (always readable, no rendering surprises). */
export function formatLeadText(lead: Lead): string {
  const lines: string[] = [
    `New ${LEAD_TYPE_LABEL[lead.type].toLowerCase()} — ${lead.reference}`,
    `Site: ${siteConfig.name}`,
    "",
  ];
  for (const row of rowsFor(lead)) {
    if (row.multiline && row.value.includes("\n")) {
      lines.push(`${row.label}:`);
      lines.push(row.value);
    } else {
      lines.push(`${row.label}: ${row.value}`);
    }
  }
  lines.push("");
  for (const row of metaRows(lead)) lines.push(`${row.label}: ${row.value}`);
  lines.push("");
  lines.push("Rates are indicative. Final terms are confirmed by the exchange team.");
  return lines.join("\n");
}

/** Simple, inline-styled HTML body. All user values are escaped. */
export function formatLeadHtml(lead: Lead): string {
  const renderRow = (row: Row): string => {
    const value = row.multiline
      ? escapeHtml(row.value).replace(/\n/g, "<br>")
      : escapeHtml(row.value);
    return `<tr><td style="padding:6px 12px 6px 0;color:#5F6B7A;vertical-align:top;white-space:nowrap">${escapeHtml(row.label)}</td><td style="padding:6px 0;color:#0B0E12">${value}</td></tr>`;
  };
  const rows = rowsFor(lead).map(renderRow).join("");
  const meta = metaRows(lead).map(renderRow).join("");
  return [
    `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.5;color:#0B0E12">`,
    `<h2 style="margin:0 0 4px;font-size:18px">${escapeHtml(LEAD_TYPE_LABEL[lead.type])} <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace">${escapeHtml(lead.reference)}</span></h2>`,
    `<p style="margin:0 0 16px;color:#5F6B7A">${escapeHtml(siteConfig.name)}</p>`,
    `<table style="border-collapse:collapse">${rows}</table>`,
    `<hr style="border:0;border-top:1px solid #E5E7EB;margin:16px 0">`,
    `<table style="border-collapse:collapse;font-size:12px;color:#5F6B7A">${meta}</table>`,
    `<p style="margin:16px 0 0;font-size:12px;color:#5F6B7A">Rates are indicative. Final terms are confirmed by the exchange team.</p>`,
    `</div>`,
  ].join("");
}

/**
 * One-line, REDACTED summary for logs: no names, masked email and phone,
 * every free-text value omitted. Safe in production logs.
 */
export function formatLeadSummary(lead: Lead): string {
  const common = [
    `type=${lead.type}`,
    `ref=${lead.reference}`,
    `locale=${lead.locale}`,
    `email=${maskEmail(lead.email)}`,
    `whatsapp=${maskPhone(lead.whatsapp)}`,
    `ip=${lead.ipHash}`,
  ];
  if (lead.type === "exchange_request") {
    common.push(`pair=${lead.pairId}`, `amount=${lead.amount}`, `est=${lead.estimatedReceive ?? "-"}`);
  }
  common.push(`ua="${escapeForLog(lead.userAgent, 60)}"`);
  return common.join(" ");
}

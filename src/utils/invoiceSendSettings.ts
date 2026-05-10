const STORAGE_KEY = "invoiceSendSettings";

export interface InvoiceSendSettings {
    email: {
        defaultSubject: string;
        defaultBody: string;
        cc: string;
        bcc: string;
        openMode: "mailto" | "gmail_web";
    };
    whatsapp: {
        defaultCountryCode: string;
        messageTemplate: string;
        openMode: "app_then_web" | "web_only";
    };
    sms: {
        messageTemplate: string;
    };
    general: {
        /** Used in signatures; may include {{company}} */
        senderName: string;
    };
}

export const INVOICE_TEMPLATE_PLACEHOLDERS = `{{invoiceNumber}}  {{customer}}  {{company}}  {{issueDate}}  {{dueDate}}  {{total}}  {{amount}}  {{senderName}}`;

const DEFAULTS: InvoiceSendSettings = {
    email: {
        defaultSubject: "Invoice {{invoiceNumber}} from {{company}}",
        defaultBody: `Dear {{customer}},

Please find the invoice {{invoiceNumber}} attached (PDF). Amount: {{amount}}.

Issue date: {{issueDate}}
Due date: {{dueDate}}

Please pay by the due date to avoid late fees.

Thank you,
{{senderName}}`,
        cc: "",
        bcc: "",
        openMode: "mailto",
    },
    whatsapp: {
        defaultCountryCode: "91",
        messageTemplate: `Dear {{customer}},

Invoice *{{invoiceNumber}}* — {{amount}}
Due: {{dueDate}}

Please arrange payment. Thank you.
— {{senderName}}`,
        openMode: "app_then_web",
    },
    sms: {
        messageTemplate: `Invoice {{invoiceNumber}}: {{amount}} due by {{dueDate}}. - {{company}}`,
    },
    general: {
        senderName: "{{company}}",
    },
};

function cloneDefaults(): InvoiceSendSettings {
    return JSON.parse(JSON.stringify(DEFAULTS)) as InvoiceSendSettings;
}

export function formatInrAmount(n: number): string {
    return `₹${(Number(n) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Replace {{key}} placeholders (keys are alphanumeric + underscore). */
export function fillInvoiceTemplate(template: string, ctx: Record<string, string>): string {
    return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => ctx[key] ?? "");
}

/** Build context from invoice + sender line (sender may reference {{company}} etc.). */
export function buildTemplateContext(
    invoice: {
        invoiceNumber?: string;
        customer?: string;
        company?: string;
        issueDate?: string;
        dueDate?: string;
        total?: number;
    },
    senderNameTemplate: string
): Record<string, string> {
    const base: Record<string, string> = {
        invoiceNumber: invoice.invoiceNumber || "",
        customer: invoice.customer || "",
        company: invoice.company || "",
        issueDate: invoice.issueDate || "",
        dueDate: invoice.dueDate || "",
        total: String(invoice.total ?? 0),
        amount: formatInrAmount(Number(invoice.total) || 0),
        senderName: "",
    };
    let sender = senderNameTemplate;
    for (let i = 0; i < 4; i++) {
        const next = fillInvoiceTemplate(sender, base);
        if (next === sender) break;
        sender = next;
    }
    base.senderName = sender;
    return base;
}

export function loadInvoiceSendSettings(): InvoiceSendSettings {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return cloneDefaults();
        const parsed = JSON.parse(raw) as Partial<InvoiceSendSettings>;
        return {
            email: { ...DEFAULTS.email, ...parsed.email },
            whatsapp: { ...DEFAULTS.whatsapp, ...parsed.whatsapp },
            sms: { ...DEFAULTS.sms, ...parsed.sms },
            general: { ...DEFAULTS.general, ...parsed.general },
        };
    } catch {
        return cloneDefaults();
    }
}

export function saveInvoiceSendSettings(s: InvoiceSendSettings): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

export function getDefaultInvoiceSendSettings(): InvoiceSendSettings {
    return cloneDefaults();
}

/** Normalize phone for wa.me: digits only, with country code, no + */
export function normalizeWhatsAppDigits(phone: string, defaultCountryCode: string): string {
    let d = phone.replace(/\D/g, "");
    const cc = (defaultCountryCode || "91").replace(/\D/g, "");
    if (!d) return "";
    if (d.length === 10 && cc) d = cc + d;
    return d;
}

/** SMS href: prefer digits with country for Android */
export function normalizeSmsPhone(phone: string, defaultCountryCode: string): string {
    const raw = phone.trim();
    if (raw.startsWith("+")) return raw.replace(/\s/g, "");
    const digits = raw.replace(/\D/g, "");
    const cc = (defaultCountryCode || "91").replace(/\D/g, "");
    if (digits.length === 10 && cc) return `+${cc}${digits}`;
    if (digits.length > 10) return `+${digits}`;
    return raw;
}

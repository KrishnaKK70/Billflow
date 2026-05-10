import { generateReceiptPDF } from "./receiptPdfGenerator";
import { toast } from "sonner";

interface Allocation {
    invoiceNumber: string;
    amount: number;
}

interface Payment {
    id: string;
    invoiceNumber?: string;
    customerId?: string;
    customer: string;
    company?: string;
    amount: number;
    date: string;
    mode: string;
    reference?: string;
    unmapped?: boolean;
    onAccount?: boolean;
    allocations?: Allocation[];
}

interface ReceiptLogEntry {
    paymentId: string;
    customer: string;
    email: string;
    status: "sent" | "skipped" | "failed";
    reason?: string;
    timestamp: string;
}

function logReceipt(entry: ReceiptLogEntry) {
    const existing = localStorage.getItem("receiptEmailLog");
    const log: ReceiptLogEntry[] = existing ? JSON.parse(existing) : [];
    log.unshift(entry);
    localStorage.setItem("receiptEmailLog", JSON.stringify(log.slice(0, 200)));
}

function formatAmount(amount: number): string {
    return "Rs. " + amount.toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

/**
 * Generate the receipt PDF (downloads locally) and open the user's default
 * email client with a pre-filled draft addressed to the customer. The user
 * attaches the downloaded PDF before sending.
 */
export function sendReceiptEmail(payment: Payment): void {
    // Lookup customer email
    const savedCustomers = localStorage.getItem("customers");
    const customers: any[] = savedCustomers ? JSON.parse(savedCustomers) : [];
    const cust = customers.find(
        (c) =>
            (payment.customerId && (c.id === payment.customerId || c.customerId === payment.customerId)) ||
            c.name === payment.customer ||
            c.customerName === payment.customer
    );
    const email: string = cust?.email || "";

    // Resolve company from transaction context (payment -> invoice), NOT default.
    const savedCompanies = localStorage.getItem("companies");
    const companies: any[] = savedCompanies ? JSON.parse(savedCompanies) : [];
    const savedInvoices = localStorage.getItem("invoices");
    const invoices: any[] = savedInvoices ? JSON.parse(savedInvoices) : [];

    const allocs = payment.allocations || [];
    const ctxInvoiceNum =
        payment.invoiceNumber || allocs[0]?.invoiceNumber;
    const ctxInvoice = ctxInvoiceNum
        ? invoices.find((i) => i.invoiceNumber === ctxInvoiceNum)
        : undefined;

    let company =
        ((payment as any).companyId &&
            companies.find((c) => c.companyId === (payment as any).companyId)) ||
        (ctxInvoice?.companyId &&
            companies.find((c) => c.companyId === ctxInvoice.companyId)) ||
        (payment.company &&
            companies.find((c) => c.name === payment.company)) ||
        (ctxInvoice?.company &&
            companies.find((c) => c.name === ctxInvoice.company));

    if (!company) {
        company = companies.find((c: any) => c.isDefault) || companies[0];
    }
    const companyName = company?.name || payment.company || "Our Company";

    // Always generate the PDF so user has it locally
    generateReceiptPDF(
        {
            id: payment.id,
            invoiceNumber: payment.invoiceNumber,
            customer: payment.customer,
            company: companyName,
            amount: payment.amount,
            date: payment.date,
            mode: payment.mode,
            reference: payment.reference,
            unmapped: payment.unmapped,
        } as any,
        company
    );

    if (!email) {
        logReceipt({
            paymentId: payment.id,
            customer: payment.customer,
            email: "",
            status: "skipped",
            reason: "Customer email not available",
            timestamp: new Date().toISOString(),
        });
        toast.warning("Customer email not available. Receipt downloaded but not sent.");
        return;
    }

    const subject = `Payment Receipt - ${payment.customer}`;
    const bodyLines = [
        `Dear ${payment.customer},`,
        ``,
        `We have received your payment of ${formatAmount(payment.amount)}.`,
        ``,
        `Payment Details:`,
        `- Date: ${payment.date}`,
        `- Mode: ${payment.mode}`,
        payment.allocations && payment.allocations.length > 1
            ? `- Applied to multiple invoices: ${payment.allocations.map((a) => a.invoiceNumber).join(", ")}`
            : payment.allocations && payment.allocations.length === 1
                ? `- Invoice Reference: ${payment.allocations[0].invoiceNumber}`
                : payment.invoiceNumber
                    ? `- Invoice Reference: ${payment.invoiceNumber}`
                    : `- On Account Payment`,
        payment.reference ? `- Reference: ${payment.reference}` : ``,
        ``,
        `Please find the attached receipt for your reference.`,
        `(The receipt PDF has been downloaded to your device — kindly attach it before sending.)`,
        ``,
        `Thank you for your business.`,
        ``,
        `Regards,`,
        companyName,
    ].filter(Boolean);

    const mailto = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(
        subject
    )}&body=${encodeURIComponent(bodyLines.join("\n"))}`;

    try {
        window.location.href = mailto;
        logReceipt({
            paymentId: payment.id,
            customer: payment.customer,
            email,
            status: "sent",
            timestamp: new Date().toISOString(),
        });
        toast.success("Receipt downloaded and email draft opened. Attach the PDF and send.");
    } catch (err: any) {
        logReceipt({
            paymentId: payment.id,
            customer: payment.customer,
            email,
            status: "failed",
            reason: err?.message || "Unknown error",
            timestamp: new Date().toISOString(),
        });
        toast.error("Payment saved, but email draft could not be opened.");
    }
}

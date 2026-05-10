// Shared utilities for FIFO payment allocation, invoice status recalc,
// and outstanding balance calculations.

export interface Allocation {
    invoiceNumber: string;
    amount: number;
}

export interface PaymentRecord {
    id: string;
    invoiceNumber?: string; // legacy single-invoice link, kept for back-compat
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

const readJSON = <T,>(key: string, fallback: T): T => {
    try {
        const raw = localStorage.getItem(key);
        return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
        return fallback;
    }
};

export function getInvoiceTotal(inv: any): number {
    return Number(inv?.grandTotal ?? inv?.total ?? 0);
}

export function getPaymentsForInvoice(invoiceNumber: string, payments: any[]): number {
    return payments.reduce((sum, p) => {
        const allocs: Allocation[] = p.allocations || [];
        if (allocs.length > 0) {
            return sum + allocs
                .filter((a) => a.invoiceNumber === invoiceNumber)
                .reduce((s, a) => s + Number(a.amount || 0), 0);
        }
        if (p.invoiceNumber === invoiceNumber) {
            return sum + Number(p.amount || 0);
        }
        return sum;
    }, 0);
}

export function computeInvoiceStatus(
    invoiceNumber: string,
    payments: any[],
    invoices: any[]
): "paid" | "partial" | "unpaid" {
    const inv = invoices.find((i) => i.invoiceNumber === invoiceNumber);
    if (!inv) return "unpaid";
    const total = getInvoiceTotal(inv);
    const paid = getPaymentsForInvoice(invoiceNumber, payments);
    if (total > 0 && paid >= total) return "paid";
    if (paid > 0) return "partial";
    return "unpaid";
}

export function recalcInvoicesStatus(
    invoiceNumbers: string[],
    payments: any[],
    invoices: any[]
): any[] {
    const set = new Set(invoiceNumbers.filter(Boolean));
    return invoices.map((inv) =>
        set.has(inv.invoiceNumber)
            ? { ...inv, status: computeInvoiceStatus(inv.invoiceNumber, payments, invoices) }
            : inv
    );
}

/**
 * Get unpaid/partial invoices for a customer, oldest first (FIFO).
 * Excludes the payment id passed via excludePaymentId from the paid totals
 * so that an edit can re-allocate cleanly.
 */
export function getOutstandingInvoices(
    customerId: string,
    customerName: string,
    invoices: any[],
    payments: any[],
    excludePaymentId?: string
): Array<{ invoiceNumber: string; outstanding: number; date: string }> {
    const otherPayments = excludePaymentId
        ? payments.filter((p) => p.id !== excludePaymentId)
        : payments;
    return invoices
        .filter(
            (i) =>
                (customerId && i.customerId === customerId) ||
                (customerName && i.customer === customerName)
        )
        .map((i) => {
            const total = getInvoiceTotal(i);
            const paid = getPaymentsForInvoice(i.invoiceNumber, otherPayments);
            const outstanding = Math.max(total - paid, 0);
            return {
                invoiceNumber: i.invoiceNumber,
                outstanding,
                date: i.invoiceDate || i.date || "",
            };
        })
        .filter((i) => i.outstanding > 0.0001)
        .sort((a, b) => (a.date || "").localeCompare(b.date || ""));
}

export function getCustomerOutstanding(
    customerId: string,
    customerName: string,
    invoices: any[],
    payments: any[]
): number {
    return getOutstandingInvoices(customerId, customerName, invoices, payments)
        .reduce((s, i) => s + i.outstanding, 0);
}

/**
 * FIFO allocate `amount` across `outstandingInvoices`. Returns allocations
 * and any remaining unallocated amount (treated as on-account).
 */
export function allocateFIFO(
    amount: number,
    outstandingInvoices: Array<{ invoiceNumber: string; outstanding: number }>
): { allocations: Allocation[]; remaining: number } {
    let remaining = amount;
    const allocations: Allocation[] = [];
    for (const inv of outstandingInvoices) {
        if (remaining <= 0.0001) break;
        const apply = Math.min(remaining, inv.outstanding);
        if (apply > 0) {
            allocations.push({ invoiceNumber: inv.invoiceNumber, amount: Number(apply.toFixed(2)) });
            remaining -= apply;
        }
    }
    return { allocations, remaining: Number(Math.max(remaining, 0).toFixed(2)) };
}

/**
 * Build allocations for a payment given form input.
 * - If a specific invoice is selected, allocate to it (capped at outstanding;
 *   any excess becomes on-account).
 * - Otherwise FIFO across outstanding invoices.
 */
export function buildAllocations(opts: {
    amount: number;
    selectedInvoice?: string;
    customerId: string;
    customerName: string;
    invoices: any[];
    payments: any[];
    excludePaymentId?: string;
}): { allocations: Allocation[]; remaining: number } {
    const outstanding = getOutstandingInvoices(
        opts.customerId,
        opts.customerName,
        opts.invoices,
        opts.payments,
        opts.excludePaymentId
    );

    if (opts.selectedInvoice) {
        const target = outstanding.find((i) => i.invoiceNumber === opts.selectedInvoice);
        const cap = target?.outstanding ?? opts.amount;
        const applied = Math.min(opts.amount, cap);
        const allocations: Allocation[] = applied > 0
            ? [{ invoiceNumber: opts.selectedInvoice, amount: Number(applied.toFixed(2)) }]
            : [];
        let remaining = Number((opts.amount - applied).toFixed(2));

        // Spill remainder FIFO to other outstanding invoices
        if (remaining > 0.0001) {
            const others = outstanding.filter((i) => i.invoiceNumber !== opts.selectedInvoice);
            const spill = allocateFIFO(remaining, others);
            allocations.push(...spill.allocations);
            remaining = spill.remaining;
        }
        return { allocations, remaining };
    }

    return allocateFIFO(opts.amount, outstanding);
}

export function loadPayments(): PaymentRecord[] {
    return readJSON<PaymentRecord[]>("payments", []);
}
export function loadInvoices(): any[] {
    return readJSON<any[]>("invoices", []);
}

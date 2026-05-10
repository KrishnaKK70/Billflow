import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Download, Pencil, Trash2, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { PaymentFormModal } from "@/components/payments/PaymentFormModal";
import { CustomerLedgerModal } from "@/components/payments/CustomerLedgerModal";
import { generateReceiptPDF } from "@/utils/receiptPdfGenerator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { recalcInvoicesStatus, Allocation } from "@/utils/paymentAllocation";

interface Payment {
    id: string;
    invoiceNumber: string;
    customerId?: string;
    customer: string;
    amount: number;
    date: string;
    mode: string;
    reference?: string;
    allocations?: Allocation[];
    onAccount?: boolean;
}

const fmtAmt = (n: number) =>
    `₹${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function loadPaymentsFromStorage(): Payment[] {
    try {
        const raw = localStorage.getItem("payments");
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

export default function Payments() {
    const [showModal, setShowModal] = useState(false);
    const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
    // Initialize from storage immediately — avoids first-render persist wiping data (Strict Mode / effect order).
    const [payments, setPayments] = useState<Payment[]>(loadPaymentsFromStorage);
    const [search, setSearch] = useState("");
    const [ledgerOpen, setLedgerOpen] = useState(false);
    const [ledgerCustomerId, setLedgerCustomerId] = useState<string>("");

    useEffect(() => {
        localStorage.setItem("payments", JSON.stringify(payments));
    }, [payments]);

    const handleDownloadReceipt = (payment: Payment) => {
        const companies = JSON.parse(localStorage.getItem("companies") || "[]");
        const invoices = JSON.parse(localStorage.getItem("invoices") || "[]");

        // Resolve company from transaction context (payment -> invoice), NOT default.
        const allocs = (payment as any).allocations || [];
        const ctxInvoiceNum =
            payment.invoiceNumber || (allocs[0]?.invoiceNumber as string | undefined);
        const ctxInvoice = ctxInvoiceNum
            ? invoices.find((i: any) => i.invoiceNumber === ctxInvoiceNum)
            : undefined;

        let company =
            ((payment as any).companyId &&
                companies.find((c: any) => c.companyId === (payment as any).companyId)) ||
            (ctxInvoice?.companyId &&
                companies.find((c: any) => c.companyId === ctxInvoice.companyId)) ||
            ((payment as any).company &&
                companies.find((c: any) => c.name === (payment as any).company)) ||
            (ctxInvoice?.company &&
                companies.find((c: any) => c.name === ctxInvoice.company));

        // Only fall back to default if we truly have no transaction context.
        if (!company) {
            company =
                companies.find((c: any) => c.isDefault) || companies[0];
        }

        generateReceiptPDF(payment as any, company);
        toast.success("Receipt downloaded successfully!");
    };

    const handleEdit = (payment: Payment) => {
        setEditingPayment(payment);
        setShowModal(true);
    };

    const handleDelete = (payment: Payment) => {
        if (!window.confirm(`Delete payment of ₹${payment.amount.toLocaleString()} from ${payment.customer}?`)) return;
        const next = payments.filter((p) => p.id !== payment.id);
        setPayments(next);
        localStorage.setItem("payments", JSON.stringify(next));

        // Recalc status for all invoices touched by this payment (allocations + legacy field)
        const affected = new Set<string>();
        (payment.allocations || []).forEach((a) => affected.add(a.invoiceNumber));
        if (payment.invoiceNumber) affected.add(payment.invoiceNumber);
        if (affected.size > 0) {
            const invoices = JSON.parse(localStorage.getItem("invoices") || "[]");
            const updated = recalcInvoicesStatus(Array.from(affected), next, invoices);
            localStorage.setItem("invoices", JSON.stringify(updated));
        }
        toast.success("Payment deleted and invoice balances recalculated");
    };

    const handleViewLedger = (customerId?: string) => {
        setLedgerCustomerId(customerId || "");
        setLedgerOpen(true);
    };

    const handleModalChange = (open: boolean) => {
        setShowModal(open);
        if (!open) setEditingPayment(null);
    };

    const filtered = payments.filter((p) => {
        const q = search.toLowerCase();
        return (
            !q ||
            (p.customer || "").toLowerCase().includes(q) ||
            (p.invoiceNumber || "").toLowerCase().includes(q) ||
            (p.reference || "").toLowerCase().includes(q)
        );
    });

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-foreground">Payment Tracking</h1>
                    <p className="text-muted-foreground">Record and track customer payments</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => handleViewLedger()}>
                        <BookOpen className="mr-2 h-4 w-4" />
                        View Ledger
                    </Button>
                    <Button className="bg-primary hover:bg-primary/90" onClick={() => { setEditingPayment(null); setShowModal(true); }}>
                        <Plus className="mr-2 h-4 w-4" />
                        Record Payment
                    </Button>
                </div>
            </div>

            <Card className="p-4 shadow-md">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        placeholder="Search payments..."
                        className="pl-10"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </Card>

            <Card className="shadow-md">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="border-b border-border bg-muted/30">
                            <tr>
                                <th className="code-column px-6 py-4 text-left text-sm font-semibold text-foreground">Invoice #</th>
                                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Customer</th>
                                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Amount Paid</th>
                                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Payment Date</th>
                                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Payment Mode</th>
                                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {filtered.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-10 text-center text-sm text-muted-foreground">
                                        No payments recorded yet.
                                    </td>
                                </tr>
                            )}
                            {filtered.map((payment) => {
                                const allocs = payment.allocations || [];
                                const isOnAccount = allocs.length === 0 && !payment.invoiceNumber;
                                const isMultiple = allocs.length > 1;
                                const singleInv = allocs.length === 1 ? allocs[0].invoiceNumber : payment.invoiceNumber;
                                return (
                                    <tr key={payment.id} className="hover:bg-muted/20 transition-colors">
                                        <td className="code-column px-6 py-4 text-sm font-medium text-foreground">
                                            {isOnAccount ? (
                                                <span className="text-muted-foreground italic">On Account</span>
                                            ) : isMultiple ? (
                                                <TooltipProvider>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <span className="cursor-help underline decoration-dotted">Multiple</span>
                                                        </TooltipTrigger>
                                                        <TooltipContent className="max-w-xs">
                                                            <div className="space-y-1 text-xs">
                                                                <p className="font-semibold">Allocation breakdown</p>
                                                                {allocs.map((a) => (
                                                                    <div key={a.invoiceNumber} className="flex justify-between gap-4">
                                                                        <span>{a.invoiceNumber}</span>
                                                                        <span>{fmtAmt(a.amount)}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                            ) : (
                                                singleInv || <span className="text-muted-foreground italic">On Account</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-foreground">
                                            {payment.customer || <span className="text-destructive">Missing</span>}
                                        </td>
                                        <td className="px-6 py-4 text-sm font-semibold text-success">{fmtAmt(payment.amount)}</td>
                                        <td className="px-6 py-4 text-sm text-muted-foreground">{payment.date}</td>
                                        <td className="px-6 py-4 text-sm text-muted-foreground">{payment.mode}</td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-wrap gap-2">
                                                <Button variant="outline" size="sm" onClick={() => handleDownloadReceipt(payment)}>
                                                    <Download className="h-4 w-4 mr-1" />
                                                    Receipt
                                                </Button>
                                                <Button variant="outline" size="sm" onClick={() => handleEdit(payment)}>
                                                    <Pencil className="h-4 w-4 mr-1" />
                                                    Edit
                                                </Button>
                                                <Button variant="outline" size="sm" onClick={() => handleDelete(payment)}>
                                                    <Trash2 className="h-4 w-4 mr-1 text-destructive" />
                                                    Delete
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </Card>

            <PaymentFormModal
                open={showModal}
                onOpenChange={handleModalChange}
                editingPayment={editingPayment}
                onPaymentRecorded={(payment) => setPayments((prev) => [payment, ...prev])}
                onPaymentUpdated={(payment) => setPayments((prev) => prev.map((p) => (p.id === payment.id ? payment : p)))}
            />

            <CustomerLedgerModal
                open={ledgerOpen}
                onOpenChange={setLedgerOpen}
                initialCustomerId={ledgerCustomerId}
            />
        </div>
    );
}

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { generateLedgerPDF } from "@/utils/ledgerPdfGenerator";
import { toast } from "sonner";

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    initialCustomerId?: string;
}

const fmt = (n: number) =>
    `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Invoices use business `customerId` (code); payments store internal `customer.id` — match both + name. */
function belongsToCustomer(row: { customerId?: string; customer?: string }, cust: any): boolean {
    if (!cust) return false;
    const cid = (row.customerId || "").trim();
    const cname = (row.customer || "").trim();
    if (cid && (cid === cust.id || cid === cust.customerId)) return true;
    const n = (cust.name || cust.customerName || "").trim();
    if (cname && n && cname.toLowerCase() === n.toLowerCase()) return true;
    return false;
}

export function CustomerLedgerModal({ open, onOpenChange, initialCustomerId }: Props) {
    const [customers, setCustomers] = useState<any[]>([]);
    const [invoices, setInvoices] = useState<any[]>([]);
    const [payments, setPayments] = useState<any[]>([]);
    const [selectedId, setSelectedId] = useState<string>("");

    useEffect(() => {
        if (!open) return;
        setCustomers(JSON.parse(localStorage.getItem("customers") || "[]"));
        setInvoices(JSON.parse(localStorage.getItem("invoices") || "[]"));
        setPayments(JSON.parse(localStorage.getItem("payments") || "[]"));
        setSelectedId(initialCustomerId || "");
    }, [open, initialCustomerId]);

    const customer = customers.find((c) => c.id === selectedId);

    const entries = useMemo(() => {
        if (!customer) return [];
        const custInvoices = invoices
            .filter((i) => belongsToCustomer(i, customer))
            .map((i) => ({
                // Always prefer the actual invoice issue date so rows never show "-"
                date: i.issueDate || i.invoiceDate || i.date || "",
                type: "Invoice",
                reference: i.invoiceNumber || "-",
                // Ledger debit = NEW charges only (i.total). Old balance is NOT re-added.
                debit: Number(i.total ?? i.grandTotal ?? 0),
                credit: 0,
            }));
        const custPayments = payments
            .filter((p) => belongsToCustomer(p, customer))
            .map((p) => {
                const allocs = p.allocations || [];
                const totalAmt = Number(p.amount || 0);
                let ref: string;
                if (allocs.length > 1) ref = `Multiple (${allocs.map((a: any) => a.invoiceNumber).join(", ")})`;
                else if (allocs.length === 1) ref = allocs[0].invoiceNumber;
                else if (p.invoiceNumber) ref = p.invoiceNumber;
                else ref = p.reference ? `On Account (${p.reference})` : "On Account Payment";
                return {
                    date: p.date || "",
                    type: "Payment",
                    reference: ref,
                    debit: 0,
                    // Full payment always credits the customer account (on-account used to compute 0 when invoiceNumber was "")
                    credit: totalAmt,
                    onAccount: 0,
                };
            });
        const all = [...custInvoices, ...custPayments].sort((a, b) =>
            (a.date || "").localeCompare(b.date || "")
        );
        let balance = 0;
        return all.map((e) => {
            balance += e.debit - e.credit;
            return { ...e, balance };
        });
    }, [customer, invoices, payments]);

    const totals = entries.reduce(
        (acc, e: any) => ({
            debit: acc.debit + e.debit,
            credit: acc.credit + e.credit,
            onAccount: acc.onAccount + (e.onAccount || 0),
        }),
        { debit: 0, credit: 0, onAccount: 0 }
    );

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl">
                <DialogHeader>
                    <DialogTitle>Customer Ledger</DialogTitle>
                    <DialogDescription>Invoices (Debit) and Payments (Credit) with running balance.</DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="flex items-end gap-2">
                        <div className="space-y-2 flex-1">
                            <Label>Customer</Label>
                            <Select value={selectedId} onValueChange={setSelectedId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a customer" />
                                </SelectTrigger>
                                <SelectContent className="z-[9999]">
                                    {customers.map((c) => (
                                        <SelectItem key={c.id} value={c.id}>
                                            {(c.customerId || c.id)} - {c.name || c.customerName}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <Button
                            type="button"
                            variant="outline"
                            disabled={!customer || entries.length === 0}
                            onClick={() => {
                                if (!customer) return;
                                const companies = JSON.parse(localStorage.getItem("companies") || "[]");
                                // Prefer the company linked to this customer's most recent invoice.
                                const custInvs = invoices
                                    .filter((i) => belongsToCustomer(i, customer))
                                    .sort((a, b) => (b.issueDate || "").localeCompare(a.issueDate || ""));
                                const ctxCompany =
                                    (custInvs[0]?.companyId && companies.find((c: any) => c.companyId === custInvs[0].companyId)) ||
                                    (custInvs[0]?.company && companies.find((c: any) => c.name === custInvs[0].company)) ||
                                    companies.find((c: any) => c.isDefault) ||
                                    companies[0];
                                generateLedgerPDF({
                                    customerName: customer.name || customer.customerName || "Customer",
                                    customerId: customer.customerId || customer.id,
                                    companyName: ctxCompany?.name,
                                    entries: entries.map((e: any) => ({
                                        date: e.date,
                                        type: e.type,
                                        reference: e.reference,
                                        debit: e.debit,
                                        credit: e.credit,
                                        balance: e.balance,
                                    })),
                                    outstanding: Math.max(totals.debit - totals.credit, 0),
                                });
                                toast.success("Ledger downloaded as PDF");
                            }}
                        >
                            <Download className="h-4 w-4 mr-2" />
                            Download Ledger
                        </Button>
                    </div>

                    {customer ? (
                        <>
                            <div className="rounded-md border p-3 text-sm">
                                <p className="text-xs text-muted-foreground">Final Outstanding</p>
                                <p className={`font-semibold text-lg ${totals.debit - totals.credit > 0 ? "text-destructive" : "text-success"}`}>
                                    {fmt(Math.max(totals.debit - totals.credit, 0))}
                                </p>
                            </div>
                            <div className="border rounded-md overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead className="bg-muted/40">
                                        <tr>
                                            <th className="px-3 py-2 text-left">Date</th>
                                            <th className="px-3 py-2 text-left">Type</th>
                                            <th className="code-column px-3 py-2 text-left">Reference</th>
                                            <th className="px-3 py-2 text-right">Debit</th>
                                            <th className="px-3 py-2 text-right">Credit</th>
                                            <th className="px-3 py-2 text-right">Balance</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {entries.length === 0 && (
                                            <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">No entries yet.</td></tr>
                                        )}
                                        {entries.map((e, idx) => (
                                            <tr key={idx}>
                                                <td className="px-3 py-2">{e.date || "-"}</td>
                                                <td className="px-3 py-2">{e.type}</td>
                                                <td className="code-column px-3 py-2">{e.reference}</td>
                                                <td className="px-3 py-2 text-right">{e.debit ? fmt(e.debit) : "-"}</td>
                                                <td className="px-3 py-2 text-right">{e.credit ? fmt(e.credit) : "-"}</td>
                                                <td className={`px-3 py-2 text-right font-medium ${e.balance > 0 ? "text-destructive" : e.balance < 0 ? "text-success" : ""}`}>
                                                    {fmt(e.balance)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    {entries.length > 0 && (
                                        <tfoot className="bg-muted/30 font-semibold">
                                            <tr>
                                                <td className="px-3 py-2" colSpan={3}>Totals</td>
                                                <td className="px-3 py-2 text-right">{fmt(totals.debit)}</td>
                                                <td className="px-3 py-2 text-right">{fmt(totals.credit)}</td>
                                                <td className="px-3 py-2 text-right">{fmt(totals.debit - totals.credit)}</td>
                                            </tr>
                                        </tfoot>
                                    )}
                                </table>
                            </div>
                        </>
                    ) : (
                        <p className="text-sm text-muted-foreground">Select a customer to view ledger.</p>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

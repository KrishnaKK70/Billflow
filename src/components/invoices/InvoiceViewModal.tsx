import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card } from "@/components/ui/card";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { generateInvoicePDF } from "@/utils/invoicePdfGenerator";
import { toast } from "sonner";

interface Payment {
    id: string;
    invoiceNumber: string;
    customer: string;
    amount: number;
    date: string;
    mode: string;
}

interface LineItem {
    id: string;
    itemCode: string;
    description: string;
    qty: number;
    unitPrice: number;
    discount: number;
    total: number;
}

interface Invoice {
    id: string;
    invoiceNumber: string;
    customer: string;
    customerId?: string;
    company?: string;
    companyId?: string;
    issueDate: string;
    dueDate: string;
    total: number;
    subtotal?: number;
    oldBalance?: number;
    lateFee?: number;
    carryForward?: number;
    totalPayable?: number;
    gstEnabled?: boolean;
    gstPercent?: number;
    gstAmount?: number;
    previousOutstanding?: number;
    finalPayable?: number;
    status: "paid" | "partial" | "unpaid";
    lineItems?: LineItem[];
}

interface InvoiceViewModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    invoice: Invoice | null;
}

export function InvoiceViewModal({ open, onOpenChange, invoice }: InvoiceViewModalProps) {
    const [payments, setPayments] = useState<Payment[]>([]);

    // Load payments for this invoice
    useEffect(() => {
        if (open && invoice) {
            const savedPayments = localStorage.getItem("payments");
            if (savedPayments) {
                const allPayments: Payment[] = JSON.parse(savedPayments);
                const invoicePayments = allPayments.filter(p => p.invoiceNumber === invoice.invoiceNumber);
                setPayments(invoicePayments);
            }
        }
    }, [open, invoice]);

    if (!invoice) return null;

    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
    const carryForward = invoice.carryForward || 0;
    // "Payable Now" = invoice amount - carry-forward
    const payableNow = invoice.totalPayable ?? Math.max(invoice.total - carryForward, 0);
    const balanceDue = invoice.total - totalPaid; // ledger balance for THIS invoice's new charges

    const getStatusColor = (status: string) => {
        switch (status) {
            case "paid":
                return "bg-success/10 text-success hover:bg-success/20";
            case "partial":
                return "bg-warning/10 text-warning hover:bg-warning/20";
            case "unpaid":
                return "bg-destructive/10 text-destructive hover:bg-destructive/20";
            default:
                return "bg-muted text-muted-foreground";
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:pr-8">
                        <DialogTitle>Invoice Details</DialogTitle>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="shrink-0"
                            onClick={() => {
                                generateInvoicePDF(invoice as any);
                                toast.success(`Invoice ${invoice.invoiceNumber} downloaded as PDF`);
                            }}
                        >
                            <Download className="h-4 w-4 mr-2" />
                            Download PDF
                        </Button>
                    </div>
                </DialogHeader>
                <div className="space-y-6">
                    {/* Header */}
                    <div className="flex items-start justify-between">
                        <div>
                            <h3 className="text-2xl font-bold text-foreground">{invoice.invoiceNumber}</h3>
                            <p className="text-sm text-muted-foreground mt-1">Invoice Number</p>
                        </div>
                        <Badge className={getStatusColor(invoice.status)}>
                            {invoice.status.toUpperCase()}
                        </Badge>
                    </div>

                    <Separator />

                    {/* Company & Customer Details */}
                    <div className="grid grid-cols-2 gap-6">
                        <Card className="p-4 bg-muted/20">
                            <h4 className="text-sm font-semibold text-primary mb-2">From (Company)</h4>
                            <p className="text-lg font-medium text-foreground">{invoice.company || "N/A"}</p>
                            {invoice.companyId && (
                                <p className="text-xs text-muted-foreground">ID: {invoice.companyId}</p>
                            )}
                        </Card>
                        <Card className="p-4 bg-muted/20">
                            <h4 className="text-sm font-semibold text-primary mb-2">To (Customer)</h4>
                            <p className="text-lg font-medium text-foreground">{invoice.customer}</p>
                            {invoice.customerId && (
                                <p className="text-xs text-muted-foreground">ID: {invoice.customerId}</p>
                            )}
                        </Card>
                    </div>

                    {/* Dates */}
                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <h4 className="text-sm font-semibold text-foreground mb-2">Issue Date</h4>
                            <p className="text-sm text-muted-foreground">{invoice.issueDate}</p>
                        </div>
                        <div>
                            <h4 className="text-sm font-semibold text-foreground mb-2">Due Date</h4>
                            <p className="text-sm text-muted-foreground">{invoice.dueDate}</p>
                        </div>
                    </div>

                    <Separator />

                    {/* Line Items */}
                    {invoice.lineItems && invoice.lineItems.length > 0 && (
                        <div>
                            <h4 className="text-sm font-semibold text-foreground mb-3">Line Items</h4>
                            <div className="border border-border rounded-lg overflow-hidden">
                                <table className="w-full text-sm table-fixed">
                                    <colgroup>
                                        <col style={{ width: "10%" }} />
                                        <col style={{ width: "30%" }} />
                                        <col style={{ width: "10%" }} />
                                        <col style={{ width: "20%" }} />
                                        <col style={{ width: "10%" }} />
                                        <col style={{ width: "20%" }} />
                                    </colgroup>
                                    <thead className="bg-muted/50">
                                        <tr>
                                            <th className="px-3 py-2 text-left">Item</th>
                                            <th className="px-3 py-2 text-left">Description</th>
                                            <th className="px-3 py-2 text-right">Qty</th>
                                            <th className="px-3 py-2 text-right">Unit Price</th>
                                            <th className="px-3 py-2 text-right">Disc%</th>
                                            <th className="px-3 py-2 text-right">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {invoice.lineItems.map((item) => (
                                            <tr key={item.id}>
                                                <td className="px-3 py-2">{item.itemCode}</td>
                                                <td className="px-3 py-2 truncate">{item.description}</td>
                                                <td className="px-3 py-2 text-right">{item.qty}</td>
                                                <td className="px-3 py-2 text-right whitespace-nowrap">₹{item.unitPrice.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                <td className="px-3 py-2 text-right">{item.discount}%</td>
                                                <td className="px-3 py-2 text-right font-bold whitespace-nowrap">₹{item.total.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    <Separator />

                    {/* Amount Summary */}
                    <Card className="p-4 bg-muted/30">
                        <h4 className="text-sm font-semibold text-foreground mb-3">Amount Summary</h4>
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">New Charges (Subtotal):</span>
                                <span className="font-medium">₹{(invoice.subtotal ?? invoice.total).toLocaleString()}</span>
                            </div>
                            {invoice.gstEnabled && (invoice.gstAmount || 0) > 0 && (
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">GST ({invoice.gstPercent}%):</span>
                                    <span className="font-medium">₹{(invoice.gstAmount || 0).toLocaleString()}</span>
                                </div>
                            )}
                            {invoice.lateFee !== undefined && invoice.lateFee > 0 && (
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Late Fee:</span>
                                    <span className="font-medium text-destructive">₹{invoice.lateFee.toLocaleString()}</span>
                                </div>
                            )}
                            <div className="flex justify-between text-sm border-t border-border pt-2">
                                <span className="text-muted-foreground">Invoice Amount (Ledger):</span>
                                <span className="font-semibold text-right">₹{invoice.total.toLocaleString()}</span>
                            </div>
                            {carryForward > 0 && (
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Less: Carry Forward:</span>
                                    <span className="font-medium text-warning text-right">- ₹{carryForward.toLocaleString()}</span>
                                </div>
                            )}
                            <Separator className="my-2" />
                            <div className="flex justify-between items-center pt-1">
                                <span className="text-base font-semibold">Payable Now:</span>
                                <span className="text-2xl font-bold text-primary text-right">
                                    ₹{payableNow.toLocaleString()}
                                </span>
                            </div>
                        </div>
                    </Card>

                    {/* Outstanding info — separate from invoice amount */}
                    <Card className="p-4 bg-muted/10 border-dashed">
                        <h4 className="text-sm font-semibold text-foreground mb-2">Customer Outstanding (Informational)</h4>
                        <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Previous Balance:</span>
                                <span className="font-medium text-right">₹{(invoice.previousOutstanding || 0).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">+ This Invoice:</span>
                                <span className="font-medium text-right">₹{invoice.total.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">- Payments:</span>
                                <span className="font-medium text-right">- ₹{totalPaid.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between border-t border-border pt-2 font-semibold">
                                <span>Final Outstanding:</span>
                                <span className="text-right text-destructive">
                                    ₹{Math.max((invoice.previousOutstanding || 0) + invoice.total - totalPaid, 0).toLocaleString()}
                                </span>
                            </div>
                            <p className="text-[11px] text-muted-foreground italic">Read-only. Old balance is not added to invoice amount.</p>
                        </div>
                    </Card>

                    {/* Payment History */}
                    <Card className="p-4 bg-success/5 border-success/20">
                        <h4 className="text-sm font-semibold text-foreground mb-3">Payment History</h4>
                        {payments.length > 0 ? (
                            <>
                                <div className="border border-border rounded-lg overflow-hidden mb-4">
                                    <table className="w-full text-sm">
                                        <thead className="bg-muted/50">
                                            <tr>
                                                <th className="px-3 py-2 text-left">Date</th>
                                                <th className="px-3 py-2 text-left">Mode</th>
                                                <th className="px-3 py-2 text-right">Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border">
                                            {payments.map((payment) => (
                                                <tr key={payment.id}>
                                                    <td className="px-3 py-2">{payment.date}</td>
                                                    <td className="px-3 py-2">{payment.mode}</td>
                                                    <td className="px-3 py-2 text-right font-medium text-success">
                                                        ₹{payment.amount.toLocaleString()}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Total Paid:</span>
                                        <span className="font-medium text-success">₹{totalPaid.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between text-sm font-bold">
                                        <span>Balance Due:</span>
                                        <span className={balanceDue > 0 ? "text-destructive" : "text-success"}>
                                            ₹{balanceDue.toLocaleString()}
                                        </span>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <p className="text-sm text-muted-foreground">No payments recorded for this invoice.</p>
                        )}
                    </Card>
                </div>
            </DialogContent>
        </Dialog>
    );
}

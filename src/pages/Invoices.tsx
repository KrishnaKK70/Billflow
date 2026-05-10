import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Plus, Eye, Send, Download, Search, Pencil, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { InvoiceFormModal } from "@/components/invoices/InvoiceFormModal";
import { InvoiceViewModal } from "@/components/invoices/InvoiceViewModal";
import { InvoiceSendModal } from "@/components/invoices/InvoiceSendModal";
import { generateInvoicePDF } from "@/utils/invoicePdfGenerator";
import { useInvoiceSendSettings } from "@/contexts/invoiceSendSettingsContext";

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
    total: number;          // NEW charges only (ledger)
    subtotal?: number;
    oldBalance?: number;    // display only
    lateFee?: number;
    carryForward?: number;
    totalPayable?: number;  // display only: total + oldBalance
    status: "paid" | "partial" | "unpaid";
    lineItems?: LineItem[];
}

export default function Invoices() {
    const { openInvoiceSendSettings } = useInvoiceSendSettings();
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showViewModal, setShowViewModal] = useState(false);
    const [showSendModal, setShowSendModal] = useState(false);
    const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
    const [editInvoice, setEditInvoice] = useState<Invoice | null>(null);
    const [companies, setCompanies] = useState<any[]>([]);
    const [customers, setCustomers] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState("");

    const loadCompaniesAndCustomers = () => {
        const savedCompanies = localStorage.getItem('companies');
        const savedCustomers = localStorage.getItem('customers');

        if (savedCompanies) {
            setCompanies(JSON.parse(savedCompanies));
        }
        if (savedCustomers) {
            setCustomers(JSON.parse(savedCustomers));
        }
    };

    const [invoices, setInvoices] = useState<Invoice[]>(() => {
        const savedInvoices = localStorage.getItem('invoices');
        if (savedInvoices) {
            return JSON.parse(savedInvoices);
        }
        // Default demo invoices
        return [
            {
                id: "1",
                invoiceNumber: "B02-11-2025",
                customer: "Vivek Go Green Construction",
                customerId: "CUST001",
                company: "TechBill Solutions",
                companyId: "COMP001",
                issueDate: "2025-11-01",
                dueDate: "2025-11-10",
                total: 6790,
                subtotal: 5500,
                oldBalance: 1000,
                lateFee: 290,
                carryForward: 0,
                status: "unpaid",
                lineItems: [
                    { id: "1", itemCode: "TS", description: "IT Service", qty: 1, unitPrice: 5000, discount: 0, total: 5000 },
                    { id: "2", itemCode: "MN", description: "Maintenance", qty: 1, unitPrice: 500, discount: 0, total: 500 },
                ],
            },
            {
                id: "2",
                invoiceNumber: "B01-11-2025",
                customer: "TechStart Industries",
                customerId: "CUST002",
                company: "TechBill Solutions",
                companyId: "COMP001",
                issueDate: "2025-11-05",
                dueDate: "2025-11-15",
                total: 12500,
                subtotal: 12500,
                oldBalance: 0,
                lateFee: 0,
                carryForward: 0,
                status: "paid",
                lineItems: [
                    { id: "1", itemCode: "WD", description: "Web Development", qty: 1, unitPrice: 10000, discount: 0, total: 10000 },
                    { id: "2", itemCode: "HS", description: "Hosting", qty: 1, unitPrice: 2500, discount: 0, total: 2500 },
                ],
            },
        ];
    });

    // Save invoices to localStorage whenever they change
    useEffect(() => {
        localStorage.setItem('invoices', JSON.stringify(invoices));
    }, [invoices]);

    // Self-healing migration v3: invoice `total` = NEW charges (subtotal + gst + lateFee).
    // `oldBalance` is no longer stored on invoices (it's tracked in the ledger).
    useEffect(() => {
        const lineItemsTotal = (inv: Invoice) =>
            (inv.lineItems || []).reduce((s, li) => s + (Number(li.total) || 0), 0);

        const expectedTotal = (inv: Invoice) => {
            const sub = inv.subtotal ?? lineItemsTotal(inv);
            const gst = (inv as any).gstEnabled ? Math.round(sub * (((inv as any).gstPercent || 0) / 100) * 100) / 100 : 0;
            return sub + gst + (inv.lateFee || 0);
        };

        const needsFix = invoices.some((inv) => {
            const t = expectedTotal(inv);
            const cf = inv.carryForward || 0;
            return (
                (inv.oldBalance || 0) > 0 ||
                inv.totalPayable === undefined ||
                Math.abs((inv.total || 0) - t) > 0.01 ||
                Math.abs((inv.totalPayable || 0) - Math.max(t - cf, 0)) > 0.01
            );
        });
        if (!needsFix) return;

        const fixed = invoices.map((inv) => {
            const liTotal = lineItemsTotal(inv);
            const sub = liTotal > 0 ? liTotal : inv.subtotal ?? 0;
            const t = expectedTotal({ ...inv, subtotal: sub });
            const cf = Math.min(Math.max(inv.carryForward || 0, 0), t);
            return {
                ...inv,
                subtotal: sub,
                total: t,
                oldBalance: 0,
                carryForward: cf,
                totalPayable: Math.max(t - cf, 0),
            };
        });
        setInvoices(fixed);
    }, [invoices]);

    useEffect(() => {
        loadCompaniesAndCustomers();
    }, []);

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

    const handleView = (invoice: Invoice) => {
        setSelectedInvoice(invoice);
        setShowViewModal(true);
    };

    const handleEdit = (invoice: Invoice) => {
        setEditInvoice(invoice);
        loadCompaniesAndCustomers();
        setShowCreateModal(true);
    };

    const handleSend = (invoice: Invoice) => {
        setSelectedInvoice(invoice);
        setShowSendModal(true);
    };

    const handleDownload = (invoice: Invoice) => {
        generateInvoicePDF(invoice);
        toast.success(`Invoice ${invoice.invoiceNumber} downloaded as PDF`);
    };

    const handleInvoiceCreated = (invoice: Invoice) => {
        if (editInvoice) {
            setInvoices(invoices.map(inv => inv.id === editInvoice.id ? invoice : inv));
            setEditInvoice(null);
        } else {
            setInvoices([invoice, ...invoices]);
        }
    };

    const handleModalClose = (open: boolean) => {
        setShowCreateModal(open);
        if (!open) {
            setEditInvoice(null);
        }
    };

    const filteredInvoices = invoices.filter(invoice =>
        invoice.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        invoice.customer.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (invoice.company && invoice.company.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-foreground">Invoice Management</h1>
                    <p className="text-muted-foreground">Create, manage and send invoices to customers</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button variant="outline" type="button" onClick={() => openInvoiceSendSettings()}>
                        <Settings2 className="mr-2 h-4 w-4" />
                        Send settings
                    </Button>
                    <Button
                        className="bg-primary hover:bg-primary/90"
                        onClick={() => {
                            setEditInvoice(null);
                            loadCompaniesAndCustomers();
                            setShowCreateModal(true);
                        }}
                    >
                        <Plus className="mr-2 h-4 w-4" />
                        Create Invoice
                    </Button>
                </div>
            </div>

            <Card className="p-4 shadow-md">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        placeholder="Search invoices..."
                        className="pl-10"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </Card>

            <Card className="shadow-md">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="border-b border-border bg-muted/30">
                            <tr>
                                <th className="code-column px-6 py-4 text-left text-sm font-semibold text-foreground">Invoice #</th>
                                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Company</th>
                                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Customer</th>
                                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Issue Date</th>
                                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Due Date</th>
                                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Amount</th>
                                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Status</th>
                                <th className="px-6 py-4 text-right text-sm font-semibold text-foreground">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {filteredInvoices.map((invoice) => (
                                <tr key={invoice.id} className="hover:bg-muted/20 transition-colors">
                                    <td className="code-column px-6 py-4 text-sm font-medium text-foreground">{invoice.invoiceNumber}</td>
                                    <td className="px-6 py-4 text-sm text-foreground">{invoice.company || "N/A"}</td>
                                    <td className="px-6 py-4 text-sm text-foreground">{invoice.customer}</td>
                                    <td className="px-6 py-4 text-sm text-muted-foreground">{invoice.issueDate}</td>
                                    <td className="px-6 py-4 text-sm text-muted-foreground">{invoice.dueDate}</td>
                                    <td className="px-6 py-4 text-sm font-semibold text-foreground text-right whitespace-nowrap" title="Invoice amount (new charges only)">₹{invoice.total.toLocaleString()}</td>
                                    <td className="px-6 py-4">
                                        <Badge className={getStatusColor(invoice.status)}>
                                            {invoice.status}
                                        </Badge>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                title="View"
                                                onClick={() => handleView(invoice)}
                                            >
                                                <Eye className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                title="Edit"
                                                onClick={() => handleEdit(invoice)}
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                title="Send"
                                                onClick={() => handleSend(invoice)}
                                            >
                                                <Send className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                title="Download PDF"
                                                onClick={() => handleDownload(invoice)}
                                            >
                                                <Download className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>

            <InvoiceFormModal
                open={showCreateModal}
                onOpenChange={handleModalClose}
                onInvoiceCreated={handleInvoiceCreated}
                companies={companies}
                customers={customers}
                editInvoice={editInvoice}
            />

            <InvoiceViewModal
                open={showViewModal}
                onOpenChange={setShowViewModal}
                invoice={selectedInvoice}
            />

            <InvoiceSendModal
                open={showSendModal}
                onOpenChange={setShowSendModal}
                invoice={selectedInvoice}
            />
        </div>
    );
}

import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, ListChecks } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { getCustomerOutstanding } from "@/utils/paymentAllocation";
// Old-balance calculations removed — invoices now contain ONLY new charges.

type LineSource = "planner" | "usage" | "manual";

interface LineItem {
    id: string;
    itemCode: string;
    description: string;
    qty: number;
    unitPrice: number;
    discount: number;
    total: number;
    source?: LineSource;
    plannerItemId?: string;
    plannerId?: string;
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
    total: number;        // NEW charges only (subtotal + lateFee). Used by ledger.
    subtotal?: number;
    oldBalance?: number;  // Display only. NOT included in `total`.
    lateFee?: number;
    carryForward?: number;
    totalPayable?: number; // Display only: total + oldBalance
    status: "paid" | "partial" | "unpaid";
    amountPaid?: number;
    lineItems?: LineItem[];
    billingMonth?: string; // YYYY-MM
}

interface PlannerLineItem {
    id: string;
    itemName: string;
    description: string;
    qty: number;
    rate: number;
    isBilled?: boolean;
    billedInvoiceId?: string;
    billedMonth?: string;
}

interface Planner {
    id: string;
    code: string;
    name: string;
    customerId: string;
    customer: string;
    cycle: string;
    lineItems: PlannerLineItem[];
    status: "active" | "inactive";
}

interface InvoiceFormModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onInvoiceCreated?: (invoice: Invoice) => void;
    companies?: any[];
    customers?: any[];
    editInvoice?: Invoice | null;
}

const emptyItem = (): LineItem => ({
    id: Date.now().toString() + Math.random(),
    itemCode: "",
    description: "",
    qty: 1,
    unitPrice: 0,
    discount: 0,
    total: 0,
    source: "manual",
});

export function InvoiceFormModal({ open, onOpenChange, onInvoiceCreated, companies = [], customers = [], editInvoice }: InvoiceFormModalProps) {
    const [lineItems, setLineItems] = useState<LineItem[]>([emptyItem()]);
    const [lateFee, setLateFee] = useState(0);
    const [carryForward, setCarryForward] = useState(0);
    const [gstEnabled, setGstEnabled] = useState(false);
    const [gstPercent, setGstPercent] = useState(18);
    const [selectedCompany, setSelectedCompany] = useState("");
    const [selectedCustomer, setSelectedCustomer] = useState("");
    const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
    const [dueDate, setDueDate] = useState(new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    const [pickerOpen, setPickerOpen] = useState(false);
    // Selection set for individual items across all planners
    const [pickerItemIds, setPickerItemIds] = useState<Set<string>>(new Set());

    // Load planners + invoices from localStorage (live each time modal opens)
    const planners: Planner[] = useMemo(() => {
        if (!open) return [];
        try {
            return JSON.parse(localStorage.getItem("planners") || "[]");
        } catch {
            return [];
        }
    }, [open]);

    const allInvoices: Invoice[] = useMemo(() => {
        if (!open) return [];
        try {
            return JSON.parse(localStorage.getItem("invoices") || "[]");
        } catch {
            return [];
        }
    }, [open]);

    const allPayments: any[] = useMemo(() => {
        if (!open) return [];
        try {
            return JSON.parse(localStorage.getItem("payments") || "[]");
        } catch {
            return [];
        }
    }, [open]);

    const billingMonth = useMemo(() => issueDate.slice(0, 7), [issueDate]);

    // Previous outstanding from ledger (excludes the invoice being edited)
    const previousOutstanding = useMemo(() => {
        if (!selectedCustomer) return 0;
        const cust = customers.find((c) => c.customerId === selectedCustomer);
        const invList = editInvoice
            ? allInvoices.filter((i) => i.id !== editInvoice.id)
            : allInvoices;
        return getCustomerOutstanding(selectedCustomer, cust?.name || "", invList, allPayments);
    }, [selectedCustomer, customers, allInvoices, allPayments, editInvoice]);

    useEffect(() => {
        if (editInvoice) {
            setLineItems(editInvoice.lineItems?.length ? editInvoice.lineItems : [emptyItem()]);
            setLateFee(editInvoice.lateFee || 0);
            setCarryForward(editInvoice.carryForward || 0);
            setGstEnabled(!!(editInvoice as any).gstEnabled);
            setGstPercent((editInvoice as any).gstPercent ?? 18);
            setSelectedCompany(editInvoice.companyId || "");
            setSelectedCustomer(editInvoice.customerId || "");
            setIssueDate(editInvoice.issueDate);
            setDueDate(editInvoice.dueDate);
        } else if (open) {
            resetForm();
        }
    }, [editInvoice, open]);

    const resetForm = () => {
        setLineItems([emptyItem()]);
        setLateFee(0);
        setCarryForward(0);
        setGstEnabled(false);
        setGstPercent(18);
        setSelectedCompany("");
        setSelectedCustomer("");
        setIssueDate(new Date().toISOString().split('T')[0]);
        setDueDate(new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    };

    // Customer planners: all active planners assigned to this customer via customerId
    const customerPlanners = useMemo(() => {
        if (!selectedCustomer) return [];
        return planners.filter((p) => p.customerId === selectedCustomer && p.status !== "inactive");
    }, [planners, selectedCustomer]);

    // Build a planner LineItem from a planner item
    const buildPlannerLine = (planner: Planner, pi: PlannerLineItem): LineItem => {
        const total = (pi.qty || 1) * (pi.rate || 0);
        return {
            id: `pl-${pi.id}-${Date.now()}-${Math.random()}`,
            itemCode: pi.itemName?.slice(0, 4).toUpperCase() || "PL",
            description: pi.description || pi.itemName || "Planner item",
            qty: pi.qty || 1,
            unitPrice: pi.rate || 0,
            discount: 0,
            total,
            source: "planner",
            plannerItemId: pi.id,
            plannerId: planner.id,
        };
    };

    // Merge new lines into invoice, skipping duplicates by plannerItemId
    const mergeLines = (newLines: LineItem[]) => {
        setLineItems((prev) => {
            const existingPlannerIds = new Set(
                prev.filter((li) => li.plannerItemId).map((li) => li.plannerItemId!)
            );
            const filtered = newLines.filter((nl) => !nl.plannerItemId || !existingPlannerIds.has(nl.plannerItemId));
            const hasOnlyEmpty =
                prev.length === 1 && !prev[0].description && !prev[0].itemCode && !prev[0].unitPrice;
            const base = hasOnlyEmpty ? [] : prev;
            return [...base, ...filtered];
        });
    };

    // Auto-load on customer selection removed as per user feedback: 
    // "by selecting one product name it is selecting all. this is not logic."
    // Users should now use the "Load Planner" button to selectively add products.
    useEffect(() => {
        if (editInvoice || !selectedCustomer || !open) return;
        setLineItems([emptyItem()]);
    }, [selectedCustomer, open, editInvoice]);

    const calculateLineTotal = (item: LineItem) => {
        const subtotal = item.qty * item.unitPrice;
        return subtotal - (subtotal * item.discount / 100);
    };

    const updateLineItem = (id: string, field: keyof LineItem, value: string | number) => {
        setLineItems(items => items.map(item => {
            if (item.id === id) {
                const updated = { ...item, [field]: value } as LineItem;
                updated.total = calculateLineTotal(updated);
                return updated;
            }
            return item;
        }));
    };

    const addLineItem = () => setLineItems([...lineItems, emptyItem()]);

    const removeLineItem = (id: string) => {
        if (lineItems.length > 1) setLineItems(lineItems.filter(item => item.id !== id));
    };

    const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
    const gstAmount = gstEnabled ? Math.round(subtotal * (gstPercent / 100) * 100) / 100 : 0;
    // NEW charges only — this is what hits the ledger.
    const invoiceAmount = subtotal + gstAmount + lateFee;
    // Carry-forward reduces the amount the customer needs to pay NOW
    // (it does NOT change the ledger debit).
    const carryForwardCapped = Math.min(Math.max(carryForward, 0), invoiceAmount);
    const payableNow = Math.max(invoiceAmount - carryForwardCapped, 0);
    // Final payable shown to customer = new invoice + previous outstanding - carry forward
    const finalPayable = Math.max(payableNow + previousOutstanding, 0);

    const getCompanyName = () => companies.find(c => c.companyId === selectedCompany)?.name || "";
    const getCustomerName = () => customers.find(c => c.customerId === selectedCustomer)?.name || "";

    // Auto-generate invoice number INV-{COMPANY}-NNNN unique per company
    const generateInvoiceNumber = (): string => {
        const company = companies.find((c) => c.companyId === selectedCompany);
        const prefix = (company?.companyId || "C00").toUpperCase();
        let max = 0;
        allInvoices.forEach((inv) => {
            const m = new RegExp(`^INV-${prefix}-(\\d+)$`, "i").exec(inv.invoiceNumber || "");
            if (m) max = Math.max(max, parseInt(m[1], 10));
        });
        return `INV-${prefix}-${String(max + 1).padStart(4, "0")}`;
    };

    // We rely purely on checking the customer's previous invoices (billedPlannerItemIds)
    // to prevent double-billing of a product item in the same month.
    // The global product catalog (Planners) is never mutated with customer billing state.

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // Validation
        if (!selectedCustomer) {
            toast.error("Please select a customer");
            return;
        }
        if (lineItems.length === 0) {
            toast.error("Add at least one line item");
            return;
        }
        const invalid = lineItems.find(li => !li.description.trim() || li.qty <= 0 || li.unitPrice < 0);
        if (invalid) {
            toast.error("Each item needs a description, quantity > 0 and unit price â‰¥ 0");
            return;
        }

        if (!selectedCompany) {
            toast.error("Please select a company");
            return;
        }

        const invoiceId = editInvoice?.id || Date.now().toString();
        const newInvoice: Invoice = {
            id: invoiceId,
            invoiceNumber: editInvoice?.invoiceNumber || generateInvoiceNumber(),
            customer: getCustomerName() || "New Customer",
            customerId: selectedCustomer,
            company: getCompanyName() || "Company",
            companyId: selectedCompany,
            issueDate,
            dueDate,
            // CRITICAL: total = NEW charges only (subtotal + GST + lateFee). Ledger uses this.
            total: invoiceAmount,
            subtotal,
            oldBalance: 0, // legacy field, no longer used
            lateFee,
            carryForward: carryForwardCapped,
            // Display-only amount the customer pays this cycle (after carry-forward).
            totalPayable: payableNow,
            status: editInvoice?.status || "unpaid",
            lineItems,
            billingMonth,
            gstEnabled,
            gstPercent: gstEnabled ? gstPercent : 0,
            gstAmount,
            previousOutstanding,
            finalPayable,
        } as Invoice & { totalPayable: number; gstEnabled: boolean; gstPercent: number; gstAmount: number; previousOutstanding: number; finalPayable: number };



        onInvoiceCreated?.(newInvoice);
        toast.success(editInvoice ? "Invoice updated successfully!" : "Invoice created successfully!");
        onOpenChange(false);
        resetForm();
    };

    const sourceBadge = (src?: LineSource) => {
        if (src === "planner") return <Badge variant="outline" className="bg-primary/10 text-primary text-[10px]">From Planner</Badge>;
        if (src === "usage") return <Badge variant="outline" className="bg-warning/10 text-warning text-[10px]">From Usage</Badge>;
        return <Badge variant="outline" className="text-[10px]">Manual</Badge>;
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{editInvoice ? "Edit Invoice" : "Create New Invoice"}</DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Company</Label>
                            <Select value={selectedCompany} onValueChange={setSelectedCompany}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select company" />
                                </SelectTrigger>
                                <SelectContent>
                                    {companies.length === 0 ? (
                                        <div className="p-2 text-sm text-muted-foreground">No companies found.</div>
                                    ) : (
                                        companies.map((company) => (
                                            <SelectItem key={company.id} value={company.companyId}>
                                                {company.name} ({company.companyId})
                                            </SelectItem>
                                        ))
                                    )}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Customer</Label>
                            <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select customer" />
                                </SelectTrigger>
                                <SelectContent>
                                    {customers.length === 0 ? (
                                        <div className="p-2 text-sm text-muted-foreground">No customers found.</div>
                                    ) : (
                                        customers.map((customer) => (
                                            <SelectItem key={customer.id} value={customer.customerId}>
                                                {customer.name} ({customer.customerId})
                                            </SelectItem>
                                        ))
                                    )}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Invoice #</Label>
                            <Input
                                value={editInvoice?.invoiceNumber || (selectedCompany ? generateInvoiceNumber() : "Auto-generated after company")}
                                readOnly
                                className="bg-muted"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Issue Date</Label>
                            <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
                        </div>

                        <div className="space-y-2">
                            <Label>Due Date</Label>
                            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                        </div>
                    </div>

                    <Card className="p-4">
                        <div className="flex justify-between items-center mb-4 gap-4 flex-wrap">
                            <h3 className="font-semibold">Line Items</h3>
                            <div className="flex items-center gap-3 flex-wrap">
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                        if (!selectedCustomer) {
                                            toast.error("Select a customer first");
                                            return;
                                        }
                                        const active = planners.filter((p) => p.status !== "inactive" && p.customerId === selectedCustomer);
                                        if (active.length === 0) {
                                            toast.error("No active planners assigned to this customer");
                                            return;
                                        }
                                        setPickerItemIds(new Set());
                                        setPickerOpen((v) => !v);
                                    }}
                                >
                                    <ListChecks className="h-4 w-4 mr-2" />
                                    Load Planner
                                </Button>
                                <Button type="button" size="sm" onClick={addLineItem}>
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add Item
                                </Button>
                            </div>
                        </div>
                                        {/* Simplified flat planner item picker */}
                        {pickerOpen && (() => {
                            const activePlanners = customerPlanners;
                            const allItems: { planner: Planner; item: PlannerLineItem }[] = [];
                            activePlanners.forEach((pl) =>
                                (pl.lineItems || []).forEach((pi) => allItems.push({ planner: pl, item: pi }))
                            );
                            const allChecked = allItems.length > 0 && allItems.every((e) => pickerItemIds.has(e.item.id));
                            
                            return (
                                <Card className="p-3 mb-4 bg-muted/30 border-dashed">
                                    <div className="flex items-center justify-between mb-2">
                                        <Label className="text-xs font-semibold">Select Products / Items to Load</Label>
                                        <button type="button" className="text-xs text-primary hover:underline" onClick={() => {
                                            if (allChecked) setPickerItemIds(new Set());
                                            else setPickerItemIds(new Set(allItems.map((e) => e.item.id)));
                                        }}>{allChecked ? "Deselect All" : "Select All"}</button>
                                    </div>
                                    <div className="space-y-1 max-h-72 overflow-y-auto border border-border rounded-md bg-card p-1">
                                        {allItems.length === 0 ? (
                                            <p className="text-sm text-muted-foreground p-4 text-center">No products found in assigned planners.</p>
                                        ) : allItems.map(({ planner: pl, item: pi }) => (
                                            <label key={`${pl.id}-${pi.id}`} className="flex items-center gap-3 p-2 rounded hover:bg-muted/50 cursor-pointer">
                                                <Checkbox checked={pickerItemIds.has(pi.id)} onCheckedChange={(v) => {
                                                    setPickerItemIds((prev) => { 
                                                        const next = new Set(prev); 
                                                        if (v) next.add(pi.id); 
                                                        else next.delete(pi.id); 
                                                        return next; 
                                                    });
                                                }} />
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm font-medium">{pi.itemName}</span>
                                                        <Badge variant="outline" className="text-[10px] h-4 py-0">{pl.name}</Badge>
                                                    </div>
                                                    <p className="text-[10px] text-muted-foreground line-clamp-1">{pi.description || "No description"}</p>
                                                </div>
                                                <div className="text-right shrink-0">
                                                    <div className="text-sm font-semibold">₹{((pi.qty || 1) * (pi.rate || 0)).toLocaleString("en-IN")}</div>
                                                    <div className="text-[10px] text-muted-foreground">Qty {pi.qty || 1}</div>
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                    <div className="flex justify-end gap-2 mt-3">
                                        <Button type="button" size="sm" variant="outline" onClick={() => { setPickerOpen(false); setPickerItemIds(new Set()); }}>Cancel</Button>
                                        <Button type="button" size="sm" onClick={() => {
                                            if (pickerItemIds.size === 0) { toast.error("Please select at least one item"); return; }
                                            const newLines: LineItem[] = [];
                                            activePlanners.forEach((pl) => {
                                                (pl.lineItems || []).forEach((pi) => { 
                                                    if (pickerItemIds.has(pi.id)) newLines.push(buildPlannerLine(pl, pi)); 
                                                });
                                            });
                                            mergeLines(newLines);
                                            setPickerOpen(false); setPickerItemIds(new Set());
                                            toast.success(`Added ${newLines.length} item(s) to invoice`);
                                        }}>Add Selected Items</Button>
                                    </div>
                                </Card>
                            );
                        })()}


                        <div className="space-y-3">
                            {lineItems.map((item, index) => (
                                <div key={item.id} className="space-y-1">
                                    {item.source && item.source !== "manual" && (
                                        <div className="flex items-center gap-2">{sourceBadge(item.source)}</div>
                                    )}
                                    <div className="grid grid-cols-12 gap-2 items-end">
                                        <div className="col-span-1">
                                            {index === 0 && <Label className="text-xs mb-1 block">Code</Label>}
                                            <Input placeholder="TS" value={item.itemCode} onChange={(e) => updateLineItem(item.id, "itemCode", e.target.value)} />
                                        </div>
                                        <div className="col-span-4">
                                            {index === 0 && <Label className="text-xs mb-1 block">Description</Label>}
                                            <Input placeholder="IT Service" value={item.description} onChange={(e) => updateLineItem(item.id, "description", e.target.value)} />
                                        </div>
                                        <div className="col-span-1">
                                            {index === 0 && <Label className="text-xs mb-1 block text-right">Qty</Label>}
                                            <Input type="number" className="text-right" value={item.qty} onChange={(e) => updateLineItem(item.id, "qty", Number(e.target.value))} />
                                        </div>
                                        <div className="col-span-2">
                                            {index === 0 && <Label className="text-xs mb-1 block text-right">Unit Price</Label>}
                                            <Input type="number" className="text-right" value={item.unitPrice} onChange={(e) => updateLineItem(item.id, "unitPrice", Number(e.target.value))} />
                                        </div>
                                        <div className="col-span-1">
                                            {index === 0 && <Label className="text-xs mb-1 block text-right">Disc%</Label>}
                                            <Input type="number" className="text-right" value={item.discount} onChange={(e) => updateLineItem(item.id, "discount", Number(e.target.value))} />
                                        </div>
                                        <div className="col-span-2">
                                            {index === 0 && <Label className="text-xs mb-1 block text-right">Total</Label>}
                                            <Input
                                                value={`₹${item.total.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                                                readOnly
                                                className="bg-muted text-right font-bold whitespace-nowrap"
                                            />
                                        </div>
                                        <div className="col-span-1">
                                            {index === 0 && <div className="h-5 mb-1"></div>}
                                            <Button type="button" variant="ghost" size="icon" onClick={() => removeLineItem(item.id)} disabled={lineItems.length === 1}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Card>

                    <Card className="p-4 bg-muted/30">
                        <div className="space-y-3">
                            <div className="grid grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <Label>Late Fee (Optional)</Label>
                                    <Input type="number" min={0} value={lateFee} onChange={(e) => setLateFee(Number(e.target.value))} placeholder="0" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Carry Forward (Optional)</Label>
                                    <Input
                                        type="number"
                                        min={0}
                                        value={carryForward}
                                        onChange={(e) => setCarryForward(Number(e.target.value))}
                                        placeholder="0"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label>Apply GST</Label>
                                        <Switch checked={gstEnabled} onCheckedChange={setGstEnabled} />
                                    </div>
                                    {gstEnabled && (
                                        <Input
                                            type="number"
                                            min={0}
                                            value={gstPercent}
                                            onChange={(e) => setGstPercent(Number(e.target.value))}
                                            placeholder="GST %"
                                        />
                                    )}
                                </div>
                            </div>

                            <div className="border-t border-border pt-3 space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">New Charges (Subtotal):</span>
                                    <span className="font-medium text-right">₹{subtotal.toLocaleString()}</span>
                                </div>
                                {gstEnabled && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">GST ({gstPercent}%):</span>
                                        <span className="font-medium text-right">₹{gstAmount.toLocaleString()}</span>
                                    </div>
                                )}
                                {lateFee > 0 && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Late Fee:</span>
                                        <span className="font-medium text-destructive text-right">₹{lateFee.toLocaleString()}</span>
                                    </div>
                                )}
                                <div className="flex justify-between text-sm border-t border-border pt-2">
                                    <span className="text-muted-foreground">Invoice Amount (to Ledger):</span>
                                    <span className="font-semibold text-primary text-right">₹{invoiceAmount.toLocaleString()}</span>
                                </div>
                                {carryForwardCapped > 0 && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Less: Carry Forward:</span>
                                        <span className="font-medium text-warning text-right">- ₹{carryForwardCapped.toLocaleString()}</span>
                                    </div>
                                )}
                                <div className="flex justify-between items-center border-t-2 border-primary/40 pt-3 mt-2">
                                    <span className="text-base font-semibold">Payable Now:</span>
                                    <span className="text-3xl font-bold text-primary text-right">₹{payableNow.toLocaleString()}</span>
                                </div>
                            </div>
                        </div>
                    </Card>

                    {/* Outstanding info — shown separately, NOT part of invoice amount */}
                    <Card className="p-4 bg-muted/10 border-dashed">
                        <h4 className="text-sm font-semibold text-foreground mb-2">Customer Outstanding (Informational)</h4>
                        <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Previous Balance:</span>
                                <span className="font-medium text-right">₹{previousOutstanding.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">+ This Invoice:</span>
                                <span className="font-medium text-right">₹{invoiceAmount.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between border-t border-border pt-2 font-semibold">
                                <span>Final Outstanding (after this invoice):</span>
                                <span className="text-right text-destructive">₹{(previousOutstanding + invoiceAmount).toLocaleString()}</span>
                            </div>
                            <p className="text-[11px] text-muted-foreground italic">
                                Read-only. Payments will reduce this balance. Old balance is NOT added to invoice amount.
                            </p>
                        </div>
                    </Card>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                        <Button type="submit">{editInvoice ? "Update Invoice" : "Create Invoice"}</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

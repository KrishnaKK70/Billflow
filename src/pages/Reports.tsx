import { useMemo, useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileSpreadsheet, FileText } from "lucide-react";
import { toast } from "sonner";
import { buildGstReportRows, downloadGstReportCsv, downloadGstReportPdf } from "@/utils/gstReport";

function loadJson<T>(key: string, fallback: T): T {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return fallback;
        return JSON.parse(raw) as T;
    } catch {
        return fallback;
    }
}

export default function Reports() {
    const today = new Date().toISOString().slice(0, 10);
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

    const [dateFrom, setDateFrom] = useState(monthStart);
    const [dateTo, setDateTo] = useState(today);

    const [invoices, setInvoices] = useState<any[]>(() => loadJson("invoices", []));
    const [customers, setCustomers] = useState<any[]>(() => loadJson("customers", []));

    useEffect(() => {
        const refresh = () => {
            setInvoices(loadJson("invoices", []));
            setCustomers(loadJson("customers", []));
        };
        refresh();
        const onVis = () => {
            if (document.visibilityState === "visible") refresh();
        };
        document.addEventListener("visibilitychange", onVis);
        return () => document.removeEventListener("visibilitychange", onVis);
    }, []);

    const rows = useMemo(
        () => buildGstReportRows(invoices, customers, dateFrom, dateTo),
        [invoices, customers, dateFrom, dateTo]
    );

    const periodLabel =
        dateFrom && dateTo ? `${dateFrom} to ${dateTo}` : dateFrom ? `From ${dateFrom}` : dateTo ? `Until ${dateTo}` : "All dates";

    const totals = useMemo(
        () => ({
            taxable: rows.reduce((s, r) => s + r.taxableValue, 0),
            gst: rows.reduce((s, r) => s + r.gstAmount, 0),
            inv: rows.reduce((s, r) => s + r.invoiceTotal, 0),
        }),
        [rows]
    );

    const onCsv = () => {
        if (rows.length === 0) {
            toast.message("No GST invoices in this range", { description: "Enable GST on invoices or widen the date range." });
            return;
        }
        const base = `GST-Report-${dateFrom || "all"}_${dateTo || "all"}`;
        downloadGstReportCsv(rows, base);
        toast.success("GST report downloaded (CSV)");
    };

    const onPdf = () => {
        if (rows.length === 0) {
            toast.message("No GST invoices in this range", { description: "Enable GST on invoices or widen the date range." });
            return;
        }
        downloadGstReportPdf(rows, { periodLabel });
        toast.success("GST report downloaded (PDF)");
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-foreground">Reports</h1>
                <p className="text-muted-foreground">Export GST summaries from invoices (GST-enabled lines only).</p>
            </div>

            <Card className="p-6 shadow-md space-y-6">
                <div>
                    <h2 className="text-lg font-semibold mb-1">GST report</h2>
                    <p className="text-sm text-muted-foreground">
                        Includes invoices with GST applied. Customer GSTIN comes from the customer record (GST Number field).
                    </p>
                </div>

                <div className="flex flex-wrap gap-4 items-end">
                    <div className="space-y-2">
                        <Label htmlFor="gst-from">From date</Label>
                        <Input id="gst-from" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="gst-to">To date</Label>
                        <Input id="gst-to" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="outline" onClick={onCsv}>
                            <FileSpreadsheet className="h-4 w-4 mr-2" />
                            Export CSV
                        </Button>
                        <Button type="button" variant="outline" onClick={onPdf}>
                            <FileText className="h-4 w-4 mr-2" />
                            Export PDF
                        </Button>
                    </div>
                </div>

                <div className="rounded-md border bg-muted/20 px-4 py-3 text-sm flex flex-wrap gap-6">
                    <span>
                        <span className="text-muted-foreground">Rows: </span>
                        <span className="font-medium">{rows.length}</span>
                    </span>
                    <span>
                        <span className="text-muted-foreground">Taxable total: </span>
                        <span className="font-medium">₹{totals.taxable.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                    </span>
                    <span>
                        <span className="text-muted-foreground">GST total: </span>
                        <span className="font-medium">₹{totals.gst.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                    </span>
                    <span>
                        <span className="text-muted-foreground">Invoice totals: </span>
                        <span className="font-medium">₹{totals.inv.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                    </span>
                </div>

                <div className="border rounded-md overflow-x-auto shadow-sm">
                    <table className="w-full text-sm table-fixed">
                        <colgroup>
                            <col className="w-[9%]" />
                            <col className="w-[8%]" />
                            <col className="w-[18%]" />
                            <col className="w-[11%]" />
                            <col className="w-[14%]" />
                            <col className="w-[10%]" />
                            <col className="w-[7%]" />
                            <col className="w-[11%]" />
                            <col className="w-[12%]" />
                        </colgroup>
                        <thead className="bg-muted/50 border-b">
                            <tr>
                                <th className="text-left px-3 py-2 font-semibold align-bottom">Invoice #</th>
                                <th className="text-left px-3 py-2 font-semibold align-bottom">Date</th>
                                <th className="text-left px-3 py-2 font-semibold align-bottom">Customer</th>
                                <th className="text-left px-3 py-2 font-semibold align-bottom">GSTIN</th>
                                <th className="text-left px-3 py-2 font-semibold align-bottom">Company</th>
                                <th className="text-right px-3 py-2 font-semibold align-bottom">Taxable</th>
                                <th className="text-center px-3 py-2 font-semibold align-bottom">GST %</th>
                                <th className="text-right px-3 py-2 font-semibold align-bottom">GST amt</th>
                                <th className="text-right px-3 py-2 font-semibold align-bottom">Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {rows.length === 0 && (
                                <tr>
                                    <td colSpan={9} className="px-3 py-10 text-center text-muted-foreground">
                                        No GST invoices in this period. Create or edit an invoice with “Apply GST” on, or adjust dates.
                                    </td>
                                </tr>
                            )}
                            {rows.map((r) => (
                                <tr key={r.id} className="hover:bg-muted/30 border-b border-border/60 last:border-0">
                                    <td className="px-3 py-2 font-mono text-xs align-top">{r.invoiceNumber}</td>
                                    <td className="px-3 py-2 whitespace-nowrap align-top">{r.issueDate}</td>
                                    <td className="px-3 py-2 truncate align-top" title={r.customer}>
                                        {r.customer}
                                    </td>
                                    <td className="px-3 py-2 font-mono text-[11px] align-top">{r.customerGstin}</td>
                                    <td className="px-3 py-2 truncate align-top" title={r.company}>
                                        {r.company}
                                    </td>
                                    <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums align-top">
                                        ₹{r.taxableValue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="px-3 py-2 text-center tabular-nums align-top">{r.gstPercent}%</td>
                                    <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums align-top">
                                        ₹{r.gstAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="px-3 py-2 text-right font-medium whitespace-nowrap tabular-nums align-top">
                                        ₹{r.invoiceTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
}

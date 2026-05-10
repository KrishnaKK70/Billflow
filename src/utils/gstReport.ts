import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export interface GstReportRow {
    id: string;
    invoiceNumber: string;
    issueDate: string;
    customer: string;
    customerGstin: string;
    company: string;
    taxableValue: number;
    gstPercent: number;
    gstAmount: number;
    invoiceTotal: number;
}

function lineItemsSubtotal(inv: any): number {
    const items = inv.lineItems || [];
    if (items.length === 0) return 0;
    return items.reduce((s: number, li: any) => s + (Number(li.total) || 0), 0);
}

/** Resolve customer GSTIN from invoice linkage. */
export function resolveCustomerGstin(customers: any[], inv: any): string {
    const cid = (inv.customerId || "").trim();
    const cname = (inv.customer || "").trim().toLowerCase();
    const c =
        customers.find((x) => (x.customerId || "").trim() === cid) ||
        customers.find((x) => (x.id || "").trim() === cid) ||
        customers.find((x) => (x.name || "").trim().toLowerCase() === cname);
    const g = (c?.gst || "").trim();
    return g || "—";
}

function taxableValueForInvoice(inv: any): number {
    if (inv.subtotal != null && !Number.isNaN(Number(inv.subtotal))) return Number(inv.subtotal);
    const li = lineItemsSubtotal(inv);
    if (li > 0) return li;
    const gst = Number(inv.gstAmount || 0);
    const late = Number(inv.lateFee || 0);
    return Math.max(Number(inv.total || 0) - gst - late, 0);
}

export function buildGstReportRows(
    invoices: any[],
    customers: any[],
    dateFrom: string,
    dateTo: string
): GstReportRow[] {
    const from = (dateFrom || "").trim();
    const to = (dateTo || "").trim();

    return invoices
        .filter((inv) => inv.gstEnabled && (Number(inv.gstAmount) > 0 || Number(inv.gstPercent) > 0))
        .filter((inv) => {
            const d = (inv.issueDate || inv.invoiceDate || inv.date || "").trim();
            if (!from && !to) return true;
            if (from && d < from) return false;
            if (to && d > to) return false;
            return true;
        })
        .map((inv) => ({
            id: String(inv.id || `${inv.invoiceNumber}-${inv.issueDate || ""}`),
            invoiceNumber: inv.invoiceNumber || "—",
            issueDate: (inv.issueDate || inv.invoiceDate || inv.date || "").trim() || "—",
            customer: inv.customer || "—",
            customerGstin: resolveCustomerGstin(customers, inv),
            company: inv.company || "—",
            taxableValue: taxableValueForInvoice(inv),
            gstPercent: Number(inv.gstPercent || 0),
            gstAmount: Number(inv.gstAmount || 0),
            invoiceTotal: Number(inv.total || 0),
        }))
        .sort((a, b) => (a.issueDate || "").localeCompare(b.issueDate || ""));
}

/** CSV field: always quoted for consistent column boundaries in Excel. */
function csvField(v: string): string {
    return `"${String(v).replace(/"/g, '""')}"`;
}

/** GSTIN as Excel text (avoids scientific notation / truncation). */
function csvGstinCell(raw: string): string {
    const g = (raw || "").trim();
    if (!g || g === "—") return csvField("");
    return `"=""${g.replace(/"/g, '""')}"""`;
}

/** Plain numeric cell — unquoted so Excel right-aligns as number. */
function csvNum(n: number, decimals: number): string {
    return (Number(n) || 0).toFixed(decimals);
}

export function downloadGstReportCsv(rows: GstReportRow[], fileBase: string): void {
    const headers = [
        "Invoice #",
        "Date",
        "Customer",
        "GSTIN",
        "Company",
        "Taxable Value",
        "GST %",
        "GST Amount",
        "Invoice Total",
    ];
    // UTF-8 BOM + sep= for Excel; CRLF for Windows spreadsheet apps
    const lines: string[] = ["sep=,", headers.map(csvField).join(",")];
    for (const r of rows) {
        lines.push(
            [
                csvField(r.invoiceNumber),
                csvField(r.issueDate),
                csvField(r.customer),
                csvGstinCell(r.customerGstin),
                csvField(r.company),
                csvNum(r.taxableValue, 2),
                csvNum(r.gstPercent, 2),
                csvNum(r.gstAmount, 2),
                csvNum(r.invoiceTotal, 2),
            ].join(",")
        );
    }
    const blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileBase}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

const fmtInr = (n: number) =>
    (Number(n) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function downloadGstReportPdf(rows: GstReportRow[], opts: { periodLabel: string }): void {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginOuter = 10;
    const marginX = 14;
    const rightX = pageWidth - marginX;
    const innerW = pageWidth - 2 * marginX;

    const drawPageFrame = () => {
        doc.setDrawColor(80);
        doc.setLineWidth(0.5);
        doc.rect(marginOuter, marginOuter, pageWidth - 2 * marginOuter, pageHeight - 2 * marginOuter);
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.2);
    };

    // Column widths (mm), sum = innerW — keeps table flush with content margins
    const wInv = 20;
    const wDate = 18;
    const wCust = 40;
    const wGstin = 28;
    const wTax = 22;
    const wPct = 11;
    const wGstAmt = 22;
    const wTot = 21;
    // 20+18+40+28+22+11+22+21 = 182
    const _sum = wInv + wDate + wCust + wGstin + wTax + wPct + wGstAmt + wTot;
    const wCustAdj = wCust + (innerW - _sum);

    drawPageFrame();

    let titleY = 17;
    doc.setFontSize(17);
    doc.setFont("helvetica", "bold");
    doc.text("GST Report", pageWidth / 2, titleY, { align: "center" });
    titleY += 7;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Period: ${opts.periodLabel}`, marginX, titleY);
    doc.text(`Generated: ${new Date().toLocaleString("en-IN")}`, rightX, titleY, { align: "right" });
    titleY += 4;
    doc.setDrawColor(200);
    doc.line(marginX, titleY, rightX, titleY);
    titleY += 5;

    const sumTaxable = rows.reduce((s, r) => s + r.taxableValue, 0);
    const sumGst = rows.reduce((s, r) => s + r.gstAmount, 0);
    const sumTotal = rows.reduce((s, r) => s + r.invoiceTotal, 0);

    autoTable(doc, {
        startY: titleY,
        head: [["Invoice #", "Date", "Customer", "GSTIN", "Taxable value", "GST %", "GST amount", "Total"]],
        body: rows.map((r) => [
            r.invoiceNumber,
            r.issueDate,
            r.customer,
            r.customerGstin === "—" ? "" : r.customerGstin,
            fmtInr(r.taxableValue),
            `${r.gstPercent}%`,
            fmtInr(r.gstAmount),
            fmtInr(r.invoiceTotal),
        ]),
        foot: [
            [
                {
                    content: "Totals",
                    colSpan: 4,
                    styles: { halign: "left", fontStyle: "bold", fillColor: [235, 235, 240] },
                },
                {
                    content: fmtInr(sumTaxable),
                    styles: { halign: "right", fontStyle: "bold", fillColor: [235, 235, 240] },
                },
                {
                    content: "—",
                    styles: { halign: "center", fontStyle: "bold", fillColor: [235, 235, 240] },
                },
                {
                    content: fmtInr(sumGst),
                    styles: { halign: "right", fontStyle: "bold", fillColor: [235, 235, 240] },
                },
                {
                    content: fmtInr(sumTotal),
                    styles: { halign: "right", fontStyle: "bold", fillColor: [235, 235, 240] },
                },
            ],
        ],
        showHead: "everyPage",
        tableWidth: innerW,
        theme: "grid",
        headStyles: {
            fillColor: [45, 55, 72],
            textColor: 255,
            fontStyle: "bold",
            valign: "middle",
            lineWidth: 0.1,
            lineColor: [180, 180, 180],
        },
        footStyles: {
            fillColor: [235, 235, 240],
            textColor: 0,
            fontStyle: "bold",
            lineWidth: 0.1,
            lineColor: [160, 160, 160],
        },
        styles: {
            fontSize: 8,
            cellPadding: { top: 2.5, bottom: 2.5, left: 2, right: 2 },
            valign: "middle",
            lineWidth: 0.1,
            lineColor: [200, 200, 200],
            overflow: "linebreak",
        },
        alternateRowStyles: { fillColor: [252, 252, 254] },
        columnStyles: {
            0: { cellWidth: wInv, halign: "left" },
            1: { cellWidth: wDate, halign: "left" },
            2: { cellWidth: wCustAdj, halign: "left" },
            3: { cellWidth: wGstin, halign: "left", font: "courier", fontStyle: "normal" },
            4: { cellWidth: wTax, halign: "right" },
            5: { cellWidth: wPct, halign: "center" },
            6: { cellWidth: wGstAmt, halign: "right" },
            7: { cellWidth: wTot, halign: "right" },
        },
        margin: { left: marginX, right: marginX, bottom: 20 },
        willDrawPage: (data: { pageNumber: number }) => {
            if (data.pageNumber > 1) drawPageFrame();
        },
    });

    let y = (doc as any).lastAutoTable.finalY + 6;
    const footNote =
        "Total = invoice new charges (subtotal + GST + late fee), aligned with ledger. Amounts in INR (Indian numbering).";
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(90);
    const split = doc.splitTextToSize(footNote, innerW);
    doc.text(split, marginX, y);
    doc.setTextColor(0, 0, 0);

    const safe = opts.periodLabel.replace(/[^a-z0-9]+/gi, "_");
    doc.save(`GST-Report-${safe || "export"}.pdf`);
}

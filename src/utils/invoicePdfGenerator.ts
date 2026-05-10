import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

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

// Indian numbering; removed "Rs." as requested.
function formatCurrency(amount: number): string {
    return (Number(amount) || 0).toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

export function generateInvoicePDF(invoice: Invoice): void {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginX = 14;
    const rightX = pageWidth - marginX;

    // ===== Outer invoice border =====
    doc.setDrawColor(80);
    doc.setLineWidth(0.5);
    doc.rect(marginX - 4, 12, pageWidth - 2 * (marginX - 4), pageHeight - 24);
    doc.setLineWidth(0.2);

    // ===== Header row: Invoice # (left) | INVOICE (center) | Status (right) =====
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Invoice #: ${invoice.invoiceNumber || "N/A"}`, marginX, 20);

    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("INVOICE", pageWidth / 2, 22, { align: "center" });

    const statusText = `Status: ${(invoice.status || "unpaid").toUpperCase()}`;
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    if (invoice.status === "unpaid") doc.setTextColor(200, 30, 30);
    else if (invoice.status === "partial") doc.setTextColor(200, 130, 0);
    else doc.setTextColor(30, 140, 60);
    doc.text(statusText, rightX, 20, { align: "right" });
    doc.setTextColor(0, 0, 0);

    // Separator
    doc.setDrawColor(200);
    doc.line(marginX, 28, rightX, 28);

    // ===== Billing details: From/To + Dates =====
    const leftColX = marginX;
    const rightColX = pageWidth / 2 + 5;
    let y = 38;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("From:", leftColX, y);
    doc.text("To:", rightColX, y);

    doc.setFont("helvetica", "normal");
    doc.text(invoice.company || "N/A", leftColX, y + 6);
    doc.text(invoice.customer || "N/A", rightColX, y + 6);

    y += 18;
    doc.setFont("helvetica", "bold");
    doc.text("Issue Date:", leftColX, y);
    doc.text("Due Date:", rightColX, y);
    doc.setFont("helvetica", "normal");
    doc.text(invoice.issueDate || "N/A", leftColX + 25, y);
    doc.text(invoice.dueDate || "N/A", rightColX + 22, y);

    y += 8;
    doc.setDrawColor(220);
    doc.line(marginX, y, rightX, y);
    y += 6;

    // ===== Line items table =====
    const tableData = (invoice.lineItems || []).map((item) => [
        item.itemCode || "-",
        item.description || "-",
        String(item.qty ?? 0),
        formatCurrency(item.unitPrice || 0),
        `${item.discount || 0}%`,
        formatCurrency(item.total || 0),
    ]);

    // Use autoTable via the plugin's exported function
    autoTable(doc, {
        startY: y,
        head: [["Item Code", "Description", "Qty", "Unit Price", "Disc %", "Total"]],
        body: tableData,
        theme: "grid",
        headStyles: {
            fillColor: [45, 55, 72],
            textColor: 255,
            fontStyle: "bold",
            halign: "center",
            lineWidth: 0.1,
            lineColor: [180, 180, 180],
        },
        styles: { fontSize: 9, cellPadding: 2.5, lineWidth: 0.1, lineColor: [200, 200, 200], overflow: "linebreak" },
        columnStyles: {
            0: { cellWidth: 18.2, halign: "left" },
            1: { cellWidth: 54.6, halign: "left" },
            2: { cellWidth: 18.2, halign: "right" },
            3: { cellWidth: 36.4, halign: "right" },
            4: { cellWidth: 18.2, halign: "right" },
            5: { cellWidth: 36.4, halign: "right", fontStyle: "bold" },
        },
        margin: { left: marginX, right: marginX },
    });

    y = (doc as any).lastAutoTable.finalY + 10;

    // ===== Totals (right aligned block) =====
    const labelX = pageWidth - 80;
    const valueX = rightX;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);

    const printRow = (label: string, value: string, bold = false) => {
        doc.setFont("helvetica", bold ? "bold" : "normal");
        doc.text(label, labelX, y);
        doc.text(value, valueX, y, { align: "right" });
        y += 7;
    };

    printRow("New Charges (Subtotal):", formatCurrency(invoice.subtotal ?? invoice.total));

    if (invoice.gstEnabled && (invoice.gstAmount || 0) > 0) {
        printRow(`GST (${invoice.gstPercent || 0}%):`, formatCurrency(invoice.gstAmount || 0));
    }

    if (invoice.lateFee && invoice.lateFee > 0) {
        printRow("Late Fee:", formatCurrency(invoice.lateFee));
    }

    // Invoice amount = what hits the ledger (NEW charges only)
    doc.setDrawColor(220);
    doc.line(labelX, y - 3, valueX, y - 3);
    y += 1;
    printRow("Invoice Amount:", formatCurrency(invoice.total), true);

    const carryForward = invoice.carryForward || 0;
    if (carryForward > 0) {
        printRow("Less: Carry Forward:", "- " + formatCurrency(carryForward));
    }

    // separator above grand total
    doc.setDrawColor(150);
    doc.line(labelX, y - 3, valueX, y - 3);
    y += 2;

    doc.setFontSize(14);
    doc.setTextColor(26, 115, 232);
    const payable = invoice.totalPayable ?? Math.max(invoice.total - carryForward, 0);
    printRow("Payable Now:", formatCurrency(payable), true);
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);

    // ===== Outstanding (separate from invoice amount) — Moved to bottom of page =====
    const prev = invoice.previousOutstanding || 0;
    const finalOutstanding = Math.max(prev + invoice.total, 0);
    
    // Position it near the bottom border
    y = pageHeight - 55; 
    
    doc.setDrawColor(180);
    doc.setLineDashPattern([2, 2], 0);
    doc.line(marginX, y, rightX, y);
    doc.setLineDashPattern([], 0);
    y += 6;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Customer Outstanding (Informational)", marginX, y);
    y += 6;
    
    // Reset printRow coordinates for bottom block
    const outstandingPrintRow = (label: string, value: string, bold = false) => {
        doc.setFont("helvetica", bold ? "bold" : "normal");
        doc.text(label, labelX, y);
        doc.text(value, valueX, y, { align: "right" });
        y += 7;
    };

    outstandingPrintRow("Previous Balance:", formatCurrency(prev));
    outstandingPrintRow("+ This Invoice:", formatCurrency(invoice.total));
    doc.setDrawColor(180);
    doc.line(labelX, y - 3, valueX, y - 3);
    y += 1;
    doc.setTextColor(200, 30, 30);
    outstandingPrintRow("Final Outstanding:", formatCurrency(finalOutstanding), true);
    doc.setTextColor(0, 0, 0);

    // ===== Footer =====
    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(120);
    doc.text("Thank you for your business!", pageWidth / 2, pageHeight - 15, { align: "center" });
    doc.setTextColor(0);

    // Save as .pdf in the browser download folder (no extra tab — avoids non-download preview quirks)
    try {
        const fileName = `Invoice-${(invoice.invoiceNumber || "Manual").replace(/[/\\?%*:|"<>]/g, "-")}.pdf`;
        doc.save(fileName);
    } catch (e) {
        console.error("PDF generation/download failed", e);
        alert("Download failed. Please check console for details.");
    }
}

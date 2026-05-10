import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface LedgerEntry {
    date: string;
    type: string;
    reference: string;
    debit: number;
    credit: number;
    balance: number;
}

const fmt = (n: number) =>
    "Rs. " + (n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function generateLedgerPDF(opts: {
    customerName: string;
    customerId?: string;
    companyName?: string;
    entries: LedgerEntry[];
    outstanding: number;
}): void {
    const { customerName, customerId, companyName, entries, outstanding } = opts;
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginX = 14;
    const rightX = pageWidth - marginX;

    // Title
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("Customer Ledger", pageWidth / 2, 18, { align: "center" });

    // Meta
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    let y = 28;
    doc.text(`Customer: ${customerName}${customerId ? ` (${customerId})` : ""}`, marginX, y);
    if (companyName) doc.text(`Company: ${companyName}`, rightX, y, { align: "right" });
    y += 6;
    doc.text(`Generated: ${new Date().toLocaleString("en-IN")}`, marginX, y);
    y += 4;

    doc.setDrawColor(200);
    doc.line(marginX, y, rightX, y);
    y += 4;

    // Table
    const totalDebit = entries.reduce((s, e) => s + (e.debit || 0), 0);
    const totalCredit = entries.reduce((s, e) => s + (e.credit || 0), 0);

    autoTable(doc, {
        startY: y,
        head: [["Date", "Type", "Reference", "Debit", "Credit", "Balance"]],
        body: entries.map((e) => [
            e.date || "-",
            e.type,
            e.reference || "-",
            e.debit ? fmt(e.debit) : "-",
            e.credit ? fmt(e.credit) : "-",
            fmt(e.balance),
        ]),
        foot: [[
            "Totals", "", "",
            fmt(totalDebit),
            fmt(totalCredit),
            fmt(totalDebit - totalCredit),
        ]],
        theme: "striped",
        headStyles: { fillColor: [45, 55, 72], textColor: 255, fontStyle: "bold" },
        footStyles: { fillColor: [230, 230, 230], textColor: 0, fontStyle: "bold" },
        styles: { fontSize: 9, cellPadding: 3 },
        columnStyles: {
            0: { cellWidth: 28, halign: "left" },
            1: { cellWidth: 22, halign: "left" },
            2: { cellWidth: 50, halign: "left" },
            3: { cellWidth: 28, halign: "right" },
            4: { cellWidth: 28, halign: "right" },
            5: { cellWidth: 30, halign: "right" },
        },
        margin: { left: marginX, right: marginX },
    });

    let endY = (doc as any).lastAutoTable.finalY + 10;

    // Final outstanding box
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Final Outstanding:", pageWidth - 80, endY);
    doc.text(fmt(Math.max(outstanding, 0)), rightX, endY, { align: "right" });

    // Footer
    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(120);
    doc.text("This is a system generated ledger statement.", pageWidth / 2, pageHeight - 12, { align: "center" });

    const safeName = customerName.replace(/[^a-z0-9]+/gi, "_");
    doc.save(`Ledger-${safeName}-${new Date().toISOString().slice(0, 10)}.pdf`);
}

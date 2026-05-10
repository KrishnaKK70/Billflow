import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface Allocation {
    invoiceNumber: string;
    amount: number;
}

interface Payment {
    id: string;
    invoiceNumber?: string;
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

interface Company {
    name: string;
    address?: string;
    phone?: string;
    email?: string;
    gst?: string;
}

// Format currency with Indian numbering system (no gaps)
function formatCurrency(amount: number): string {
    return "Rs." + amount.toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

export function generateReceiptPDF(payment: Payment, company?: Company) {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header
    doc.setFillColor(34, 197, 94); // Green color
    doc.rect(0, 0, pageWidth, 40, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont("helvetica", "bold");
    doc.text("PAYMENT RECEIPT", pageWidth / 2, 25, { align: "center" });

    // Receipt number
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const receiptNumber = `RCP-${payment.id.slice(-6)}`;
    doc.text(`Receipt No: ${receiptNumber}`, pageWidth - 20, 35, { align: "right" });

    // Reset text color
    doc.setTextColor(0, 0, 0);

    // From (Company) Info
    let yPos = 55;
    const companyName = company?.name || payment.company || "N/A";

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("From:", 20, yPos);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(13);
    doc.text(companyName, 20, yPos + 7);

    doc.setFontSize(9);
    let companyY = yPos + 14;
    if (company?.address) { doc.text(company.address, 20, companyY); companyY += 5; }
    if (company?.phone) { doc.text(`Phone: ${company.phone}`, 20, companyY); companyY += 5; }
    if (company?.email) { doc.text(`Email: ${company.email}`, 20, companyY); companyY += 5; }
    if (company?.gst) { doc.text(`GST: ${company.gst}`, 20, companyY); companyY += 5; }

    // Received From Section
    yPos = Math.max(companyY + 10, 95);
    doc.setFillColor(240, 240, 240);
    doc.rect(15, yPos - 5, pageWidth - 30, 32, "F");

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Received From:", 20, yPos + 4);

    doc.setFontSize(14);
    doc.text(payment.customer || "N/A", 20, yPos + 14);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const allocs = payment.allocations || [];
    let invoiceRefLabel: string;
    if (allocs.length > 1) {
        invoiceRefLabel = "Applied to multiple invoices";
    } else if (allocs.length === 1) {
        invoiceRefLabel = `Invoice Reference: ${allocs[0].invoiceNumber}`;
    } else if (payment.invoiceNumber) {
        invoiceRefLabel = `Invoice Reference: ${payment.invoiceNumber}`;
    } else {
        invoiceRefLabel = "On Account Payment";
    }
    doc.text(invoiceRefLabel, 20, yPos + 23);

    // Payment Details Table
    yPos += 42;

    const invoiceCellValue =
        allocs.length > 1
            ? `Multiple (${allocs.length})`
            : allocs.length === 1
                ? allocs[0].invoiceNumber
                : payment.invoiceNumber || "On Account";

    autoTable(doc, {
        startY: yPos,
        head: [["Description", "Details"]],
        body: [
            ["Payment Date", payment.date],
            ["Payment Mode", payment.mode],
            ["Invoice Number", invoiceCellValue],
            ["Reference", payment.reference || "-"],
            ["Amount Received", formatCurrency(payment.amount)],
        ],
        theme: "striped",
        headStyles: {
            fillColor: [34, 197, 94],
            textColor: [255, 255, 255],
            fontStyle: "bold",
        },
        styles: {
            fontSize: 11,
            cellPadding: 8,
        },
        columnStyles: {
            0: { fontStyle: "bold", cellWidth: 60 },
            1: { cellWidth: 100 },
        },
        margin: { left: 20, right: 20 },
    });

    // Allocation breakdown table when multiple invoices
    if (allocs.length > 1) {
        autoTable(doc, {
            startY: (doc as any).lastAutoTable.finalY + 6,
            head: [["Invoice #", "Amount Applied"]],
            body: allocs.map((a) => [a.invoiceNumber, formatCurrency(a.amount)]),
            theme: "grid",
            headStyles: { fillColor: [34, 197, 94], textColor: [255, 255, 255], fontStyle: "bold" },
            styles: { fontSize: 10, cellPadding: 6 },
            margin: { left: 20, right: 20 },
        });
    }

    // Amount in Words
    yPos = (doc as any).lastAutoTable.finalY + 15;
    doc.setFillColor(34, 197, 94);
    doc.rect(15, yPos - 5, pageWidth - 30, 25, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Amount Received:", 20, yPos + 5);

    doc.setFontSize(18);
    doc.text(formatCurrency(payment.amount), 20, yPos + 15);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`(${numberToWords(payment.amount)} Rupees Only)`, pageWidth - 20, yPos + 10, { align: "right" });

    // Reset text color
    doc.setTextColor(0, 0, 0);

    // Footer
    yPos += 45;
    doc.setFontSize(10);
    doc.text("This is a computer-generated receipt and does not require a signature.", pageWidth / 2, yPos, { align: "center" });

    // Signature line
    yPos += 25;
    doc.line(pageWidth - 80, yPos, pageWidth - 20, yPos);
    doc.setFontSize(9);
    doc.text("Authorized Signature", pageWidth - 50, yPos + 8, { align: "center" });

    // Thank you message
    yPos += 25;
    doc.setFontSize(11);
    doc.setFont("helvetica", "italic");
    doc.text("Thank you for your payment!", pageWidth / 2, yPos, { align: "center" });

    // Save PDF
    doc.save(`Receipt-${receiptNumber}-${payment.date}.pdf`);
}

function numberToWords(num: number): string {
    const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];
    const teens = ["Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
    const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

    if (num === 0) return "Zero";

    const convert = (n: number): string => {
        if (n < 10) return ones[n];
        if (n < 20) return teens[n - 10];
        if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "");
        if (n < 1000) return ones[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " " + convert(n % 100) : "");
        if (n < 100000) return convert(Math.floor(n / 1000)) + " Thousand" + (n % 1000 ? " " + convert(n % 1000) : "");
        if (n < 10000000) return convert(Math.floor(n / 100000)) + " Lakh" + (n % 100000 ? " " + convert(n % 100000) : "");
        return convert(Math.floor(n / 10000000)) + " Crore" + (n % 10000000 ? " " + convert(n % 10000000) : "");
    };

    return convert(Math.floor(num));
}

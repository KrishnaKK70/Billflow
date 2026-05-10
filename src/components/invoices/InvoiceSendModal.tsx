import { useEffect, useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Mail, MessageCircle, Phone, Settings2 } from "lucide-react";
import {
    buildTemplateContext,
    fillInvoiceTemplate,
    loadInvoiceSendSettings,
    normalizeSmsPhone,
    normalizeWhatsAppDigits,
} from "@/utils/invoiceSendSettings";
import { useInvoiceSendSettings } from "@/contexts/invoiceSendSettingsContext";

interface Invoice {
    id: string;
    invoiceNumber: string;
    customer: string;
    customerId?: string;
    company?: string;
    issueDate: string;
    dueDate: string;
    total: number;
    status: "paid" | "partial" | "unpaid";
}

interface InvoiceSendModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    invoice: Invoice | null;
}

function resolveCustomerFromStorage(invoice: Invoice) {
    try {
        const customers = JSON.parse(localStorage.getItem("customers") || "[]") as any[];
        return (
            customers.find((x) => x.customerId === invoice.customerId || x.id === invoice.customerId) ||
            customers.find((x) => (x.name || "").trim().toLowerCase() === (invoice.customer || "").trim().toLowerCase())
        );
    } catch {
        return undefined;
    }
}

function isProbablyMobileDevice(): boolean {
    return /Android|iPhone|iPad|iPod|Windows Phone|Mobile/i.test(navigator.userAgent);
}

async function postSend(path: string, payload: Record<string, string>) {
    const r = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || data?.ok === false) {
        throw new Error(data?.error || `Send failed (${r.status})`);
    }
}

export function InvoiceSendModal({ open, onOpenChange, invoice }: InvoiceSendModalProps) {
    const { openInvoiceSendSettings } = useInvoiceSendSettings();
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [emailSubject, setEmailSubject] = useState("");
    const [emailBody, setEmailBody] = useState("");
    const [whatsappBody, setWhatsappBody] = useState("");
    const [smsBody, setSmsBody] = useState("");
    const [sendMethod, setSendMethod] = useState("email");

    useEffect(() => {
        if (!open || !invoice) return;
        const settings = loadInvoiceSendSettings();
        const cust = resolveCustomerFromStorage(invoice);
        setEmail((cust?.email || "").trim());
        setPhone((cust?.phone || "").replace(/[\s-]/g, ""));
        const ctx = buildTemplateContext(invoice, settings.general.senderName);
        setEmailSubject(fillInvoiceTemplate(settings.email.defaultSubject, ctx));
        setEmailBody(fillInvoiceTemplate(settings.email.defaultBody, ctx));
        setWhatsappBody(fillInvoiceTemplate(settings.whatsapp.messageTemplate, ctx));
        setSmsBody(fillInvoiceTemplate(settings.sms.messageTemplate, ctx));
        setSendMethod("email");
    }, [open, invoice]);

    if (!invoice) return null;

    const handleSendEmail = () => {
        if (!email.trim()) {
            toast.error("Please enter an email address");
            return;
        }
        const settings = loadInvoiceSendSettings();
        const subj = emailSubject.trim() || `Invoice ${invoice.invoiceNumber}`;
        const body = emailBody;
        let mailto = `mailto:${encodeURIComponent(email.trim())}?subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(body)}`;
        if (settings.email.cc.trim()) {
            mailto += `&cc=${encodeURIComponent(settings.email.cc.trim())}`;
        }
        if (settings.email.bcc.trim()) {
            mailto += `&bcc=${encodeURIComponent(settings.email.bcc.trim())}`;
        }
        postSend("/api/send/email", {
            to: email.trim(),
            subject: subj,
            body,
            cc: settings.email.cc.trim(),
            bcc: settings.email.bcc.trim(),
        })
            .then(() => {
                toast.success(`Email sent for Invoice ${invoice.invoiceNumber}`);
                resetAndClose();
            })
            .catch((e) => {
                if (settings.email.openMode === "gmail_web") {
                    const gmail = new URL("https://mail.google.com/mail/");
                    gmail.searchParams.set("view", "cm");
                    gmail.searchParams.set("fs", "1");
                    gmail.searchParams.set("to", email.trim());
                    gmail.searchParams.set("su", subj);
                    gmail.searchParams.set("body", body);
                    if (settings.email.cc.trim()) gmail.searchParams.set("cc", settings.email.cc.trim());
                    if (settings.email.bcc.trim()) gmail.searchParams.set("bcc", settings.email.bcc.trim());
                    window.open(gmail.toString(), "_blank", "noopener,noreferrer");
                    toast.info(`API unavailable: ${e.message}. Opened Gmail draft instead.`);
                } else {
                    const link = document.createElement("a");
                    link.href = mailto;
                    link.click();
                    toast.info(`API unavailable: ${e.message}. Opened email draft instead.`);
                }
                resetAndClose();
            });
    };

    const handleSendWhatsApp = () => {
        if (!phone.trim()) {
            toast.error("Please enter a phone number");
            return;
        }
        const settings = loadInvoiceSendSettings();
        const clean = normalizeWhatsAppDigits(phone, settings.whatsapp.defaultCountryCode);
        if (!clean || clean.length < 10) {
            toast.error("Enter a valid number (with country code if outside your default)");
            return;
        }
        const encoded = encodeURIComponent(whatsappBody);
        const whatsappUrl = `https://wa.me/${clean}?text=${encoded}`;
        postSend("/api/send/whatsapp", { to: `+${clean}`, body: whatsappBody })
            .then(() => {
                toast.success(`WhatsApp sent for Invoice ${invoice.invoiceNumber}`);
                resetAndClose();
            })
            .catch((e) => {
                if (settings.whatsapp.openMode === "app_then_web") {
                    const appUrl = `whatsapp://send?phone=${clean}&text=${encoded}`;
                    const frame = document.createElement("iframe");
                    frame.style.display = "none";
                    frame.src = appUrl;
                    document.body.appendChild(frame);
                    setTimeout(() => {
                        frame.remove();
                        if (!document.hidden) {
                            window.open(whatsappUrl, "_blank", "noopener,noreferrer");
                        }
                    }, 1000);
                } else {
                    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
                }
                toast.info(`API unavailable: ${e.message}. Opened WhatsApp compose instead.`);
                resetAndClose();
            });
    };

    const handleSendSMS = () => {
        if (!phone.trim()) {
            toast.error("Please enter a phone number");
            return;
        }
        const settings = loadInvoiceSendSettings();
        const smsPhone = normalizeSmsPhone(phone, settings.whatsapp.defaultCountryCode);
        postSend("/api/send/sms", { to: smsPhone, body: smsBody })
            .then(() => {
                toast.success(`SMS sent for Invoice ${invoice.invoiceNumber}`);
                resetAndClose();
            })
            .catch((e) => {
                const smsMessage = encodeURIComponent(smsBody);
                if (!isProbablyMobileDevice()) {
                    const toCopy = `To: ${smsPhone}\nMessage: ${smsBody}`;
                    navigator.clipboard.writeText(toCopy).catch(() => {});
                    toast.info(`API unavailable: ${e.message}. Copied SMS details for manual send.`);
                    return;
                }
                const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
                const raw = smsPhone.replace(/^\+/, "");
                const smsUrl = isIOS ? `sms:${raw}&body=${smsMessage}` : `sms:${smsPhone}?body=${smsMessage}`;
                const link = document.createElement("a");
                link.href = smsUrl;
                link.click();
                toast.info(`API unavailable: ${e.message}. Opened SMS app draft.`);
                resetAndClose();
            });
    };

    const resetAndClose = () => {
        onOpenChange(false);
        setEmail("");
        setPhone("");
        setEmailSubject("");
        setEmailBody("");
        setWhatsappBody("");
        setSmsBody("");
        setSendMethod("email");
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:pr-8">
                        <DialogTitle>Send Invoice {invoice.invoiceNumber}</DialogTitle>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="shrink-0 gap-1"
                            onClick={() => openInvoiceSendSettings()}
                        >
                            <Settings2 className="h-4 w-4" />
                            Templates
                        </Button>
                    </div>
                </DialogHeader>

                <Tabs value={sendMethod} onValueChange={setSendMethod} className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="email" className="flex items-center gap-2">
                            <Mail className="h-4 w-4" />
                            Email
                        </TabsTrigger>
                        <TabsTrigger value="whatsapp" className="flex items-center gap-2">
                            <MessageCircle className="h-4 w-4" />
                            WhatsApp
                        </TabsTrigger>
                        <TabsTrigger value="sms" className="flex items-center gap-2">
                            <Phone className="h-4 w-4" />
                            SMS
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="email" className="space-y-4 mt-4">
                        <div>
                            <Label htmlFor="email">Recipient Email</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="customer@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>
                        <div>
                            <Label htmlFor="subject">Subject</Label>
                            <Input
                                id="subject"
                                value={emailSubject}
                                onChange={(e) => setEmailSubject(e.target.value)}
                            />
                        </div>
                        <div>
                            <Label htmlFor="message">Message</Label>
                            <Textarea
                                id="message"
                                value={emailBody}
                                onChange={(e) => setEmailBody(e.target.value)}
                                rows={6}
                            />
                            <p className="text-[11px] text-muted-foreground mt-1">
                                CC / BCC come from Invoice send settings (header gear or Templates above).
                            </p>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => onOpenChange(false)}>
                                Cancel
                            </Button>
                            <Button onClick={handleSendEmail}>
                                <Mail className="h-4 w-4 mr-2" />
                                Send Email
                            </Button>
                        </DialogFooter>
                    </TabsContent>

                    <TabsContent value="whatsapp" className="space-y-4 mt-4">
                        <div>
                            <Label htmlFor="whatsapp-phone">WhatsApp number</Label>
                            <Input
                                id="whatsapp-phone"
                                type="tel"
                                placeholder="+919876543210 or 9876543210"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                            />
                            <p className="text-[11px] text-muted-foreground mt-1">
                                10-digit numbers use the default country code from settings.
                            </p>
                        </div>
                        <div>
                            <Label htmlFor="whatsapp-message">Message</Label>
                            <Textarea
                                id="whatsapp-message"
                                value={whatsappBody}
                                onChange={(e) => setWhatsappBody(e.target.value)}
                                rows={6}
                            />
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => onOpenChange(false)}>
                                Cancel
                            </Button>
                            <Button onClick={handleSendWhatsApp} className="bg-green-600 hover:bg-green-700">
                                <MessageCircle className="h-4 w-4 mr-2" />
                                Send via WhatsApp
                            </Button>
                        </DialogFooter>
                    </TabsContent>

                    <TabsContent value="sms" className="space-y-4 mt-4">
                        <div>
                            <Label htmlFor="sms-phone">Phone number</Label>
                            <Input
                                id="sms-phone"
                                type="tel"
                                placeholder="+919876543210 or 9876543210"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                            />
                        </div>
                        <div>
                            <Label htmlFor="sms-msg">SMS text</Label>
                            <Textarea
                                id="sms-msg"
                                value={smsBody}
                                onChange={(e) => setSmsBody(e.target.value)}
                                rows={4}
                            />
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => onOpenChange(false)}>
                                Cancel
                            </Button>
                            <Button onClick={handleSendSMS}>
                                <Phone className="h-4 w-4 mr-2" />
                                Send SMS
                            </Button>
                        </DialogFooter>
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}

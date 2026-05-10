import { useEffect, useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Mail, MessageCircle, Phone, User } from "lucide-react";
import {
    getDefaultInvoiceSendSettings,
    INVOICE_TEMPLATE_PLACEHOLDERS,
    loadInvoiceSendSettings,
    saveInvoiceSendSettings,
    type InvoiceSendSettings,
} from "@/utils/invoiceSendSettings";

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function InvoiceSendSettingsModal({ open, onOpenChange }: Props) {
    const [s, setS] = useState<InvoiceSendSettings>(() => loadInvoiceSendSettings());

    useEffect(() => {
        if (open) setS(loadInvoiceSendSettings());
    }, [open]);

    const handleSave = () => {
        saveInvoiceSendSettings(s);
        toast.success("Invoice send settings saved");
        onOpenChange(false);
    };

    const handleReset = () => {
        if (!window.confirm("Reset all invoice send templates to defaults?")) return;
        const d = getDefaultInvoiceSendSettings();
        setS(d);
        saveInvoiceSendSettings(d);
        toast.success("Restored default templates");
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Invoice send settings</DialogTitle>
                    <DialogDescription>
                        Templates for Email, WhatsApp, and SMS. Placeholders: {INVOICE_TEMPLATE_PLACEHOLDERS}
                    </DialogDescription>
                    <p className="text-xs text-muted-foreground">
                        Real sending uses the local send API (`npm run server`) with SMTP/Twilio env configuration.
                    </p>
                </DialogHeader>

                <Tabs defaultValue="email" className="w-full">
                    <TabsList className="grid w-full grid-cols-4">
                        <TabsTrigger value="email" className="gap-1 text-xs sm:text-sm">
                            <Mail className="h-3.5 w-3.5 shrink-0" />
                            Email
                        </TabsTrigger>
                        <TabsTrigger value="whatsapp" className="gap-1 text-xs sm:text-sm">
                            <MessageCircle className="h-3.5 w-3.5 shrink-0" />
                            WhatsApp
                        </TabsTrigger>
                        <TabsTrigger value="sms" className="gap-1 text-xs sm:text-sm">
                            <Phone className="h-3.5 w-3.5 shrink-0" />
                            SMS
                        </TabsTrigger>
                        <TabsTrigger value="general" className="gap-1 text-xs sm:text-sm">
                            <User className="h-3.5 w-3.5 shrink-0" />
                            Signature
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="email" className="space-y-3 mt-4">
                        <div>
                            <Label htmlFor="set-email-mode">Open email using</Label>
                            <select
                                id="set-email-mode"
                                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                value={s.email.openMode}
                                onChange={(e) =>
                                    setS((p) => ({
                                        ...p,
                                        email: {
                                            ...p.email,
                                            openMode: e.target.value as "mailto" | "gmail_web",
                                        },
                                    }))
                                }
                            >
                                <option value="mailto">Default mail app (mailto)</option>
                                <option value="gmail_web">Gmail web compose</option>
                            </select>
                        </div>
                        <div>
                            <Label htmlFor="set-email-subj">Default subject</Label>
                            <Input
                                id="set-email-subj"
                                value={s.email.defaultSubject}
                                onChange={(e) =>
                                    setS((p) => ({ ...p, email: { ...p.email, defaultSubject: e.target.value } }))
                                }
                            />
                        </div>
                        <div>
                            <Label htmlFor="set-email-body">Default message body</Label>
                            <Textarea
                                id="set-email-body"
                                rows={8}
                                value={s.email.defaultBody}
                                onChange={(e) =>
                                    setS((p) => ({ ...p, email: { ...p.email, defaultBody: e.target.value } }))
                                }
                                className="font-mono text-xs sm:text-sm"
                            />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <Label htmlFor="set-email-cc">CC (optional)</Label>
                                <Input
                                    id="set-email-cc"
                                    placeholder="accounts@yourco.com"
                                    value={s.email.cc}
                                    onChange={(e) => setS((p) => ({ ...p, email: { ...p.email, cc: e.target.value } }))}
                                />
                            </div>
                            <div>
                                <Label htmlFor="set-email-bcc">BCC (optional)</Label>
                                <Input
                                    id="set-email-bcc"
                                    value={s.email.bcc}
                                    onChange={(e) => setS((p) => ({ ...p, email: { ...p.email, bcc: e.target.value } }))}
                                />
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="whatsapp" className="space-y-3 mt-4">
                        <div>
                            <Label htmlFor="set-wa-mode">Open WhatsApp using</Label>
                            <select
                                id="set-wa-mode"
                                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                value={s.whatsapp.openMode}
                                onChange={(e) =>
                                    setS((p) => ({
                                        ...p,
                                        whatsapp: {
                                            ...p.whatsapp,
                                            openMode: e.target.value as "app_then_web" | "web_only",
                                        },
                                    }))
                                }
                            >
                                <option value="app_then_web">App first, then web fallback</option>
                                <option value="web_only">Web only</option>
                            </select>
                        </div>
                        <div>
                            <Label htmlFor="set-wa-cc">Default country code (digits)</Label>
                            <Input
                                id="set-wa-cc"
                                placeholder="91"
                                value={s.whatsapp.defaultCountryCode}
                                onChange={(e) =>
                                    setS((p) => ({
                                        ...p,
                                        whatsapp: { ...p.whatsapp, defaultCountryCode: e.target.value.replace(/\D/g, "") },
                                    }))
                                }
                            />
                            <p className="text-[11px] text-muted-foreground mt-1">
                                10-digit local numbers get this prefix for WhatsApp and SMS.
                            </p>
                        </div>
                        <div>
                            <Label htmlFor="set-wa-tpl">Message template</Label>
                            <Textarea
                                id="set-wa-tpl"
                                rows={8}
                                value={s.whatsapp.messageTemplate}
                                onChange={(e) =>
                                    setS((p) => ({
                                        ...p,
                                        whatsapp: { ...p.whatsapp, messageTemplate: e.target.value },
                                    }))
                                }
                                className="font-mono text-xs sm:text-sm"
                            />
                        </div>
                    </TabsContent>

                    <TabsContent value="sms" className="space-y-3 mt-4">
                        <div>
                            <Label htmlFor="set-sms-tpl">SMS template (single SMS — keep concise)</Label>
                            <Textarea
                                id="set-sms-tpl"
                                rows={5}
                                value={s.sms.messageTemplate}
                                onChange={(e) =>
                                    setS((p) => ({ ...p, sms: { ...p.sms, messageTemplate: e.target.value } }))
                                }
                                className="font-mono text-xs sm:text-sm"
                            />
                        </div>
                    </TabsContent>

                    <TabsContent value="general" className="space-y-3 mt-4">
                        <div>
                            <Label htmlFor="set-sender">Sender / sign-off</Label>
                            <Input
                                id="set-sender"
                                placeholder="{{company}} or your name"
                                value={s.general.senderName}
                                onChange={(e) =>
                                    setS((p) => ({ ...p, general: { ...p.general, senderName: e.target.value } }))
                                }
                            />
                            <p className="text-[11px] text-muted-foreground mt-1">
                                Fills <code className="text-xs">{"{{senderName}}"}</code> in templates. Use{" "}
                                <code className="text-xs">{"{{company}}"}</code> to pull the invoice company name.
                            </p>
                        </div>
                    </TabsContent>
                </Tabs>

                <DialogFooter className="flex-col sm:flex-row gap-2 sm:justify-between sm:items-center">
                    <Button type="button" variant="outline" onClick={handleReset}>
                        Reset to defaults
                    </Button>
                    <div className="flex gap-2">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="button" onClick={handleSave}>
                            Save settings
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

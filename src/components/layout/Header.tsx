import { Button } from "@/components/ui/button";
import { Bell, Settings } from "lucide-react";
import { useInvoiceSendSettings } from "@/contexts/invoiceSendSettingsContext";

export function Header() {
    const { openInvoiceSendSettings } = useInvoiceSendSettings();

    return (
        <header className="flex h-16 items-center justify-between border-b border-border bg-card px-6">
            <div className="flex-1">
                <h2 className="text-lg font-semibold text-foreground">Billing Management</h2>
            </div>

            <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" type="button" title="Notifications">
                    <Bell className="h-5 w-5" />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    type="button"
                    title="Invoice send settings (email, WhatsApp, SMS)"
                    onClick={() => openInvoiceSendSettings()}
                >
                    <Settings className="h-5 w-5" />
                </Button>
            </div>
        </header>
    );
}

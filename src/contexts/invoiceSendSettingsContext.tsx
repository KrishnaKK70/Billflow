import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { InvoiceSendSettingsModal } from "@/components/invoices/InvoiceSendSettingsModal";

type InvoiceSendSettingsContextValue = {
    openInvoiceSendSettings: () => void;
};

const InvoiceSendSettingsContext = createContext<InvoiceSendSettingsContextValue | null>(null);

export function InvoiceSendSettingsProvider({ children }: { children: ReactNode }) {
    const [open, setOpen] = useState(false);
    const openInvoiceSendSettings = useCallback(() => setOpen(true), []);

    return (
        <InvoiceSendSettingsContext.Provider value={{ openInvoiceSendSettings }}>
            {children}
            <InvoiceSendSettingsModal open={open} onOpenChange={setOpen} />
        </InvoiceSendSettingsContext.Provider>
    );
}

export function useInvoiceSendSettings(): InvoiceSendSettingsContextValue {
    const ctx = useContext(InvoiceSendSettingsContext);
    if (!ctx) {
        throw new Error("useInvoiceSendSettings must be used within InvoiceSendSettingsProvider");
    }
    return ctx;
}

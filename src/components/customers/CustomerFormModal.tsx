import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { z } from "zod";

const CUSTOMER_ID_REGEX = /^C\d{2}-(0[1-9]|1[0-2])-\d{4}$/;
const customerIdSchema = z
    .string()
    .trim()
    .nonempty({ message: "Customer ID is required" })
    .max(15, { message: "Customer ID is too long" })
    .regex(CUSTOMER_ID_REGEX, {
        message: "Format must be CNN-MM-YYYY (e.g. C01-04-2026)",
    });

interface Customer {
    id: string;
    customerId: string;
    name: string;
    contactName: string;
    email: string;
    phone: string;
    outstanding: number;
    status: "active" | "inactive";
    whatsappReminders?: boolean;
    lastReminderSent?: string;
    /** Customer GSTIN for invoices / GST report */
    gst?: string;
}

interface CustomerFormModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onCustomerCreated?: (customer: Customer) => void;
    onCustomerUpdated?: (customer: Customer) => void;
    editCustomer?: Customer | null;
    existingCustomers?: Customer[];
}

const generateCustomerId = (existing: Customer[] = []): string => {
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const yyyy = String(now.getFullYear());
    const suffix = `-${mm}-${yyyy}`;

    const seqs = existing
        .map((c) => {
            const m = c.customerId?.match(/^C(\d+)-(\d{2})-(\d{4})$/);
            if (!m) return 0;
            if (m[2] !== mm || m[3] !== yyyy) return 0;
            return parseInt(m[1], 10);
        })
        .filter((n) => !isNaN(n));

    const next = (seqs.length ? Math.max(...seqs) : 0) + 1;
    return `C${String(next).padStart(2, "0")}${suffix}`;
};

export function CustomerFormModal({ open, onOpenChange, onCustomerCreated, onCustomerUpdated, editCustomer, existingCustomers = [], availablePlanners = [] }: CustomerFormModalProps) {
    const [formData, setFormData] = useState({
        customerId: "",
        companyName: "",
        contactName: "",
        email: "",
        phone: "",
        gst: "",
        address: "",
        city: "",
        state: "",
        pincode: "",
        isActive: true,
        whatsappReminders: false,
    });

    useEffect(() => {
        if (editCustomer) {
            setFormData({
                customerId: editCustomer.customerId,
                companyName: editCustomer.name,
                contactName: editCustomer.contactName,
                email: editCustomer.email,
                phone: editCustomer.phone,
                gst: editCustomer.gst || "",
                address: "",
                city: "",
                state: "",
                pincode: "",
                isActive: editCustomer.status === "active",
                whatsappReminders: !!editCustomer.whatsappReminders,
            });
        } else {
            setFormData({
                customerId: generateCustomerId(existingCustomers),
                companyName: "",
                contactName: "",
                email: "",
                phone: "",
                gst: "",
                address: "",
                city: "",
                state: "",
                pincode: "",
                isActive: true,
                whatsappReminders: false,
            });
        }
    }, [editCustomer, open]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const idToUse = (formData.customerId || (editCustomer ? "" : generateCustomerId(existingCustomers))).trim();

        const parsed = customerIdSchema.safeParse(idToUse);
        if (!parsed.success) {
            toast.error(parsed.error.errors[0]?.message || "Invalid Customer ID");
            return;
        }

        const duplicate = existingCustomers.some(
            (c) => c.customerId.trim().toLowerCase() === parsed.data.toLowerCase() && c.id !== editCustomer?.id
        );
        if (duplicate) {
            toast.error("Customer ID already exists. Please use a unique ID.");
            return;
        }

        // Prevent duplicate customer NAMES (so the same real customer can't be
        // recreated with a different code). Editing keeps its own record.
        const nameClash = existingCustomers.some(
            (c) =>
                c.id !== editCustomer?.id &&
                c.name.trim().toLowerCase() === formData.companyName.trim().toLowerCase()
        );
        if (nameClash) {
            toast.error("A customer with this name already exists. Reuse the existing record instead of creating a duplicate.");
            return;
        }

        if (editCustomer) {
            const updatedCustomer: Customer = {
                ...editCustomer,
                customerId: parsed.data,
                name: formData.companyName,
                contactName: formData.contactName,
                email: formData.email,
                phone: formData.phone,
                gst: formData.gst.trim() || undefined,
                status: formData.isActive ? "active" : "inactive",
                whatsappReminders: formData.whatsappReminders,
            };
            onCustomerUpdated?.(updatedCustomer);
            toast.success("Customer updated successfully!");
        } else {
            const newCustomer: Customer = {
                id: Date.now().toString(),
                customerId: parsed.data,
                name: formData.companyName,
                contactName: formData.contactName,
                email: formData.email,
                phone: formData.phone,
                gst: formData.gst.trim() || undefined,
                outstanding: 0,
                status: formData.isActive ? "active" : "inactive",
                whatsappReminders: formData.whatsappReminders,
            };
            onCustomerCreated?.(newCustomer);
            toast.success("Customer added successfully!");
        }
        onOpenChange(false);
    };

    const handleChange = (field: string, value: string | boolean) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{editCustomer ? "Edit Customer" : "Add Customer"}</DialogTitle>
                    <DialogDescription>Enter customer details and contact information</DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="customerId">Customer ID *</Label>
                            <Input
                                id="customerId"
                                value={formData.customerId}
                                readOnly
                                className="bg-muted cursor-not-allowed"
                                placeholder="C01-04-2026"
                                required
                                title="Customer code is generated once and cannot be changed."
                            />
                            <p className="text-[11px] text-muted-foreground">
                                Auto-generated and permanent — used across planners, invoices, payments, ledger and receipts.
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="companyName">Company Name *</Label>
                            <Input
                                id="companyName"
                                value={formData.companyName}
                                onChange={(e) => handleChange("companyName", e.target.value)}
                                placeholder="TechStart Industries"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="contactName">Contact Person *</Label>
                            <Input
                                id="contactName"
                                value={formData.contactName}
                                onChange={(e) => handleChange("contactName", e.target.value)}
                                placeholder="Mr. John Doe"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="email">Email *</Label>
                            <Input
                                id="email"
                                type="email"
                                value={formData.email}
                                onChange={(e) => handleChange("email", e.target.value)}
                                placeholder="contact@company.com"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="phone">Phone *</Label>
                            <Input
                                id="phone"
                                value={formData.phone}
                                onChange={(e) => handleChange("phone", e.target.value)}
                                placeholder="+91 9876543210"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="gst">GST Number</Label>
                            <Input
                                id="gst"
                                value={formData.gst}
                                onChange={(e) => handleChange("gst", e.target.value)}
                                placeholder="22AAAAA0000A1Z5"
                            />
                        </div>

                        <div className="space-y-2 col-span-2">
                            <Label htmlFor="address">Address</Label>
                            <Input
                                id="address"
                                value={formData.address}
                                onChange={(e) => handleChange("address", e.target.value)}
                                placeholder="Street address"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="city">City</Label>
                            <Input
                                id="city"
                                value={formData.city}
                                onChange={(e) => handleChange("city", e.target.value)}
                                placeholder="Mumbai"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="state">State</Label>
                            <Input
                                id="state"
                                value={formData.state}
                                onChange={(e) => handleChange("state", e.target.value)}
                                placeholder="Maharashtra"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="pincode">Pincode</Label>
                            <Input
                                id="pincode"
                                value={formData.pincode}
                                onChange={(e) => handleChange("pincode", e.target.value)}
                                placeholder="400001"
                            />
                        </div>

                        <div className="space-y-2 flex items-center justify-between col-span-2">
                            <Label htmlFor="isActive">Active Status</Label>
                            <Switch
                                id="isActive"
                                checked={formData.isActive}
                                onCheckedChange={(checked) => handleChange("isActive", checked)}
                            />
                        </div>

                        <div className="space-y-2 col-span-2 p-3 border border-border rounded-md bg-muted/10">
                            <div className="flex items-center justify-between">
                                <div>
                                    <Label htmlFor="whatsappReminders" className="cursor-pointer">Enable WhatsApp Reminders</Label>
                                    <p className="text-[11px] text-muted-foreground">Weekly reminder sent only when outstanding &gt; 0.</p>
                                </div>
                                <Switch
                                    id="whatsappReminders"
                                    checked={formData.whatsappReminders}
                                    onCheckedChange={(checked) => handleChange("whatsappReminders", checked)}
                                />
                            </div>
                            {editCustomer?.lastReminderSent && (
                                <p className="text-[11px] text-muted-foreground">Last reminder sent: {editCustomer.lastReminderSent}</p>
                            )}
                        </div>


                    </div>

                    <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit">{editCustomer ? "Update Customer" : "Save Customer"}</Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}

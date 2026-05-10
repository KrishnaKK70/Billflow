import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useState, useEffect } from "react";

interface CompanyFormModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onCompanyCreated?: (company: any) => void;
    editingCompany?: any;
    existingCompanies?: any[];
}

const IGNORED_WORDS = new Set(["pvt", "ltd", "llp", "private", "limited", "company", "co", "inc", "corp", "the", "and", "&"]);

function generateCompanyCode(name: string, existing: any[] = [], currentId?: string): string {
    if (!name || !name.trim()) return "";
    const words = name
        .replace(/[^a-zA-Z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w && !IGNORED_WORDS.has(w.toLowerCase()));
    if (words.length === 0) return "";
    let prefix = "";
    if (words.length === 1) {
        prefix = words[0].substring(0, 2).toUpperCase();
    } else {
        prefix = (words[0][0] + words[1][0]).toUpperCase();
    }
    const others = existing.filter((c) => c.id !== currentId);
    const used = others
        .map((c) => c.companyId || "")
        .filter((code) => code.startsWith(prefix + "-"))
        .map((code) => parseInt(code.split("-")[1], 10))
        .filter((n) => !isNaN(n));
    const next = (used.length ? Math.max(...used) : 0) + 1;
    return `${prefix}-${String(next).padStart(2, "0")}`;
}

export function CompanyFormModal({ open, onOpenChange, onCompanyCreated, editingCompany, existingCompanies = [] }: CompanyFormModalProps) {
    const [formData, setFormData] = useState({
        companyId: "",
        name: "",
        payableName: "",
        gst: "",
        pan: "",
        address: "",
        city: "",
        state: "",
        pincode: "",
        phone: "",
        email: "",
        bankName: "",
        accountNumber: "",
        ifsc: "",
        hasPan: false,
        hasGst: false,
    });

    // Update form data when editingCompany changes
    useEffect(() => {
        if (editingCompany) {
            setFormData({
                companyId: editingCompany.companyId || "",
                name: editingCompany.name || "",
                payableName: editingCompany.payableName || "",
                gst: editingCompany.gst || "",
                pan: editingCompany.pan || "",
                address: editingCompany.address || "",
                city: editingCompany.city || "",
                state: editingCompany.state || "",
                pincode: editingCompany.pincode || "",
                phone: editingCompany.phone || "",
                email: editingCompany.email || "",
                bankName: editingCompany.bankName || "",
                accountNumber: editingCompany.accountNumber || "",
                ifsc: editingCompany.ifsc || "",
                hasPan: editingCompany.hasPan || false,
                hasGst: editingCompany.hasGst || false,
            });
        } else if (!open) {
            // Reset form when modal closes
            setFormData({
                companyId: "",
                name: "",
                payableName: "",
                gst: "",
                pan: "",
                address: "",
                city: "",
                state: "",
                pincode: "",
                phone: "",
                email: "",
                bankName: "",
                accountNumber: "",
                ifsc: "",
                hasPan: false,
                hasGst: false,
            });
        }
    }, [editingCompany, open]);

    const [errors, setErrors] = useState({
        pan: "",
        gst: "",
    });

    const validatePan = (pan: string): boolean => {
        if (!formData.hasPan || !pan) return true;
        const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
        return panRegex.test(pan);
    };

    const validateGst = (gst: string): boolean => {
        if (!formData.hasGst || !gst) return true;
        const gstRegex = /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}$/;
        return gstRegex.test(gst);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // Validate PAN if enabled
        if (formData.hasPan && formData.pan && !validatePan(formData.pan)) {
            setErrors(prev => ({ ...prev, pan: "Invalid PAN format. Must be: AAAAA0000A" }));
            return;
        }

        // Validate GST if enabled
        if (formData.hasGst && formData.gst && !validateGst(formData.gst)) {
            setErrors(prev => ({ ...prev, gst: "Invalid GST format. Must be: 22AAAAA0000A1Z5" }));
            return;
        }

        const companyData = {
            id: editingCompany?.id || Date.now().toString(),
            companyId: editingCompany?.companyId || formData.companyId,
            name: formData.name,
            email: formData.email,
            phone: formData.phone,
            pan: formData.hasPan ? formData.pan : undefined,
            gst: formData.hasGst ? formData.gst : undefined,
            hasPan: formData.hasPan,
            hasGst: formData.hasGst,
            isDefault: editingCompany?.isDefault || false,
            ...formData,
        };
        onCompanyCreated?.(companyData);
        setErrors({ pan: "", gst: "" });
        onOpenChange(false);
    };

    const handleChange = (field: string, value: string | boolean) => {
        setFormData(prev => {
            const next = { ...prev, [field]: value };
            if (field === "name" && !editingCompany) {
                next.companyId = generateCompanyCode(value as string, existingCompanies, editingCompany?.id);
            }
            return next;
        });
        if (field === "pan" || field === "gst") {
            setErrors(prev => ({ ...prev, [field]: "" }));
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{editingCompany ? "Edit Company" : "Add Company"}</DialogTitle>
                    <DialogDescription>Enter company details and banking information</DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Company Name *</Label>
                            <Input
                                id="name"
                                value={formData.name}
                                onChange={(e) => handleChange("name", e.target.value)}
                                placeholder="TechFlow Solutions Pvt Ltd"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="companyId">Company Code</Label>
                            <Input
                                id="companyId"
                                value={formData.companyId}
                                placeholder="Auto-generated"
                                readOnly
                                className="bg-muted cursor-not-allowed"
                            />
                        </div>

                        <div className="space-y-2 col-span-2">
                            <Label htmlFor="payableName">Payable Name *</Label>
                            <Input
                                id="payableName"
                                value={formData.payableName}
                                onChange={(e) => handleChange("payableName", e.target.value)}
                                placeholder="Name on checks/payments"
                                required
                            />
                        </div>

                        <div className="space-y-4 col-span-2 p-4 border border-border rounded-md bg-muted/10">
                            <h3 className="text-sm font-semibold text-foreground">Tax Settings</h3>

                            <div className="space-y-3">
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="hasPan"
                                        checked={formData.hasPan}
                                        onCheckedChange={(checked) => handleChange("hasPan", checked as boolean)}
                                    />
                                    <Label htmlFor="hasPan" className="text-sm cursor-pointer">
                                        This company has a PAN
                                    </Label>
                                </div>

                                {formData.hasPan && (
                                    <div className="space-y-2 ml-6">
                                        <Label htmlFor="pan">PAN Number *</Label>
                                        <Input
                                            id="pan"
                                            value={formData.pan}
                                            onChange={(e) => handleChange("pan", e.target.value.toUpperCase())}
                                            placeholder="AAAAA0000A"
                                            className={errors.pan ? "border-destructive" : ""}
                                        />
                                        {errors.pan && (
                                            <p className="text-xs text-destructive">{errors.pan}</p>
                                        )}
                                    </div>
                                )}

                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="hasGst"
                                        checked={formData.hasGst}
                                        onCheckedChange={(checked) => handleChange("hasGst", checked as boolean)}
                                    />
                                    <Label htmlFor="hasGst" className="text-sm cursor-pointer">
                                        This company is GST-registered
                                    </Label>
                                </div>

                                {formData.hasGst && (
                                    <div className="space-y-2 ml-6">
                                        <Label htmlFor="gst">GST Number *</Label>
                                        <Input
                                            id="gst"
                                            value={formData.gst}
                                            onChange={(e) => handleChange("gst", e.target.value.toUpperCase())}
                                            placeholder="22AAAAA0000A1Z5"
                                            className={errors.gst ? "border-destructive" : ""}
                                        />
                                        {errors.gst && (
                                            <p className="text-xs text-destructive">{errors.gst}</p>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="space-y-2 col-span-2">
                            <Label htmlFor="address">Address *</Label>
                            <Input
                                id="address"
                                value={formData.address}
                                onChange={(e) => handleChange("address", e.target.value)}
                                placeholder="Street address"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="city">City *</Label>
                            <Input
                                id="city"
                                value={formData.city}
                                onChange={(e) => handleChange("city", e.target.value)}
                                placeholder="Mumbai"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="state">State *</Label>
                            <Input
                                id="state"
                                value={formData.state}
                                onChange={(e) => handleChange("state", e.target.value)}
                                placeholder="Maharashtra"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="pincode">Pincode *</Label>
                            <Input
                                id="pincode"
                                value={formData.pincode}
                                onChange={(e) => handleChange("pincode", e.target.value)}
                                placeholder="400001"
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

                        <div className="space-y-2 col-span-2">
                            <Label htmlFor="email">Email *</Label>
                            <Input
                                id="email"
                                type="email"
                                value={formData.email}
                                onChange={(e) => handleChange("email", e.target.value)}
                                placeholder="billing@company.com"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="bankName">Bank Name *</Label>
                            <Input
                                id="bankName"
                                value={formData.bankName}
                                onChange={(e) => handleChange("bankName", e.target.value)}
                                placeholder="HDFC Bank"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="accountNumber">Account Number *</Label>
                            <Input
                                id="accountNumber"
                                value={formData.accountNumber}
                                onChange={(e) => handleChange("accountNumber", e.target.value)}
                                placeholder="50100012345678"
                                required
                            />
                        </div>

                        <div className="space-y-2 col-span-2">
                            <Label htmlFor="ifsc">IFSC Code *</Label>
                            <Input
                                id="ifsc"
                                value={formData.ifsc}
                                onChange={(e) => handleChange("ifsc", e.target.value)}
                                placeholder="HDFC0001234"
                                required
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit">Save Company</Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}

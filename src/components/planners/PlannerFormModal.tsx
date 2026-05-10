import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { toast } from "sonner";
import { useState, useEffect, useMemo } from "react";
import { Plus, Trash2, Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { z } from "zod";

interface Customer {
    id: string;
    customerId: string;
    name: string;
}

interface LineItem {
    id: string;
    itemName: string;
    description: string;
    qty: number;
    rate: number;
}

export interface PlannerTemplate {
    name: string;
    defaultItems?: LineItem[];
}

export interface Planner {
    id: string;
    code: string;
    name: string;
    customerId: string;
    customer: string;
    cycle: string;
    lineItems: LineItem[];
    itemCount: number;
    status: "active" | "inactive";
    lastBillingDate?: string;
    nextBillingDate?: string;
}

interface PlannerFormModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onPlannerCreated?: (planner: Planner) => void;
    onPlannerUpdated?: (planner: Planner) => void;
    editPlanner?: Planner | null;
    existingPlanners: Planner[];
    customers: Customer[];
    plannerNames?: string[];
    plannerTemplates?: PlannerTemplate[];
    onTemplateCreated?: (template: PlannerTemplate) => void;
}

const customerIdRegex = /^C\d{2}-(0[1-9]|1[0-2])-\d{4}$/;

const plannerSchema = z.object({
    code: z.string().trim().min(1, "Planner code required").max(50),
    name: z.string().trim().min(1, "Planner name required").max(100),
    cycle: z.enum(["monthly", "quarterly", "half-yearly", "yearly"]),
});

const emptyItem = (): LineItem => ({
    id: Date.now().toString() + Math.random(),
    itemName: "",
    description: "",
    qty: 1,
    rate: 0,
});

export function PlannerFormModal({
    open,
    onOpenChange,
    onPlannerCreated,
    onPlannerUpdated,
    editPlanner,
    existingPlanners,
    customers,
    plannerNames = [],
    plannerTemplates = [],
    onTemplateCreated,
}: PlannerFormModalProps) {
    const [formData, setFormData] = useState({
        code: "",
        name: "",
        customerId: "",
        cycle: "monthly",
    });
    const [lineItems, setLineItems] = useState<LineItem[]>([emptyItem()]);
    const [initialSnapshot, setInitialSnapshot] = useState<string>("");
    const [nameOpen, setNameOpen] = useState(false);
    const [nameSearch, setNameSearch] = useState("");
    // True when the current planner name matches an existing planner — code is then
    // pulled from the existing record and locked to prevent duplicates.
    const [codeLocked, setCodeLocked] = useState(false);

    // Auto-generate next planner code in PLN-NNN format
    const generateNextCode = () => {
        let max = 0;
        existingPlanners.forEach((p) => {
            const m = /^PLN-(\d+)$/i.exec(p.code || "");
            if (m) max = Math.max(max, parseInt(m[1], 10));
        });
        return `PLN-${String(max + 1).padStart(3, "0")}`;
    };

    useEffect(() => {
        if (open) {
            if (editPlanner) {
                const data = {
                    code: editPlanner.code,
                    name: editPlanner.name,
                    customerId: editPlanner.customerId || "",
                    cycle: (editPlanner.cycle || "monthly").toLowerCase(),
                };
                setFormData(data);
                const items = editPlanner.lineItems?.length ? editPlanner.lineItems : [emptyItem()];
                setLineItems(items);
                setInitialSnapshot(JSON.stringify({ ...data, items }));
                setCodeLocked(true);
            } else {
                const data = { code: generateNextCode(), name: "", customerId: "", cycle: "monthly" };
                setFormData(data);
                setLineItems([emptyItem()]);
                setInitialSnapshot("");
                setCodeLocked(true);
            }
            setNameSearch("");
        }
    }, [open, editPlanner]);

    const safeNames = useMemo(() => {
        const set = new Set<string>();
        (plannerNames || []).forEach((n) => n && set.add(n));
        (plannerTemplates || []).forEach((t) => t?.name && set.add(t.name));
        if (formData.name) set.add(formData.name);
        return Array.from(set);
    }, [plannerNames, plannerTemplates, formData.name]);

    const trimmedSearch = nameSearch.trim();
    const lowerNames = useMemo(() => safeNames.map((n) => n.toLowerCase()), [safeNames]);
    const showCreate =
        trimmedSearch.length > 0 && !lowerNames.includes(trimmedSearch.toLowerCase());

    const selectName = (name: string) => {
        const trimmed = name.trim();
        if (!trimmed) return;

        // If an existing planner already uses this name, reuse its code/items
        // instead of letting the user generate a new (potentially duplicate) one.
        // Skip this when editing — editing should not mutate the planner being edited.
        const existing = !editPlanner
            ? existingPlanners.find((p) => p.name.toLowerCase() === trimmed.toLowerCase())
            : undefined;

        if (existing) {
            // If the user selects an existing name, prepopulate the cycle but NOT the items
            // each purchase is unique.
            setFormData({
                code: existing.code,
                name: existing.name,
                customerId: formData.customerId,
                cycle: (existing.cycle || "monthly").toLowerCase(),
            });
            setCodeLocked(true);
            toast.info(`Using product code from existing product "${existing.name}"`);
        } else {
            setFormData((f) => ({ ...f, name: trimmed }));
            setCodeLocked(true);
        }

        setNameOpen(false);
        setNameSearch("");
    };

    const createNewName = () => {
        const trimmed = trimmedSearch;
        if (!trimmed) return;
        // Planner names are global and reusable. If it already exists, reuse it.
        if (lowerNames.includes(trimmed.toLowerCase())) {
            selectName(trimmed);
            return;
        }
        onTemplateCreated?.({ name: trimmed });
        selectName(trimmed);
        toast.success(`Created planner name "${trimmed}"`);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const parsed = plannerSchema.safeParse(formData);
        if (!parsed.success) {
            toast.error(parsed.error.issues[0].message);
            return;
        }

        // Planners are GLOBAL — the same code/name can be reused across customers.
        // No uniqueness enforcement on planner code.

        if (lineItems.length === 0) {
            toast.error("At least one line item required");
            return;
        }
        for (const item of lineItems) {
            if (!item.itemName.trim()) return toast.error("Item name required for all rows");
            if (item.qty <= 0) return toast.error("Quantity must be greater than 0");
            if (item.rate <= 0) return toast.error("Rate must be greater than 0");
        }

        if (editPlanner) {
            const current = JSON.stringify({ ...formData, items: lineItems });
            if (current === initialSnapshot) {
                toast.info("No changes detected");
                return;
            }
        }

        const customerObj = customers.find((c) => c.customerId === formData.customerId);
        if (!formData.customerId || !customerObj) {
            toast.error("Please select a customer");
            return;
        }

        const planner: Planner = {
            id: editPlanner?.id || Date.now().toString(),
            code: formData.code.trim(),
            name: formData.name.trim(),
            customerId: formData.customerId,
            customer: customerObj.name,
            cycle: formData.cycle,
            lineItems,
            itemCount: lineItems.length,
            status: editPlanner?.status || "active",
            lastBillingDate: editPlanner?.lastBillingDate,
            nextBillingDate: editPlanner?.nextBillingDate,
        };

        if (editPlanner) {
            onPlannerUpdated?.(planner);
            toast.success("Planner updated successfully!");
        } else {
            onPlannerCreated?.(planner);
            toast.success("Planner created successfully!");
        }
        onOpenChange(false);
    };

    const addLineItem = () => setLineItems([...lineItems, emptyItem()]);
    const removeLineItem = (id: string) => {
        if (lineItems.length > 1) setLineItems(lineItems.filter((i) => i.id !== id));
    };
    const updateLineItem = (id: string, field: keyof LineItem, value: string | number) => {
        setLineItems(lineItems.map((i) => (i.id === id ? { ...i, [field]: value } : i)));
    };

    const isValid =
        formData.code.trim() &&
        formData.name.trim() &&
        formData.customerId &&
        formData.cycle &&
        lineItems.every((i) => i.itemName.trim() && i.qty > 0 && i.rate > 0);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{editPlanner ? "Edit Planner" : "Create Planner"}</DialogTitle>
                    <DialogDescription>Define a recurring billing template for your customer</DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="code">Planner Code *</Label>
                            <Input
                                id="code"
                                value={formData.code}
                                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                                placeholder="B02AA"
                                required
                                readOnly={codeLocked}
                                className={codeLocked ? "bg-muted cursor-not-allowed" : ""}
                            />
                            {codeLocked && (
                                <p className="text-xs text-muted-foreground">
                                    Auto-generated. Read-only and never editable.
                                </p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label>Planner Name *</Label>
                            <Popover open={nameOpen} onOpenChange={setNameOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={nameOpen}
                                        className="w-full justify-between font-normal"
                                    >
                                        <span className={cn(!formData.name && "text-muted-foreground")}>
                                            {formData.name || "Select or type to create..."}
                                        </span>
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                                    <Command shouldFilter={true}>
                                        <CommandInput
                                            placeholder="Search or type new name..."
                                            value={nameSearch}
                                            onValueChange={setNameSearch}
                                        />
                                        <CommandList>
                                            <CommandEmpty>
                                                {trimmedSearch ? (
                                                    <button
                                                        type="button"
                                                        onClick={createNewName}
                                                        className="w-full text-left px-2 py-1.5 text-sm hover:bg-accent rounded-sm"
                                                    >
                                                        + Create "{trimmedSearch}"
                                                    </button>
                                                ) : (
                                                    <span className="text-sm text-muted-foreground">No names found</span>
                                                )}
                                            </CommandEmpty>
                                            {safeNames.length > 0 && (
                                                <CommandGroup heading="Existing">
                                                    {safeNames.map((n) => (
                                                        <CommandItem key={n} value={n} onSelect={() => selectName(n)}>
                                                            <Check
                                                                className={cn(
                                                                    "mr-2 h-4 w-4",
                                                                    formData.name === n ? "opacity-100" : "opacity-0"
                                                                )}
                                                            />
                                                            {n}
                                                        </CommandItem>
                                                    ))}
                                                </CommandGroup>
                                            )}
                                            {showCreate && (
                                                <CommandGroup heading="Create new">
                                                    <CommandItem value={`__create__${trimmedSearch}`} onSelect={createNewName}>
                                                        <Plus className="mr-2 h-4 w-4" />
                                                        Create "{trimmedSearch}"
                                                    </CommandItem>
                                                </CommandGroup>
                                            )}
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </div>



                        <div className="space-y-2">
                            <Label htmlFor="customer">Customer *</Label>
                            <Select
                                value={formData.customerId}
                                onValueChange={(v) => setFormData({ ...formData, customerId: v })}
                            >
                                <SelectTrigger id="customer">
                                    <SelectValue placeholder="Select customer" />
                                </SelectTrigger>
                                <SelectContent>
                                    {customers.map((c) => (
                                        <SelectItem key={c.id} value={c.customerId}>
                                            {c.name} ({c.customerId})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="cycle">Billing Cycle *</Label>
                            <Select value={formData.cycle} onValueChange={(v) => setFormData({ ...formData, cycle: v })}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="monthly">Monthly</SelectItem>
                                    <SelectItem value="quarterly">Quarterly</SelectItem>
                                    <SelectItem value="half-yearly">Half-Yearly</SelectItem>
                                    <SelectItem value="yearly">Yearly</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <Label className="text-base">Fixed Line Items</Label>
                            <Button type="button" size="sm" onClick={addLineItem}>
                                <Plus className="h-4 w-4 mr-1" />
                                Add Item
                            </Button>
                        </div>

                        <div className="space-y-3">
                            {lineItems.map((item) => (
                                <div key={item.id} className="grid grid-cols-12 gap-2 p-3 border rounded-lg bg-muted/30">
                                    <div className="col-span-3">
                                        <Input
                                            placeholder="Item Name"
                                            value={item.itemName}
                                            onChange={(e) => updateLineItem(item.id, "itemName", e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div className="col-span-4">
                                        <Input
                                            placeholder="Description"
                                            value={item.description}
                                            onChange={(e) => updateLineItem(item.id, "description", e.target.value)}
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <Input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            placeholder="Rate"
                                            value={item.rate || ""}
                                            onChange={(e) => updateLineItem(item.id, "rate", parseFloat(e.target.value) || 0)}
                                            required
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <Input
                                            type="number"
                                            min="0"
                                            placeholder="Quantity"
                                            value={item.qty || ""}
                                            onChange={(e) => updateLineItem(item.id, "qty", parseFloat(e.target.value) || 0)}
                                            required
                                        />
                                    </div>
                                    <div className="col-span-1 flex items-center justify-center">
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => removeLineItem(item.id)}
                                            disabled={lineItems.length === 1}
                                        >
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={!isValid}>
                            {editPlanner ? "Update Planner" : "Create Planner"}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}

import { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Copy } from "lucide-react";
import { toast } from "sonner";
import { PlannerFormModal, Planner, PlannerTemplate } from "@/components/planners/PlannerFormModal";

interface Customer {
    id: string;
    customerId: string;
    name: string;
}

interface InvoiceLineItem {
    qty?: number;
}

interface Invoice {
    id: string;
    customerId?: string;
    customer?: string;
    issueDate: string;
    lineItems?: InvoiceLineItem[];
}

const cycleLabel: Record<string, string> = {
    monthly: "Monthly",
    quarterly: "Quarterly",
    "half-yearly": "Half-Yearly",
    yearly: "Yearly",
};

export default function Planners() {
    const [showModal, setShowModal] = useState(false);
    const [editPlanner, setEditPlanner] = useState<Planner | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<Planner | null>(null);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [invoices, setInvoices] = useState<Invoice[]>([]);

    const [planners, setPlanners] = useState<Planner[]>(() => {
        const saved = localStorage.getItem("planners");
        if (saved) return JSON.parse(saved);
        return [
            {
                id: "1",
                code: "B02AA",
                name: "IT & Cloud Support",
                cycle: "monthly",
                lineItems: [
                    { id: "i1", itemName: "Support Fee", description: "Monthly support", qty: 1, rate: 2000 },
                ],
                itemCount: 1,
                status: "active",
            },
        ];
    });

    useEffect(() => {
        localStorage.setItem("planners", JSON.stringify(planners));
    }, [planners]);

    const [plannerTemplates, setPlannerTemplates] = useState<PlannerTemplate[]>(() => {
        const saved = localStorage.getItem("plannerTemplates");
        return saved ? JSON.parse(saved) : [];
    });

    useEffect(() => {
        localStorage.setItem("plannerTemplates", JSON.stringify(plannerTemplates));
    }, [plannerTemplates]);

    const handleTemplateCreated = (t: PlannerTemplate) => {
        setPlannerTemplates((prev) => {
            if (prev.some((p) => p.name.toLowerCase() === t.name.toLowerCase())) return prev;
            return [...prev, t];
        });
    };

    useEffect(() => {
        const reload = () => {
            const c = localStorage.getItem("customers");
            const i = localStorage.getItem("invoices");
            if (c) setCustomers(JSON.parse(c));
            if (i) setInvoices(JSON.parse(i));
        };
        reload();
        window.addEventListener("storage", reload);
        return () => window.removeEventListener("storage", reload);
    }, []);

    const plannerNames = useMemo(
        () => Array.from(new Set(planners.map((p) => p.name).filter(Boolean))),
        [planners]
    );

    // Count usage items per customer (current month) for "Items" column
    const usageCountByCustomer = useMemo(() => {
        const map = new Map<string, number>();
        const now = new Date();
        invoices.forEach((inv) => {
            const d = new Date(inv.issueDate);
            if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) {
                const key = inv.customerId || inv.customer || "";
                if (!key) return;
                map.set(key, (map.get(key) || 0) + (inv.lineItems?.length || 0));
            }
        });
        return map;
    }, [invoices]);

    const handleCreate = (p: Planner) => setPlanners([p, ...planners]);
    const handleUpdate = (p: Planner) =>
        setPlanners(planners.map((x) => (x.id === p.id ? p : x)));

    const handleClone = (p: Planner) => {
        const newCode = `${p.code}-COPY-${Date.now().toString().slice(-4)}`;
        const clone: Planner = {
            ...p,
            id: Date.now().toString(),
            code: newCode,
            lineItems: p.lineItems.map((i) => ({ ...i, id: Date.now().toString() + Math.random() })),
        };
        setPlanners([clone, ...planners]);
        toast.success(`Cloned planner as ${newCode}`);
    };

    const confirmDelete = () => {
        if (!deleteTarget) return;
        setPlanners(planners.filter((p) => p.id !== deleteTarget.id));
        toast.success(`Deleted planner: ${deleteTarget.name}`);
        setDeleteTarget(null);
    };

    const openEdit = (p: Planner) => {
        setEditPlanner(p);
        setShowModal(true);
    };

    const handleModalChange = (open: boolean) => {
        setShowModal(open);
        if (!open) setEditPlanner(null);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-foreground">Planner Management</h1>
                    <p className="text-muted-foreground">
                        Create hybrid billing templates — fixed items + dynamic usage
                    </p>
                </div>
                <Button className="bg-primary hover:bg-primary/90" onClick={() => setShowModal(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Planner
                </Button>
            </div>

            <Card className="shadow-md">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="border-b border-border bg-muted/30">
                            <tr>
                                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Customer</th>
                                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Name</th>
                                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Billing Cycle</th>
                                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Status</th>
                                <th className="px-6 py-4 text-right text-sm font-semibold text-foreground">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {planners.map((planner) => {
                                return (
                                    <tr key={planner.id} className="hover:bg-muted/20 transition-colors">
                                        <td className="px-6 py-4 text-sm text-foreground font-medium">
                                            {planner.customer || customers.find((c) => c.customerId === planner.customerId)?.name || <span className="text-muted-foreground italic">—</span>}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-foreground">{planner.name}</td>
                                        <td className="px-6 py-4 text-sm text-muted-foreground">
                                            {cycleLabel[planner.cycle] || planner.cycle}
                                        </td>
                                        <td className="px-6 py-4">
                                            <Badge
                                                className={
                                                    planner.status === "active"
                                                        ? "bg-success/10 text-success hover:bg-success/20"
                                                        : "bg-muted text-muted-foreground"
                                                }
                                            >
                                                {planner.status}
                                            </Badge>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button variant="ghost" size="icon" title="Clone planner" onClick={() => handleClone(planner)}>
                                                    <Copy className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" title="Edit" onClick={() => openEdit(planner)}>
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" title="Delete" onClick={() => setDeleteTarget(planner)}>
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {planners.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-sm text-muted-foreground">
                                        No planners yet. Create your first one.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            <PlannerFormModal
                open={showModal}
                onOpenChange={handleModalChange}
                onPlannerCreated={handleCreate}
                onPlannerUpdated={handleUpdate}
                editPlanner={editPlanner}
                existingPlanners={planners}
                customers={customers}
                plannerNames={plannerNames}
                plannerTemplates={plannerTemplates}
                onTemplateCreated={handleTemplateCreated}
            />

            <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Planner?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete planner "{deleteTarget?.name}" ({deleteTarget?.code}). This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

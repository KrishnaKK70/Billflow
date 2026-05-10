import { StatCard } from "@/components/dashboard/StatCard";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DollarSign, FileText, Users, TrendingUp, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function Dashboard() {
    const navigate = useNavigate();

    const recentInvoices = [
        { id: "B02-11-2025", customer: "Vivek Go Green Construction", amount: "₹6,790", status: "unpaid", date: "2025-11-01" },
        { id: "B01-11-2025", customer: "TechStart Industries", amount: "₹12,500", status: "paid", date: "2025-11-05" },
        { id: "B03-10-2025", customer: "Green Valley Enterprises", amount: "₹8,900", status: "partial", date: "2025-10-28" },
    ];

    const getStatusColor = (status: string) => {
        switch (status) {
            case "paid":
                return "bg-success/10 text-success hover:bg-success/20";
            case "partial":
                return "bg-warning/10 text-warning hover:bg-warning/20";
            case "unpaid":
                return "bg-destructive/10 text-destructive hover:bg-destructive/20";
            default:
                return "bg-muted text-muted-foreground";
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
                    <p className="text-muted-foreground">Overview of your billing system</p>
                </div>
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="outline" className="text-destructive border-destructive/40 hover:bg-destructive/10">
                            <Trash2 className="h-4 w-4 mr-2" />
                            Clear All Data
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Clear ALL data?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This permanently deletes all invoices, payments, customers, planners,
                                and ledger history from this device. This cannot be undone.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={() => {
                                    [
                                        "invoices",
                                        "payments",
                                        "customers",
                                        "planners",
                                        "plannerTemplates",
                                        "invoices_migrated_v3",
                                        "invoiceSendSettings",
                                    ].forEach((k) => localStorage.removeItem(k));
                                    toast.success("All data cleared. Reloading…");
                                    setTimeout(() => window.location.reload(), 600);
                                }}
                            >
                                Yes, clear everything
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                <StatCard
                    title="Total Revenue"
                    value="₹2,45,890"
                    icon={DollarSign}
                    trend={{ value: "12.5%", positive: true }}
                />
                <StatCard
                    title="Outstanding"
                    value="₹45,230"
                    icon={TrendingUp}
                    trend={{ value: "8.2%", positive: false }}
                />
                <StatCard
                    title="Active Customers"
                    value="24"
                    icon={Users}
                    trend={{ value: "3 new", positive: true }}
                />
                <StatCard
                    title="Invoices"
                    value="156"
                    icon={FileText}
                    trend={{ value: "18 this month", positive: true }}
                />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                <Card className="p-6 shadow-md">
                    <h3 className="text-lg font-semibold text-foreground mb-4">Recent Invoices</h3>
                    <div className="space-y-4">
                        {recentInvoices.map((invoice) => (
                            <div key={invoice.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                                <div className="space-y-1">
                                    <p className="font-medium text-foreground">{invoice.id}</p>
                                    <p className="text-sm text-muted-foreground">{invoice.customer}</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <p className="font-semibold text-foreground">{invoice.amount}</p>
                                    <Badge className={getStatusColor(invoice.status)}>
                                        {invoice.status}
                                    </Badge>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>

                <Card className="p-6 shadow-md">
                    <h3 className="text-lg font-semibold text-foreground mb-4">Quick Actions</h3>
                    <div className="grid gap-3">
                        <Button
                            className="flex items-center justify-start gap-3 p-4 h-auto bg-primary text-primary-foreground hover:bg-primary/90"
                            onClick={() => {
                                navigate('/invoices');
                                toast.success('Navigating to create invoice');
                            }}
                        >
                            <FileText className="h-5 w-5" />
                            <span className="font-medium">Create New Invoice</span>
                        </Button>
                        <Button
                            className="flex items-center justify-start gap-3 p-4 h-auto"
                            variant="secondary"
                            onClick={() => {
                                navigate('/customers');
                                toast.success('Navigating to add customer');
                            }}
                        >
                            <Users className="h-5 w-5" />
                            <span className="font-medium">Add New Customer</span>
                        </Button>
                        <Button
                            className="flex items-center justify-start gap-3 p-4 h-auto"
                            variant="secondary"
                            onClick={() => {
                                navigate('/payments');
                                toast.success('Navigating to record payment');
                            }}
                        >
                            <DollarSign className="h-5 w-5" />
                            <span className="font-medium">Record Payment</span>
                        </Button>
                    </div>
                </Card>
            </div>
        </div>
    );
}

import { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Plus, Pencil, Trash2, Search, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { CustomerFormModal } from "@/components/customers/CustomerFormModal";
import { getCustomerOutstanding, loadInvoices, loadPayments } from "@/utils/paymentAllocation";

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
    gst?: string;
}

export default function Customers() {
    const [showModal, setShowModal] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
    const [customers, setCustomers] = useState<Customer[]>(() => {
        const saved = localStorage.getItem('customers');
        if (saved) {
            return JSON.parse(saved);
        }
        return [
            {
                id: "1",
                customerId: "B02",
                name: "Vivek Go Green Construction Pvt Ltd",
                contactName: "Mr. Vivek Sharma",
                email: "vivek@vggconstruction.com",
                phone: "+91 9876543210",
                outstanding: 2000,
                status: "active",
            },
            {
                id: "2",
                customerId: "B01",
                name: "TechStart Industries",
                contactName: "Ms. Priya Desai",
                email: "priya@techstart.com",
                phone: "+91 9988776655",
                outstanding: 0,
                status: "active",
            },
        ];
    });

    useEffect(() => {
        localStorage.setItem('customers', JSON.stringify(customers));
    }, [customers]);



    const handleEdit = (customer: Customer) => {
        setEditingCustomer(customer);
        setShowModal(true);
    };

    const handleDelete = (customer: Customer) => {
        if (window.confirm(`Are you sure you want to delete ${customer.name}?`)) {
            setCustomers(customers.filter(c => c.id !== customer.id));
            toast.success(`Customer "${customer.name}" deleted successfully`);
        }
    };

    const handleCustomerUpdated = (updatedCustomer: Customer) => {
        setCustomers(customers.map(c => c.id === updatedCustomer.id ? updatedCustomer : c));
        setEditingCustomer(null);
    };

    const liveOutstanding = useMemo(() => {
        const invs = loadInvoices();
        const pays = loadPayments();
        const map: Record<string, number> = {};
        customers.forEach((c) => {
            map[c.id] = getCustomerOutstanding(c.customerId, c.name, invs, pays);
        });
        return map;
    }, [customers]);

    const sendWhatsAppReminder = (customer: Customer) => {
        const outstanding = liveOutstanding[customer.id] || 0;
        if (outstanding <= 0) {
            toast.error("No outstanding balance — reminder not sent.");
            return;
        }
        if (customer.lastReminderSent) {
            const last = new Date(customer.lastReminderSent).getTime();
            if (Date.now() - last < 7 * 24 * 60 * 60 * 1000) {
                toast.error("Reminder already sent within the last 7 days.");
                return;
            }
        }
        const msg = `Hello ${customer.name}, your outstanding balance is ₹${outstanding.toLocaleString()}. Please clear pending invoices.`;
        const phone = (customer.phone || "").replace(/\D/g, "");
        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank");
        const today = new Date().toISOString().split("T")[0];
        setCustomers(customers.map((c) => (c.id === customer.id ? { ...c, lastReminderSent: today } : c)));
        toast.success("WhatsApp reminder opened.");
    };

    const handleModalClose = (open: boolean) => {
        setShowModal(open);
        if (!open) {
            setEditingCustomer(null);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-foreground">Customer Management</h1>
                    <p className="text-muted-foreground">Manage customer profiles and track outstanding balances</p>
                </div>
                <Button
                    className="bg-primary hover:bg-primary/90"
                    onClick={() => setShowModal(true)}
                >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Customer
                </Button>
            </div>

            <Card className="p-4 shadow-md">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        placeholder="Search customers..."
                        className="pl-10"
                    />
                </div>
            </Card>

            <Card className="shadow-md">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="border-b border-border bg-muted/30">
                            <tr>
                                <th className="code-column px-6 py-4 text-left text-sm font-semibold text-foreground">Customer ID</th>
                                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Company Name</th>
                                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Contact</th>
                                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Email</th>
                                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Outstanding</th>
                                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Status</th>
                                <th className="px-6 py-4 text-right text-sm font-semibold text-foreground">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {customers.map((customer) => (
                                <tr key={customer.id} className="hover:bg-muted/20 transition-colors">
                                    <td className="code-column px-6 py-4 text-sm font-medium text-foreground">{customer.customerId}</td>
                                    <td className="px-6 py-4 text-sm text-foreground">{customer.name}</td>
                                    <td className="px-6 py-4 text-sm text-muted-foreground">{customer.contactName}</td>
                                    <td className="px-6 py-4 text-sm text-muted-foreground">{customer.email}</td>
                                    <td className="px-6 py-4">
                                        <span className={`text-sm font-semibold ${customer.outstanding > 0 ? 'text-destructive' : 'text-success'}`}>
                                            ₹{customer.outstanding.toLocaleString()}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <Badge className={customer.status === "active" ? "bg-success/10 text-success hover:bg-success/20" : "bg-muted text-muted-foreground"}>
                                            {customer.status}
                                        </Badge>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleEdit(customer)}
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleDelete(customer)}
                                            >
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>

            <CustomerFormModal
                open={showModal}
                onOpenChange={handleModalClose}
                onCustomerCreated={(customer) => setCustomers([customer, ...customers])}
                onCustomerUpdated={handleCustomerUpdated}
                editCustomer={editingCustomer}
                existingCustomers={customers}
            />
        </div>
    );
}

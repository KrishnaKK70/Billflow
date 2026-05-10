import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

interface Payment {
    id: string;
    invoiceNumber: string;
    customerId?: string;
    customer: string;
    amount: number;
    date: string;
    mode: string;
    reference?: string;
    allocations?: any[];
    onAccount?: boolean;
}

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    editingPayment: Payment | null;
    onPaymentRecorded: (payment: Payment) => void;
    onPaymentUpdated: (payment: Payment) => void;
}

const formSchema = z.object({
    customerId: z.string().min(1, "Customer is required"),
    amount: z.coerce.number().min(0.01, "Amount must be greater than 0"),
    date: z.string().min(1, "Date is required"),
    mode: z.string().min(1, "Mode is required"),
    reference: z.string().optional(),
});

export function PaymentFormModal({ open, onOpenChange, editingPayment, onPaymentRecorded, onPaymentUpdated }: Props) {
    const [customers, setCustomers] = useState<any[]>([]);

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            customerId: "",
            amount: 0,
            date: new Date().toISOString().split("T")[0],
            mode: "Bank Transfer",
            reference: "",
        },
    });

    useEffect(() => {
        if (open) {
            setCustomers(JSON.parse(localStorage.getItem("customers") || "[]"));
            if (editingPayment) {
                form.reset({
                    customerId: editingPayment.customerId || "",
                    amount: editingPayment.amount,
                    date: editingPayment.date,
                    mode: editingPayment.mode,
                    reference: editingPayment.reference || "",
                });
            } else {
                form.reset({
                    customerId: "",
                    amount: 0,
                    date: new Date().toISOString().split("T")[0],
                    mode: "Bank Transfer",
                    reference: "",
                });
            }
        }
    }, [open, editingPayment, form]);

    const onSubmit = (values: z.infer<typeof formSchema>) => {
        const customer = customers.find(c => c.id === values.customerId);
        if (!customer) return;

        const payment: Payment = {
            id: editingPayment ? editingPayment.id : crypto.randomUUID(),
            invoiceNumber: editingPayment?.invoiceNumber || "",
            customerId: customer.id,
            customer: customer.name || customer.customerName,
            amount: values.amount,
            date: values.date,
            mode: values.mode,
            reference: values.reference,
            allocations: editingPayment?.allocations || [],
            onAccount: editingPayment ? editingPayment.onAccount : true,
        };

        if (editingPayment) {
            onPaymentUpdated(payment);
        } else {
            onPaymentRecorded(payment);
        }
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{editingPayment ? "Edit Payment" : "Record Payment"}</DialogTitle>
                    <DialogDescription>
                        {editingPayment ? "Update the details of the selected payment." : "Enter details for the new payment."}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="customerId">Customer</Label>
                        <Select
                            value={form.watch("customerId")}
                            onValueChange={(value) => form.setValue("customerId", value)}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select a customer" />
                            </SelectTrigger>
                            <SelectContent className="z-[9999]">
                                {customers.map((c) => (
                                    <SelectItem key={c.id} value={c.id}>
                                        {c.name || c.customerName}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {form.formState.errors.customerId && (
                            <p className="text-xs text-destructive">{form.formState.errors.customerId.message}</p>
                        )}
                    </div>
                    
                    <div className="space-y-2">
                        <Label htmlFor="amount">Amount</Label>
                        <Input
                            id="amount"
                            type="number"
                            step="0.01"
                            {...form.register("amount")}
                        />
                        {form.formState.errors.amount && (
                            <p className="text-xs text-destructive">{form.formState.errors.amount.message}</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="date">Date</Label>
                        <Input
                            id="date"
                            type="date"
                            {...form.register("date")}
                        />
                        {form.formState.errors.date && (
                            <p className="text-xs text-destructive">{form.formState.errors.date.message}</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="mode">Payment Mode</Label>
                        <Select
                            value={form.watch("mode")}
                            onValueChange={(value) => form.setValue("mode", value)}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select mode" />
                            </SelectTrigger>
                            <SelectContent className="z-[9999]">
                                <SelectItem value="Cash">Cash</SelectItem>
                                <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                                <SelectItem value="Cheque">Cheque</SelectItem>
                                <SelectItem value="UPI">UPI</SelectItem>
                            </SelectContent>
                        </Select>
                        {form.formState.errors.mode && (
                            <p className="text-xs text-destructive">{form.formState.errors.mode.message}</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="reference">Reference (Optional)</Label>
                        <Input
                            id="reference"
                            placeholder="Transaction ID, Cheque No, etc."
                            {...form.register("reference")}
                        />
                    </div>

                    <div className="flex justify-end pt-4">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="mr-2">
                            Cancel
                        </Button>
                        <Button type="submit">
                            {editingPayment ? "Save Changes" : "Record Payment"}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}

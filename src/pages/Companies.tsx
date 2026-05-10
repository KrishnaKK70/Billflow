import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { CompanyFormModal } from "@/components/companies/CompanyFormModal";

interface Company {
    id: string;
    companyId: string;
    name: string;
    email: string;
    phone: string;
    pan?: string;
    gst?: string;
    hasPan: boolean;
    hasGst: boolean;
    isDefault: boolean;
}

export default function Companies() {
    const [showModal, setShowModal] = useState(false);
    const [editingCompany, setEditingCompany] = useState<Company | null>(null);
    const [companies, setCompanies] = useState<Company[]>(() => {
        const saved = localStorage.getItem('companies');
        if (saved) {
            return JSON.parse(saved);
        }
        return [
            {
                id: "1",
                companyId: "CO1",
                name: "TechFlow Solutions Pvt Ltd",
                email: "billing@techflow.com",
                phone: "+91 9876543210",
                hasPan: false,
                hasGst: false,
                isDefault: true,
            },
        ];
    });

    useEffect(() => {
        localStorage.setItem('companies', JSON.stringify(companies));
    }, [companies]);

    const handleEdit = (company: Company) => {
        setEditingCompany(company);
        setShowModal(true);
    };

    const handleDelete = (company: Company) => {
        if (company.isDefault) {
            toast.error("Cannot delete default company");
            return;
        }
        setCompanies(companies.filter(c => c.id !== company.id));
        toast.success(`Company "${company.name}" deleted successfully`);
    };

    const handleModalClose = (open: boolean) => {
        setShowModal(open);
        if (!open) {
            setEditingCompany(null);
        }
    };

    const handleCompanyCreated = (company: Company) => {
        if (editingCompany) {
            setCompanies(companies.map(c => c.id === editingCompany.id ? company : c));
            toast.success("Company updated successfully");
        } else {
            setCompanies([company, ...companies]);
            toast.success("Company created successfully");
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-foreground">Company Management</h1>
                    <p className="text-muted-foreground">Manage your company profiles and billing settings</p>
                </div>
                <Button
                    className="bg-primary hover:bg-primary/90"
                    onClick={() => setShowModal(true)}
                >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Company
                </Button>
            </div>

            <Card className="shadow-md">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="border-b border-border bg-muted/30">
                            <tr>
                                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Company ID</th>
                                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Name</th>
                                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Email</th>
                                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Phone</th>
                                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Status</th>
                                <th className="px-6 py-4 text-right text-sm font-semibold text-foreground">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {companies.map((company) => (
                                <tr key={company.id} className="hover:bg-muted/20 transition-colors">
                                    <td className="px-6 py-4 text-sm font-medium text-foreground">{company.companyId}</td>
                                    <td className="px-6 py-4 text-sm text-foreground">{company.name}</td>
                                    <td className="px-6 py-4 text-sm text-muted-foreground">{company.email}</td>
                                    <td className="px-6 py-4 text-sm text-muted-foreground">{company.phone}</td>
                                    <td className="px-6 py-4">
                                        {company.isDefault && (
                                            <Badge className="bg-primary/10 text-primary hover:bg-primary/20">Default</Badge>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleEdit(company)}
                                                title="Edit company"
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleDelete(company)}
                                                title="Delete company"
                                                disabled={company.isDefault}
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

            <CompanyFormModal
                open={showModal}
                onOpenChange={handleModalClose}
                onCompanyCreated={handleCompanyCreated}
                editingCompany={editingCompany}
                existingCompanies={companies}
            />
        </div>
    );
}

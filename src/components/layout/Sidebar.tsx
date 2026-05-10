import { Link, useLocation } from "react-router-dom";
import {
    LayoutDashboard,
    Building2,
    Users,
    FileText,
    CreditCard,
    Calendar,
    Receipt,
    PieChart,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Companies", href: "/companies", icon: Building2 },
    { name: "Customers", href: "/customers", icon: Users },
    { name: "Planners", href: "/planners", icon: Calendar },
    { name: "Invoices", href: "/invoices", icon: FileText },
    { name: "Payments", href: "/payments", icon: CreditCard },
    { name: "Reports", href: "/reports", icon: PieChart },
];

export function Sidebar() {
    const location = useLocation();

    return (
        <div className="flex h-screen w-64 flex-col bg-sidebar border-r border-sidebar-border">
            <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-6">
                <Receipt className="h-8 w-8 text-sidebar-foreground" />
                <span className="text-xl font-bold text-sidebar-foreground">BillFlow</span>
            </div>

            <nav className="flex-1 space-y-1 px-3 py-4">
                {navigation.map((item) => {
                    const isActive = location.pathname === item.href;
                    return (
                        <Link
                            key={item.name}
                            to={item.href}
                            className={cn(
                                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                                isActive
                                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                            )}
                        >
                            <item.icon className="h-5 w-5" />
                            {item.name}
                        </Link>
                    );
                })}
            </nav>
        </div>
    );
}

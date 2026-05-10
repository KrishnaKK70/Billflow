import { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";

interface StatCardProps {
    title: string;
    value: string;
    icon: LucideIcon;
    trend?: {
        value: string;
        positive: boolean;
    };
}

export function StatCard({ title, value, icon: Icon, trend }: StatCardProps) {
    return (
        <Card className="p-6 bg-gradient-card shadow-md hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">{title}</p>
                    <p className="text-2xl font-bold text-foreground">{value}</p>
                    {trend && (
                        <p className={`text-xs ${trend.positive ? 'text-success' : 'text-destructive'}`}>
                            {trend.positive ? '↑' : '↓'} {trend.value}
                        </p>
                    )}
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                    <Icon className="h-6 w-6 text-primary" />
                </div>
            </div>
        </Card>
    );
}

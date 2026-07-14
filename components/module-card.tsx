import type { LucideIcon } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";

type ModuleCardProps = {
  title: string;
  description: string;
  icon: LucideIcon;
  value?: string;
};

export function ModuleCard({
  title,
  description,
  icon: Icon,
  value
}: ModuleCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div className="space-y-1">
          <CardTitle className="text-sm">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-secondary text-primary">
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      {value ? (
        <CardContent>
          <p className="text-xl font-semibold">{value}</p>
        </CardContent>
      ) : null}
    </Card>
  );
}

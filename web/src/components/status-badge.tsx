import { Badge } from "@/components/ui/badge";
import { taskStatusLabel, type TaskStatus } from "@/lib/domain";
import { cn } from "@/lib/utils";

export function StatusBadge({ status }: { status: TaskStatus }) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        "border font-normal",
        status === "approved" && "bg-[#292929] text-white",
        status === "rejected" && "border-[#d9d9d9] bg-white text-[#292929]",
      )}
    >
      {taskStatusLabel(status)}
    </Badge>
  );
}

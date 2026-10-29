"use client";

import { ChevronDown, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ExportFormat } from "@/lib/export/applications-csv";

type ExportMenuProps = {
  onExport: (format: ExportFormat) => void;
  label?: string;
  disabled?: boolean;
  variant?: "outline" | "ghost";
  size?: "default" | "sm";
  side?: "top" | "bottom";
};

/** "Export" button that asks for the format: Excel or CSV. */
export function ExportMenu({
  onExport,
  label = "Export",
  disabled,
  variant = "outline",
  size = "default",
  side = "bottom",
}: ExportMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <Button variant={variant} size={size} disabled={disabled}>
          <Download aria-hidden />
          {label}
          <ChevronDown aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side={side} align="start" className="w-44">
        <DropdownMenuItem onSelect={() => onExport("xlsx")}>Excel (.xlsx)</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onExport("csv")}>CSV (.csv)</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

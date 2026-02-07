"use client";

import * as React from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import type { DateRange } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface DateRangeValue {
  from?: string;
  to?: string;
}

interface DateRangePickerProps {
  value?: DateRangeValue;
  onChange?: (range: DateRangeValue) => void;
  placeholder?: string;
  className?: string;
  align?: "start" | "center" | "end";
}

function toDateRange(value: DateRangeValue | undefined): DateRange | undefined {
  if (!value?.from && !value?.to) return undefined;
  return {
    from: value.from ? new Date(value.from + "T00:00:00") : undefined,
    to: value.to ? new Date(value.to + "T23:59:59") : undefined,
  };
}

function fromDateRange(range: DateRange | undefined): DateRangeValue {
  if (!range) return {};
  return {
    from: range.from ? format(range.from, "yyyy-MM-dd") : undefined,
    to: range.to ? format(range.to, "yyyy-MM-dd") : undefined,
  };
}

export function DateRangePicker({
  value,
  onChange,
  placeholder = "Pick a date range",
  className,
  align = "start",
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false);
  const dateRange = toDateRange(value);

  const handleSelect = (range: DateRange | undefined) => {
    const next = fromDateRange(range);
    onChange?.(next);
  };

  const label = React.useMemo(() => {
    if (dateRange?.from && dateRange?.to) {
      return `${format(dateRange.from, "LLL d, y")} – ${format(dateRange.to, "LLL d, y")}`;
    }
    if (dateRange?.from) {
      return format(dateRange.from, "LLL d, y");
    }
    return placeholder;
  }, [dateRange, placeholder]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          data-empty={!dateRange?.from && !dateRange?.to}
          className={cn(
            "w-full justify-start text-left font-normal sm:w-[280px]",
            "data-[empty=true]:text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align={align}>
        <Calendar
          mode="range"
          defaultMonth={dateRange?.from ?? new Date()}
          selected={dateRange}
          onSelect={handleSelect}
          numberOfMonths={2}
        />
      </PopoverContent>
    </Popover>
  );
}

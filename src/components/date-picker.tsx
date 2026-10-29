"use client";

import { useRef, useState } from "react";
import { CalendarDays } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatDate } from "@/lib/format";
import { parseDate } from "@/lib/import/normalize";
import { cn } from "@/lib/utils";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/** A complete value of `DateTimeInput`: "2026-10-29T14:30". */
export const isDateTime = (value: string) => ISO_DATE_TIME.test(value);

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * What people type into a date field → "2026-10-29": "29.10.2026", "29/10/2026", "2026-10-29"
 * (the same rules as spreadsheet import) or "Oct 29, 2026" as the field shows it.
 */
export function parseDateInput(text: string): string | null {
  const value = text.trim();
  if (!value || /^\d+$/.test(value)) return null;
  const numeric = parseDate(value);
  if (numeric) return numeric;
  if (!/[a-z]/i.test(value) || !/\d{4}/.test(value)) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// The calendar works with local dates; the app stores dates as "YYYY-MM-DD".
const toLocalDate = (iso: string) => {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
};
const fromLocalDate = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const textFor = (value: string) => (ISO_DATE.test(value) ? (formatDate(value) ?? value) : value);

/** Focus moved outside the field and its calendar (the calendar lives in a portal). */
function focusLeft(container: HTMLElement | null, next: EventTarget | null) {
  if (!(next instanceof Element)) return true;
  return !container?.contains(next) && !next.closest("[data-date-popover]");
}

type DateInputProps = {
  /** "YYYY-MM-DD", "" when empty, or the text as typed while it is not a date. */
  value: string;
  onValueChange: (value: string) => void;
  /** Inline editing: called on Enter, when a day is picked and when focus leaves the field. */
  onCommit?: (value: string) => void;
  /** Inline editing: Esc while the calendar is closed. */
  onCancel?: () => void;
  /** Open the calendar right away, keeping focus in the text field (inline editing). */
  defaultOpen?: boolean;
  autoFocus?: boolean;
  id?: string;
  size?: "default" | "sm";
  className?: string;
  "aria-label"?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
};

/**
 * A date you can type ("29.10.2026", "Oct 29, 2026") or pick in a calendar. Replaces the browser's
 * own date picker, which looks different in every browser and cannot be styled.
 */
export function DateInput({
  value,
  onValueChange,
  onCommit,
  onCancel,
  defaultOpen = false,
  autoFocus,
  id,
  size = "default",
  className,
  ...aria
}: DateInputProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(defaultOpen);
  // Opened with the button or Alt+Down: focus goes to the selected day for the keyboard.
  const [focusCalendar, setFocusCalendar] = useState(false);
  const [text, setText] = useState(() => textFor(value));
  const [touched, setTouched] = useState(false);
  // The value the text stands for; a different `value` prop means it was changed from outside.
  const [shown, setShown] = useState(value);
  if (value !== shown) {
    setShown(value);
    setText(textFor(value));
  }

  const parsed = parseDateInput(text);
  const invalid = touched && text.trim() !== "" && !parsed;
  const current = () => parsed ?? text.trim();

  function emit(next: string) {
    setShown(next);
    onValueChange(next);
  }

  function pick(date: Date | undefined) {
    const next = date ? fromLocalDate(date) : "";
    setText(textFor(next));
    setTouched(false);
    emit(next);
    setOpen(false);
    setFocusCalendar(false);
    if (onCommit) onCommit(next);
    else inputRef.current?.focus();
  }

  const selected = parsed ? toLocalDate(parsed) : undefined;

  return (
    <Popover
      open={open}
      // Opened for the keyboard, the calendar holds focus like a dialog (also inside another dialog,
      // which would otherwise pull focus back); opened for typing, it leaves focus in the text field.
      modal={focusCalendar}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setFocusCalendar(false);
      }}
    >
      <PopoverAnchor asChild>
        <div
          ref={containerRef}
          className={cn("relative", className)}
          onBlur={(event) => {
            if (focusLeft(containerRef.current, event.relatedTarget)) onCommit?.(current());
          }}
        >
          <Input
            ref={inputRef}
            id={id}
            autoFocus={autoFocus}
            value={text}
            placeholder="Pick a date"
            autoComplete="off"
            {...aria}
            aria-invalid={aria["aria-invalid"] || invalid || undefined}
            onBlur={() => {
              // "29.10.2026" becomes "Oct 29, 2026"; text that is not a date gets marked.
              setTouched(true);
              if (parsed) setText(textFor(parsed));
            }}
            onChange={(event) => {
              setText(event.target.value);
              setTouched(false);
              emit(parseDateInput(event.target.value) ?? event.target.value.trim());
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && onCommit) {
                event.preventDefault();
                setOpen(false);
                onCommit(current());
              } else if (event.key === "Escape" && !open && onCancel) {
                event.preventDefault();
                onCancel();
              } else if (event.key === "ArrowDown" && event.altKey) {
                event.preventDefault();
                setFocusCalendar(true);
                setOpen(true);
              }
            }}
            className={cn("pr-9", size === "sm" && "h-7 px-2 pr-8 text-xs md:text-xs")}
          />
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="Choose a date"
              onClick={() => setFocusCalendar(true)}
              className={cn(
                "absolute inset-y-0 right-0 flex items-center justify-center rounded-r-lg text-muted-foreground hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                size === "sm" ? "w-7" : "w-8",
              )}
            >
              <CalendarDays className={size === "sm" ? "size-3.5" : "size-4"} aria-hidden />
            </button>
          </PopoverTrigger>
        </div>
      </PopoverAnchor>
      <PopoverContent
        data-date-popover
        align="start"
        className="w-auto p-0"
        // Opened for inline editing, focus stays in the text field so typing goes on.
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => event.preventDefault()}
        onEscapeKeyDown={() => inputRef.current?.focus()}
        // A click on a day must not blur the text field first: that would save before the day is picked.
        onMouseDown={(event) => event.preventDefault()}
      >
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          onSelect={pick}
          weekStartsOn={1}
          autoFocus={focusCalendar}
        />
      </PopoverContent>
    </Popover>
  );
}

type DateTimeInputProps = Omit<DateInputProps, "defaultOpen"> & {
  /** "YYYY-MM-DDTHH:mm" in local time, "" when empty; the date part may be unfinished text. */
  value: string;
};

/** A date as in `DateInput` plus a time. Without a time the date counts as midnight. */
export function DateTimeInput({
  value,
  onValueChange,
  onCommit,
  onCancel,
  autoFocus,
  id,
  size = "default",
  className,
  ...aria
}: DateTimeInputProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [datePart = ""] = value.split("T");
  // The time is kept here, so an empty time stays empty on screen; only the value counts it as midnight.
  const [time, setTime] = useState(() => value.split("T")[1]?.slice(0, 5) ?? "");
  const combine = (date: string, nextTime: string) => (date ? `${date}T${nextTime || "00:00"}` : "");

  return (
    <div
      ref={containerRef}
      className={cn("flex gap-2", className)}
      onBlur={(event) => {
        if (onCommit && focusLeft(containerRef.current, event.relatedTarget)) onCommit(value);
      }}
      onKeyDown={(event) => {
        if (!onCommit && !onCancel) return;
        const target = event.target as HTMLElement;
        if (target.closest("[data-date-popover]")) return;
        if (event.key === "Enter") {
          event.preventDefault();
          onCommit?.(value);
        } else if (event.key === "Escape" && onCancel && !document.querySelector("[data-date-popover]")) {
          event.preventDefault();
          onCancel();
        }
      }}
    >
      <DateInput
        id={id}
        autoFocus={autoFocus}
        size={size}
        value={datePart}
        onValueChange={(date) => onValueChange(combine(date, time))}
        className="min-w-0 flex-1"
        {...aria}
      />
      <Input
        type="time"
        aria-label="Time"
        value={time}
        onChange={(event) => {
          setTime(event.target.value);
          onValueChange(combine(datePart, event.target.value));
        }}
        // The browser's clock picker is hidden like its calendar; the time is typed.
        className={cn(
          "w-28 shrink-0 [&::-webkit-calendar-picker-indicator]:hidden",
          size === "sm" && "h-7 w-24 px-2 text-xs md:text-xs",
        )}
      />
    </div>
  );
}

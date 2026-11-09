"use client";

import {
  createContext,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Check, Pencil } from "lucide-react";
import { DateInput } from "@/components/date-picker";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Only one field is open at a time on the page. */
const EditingContext = createContext<{
  openKey: string | null;
  setOpenKey: (key: string | null) => void;
  readOnly: boolean;
}>({
  openKey: null,
  setOpenKey: () => {},
  readOnly: false,
});

/** `readOnly` (an archived application) shows values as plain text and hides every edit control. */
export function InlineEditingProvider({
  children,
  readOnly = false,
}: {
  children: ReactNode;
  readOnly?: boolean;
}) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  // An open editor is closed when the page is hidden (<Activity>) — no half-edited field on return.
  useLayoutEffect(() => () => setOpenKey(null), []);
  return (
    <EditingContext.Provider value={{ openKey, setOpenKey, readOnly }}>{children}</EditingContext.Provider>
  );
}

/** true on a read-only page: components hide their edit and add controls. */
export function useReadOnly() {
  return useContext(EditingContext).readOnly;
}

/** Returns an error message, or null when saved. */
export type SaveResult = Promise<string | null>;

const SAVED_FLASH_MS = 1200;

/** True when focus moved outside the element (or to nothing, e.g. a click on the page). */
const leftTheGroup = (container: HTMLElement | null, next: EventTarget | null) =>
  !container || !next || !(next instanceof Node) || !container.contains(next);

function useInlineState(fieldKey: string) {
  const { openKey, setOpenKey } = useContext(EditingContext);
  const open = openKey === fieldKey;
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  // Focus returns to the value after saving or cancelling.
  useEffect(() => {
    if (wasOpen.current && !open) triggerRef.current?.focus();
    wasOpen.current = open;
  }, [open]);

  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => setSaved(false), SAVED_FLASH_MS);
    return () => clearTimeout(timer);
  }, [saved]);

  return {
    open,
    error,
    saved,
    triggerRef,
    start: () => {
      setError(null);
      setOpenKey(fieldKey);
    },
    close: () => setOpenKey(null),
    finish: () => {
      setSaved(true);
      setOpenKey(null);
    },
    setError,
  };
}

type DisplayProps = {
  label: string;
  display: ReactNode;
  ariaValue: string | null;
  emptyText: string;
  saved: boolean;
  onStart: () => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  /** When set, the value itself is a link and editing is a separate pencil button. */
  href?: string | null;
};

function Display({ label, display, ariaValue, emptyText, saved, onStart, triggerRef, href }: DisplayProps) {
  const readOnly = useReadOnly();
  const empty = ariaValue === null || ariaValue === "";
  if (readOnly) {
    return (
      <div className="flex min-h-8 items-center px-2 text-sm">
        {empty ? (
          <span className="text-muted-foreground/60">—</span>
        ) : href ? (
          <a
            href={href}
            target={href.startsWith("mailto:") ? undefined : "_blank"}
            rel="noreferrer"
            className="min-w-0 truncate underline underline-offset-4 hover:no-underline"
          >
            {display}
          </a>
        ) : (
          <span className="min-w-0 truncate">{display}</span>
        )}
      </div>
    );
  }
  const editLabel = `${label}: ${empty ? "not set" : ariaValue}. Edit`;
  // A circled check, no text: the field itself already shows the saved value.
  const savedMark = saved ? (
    <span
      role="status"
      aria-label="Saved"
      className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-status-offer-bg text-status-offer"
    >
      <Check className="size-3" aria-hidden />
    </span>
  ) : null;

  if (href && !empty) {
    return (
      <div className="flex min-h-8 items-center gap-2 px-2">
        <a
          href={href}
          target={href.startsWith("mailto:") ? undefined : "_blank"}
          rel="noreferrer"
          className="min-w-0 truncate text-sm underline underline-offset-4 hover:no-underline"
        >
          {display}
        </a>
        {savedMark}
        <button
          ref={triggerRef}
          type="button"
          onClick={onStart}
          aria-label={editLabel}
          className="ml-auto flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <Pencil className="size-3.5" aria-hidden />
        </button>
      </div>
    );
  }

  return (
    <button
      ref={triggerRef}
      type="button"
      onClick={onStart}
      aria-label={editLabel}
      className="group flex min-h-8 w-full items-center gap-2 rounded-md px-2 text-left text-sm hover:bg-muted focus-visible:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <span className={cn("min-w-0 flex-1 truncate", empty && "text-muted-foreground")}>
        {empty ? emptyText : display}
      </span>
      {savedMark}
      <Pencil
        className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
        aria-hidden
      />
    </button>
  );
}

function ErrorText({ id, error }: { id: string; error: string | null }) {
  return error ? (
    <p id={id} className="mt-1 px-2 text-xs text-destructive">
      {error}
    </p>
  ) : null;
}

type InlineFieldProps = {
  fieldKey: string;
  label: string;
  value: string | null;
  display?: ReactNode;
  emptyText: string;
  onSave: (value: string | null) => SaveResult;
  kind?: "text" | "date" | "url" | "select";
  options?: { value: string; label: string }[];
  placeholder?: string;
  maxLength?: number;
  href?: string | null;
  /** For headings: bigger text. */
  className?: string;
};

/** A simple field: Enter or leaving the field saves, Esc cancels; a select saves on change. */
export function InlineField({
  fieldKey,
  label,
  value,
  display,
  emptyText,
  onSave,
  kind = "text",
  options = [],
  placeholder,
  maxLength,
  href,
  className,
}: InlineFieldProps) {
  const state = useInlineState(fieldKey);
  const [draft, setDraft] = useState(value ?? "");
  const errorId = useId();
  const saving = useRef(false);

  async function save(next: string) {
    if (saving.current) return;
    const normalized = next.trim() === "" ? null : next;
    if (normalized === value) {
      state.close();
      return;
    }
    saving.current = true;
    const error = await onSave(normalized);
    saving.current = false;
    if (error) state.setError(error);
    else state.finish();
  }

  function start() {
    setDraft(value ?? "");
    state.start();
  }

  if (!state.open) {
    return (
      <div className={className}>
        <Display
          label={label}
          display={display ?? value}
          ariaValue={value}
          emptyText={emptyText}
          saved={state.saved}
          onStart={start}
          triggerRef={state.triggerRef}
          href={href}
        />
      </div>
    );
  }

  const common = {
    autoFocus: true,
    "aria-label": label,
    "aria-invalid": state.error ? true : undefined,
    "aria-describedby": state.error ? errorId : undefined,
    onKeyDown: (event: React.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        state.close();
      } else if (event.key === "Enter" && kind !== "select") {
        event.preventDefault();
        void save(draft);
      }
    },
  };

  return (
    <div className={cn("text-sm", className)}>
      {kind === "select" ? (
        <select
          {...common}
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            void save(event.target.value);
          }}
          onBlur={() => state.close()}
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
        >
          <option value="">Not set</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : kind === "date" ? (
        <DateInput
          autoFocus
          defaultOpen
          aria-label={label}
          aria-invalid={state.error ? true : undefined}
          aria-describedby={state.error ? errorId : undefined}
          value={draft}
          onValueChange={(next) => {
            setDraft(next);
            if (state.error) state.setError(null);
          }}
          onCommit={(next) => {
            if (next && !/^\d{4}-\d{2}-\d{2}$/.test(next)) state.setError("Enter a date like Oct 29, 2026");
            else void save(next);
          }}
          onCancel={() => state.close()}
        />
      ) : (
        <Input
          {...common}
          type={kind === "url" ? "url" : "text"}
          value={draft}
          placeholder={placeholder}
          maxLength={maxLength}
          onChange={(event) => {
            setDraft(event.target.value);
            if (state.error) state.setError(null);
          }}
          onBlur={() => void save(draft)}
          // The font comes from the wrapper, so the editor matches the value it replaces.
          className="h-8 px-2 [font-size:inherit] leading-5 font-normal"
        />
      )}
      <ErrorText id={errorId} error={state.error} />
    </div>
  );
}

type GroupPart = {
  key: string;
  label: string;
  placeholder?: string;
  inputMode?: "numeric" | "text";
  maxLength?: number;
  className?: string;
};

type InlineGroupFieldProps = {
  fieldKey: string;
  label: string;
  values: Record<string, string>;
  display: ReactNode;
  ariaValue: string | null;
  emptyText: string;
  parts: GroupPart[];
  onSave: (values: Record<string, string>) => SaveResult;
  href?: string | null;
};

/** A compound field (salary, contact): explicit "Save / Cancel". */
export function InlineGroupField({
  fieldKey,
  label,
  values,
  display,
  ariaValue,
  emptyText,
  parts,
  onSave,
  href,
}: InlineGroupFieldProps) {
  const state = useInlineState(fieldKey);
  const [draft, setDraft] = useState(values);
  const errorId = useId();
  const containerRef = useRef<HTMLDivElement>(null);

  if (!state.open) {
    return (
      <Display
        label={label}
        display={display}
        ariaValue={ariaValue}
        emptyText={emptyText}
        saved={state.saved}
        onStart={() => {
          setDraft(values);
          state.start();
        }}
        triggerRef={state.triggerRef}
        href={href}
      />
    );
  }

  async function save() {
    const error = await onSave(draft);
    if (error) state.setError(error);
    else state.finish();
  }

  return (
    <div
      ref={containerRef}
      role="group"
      aria-label={label}
      // Like every other field: Enter saves, leaving the group saves, Esc cancels. No buttons.
      onBlur={(event) => {
        if (leftTheGroup(containerRef.current, event.relatedTarget)) void save();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          state.close();
        }
      }}
      // No box or padding: the editor keeps the height of the line it replaces.
      className="grid gap-1"
    >
      <div className="flex flex-wrap gap-2">
        {parts.map((part, index) => (
          <Input
            key={part.key}
            autoFocus={index === 0}
            aria-label={part.label}
            aria-invalid={state.error ? true : undefined}
            aria-describedby={state.error ? errorId : undefined}
            placeholder={part.placeholder}
            inputMode={part.inputMode}
            maxLength={part.maxLength}
            value={draft[part.key] ?? ""}
            onChange={(event) => {
              setDraft((current) => ({ ...current, [part.key]: event.target.value }));
              if (state.error) state.setError(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void save();
              }
            }}
            className={cn("h-8 min-w-0 flex-1", part.className)}
          />
        ))}
      </div>
      <ErrorText id={errorId} error={state.error} />
    </div>
  );
}

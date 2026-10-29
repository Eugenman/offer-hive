"use client";

import { useState } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";

type SearchInputProps = {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder?: string;
};

/** Search field with an icon and a clear button. Shared by Applications and Archive. */
export function SearchInput({
  value: search,
  onChange,
  label,
  placeholder = "Company or position",
}: SearchInputProps) {
  // Local value keeps typing instant while the URL updates with a short debounce.
  const [value, setValue] = useState(search);
  const [synced, setSynced] = useState(search);
  if (search !== synced) {
    setSynced(search);
    setValue(search);
  }

  function change(next: string) {
    setValue(next);
    setSynced(next);
    onChange(next);
  }

  return (
    <div className="relative w-full max-w-64">
      <Search
        className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        type="search"
        value={value}
        onChange={(event) => change(event.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className="pr-8 pl-8 [&::-webkit-search-cancel-button]:hidden"
      />
      {value ? (
        <button
          type="button"
          onClick={() => change("")}
          aria-label="Clear search"
          className="absolute top-1/2 right-1.5 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

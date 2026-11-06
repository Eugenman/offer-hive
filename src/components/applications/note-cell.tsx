"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { MessageSquareText } from "lucide-react";
import { HoverCard } from "radix-ui";
import type { Note } from "@/lib/domain";
import { formatDate } from "@/lib/format";

const EMPTY = <span className="text-muted-foreground">—</span>;

// While the page or the table scrolls, rows slide under a still cursor: the card must not pop up.
const SCROLL_QUIET_MS = 300;
let lastScrollAt = 0;
if (typeof window !== "undefined") {
  window.addEventListener("scroll", () => (lastScrollAt = performance.now()), {
    capture: true,
    passive: true,
  });
}
const scrolling = () => performance.now() - lastScrollAt < SCROLL_QUIET_MS;

/** A note's day in the viewer's time zone. */
const noteDay = (note: Note) => formatDate(new Date(note.createdAt).toLocaleDateString("en-CA"));

/** One note, cut to a few lines; "Read more" shows the rest in place. */
function NoteText({ body }: { body: string }) {
  const text = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [cut, setCut] = useState(false);

  useLayoutEffect(() => {
    const element = text.current;
    if (element && !expanded) setCut(element.scrollHeight > element.clientHeight + 1);
  }, [body, expanded]);

  return (
    <>
      <p ref={text} className={`break-words whitespace-pre-line ${expanded ? "" : "line-clamp-6"}`}>
        {body}
      </p>
      {cut ? (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="mt-1 rounded-sm text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          {expanded ? "Show less" : "Read more"}
        </button>
      ) : null}
    </>
  );
}

/**
 * The count in the row; every note, newest first, in a card that opens on hover over the cell
 * or on click (also from the keyboard). Long notes are cut to a few lines, so all of them and the
 * lines between them stay in view; "Read more" opens one in place.
 */
export function NoteCell({ notes }: { notes: Note[] }) {
  const [open, setOpen] = useState(false);
  const content = useRef<HTMLDivElement>(null);

  // Scrolling the page or the table closes the card; scrolling inside it doesn't.
  useEffect(() => {
    if (!open) return;
    const close = (event: Event) => {
      if (!content.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("scroll", close, { capture: true, passive: true });
    return () => window.removeEventListener("scroll", close, { capture: true });
  }, [open]);

  if (notes.length === 0) return EMPTY;
  const label = notes.length === 1 ? "1 note" : `${notes.length} notes`;

  return (
    <HoverCard.Root
      open={open}
      onOpenChange={(next) => setOpen(next && scrolling() ? false : next)}
      openDelay={150}
      closeDelay={150}
    >
      <HoverCard.Trigger asChild>
        <button
          type="button"
          aria-label={label}
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          // On a kanban card a double click opens the application; here it only toggles the card.
          onDoubleClick={(event) => event.stopPropagation()}
          // The ::after layer stretches the button over the whole cell, so hovering anywhere opens the card.
          className="flex items-center gap-1.5 rounded-md text-muted-foreground after:absolute after:inset-0 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <MessageSquareText className="size-3.5 shrink-0" aria-hidden />
          <span className="text-xs tabular-nums">{notes.length}</span>
        </button>
      </HoverCard.Trigger>
      <HoverCard.Portal>
        <HoverCard.Content
          ref={content}
          side="bottom"
          align="start"
          sideOffset={6}
          collisionPadding={16}
          className="z-50 flex max-h-[min(60vh,32rem)] w-90 max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-lg bg-popover text-sm text-popover-foreground shadow-md ring-1 ring-border data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0"
        >
          <p className="border-b px-3.5 py-2 text-xs text-muted-foreground">{label}</p>
          <ol className="overflow-y-auto">
            {notes.map((note) => (
              <li key={note.id} className="border-b px-3.5 py-2.5 last:border-0">
                <p className="mb-1 text-xs text-muted-foreground">{noteDay(note)}</p>
                <NoteText body={note.body} />
              </li>
            ))}
          </ol>
        </HoverCard.Content>
      </HoverCard.Portal>
    </HoverCard.Root>
  );
}

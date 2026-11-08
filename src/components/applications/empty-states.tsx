import { BriefcaseBusiness, SearchX, Upload, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

/** No applications at all — the first thing a new user sees. */
export function NoApplications({ onAdd, onImport }: { onAdd: () => void; onImport: () => void }) {
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-xl bg-muted" aria-hidden>
        <BriefcaseBusiness className="size-6 text-muted-foreground" />
      </span>
      <h2 className="mt-4 text-base font-semibold">Start tracking your applications</h2>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Add your first application by hand, or import the spreadsheet you kept in Excel, Google Sheets or
        Numbers.
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <Button onClick={onAdd}>
          <Plus aria-hidden />
          Add application
        </Button>
        <Button variant="outline" onClick={onImport}>
          <Upload aria-hidden />
          Import spreadsheet
        </Button>
      </div>
    </div>
  );
}

/** Shown instead of the empty state while a spreadsheet is dragged over the page. */
export function DropSpreadsheet() {
  return (
    <div className="px-6 pt-6">
      <div
        className="flex flex-col items-center rounded-xl border-2 border-dashed border-primary/40 bg-muted/40 px-6 py-16 text-center"
        aria-live="polite"
      >
        <span className="flex size-12 items-center justify-center rounded-xl bg-background" aria-hidden>
          <Upload className="size-6 text-muted-foreground" />
        </span>
        <h2 className="mt-4 text-base font-semibold">Drop the spreadsheet here</h2>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Excel, LibreOffice, Numbers, CSV or TSV. The file is read in your browser and never uploaded.
        </p>
      </div>
    </div>
  );
}

/** Applications exist, but the search or filter hides all of them. */
export function NoResults({ onReset }: { onReset: () => void }) {
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-xl bg-muted" aria-hidden>
        <SearchX className="size-6 text-muted-foreground" />
      </span>
      <h2 className="mt-4 text-base font-semibold">Nothing found</h2>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">Try another search or reset the filter.</p>
      <Button variant="outline" className="mt-5" onClick={onReset}>
        Reset search and filter
      </Button>
    </div>
  );
}

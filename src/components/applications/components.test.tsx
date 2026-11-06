import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CompanyAvatar } from "./company-avatar";
import { InlineEditingProvider, InlineField } from "./detail/inline-field";
import { StatusBadge } from "./status-badge";

// Bun has no global afterEach, so React Testing Library does not clean up on its own.
afterEach(cleanup);

// A few components only: the inline field on the application page (the place where a typo costs
// the most) and two small presentational pieces the table and the kanban lean on.

const noSave = async (): Promise<string | null> => null;

describe("a field edited in place", () => {
  function renderField(props: {
    value?: string | null;
    onSave?: (value: string | null) => Promise<string | null>;
  }) {
    return render(
      <InlineEditingProvider>
        <InlineField
          fieldKey="location"
          label="Location"
          value={props.value === undefined ? "Berlin" : props.value}
          onSave={props.onSave ?? noSave}
          emptyText="Add a city"
        />
      </InlineEditingProvider>,
    );
  }

  test("shows the value and says what the edit button does", () => {
    renderField({});
    expect(screen.getByRole("button", { name: "Location: Berlin. Edit" })).toBeDefined();
  });

  test("an empty field invites a value instead of showing a dash", () => {
    renderField({ value: null });
    expect(screen.getByText("Add a city")).toBeDefined();
    expect(screen.getByRole("button", { name: "Location: not set. Edit" })).toBeDefined();
  });

  test("clicking opens the editor with the current value", () => {
    renderField({});
    fireEvent.click(screen.getByRole("button", { name: "Location: Berlin. Edit" }));

    const input = screen.getByLabelText("Location") as HTMLInputElement;
    expect(input.value).toBe("Berlin");
  });

  test("Enter saves the typed value and closes the editor", async () => {
    const saved: (string | null)[] = [];
    renderField({
      onSave: async (value) => {
        saved.push(value);
        return null;
      },
    });

    fireEvent.click(screen.getByRole("button", { name: "Location: Berlin. Edit" }));
    const input = screen.getByLabelText("Location");
    fireEvent.change(input, { target: { value: "  Munich  " } });
    fireEvent.keyDown(input, { key: "Enter" });

    // The field hands over the text as typed; the Zod schemas trim it before storage.
    await waitFor(() => expect(saved).toEqual(["  Munich  "]));
    await waitFor(() => expect(screen.queryByLabelText("Location")).toBeNull());
  });

  test("an empty edit is saved as nothing, not as spaces", async () => {
    const saved: (string | null)[] = [];
    renderField({
      onSave: async (value) => {
        saved.push(value);
        return null;
      },
    });

    fireEvent.click(screen.getByRole("button", { name: "Location: Berlin. Edit" }));
    const input = screen.getByLabelText("Location");
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => expect(saved).toEqual([null]));
  });

  test("Escape cancels and leaves the editor", () => {
    const saved: (string | null)[] = [];
    renderField({
      onSave: async (value) => {
        saved.push(value);
        return null;
      },
    });

    fireEvent.click(screen.getByRole("button", { name: "Location: Berlin. Edit" }));
    fireEvent.change(screen.getByLabelText("Location"), { target: { value: "Munich" } });
    fireEvent.keyDown(screen.getByLabelText("Location"), { key: "Escape" });

    expect(saved).toEqual([]);
    expect(screen.getByRole("button", { name: "Location: Berlin. Edit" })).toBeDefined();
  });

  test("an error from saving keeps the editor open", async () => {
    renderField({ onSave: async () => "Too long" });

    fireEvent.click(screen.getByRole("button", { name: "Location: Berlin. Edit" }));
    const input = screen.getByLabelText("Location");
    fireEvent.change(input, { target: { value: "Munich" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => expect(screen.queryByLabelText("Location")).not.toBeNull());
  });
});

describe("a status badge", () => {
  test("renders the status name", () => {
    render(<StatusBadge status="interview" />);
    expect(screen.getByText("Interview")).toBeDefined();
  });

  test("can show a custom label and a count", () => {
    render(<StatusBadge status="rejected" label="Closed" count={4} />);
    expect(screen.getByText("Closed")).toBeDefined();
    expect(screen.getByText("4")).toBeDefined();
  });
});

describe("a company avatar", () => {
  test("uses the first letter, upper case", () => {
    const { container } = render(<CompanyAvatar name="acme" />);
    expect(container.textContent).toBe("A");
  });

  test("an empty name still shows something", () => {
    const { container } = render(<CompanyAvatar name="   " />);
    expect(container.textContent).toBe("?");
  });
});

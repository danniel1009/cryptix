import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Accordion } from "../Accordion";

const items = [
  { id: "a", title: "First question", content: "First answer" },
  { id: "b", title: "Second question", content: "Second answer" },
  { id: "c", title: "Third question", content: "Third answer" },
];

describe("Accordion", () => {
  it("renders triggers inside headings with the ARIA wiring", () => {
    render(<Accordion items={items} defaultOpen={["a"]} />);
    const trigger = screen.getByRole("button", { name: "First question" });
    expect(trigger.closest("h3")).not.toBeNull();
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    const panel = screen.getByRole("region", { name: "First question" });
    expect(trigger).toHaveAttribute("aria-controls", panel.id);
    expect(panel).toHaveAttribute("aria-labelledby", trigger.id);
    expect(screen.getByRole("button", { name: "Second question" })).toHaveAttribute("aria-expanded", "false");
  });

  it("click toggles a panel open and closed", async () => {
    const onToggle = vi.fn();
    render(<Accordion items={items} onToggle={onToggle} />);
    const trigger = screen.getByRole("button", { name: "Second question" });
    expect(screen.queryByText("Second answer")).not.toBeInTheDocument();

    await userEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Second answer")).toBeInTheDocument();
    expect(onToggle).toHaveBeenLastCalledWith("b", true);

    await userEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    await waitFor(() => expect(screen.queryByText("Second answer")).not.toBeInTheDocument());
    expect(onToggle).toHaveBeenLastCalledWith("b", false);
  });

  it("single mode: opening one item closes the other", async () => {
    render(<Accordion items={items} defaultOpen={["a"]} />);
    await userEvent.click(screen.getByRole("button", { name: "Third question" }));
    expect(screen.getByRole("button", { name: "Third question" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: "First question" })).toHaveAttribute("aria-expanded", "false");
  });

  it("allowMultiple keeps several panels open", async () => {
    render(<Accordion items={items} allowMultiple defaultOpen={["a"]} />);
    await userEvent.click(screen.getByRole("button", { name: "Third question" }));
    expect(screen.getByRole("button", { name: "First question" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: "Third question" })).toHaveAttribute("aria-expanded", "true");
  });

  it("keyboard: Enter/Space toggle, arrows and Home/End move focus", async () => {
    render(<Accordion items={items} />);
    const [first, second, third] = ["First question", "Second question", "Third question"].map((name) =>
      screen.getByRole("button", { name }),
    );

    first.focus();
    await userEvent.keyboard("{Enter}");
    expect(first).toHaveAttribute("aria-expanded", "true");
    await userEvent.keyboard(" ");
    expect(first).toHaveAttribute("aria-expanded", "false");

    await userEvent.keyboard("{ArrowDown}");
    expect(second).toHaveFocus();
    await userEvent.keyboard("{ArrowDown}{ArrowDown}");
    expect(first).toHaveFocus(); // wraps
    await userEvent.keyboard("{ArrowUp}");
    expect(third).toHaveFocus(); // wraps backwards
    await userEvent.keyboard("{Home}");
    expect(first).toHaveFocus();
    await userEvent.keyboard("{End}");
    expect(third).toHaveFocus();
  });
});

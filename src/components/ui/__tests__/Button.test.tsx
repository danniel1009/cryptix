import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button } from "../Button";

describe("Button", () => {
  it("renders a <button type=button> by default and fires onClick", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Request</Button>);
    const button = screen.getByRole("button", { name: "Request" });
    expect(button.tagName).toBe("BUTTON");
    expect(button).toHaveAttribute("type", "button");
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("renders an <a> with href when href is given", () => {
    render(
      <Button href="https://wa.me/123" target="_blank" rel="noopener noreferrer" variant="whatsapp">
        Chat
      </Button>,
    );
    const link = screen.getByRole("link", { name: "Chat" });
    expect(link.tagName).toBe("A");
    expect(link).toHaveAttribute("href", "https://wa.me/123");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("disabled: native disabled attribute, click is a no-op", async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Send
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Send" });
    expect(button).toBeDisabled();
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("loading: aria-busy, disabled, spinner shown instead of the left icon", () => {
    render(
      <Button loading leftIcon={<svg data-testid="left-icon" />}>
        Sending
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Sending" });
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toBeDisabled();
    expect(screen.queryByTestId("left-icon")).not.toBeInTheDocument();
    expect(button.querySelector("svg.animate-spin")).not.toBeNull();
  });

  it("disabled anchor: no href, aria-disabled, removed from tab order", () => {
    render(
      <Button href="/x" disabled>
        Gone
      </Button>,
    );
    const el = screen.getByText("Gone").closest("a");
    expect(el).not.toBeNull();
    expect(el).not.toHaveAttribute("href");
    expect(el).toHaveAttribute("aria-disabled", "true");
    expect(el).toHaveAttribute("tabindex", "-1");
  });

  it("applies fullWidth and merges className", () => {
    render(
      <Button fullWidth className="mt-4">
        Wide
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Wide" });
    expect(button.className).toContain("w-full");
    expect(button.className).toContain("mt-4");
  });
});

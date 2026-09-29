import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { Modal } from "../Modal";

beforeAll(() => {
  // jsdom has no matchMedia; useMediaQuery falls back to its default without it,
  // but framer's useReducedMotion also probes it, so provide a stub.
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

function renderModal(open = true, onClose = vi.fn()) {
  const utils = render(
    <>
      <button type="button">Opener</button>
      <Modal open={open} onClose={onClose} title="Request Exchange" description="Indicative only" closeLabel="Close">
        <input aria-label="Amount" />
        <button type="button">Submit</button>
      </Modal>
    </>,
  );
  return { ...utils, onClose };
}

describe("Modal", () => {
  it("renders nothing when closed", () => {
    renderModal(false);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("exposes dialog semantics: role, aria-modal, labelledby/describedby, close button", () => {
    renderModal();
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleName("Request Exchange");
    expect(dialog).toHaveAccessibleDescription("Indicative only");
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
    // Portal: the dialog lives directly under document.body, outside the app root.
    expect(dialog.closest("body")).toBe(document.body);
  });

  it("Escape calls onClose", () => {
    const { onClose } = renderModal();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("clicking the backdrop calls onClose, clicking inside does not", async () => {
    const { onClose } = renderModal();
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(onClose).not.toHaveBeenCalled();
    await userEvent.click(screen.getByTestId("modal-backdrop"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("close button calls onClose", async () => {
    const { onClose } = renderModal();
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("moves focus into the dialog, traps Tab, and locks body scroll", async () => {
    const { rerender } = renderModal();
    await waitFor(() => expect(document.activeElement?.closest('[role="dialog"]')).not.toBeNull());
    expect(document.body.style.overflow).toBe("hidden");

    // Shift+Tab from the first focusable wraps to the last one inside the dialog.
    const close = screen.getByRole("button", { name: "Close" });
    const submit = screen.getByRole("button", { name: "Submit" });
    close.focus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(submit).toHaveFocus();
    // Tab from the last focusable wraps to the first.
    fireEvent.keyDown(document, { key: "Tab" });
    expect(close).toHaveFocus();

    await act(async () => {
      rerender(
        <>
          <button type="button">Opener</button>
          <Modal open={false} onClose={vi.fn()} title="Request Exchange" closeLabel="Close">
            <input aria-label="Amount" />
          </Modal>
        </>,
      );
    });
    await waitFor(() => expect(document.body.style.overflow).toBe(""));
  });
});

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Message } from "../../types";
import { MessageRow } from "../MessageRow";

/**
 * Deleting a conversation was a swipe and nothing else: a keyboard could not
 * do it and a mouse had to know to drag. The copy is mocked so the suite does
 * not depend on the message catalogues.
 */

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, string>) =>
    values?.name ? `${key}:${values.name}` : key,
}));

const message: Message = {
  id: "c1",
  name: "Nicolas Martin",
  initials: "NM",
  listing: "Canapé",
  snippet: "Bonjour",
  timestamp: "Hier",
  unread: false,
};

const button = () => screen.getByTestId("row-delete");

describe("RowDeleteButton", () => {
  it("is a real button, named for the conversation it deletes", () => {
    render(<MessageRow message={message} onDelete={vi.fn()} />);

    expect(button().tagName).toBe("BUTTON");
    expect(button()).toHaveAccessibleName("deleteNamed:Nicolas Martin");
    // Reachable by Tab: nothing takes it out of the focus order.
    expect(button()).not.toHaveAttribute("tabindex", "-1");
    expect(button()).not.toBeDisabled();
  });

  it("asks before deleting: the first press arms, the second deletes", () => {
    const onDelete = vi.fn();
    render(<MessageRow message={message} onDelete={onDelete} />);

    fireEvent.click(button());
    expect(onDelete).not.toHaveBeenCalled();
    expect(button()).toHaveAccessibleName("deleteConfirm:Nicolas Martin");
    expect(screen.getByText("deleteConfirmShort")).toBeInTheDocument();

    fireEvent.click(button());
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledWith("c1");
  });

  it("does not open the thread it sits on", () => {
    push.mockClear();
    render(<MessageRow message={message} onDelete={vi.fn()} />);

    fireEvent.click(button());
    fireEvent.click(button());

    expect(push).not.toHaveBeenCalled();
  });

  it("disarms on Escape and when focus leaves", () => {
    const onDelete = vi.fn();
    render(<MessageRow message={message} onDelete={onDelete} />);

    fireEvent.click(button());
    fireEvent.keyDown(button(), { key: "Escape" });
    expect(button()).toHaveAccessibleName("deleteNamed:Nicolas Martin");

    fireEvent.click(button());
    fireEvent.blur(button());
    fireEvent.click(button());
    expect(onDelete).not.toHaveBeenCalled();
  });

  it("is absent where a conversation cannot be deleted", () => {
    render(<MessageRow message={message} />);

    expect(screen.queryByTestId("row-delete")).not.toBeInTheDocument();
  });
});

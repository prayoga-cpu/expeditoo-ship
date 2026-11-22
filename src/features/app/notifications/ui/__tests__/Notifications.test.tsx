import { render, screen } from "@testing-library/react";
import { Bell } from "lucide-react";
import { describe, expect, it, vi } from "vitest";

import { getRelativeTime } from "../../hooks/useNotifications";
import type { Notification } from "../../types";
import { Notifications } from "../Notifications";

/**
 * `/notifications` read « All / Unread / Messages », « 3 unread
 * notifications », « 5m ago » and « Reply » to a French reader: the strings
 * were typed into the JSX. Every one now goes through next-intl, which is
 * mocked to echo its key so the suite stands on its own.
 */

const KNOWN_TYPES = new Set(["message", "payment"]);

vi.mock("next-intl", () => ({
  useTranslations: (namespace?: string) => {
    const t = (key: string, values?: Record<string, unknown>) =>
      `${namespace}.${key}${values ? `(${JSON.stringify(values)})` : ""}`;
    return Object.assign(t, { has: (key: string) => KNOWN_TYPES.has(key) });
  },
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const notification = (over: Partial<Notification> = {}): Notification =>
  ({
    id: "n1",
    type: "message",
    title: "Nouveau message",
    description: "Bonjour",
    timestamp: "il y a 5 minutes",
    read: false,
    icon: Bell,
    ...over,
  }) as Notification;

const renderList = (notifications: Notification[] = [], unreadCount = 0) =>
  render(
    <Notifications
      notifications={notifications}
      activeTab="all"
      unreadCount={unreadCount}
      unreadByType={{ all: unreadCount, message: 0 }}
      onTabChange={vi.fn()}
      onMarkAllAsRead={vi.fn()}
      onDismiss={vi.fn()}
    />
  );

describe("Notifications", () => {
  it("names its three tabs through the catalogue", () => {
    renderList();

    const tabs = screen.getAllByRole("tab").map((tab) => tab.textContent);
    expect(tabs).toEqual([
      "notifications.tabs.all",
      "notifications.tabs.unread",
      "notifications.tabs.messages",
    ]);
  });

  it("leaves no English typed into the page", () => {
    const { container } = renderList([notification()], 3);

    expect(container).not.toHaveTextContent(/\bAll\b|\bUnread\b|unread notification/);
    expect(container).toHaveTextContent('notifications.bell.unread({"count":3})');
  });

  it("labels a type the catalogue knows, and never prints a raw key for one it does not", () => {
    renderList([
      notification({ id: "a", type: "payment" }),
      notification({ id: "b", type: "brand_new_type" as Notification["type"] }),
    ]);

    expect(screen.getByText("notifications.types.payment")).toBeInTheDocument();
    expect(screen.getByText("notifications.types.other")).toBeInTheDocument();
    expect(screen.queryByText("notifications.types.brand_new_type")).toBeNull();
  });

  it("gives the dismiss button a name", () => {
    renderList([notification()]);

    expect(
      screen.getByRole("button", { name: "notifications.dismiss" })
    ).toBeInTheDocument();
  });
});

describe("getRelativeTime", () => {
  const t = (key: string, values?: { count: number }) =>
    values ? `${key}:${values.count}` : key;
  const ago = (seconds: number) => new Date(Date.now() - seconds * 1000);

  it.each([
    [10, "now"],
    [5 * 60 + 5, "minutesAgo:5"],
    [3 * 3600 + 5, "hoursAgo:3"],
    [2 * 86400 + 5, "daysAgo:2"],
  ])("%i seconds ago reads %s", (seconds, expected) => {
    expect(getRelativeTime(ago(seconds), t)).toBe(expected);
  });
});

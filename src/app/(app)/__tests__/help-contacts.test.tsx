import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { mailbox } from "@/lib/app-url";

/**
 * `/help` and `/driver/help` printed `+1 (234) 567-890` and
 * `+1 (987) 654-321` — placeholder numbers, the second one labelled as a
 * 24/7 emergency line. There is no support phone. What remains must be a
 * channel somebody answers: the support mailbox and the in-app paths.
 */

vi.mock("next-intl", () => ({
  useTranslations: (namespace?: string) => (key: string) => `${namespace}.${key}`,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/features/app/feedback/ui/FeedbackRequestCard", () => ({
  FeedbackRequestCard: () => <div data-testid="feedback-card" />,
}));
vi.mock("@/features/app/messages/api/messages.api", () => ({
  messagesApi: { createSupportChat: vi.fn() },
}));

import HelpPage from "../(main)/help/page";
import DriverHelpPage from "../driver/help/page";

const hrefs = (container: HTMLElement) =>
  Array.from(container.querySelectorAll("a"), (a) => a.getAttribute("href") ?? "");

describe.each([
  ["/help", HelpPage],
  ["/driver/help", DriverHelpPage],
])("%s", (_path, Page) => {
  it("offers no phone number", () => {
    const { container } = render(<Page />);

    expect(hrefs(container).filter((href) => href.startsWith("tel:"))).toEqual([]);
    expect(container).not.toHaveTextContent(/\+\d[\d ()-]{6,}/);
    expect(container).not.toHaveTextContent(/phoneSupport|emergency/);
  });

  it("keeps the support mailbox and the in-app request card", () => {
    const { container } = render(<Page />);

    expect(hrefs(container)).toContain(`mailto:${mailbox("support")}`);
    expect(container.querySelector("[data-testid='feedback-card']")).not.toBeNull();
  });
});

describe("placeholder contact data", () => {
  const SRC = join(process.cwd(), "src");
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) {
        return name === "__tests__" || name === "node_modules" ? [] : files(path);
      }
      return /\.tsx$/.test(name) ? [path] : [];
    });

  it("has no `tel:` link to a made-up number anywhere in the UI", () => {
    // A `tel:` built from data (`tel:${phone}`) is somebody's real number; a
    // literal one typed into a component is a placeholder until proven real.
    const offenders = files(SRC).filter((file) =>
      /href=["']tel:\+?\d/.test(readFileSync(file, "utf8"))
    );

    expect(offenders).toEqual([]);
  });
});

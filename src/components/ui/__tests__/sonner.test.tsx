import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const sonner = vi.fn((_props: Record<string, unknown>) => null);
vi.mock("sonner", () => ({ Toaster: (props: Record<string, unknown>) => sonner(props) }));
vi.mock("next-themes", () => ({ useTheme: () => ({ theme: "light" }) }));

import { Toaster } from "../sonner";

const lastProps = () => sonner.mock.calls.at(-1)?.[0] ?? {};

function width(wide: boolean) {
  window.matchMedia = (() => ({
    matches: wide,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
}

describe("Toaster placement", () => {
  it("comes from the top below lg, clear of the header, not over the bottom bar", () => {
    width(false);
    render(<Toaster />);
    expect(lastProps().position).toBe("top-center");
    expect(String(lastProps().mobileOffset && (lastProps().mobileOffset as { top: string }).top)).toContain(
      "safe-area-inset-top"
    );
    expect(lastProps().offset).toEqual(lastProps().mobileOffset);
  });

  it("keeps the bottom-right corner where there is a sidebar and no bar", () => {
    width(true);
    render(<Toaster />);
    expect(lastProps().position).toBe("bottom-right");
  });

  it("falls back to the top when matchMedia does not exist", () => {
    // @ts-expect-error -- simulating an old webview
    window.matchMedia = undefined;
    render(<Toaster />);
    expect(lastProps().position).toBe("top-center");
  });
});

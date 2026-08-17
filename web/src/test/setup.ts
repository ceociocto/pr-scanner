import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.stubGlobal("ResizeObserver", ResizeObserverMock);
Object.defineProperty(HTMLElement.prototype, "getBoundingClientRect", {
  configurable: true,
  value: () => ({
    width: 800,
    height: 300,
    top: 0,
    left: 0,
    right: 800,
    bottom: 300,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  }),
});

afterEach(() => cleanup());

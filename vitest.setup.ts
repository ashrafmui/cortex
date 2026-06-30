import "@testing-library/jest-dom";

// jsdom does not implement scrollTo — polyfill so components that call
// ref.scrollTo() don't crash in tests.
Object.defineProperty(HTMLElement.prototype, "scrollTo", {
  value: () => {},
  writable: true,
  configurable: true,
});

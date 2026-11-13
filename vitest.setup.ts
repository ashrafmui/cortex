import "@testing-library/jest-dom";

// jsdom does not implement scrollTo — polyfill so components that call
// ref.scrollTo() don't crash in tests. (Skipped in `@vitest-environment node`
// suites such as the API route tests, which have no DOM.)
if (typeof HTMLElement !== "undefined") {
  Object.defineProperty(HTMLElement.prototype, "scrollTo", {
    value: () => {},
    writable: true,
    configurable: true,
  });
}

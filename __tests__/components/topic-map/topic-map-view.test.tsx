import { describe, it, expect, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";
import TopicMapView, { type ConceptNode } from "@/components/topic-map/topic-map-view";

// jsdom lacks ResizeObserver (the view uses it to size the SVG).
beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

const node = (o: Partial<ConceptNode> = {}): ConceptNode => ({
  id: "n1",
  topic: "Pointers",
  parentTopic: null,
  mastery: 0.5,
  difficultyTier: "foundation",
  ...o,
});

describe("TopicMapView", () => {
  it("shows empty state when there are no concepts", () => {
    render(<TopicMapView concepts={[]} />);
    expect(screen.getByText(/no concepts yet/i)).toBeInTheDocument();
  });

  it("renders the 'Topic Map' heading when concepts exist", () => {
    render(<TopicMapView concepts={[node()]} />);
    expect(screen.getByRole("heading", { level: 1, name: /topic map/i })).toBeInTheDocument();
  });

  it("renders the total concept count", () => {
    render(
      <TopicMapView
        concepts={[node({ id: "1" }), node({ id: "2", topic: "Heap" }), node({ id: "3", topic: "Stack" })]}
      />
    );
    expect(screen.getByText(/3 concepts/)).toBeInTheDocument();
  });

  it("renders '1 concept' (singular) for a single node", () => {
    render(<TopicMapView concepts={[node()]} />);
    expect(screen.getByText(/1 concept[^s]/)).toBeInTheDocument();
  });

  it("renders the average mastery percentage", () => {
    render(
      <TopicMapView
        concepts={[node({ id: "1", mastery: 0.8 }), node({ id: "2", topic: "Heap", mastery: 0.6 })]}
      />
    );
    expect(screen.getByText(/70% avg mastery/)).toBeInTheDocument();
  });

  it("renders concept topic labels as graph nodes", () => {
    render(<TopicMapView concepts={[node({ topic: "Stack vs Heap" })]} />);
    expect(screen.getByText("Stack vs Heap")).toBeInTheDocument();
  });

  it("renders a synthetic hub node for a parent topic that isn't itself a concept", () => {
    render(
      <TopicMapView concepts={[node({ id: "c1", topic: "Big-O", parentTopic: "Algorithms" })]} />
    );
    expect(screen.getByText("Big-O")).toBeInTheDocument();
    expect(screen.getByText("Algorithms")).toBeInTheDocument(); // the hub
  });

  it("renders the mastery legend and reset control", () => {
    render(<TopicMapView concepts={[node()]} />);
    expect(screen.getByText(/Strong \(≥70%\)/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reset view/i })).toBeInTheDocument();
  });
});

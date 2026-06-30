import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import TopicMapView from "@/components/topic-map/topic-map-view";

const makeNode = (overrides: Partial<{ id: string; topic: string; mastery: number; difficultyTier: string }> = {}) => ({
  id: "node-1",
  topic: "Pointers",
  mastery: 0.5,
  difficultyTier: "foundation",
  ...overrides,
});

const makeGroup = (name: string, nodes: ReturnType<typeof makeNode>[]) => ({ name, nodes });

describe("TopicMapView", () => {
  it("shows empty state when there are no groups", () => {
    render(<TopicMapView groups={[]} />);
    expect(screen.getByText(/no concepts yet/i)).toBeInTheDocument();
  });

  it("renders the 'Topic Map' heading when groups exist", () => {
    render(<TopicMapView groups={[makeGroup("Memory", [makeNode()])]} />);
    expect(screen.getByRole("heading", { level: 1, name: /topic map/i })).toBeInTheDocument();
  });

  it("renders the total concept count", () => {
    const groups = [makeGroup("A", [makeNode({ id: "1" }), makeNode({ id: "2" })]), makeGroup("B", [makeNode({ id: "3" })])];
    render(<TopicMapView groups={groups} />);
    expect(screen.getByText(/3 concepts/)).toBeInTheDocument();
  });

  it("renders '1 concept' (singular) for a single node", () => {
    render(<TopicMapView groups={[makeGroup("A", [makeNode()])]} />);
    expect(screen.getByText(/1 concept[^s]/)).toBeInTheDocument();
  });

  it("renders the average mastery percentage", () => {
    const groups = [makeGroup("A", [makeNode({ mastery: 0.8 }), makeNode({ id: "2", mastery: 0.6 })])];
    render(<TopicMapView groups={groups} />);
    // avg = (0.8 + 0.6) / 2 = 0.7 → 70%
    expect(screen.getByText(/70% avg mastery/)).toBeInTheDocument();
  });

  it("renders group names as section headings", () => {
    render(<TopicMapView groups={[makeGroup("Memory Management", [makeNode()])]} />);
    expect(screen.getByText("Memory Management")).toBeInTheDocument();
  });

  it("renders concept topic names", () => {
    render(<TopicMapView groups={[makeGroup("C", [makeNode({ topic: "Stack vs Heap" })])]} />);
    expect(screen.getByText("Stack vs Heap")).toBeInTheDocument();
  });

  it("renders mastery percentage on each chip", () => {
    render(<TopicMapView groups={[makeGroup("C", [makeNode({ mastery: 0.75 })])]} />);
    expect(screen.getByText("75%")).toBeInTheDocument();
  });

  it("applies green classes for mastery >= 0.7", () => {
    render(<TopicMapView groups={[makeGroup("A", [makeNode({ id: "g", topic: "Strong", mastery: 0.7 })])]} />);
    // Find the chip div by looking for both topic text and the parent having the green class
    const chip = screen.getByText("Strong").closest("div");
    expect(chip).toHaveClass("bg-green-100");
  });

  it("applies amber classes for mastery in [0.4, 0.7)", () => {
    render(<TopicMapView groups={[makeGroup("A", [makeNode({ id: "a", topic: "Developing", mastery: 0.5 })])]} />);
    const chip = screen.getByText("Developing").closest("div");
    expect(chip).toHaveClass("bg-amber-100");
  });

  it("applies red classes for mastery < 0.4", () => {
    render(<TopicMapView groups={[makeGroup("A", [makeNode({ id: "r", topic: "Weak", mastery: 0.2 })])]} />);
    const chip = screen.getByText("Weak").closest("div");
    expect(chip).toHaveClass("bg-red-100");
  });
});

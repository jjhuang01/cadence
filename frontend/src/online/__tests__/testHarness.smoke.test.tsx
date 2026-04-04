import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

function SmokeComponent() {
  return <div>Tips test harness</div>;
}

describe("test harness", () => {
  test("renders a component with Testing Library", () => {
    render(<SmokeComponent />);

    expect(screen.getByText("Tips test harness")).toBeInTheDocument();
  });
});

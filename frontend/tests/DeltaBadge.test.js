import { jsx as _jsx } from "react/jsx-runtime";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import DeltaBadge from "../src/components/DeltaBadge";
describe("DeltaBadge", () => {
    it("renders positive delta in green with + prefix", () => {
        render(_jsx(DeltaBadge, { delta: 12 }));
        const badge = screen.getByText("+12");
        expect(badge).toHaveClass("text-green-400");
    });
    it("renders negative delta in red without extra prefix", () => {
        render(_jsx(DeltaBadge, { delta: -8 }));
        const badge = screen.getByText("-8");
        expect(badge).toHaveClass("text-red-400");
    });
});

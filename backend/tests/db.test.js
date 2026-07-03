import { describe, it, expect } from "vitest";
import { db } from "../src/db";
describe("db singleton", () => {
    it("exports a PrismaClient instance", () => {
        expect(db).toBeDefined();
        expect(typeof db.user.findMany).toBe("function");
    });
});

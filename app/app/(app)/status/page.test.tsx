import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import StatusPage from "./page";

vi.mock("@/lib/api-client", () => ({
  browserApi: () => ({
    systemStatus: () => new Promise(() => {}),
    systemModels: async () => ({
      available: true,
      models: [
        {
          name: "eligible-model",
          capability: "encoder",
          provider: "local",
          lane: "production",
          license: "Apache-2.0",
          promotable: true,
          runtime_servable: true,
          blockers: [],
          runtime_blockers: [],
          eval_report: null,
          model_version: null,
        },
        {
          name: "blocked-model",
          capability: "encoder",
          provider: "local",
          lane: "production",
          license: "Apache-2.0",
          promotable: true,
          runtime_servable: false,
          blockers: [],
          runtime_blockers: ["configured identity mismatch"],
          eval_report: null,
          model_version: null,
        },
        {
          name: "research-model",
          capability: "encoder",
          provider: "local",
          lane: "research",
          license: "research-only",
          promotable: false,
          runtime_servable: null,
          blockers: ["lane is research, not production"],
          runtime_blockers: [],
          eval_report: null,
          model_version: null,
        },
      ],
    }),
  }),
}));

it("labels policy eligibility without claiming a model is serving", async () => {
  render(<StatusPage />);

  expect(await screen.findByText("Eligible")).toBeInTheDocument();
  expect(screen.getByText("Blocked")).toBeInTheDocument();
  expect(screen.getByText("Not checked")).toBeInTheDocument();
  expect(screen.getByText(/configured identity mismatch/)).toBeInTheDocument();
  expect(screen.queryByText("Serving")).not.toBeInTheDocument();
});

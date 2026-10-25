import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AiPanel } from "../components/AiPanel";
import { AiResult } from "../api/tauri";

describe("AiPanel", () => {
  const mockFindings: AiResult[] = [
    {
      id: "finding-1",
      case_id: "case-1",
      model_info: {
        id: "mock-cxr",
        version: "1.0.0",
        bundle_sha256: "abc12345",
      },
      finding: {
        label: "consolidation",
        confidence: 0.85,
      },
      input_ref: "test.png",
      run_at: "2026-10-25T15:00:00Z",
      doctor_action: null,
      doctor_user_id: null,
      action_at: null,
    },
  ];

  it("renders finding with clinical safety wording (AI suggests)", () => {
    render(
      <AiPanel
        caseId="case-1"
        findings={mockFindings}
        modelInfo={null}
        onRunAi={vi.fn()}
        onRecordAction={vi.fn()}
      />
    );

    expect(screen.getByText(/AI suggests: consolidation/i)).toBeDefined();
    expect(screen.getByText(/85% Confidence/i)).toBeDefined();
  });

  it("calls onRecordAction when Accept button is clicked", () => {
    const actionSpy = vi.fn();
    render(
      <AiPanel
        caseId="case-1"
        findings={mockFindings}
        modelInfo={null}
        onRunAi={vi.fn()}
        onRecordAction={actionSpy}
      />
    );

    fireEvent.click(screen.getByTestId("accept-btn"));
    expect(actionSpy).toHaveBeenCalledWith("finding-1", "Accepted");
  });
});

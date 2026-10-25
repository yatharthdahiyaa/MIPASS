import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AuditAlert } from "../components/AuditAlert";

describe("AuditAlert", () => {
  it("renders nothing when chain is intact (ok: true)", () => {
    const { container } = render(
      <AuditAlert
        status={{ ok: true, message: "Chain intact" }}
        onDismiss={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders security alert banner when tamper detected (ok: false)", () => {
    render(
      <AuditAlert
        status={{
          ok: false,
          message: "Tamper detected at sequence 3",
        }}
        onDismiss={vi.fn()}
      />
    );

    expect(screen.getByTestId("audit-alert")).toBeDefined();
    expect(screen.getByText(/Security Alert: Audit Log Tamper Detected/i)).toBeDefined();
    expect(screen.getByText(/Tamper detected at sequence 3/i)).toBeDefined();
  });
});

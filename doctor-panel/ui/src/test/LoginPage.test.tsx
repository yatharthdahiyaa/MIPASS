import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LoginPage } from "../pages/LoginPage";
import { api } from "../api/tauri";

describe("LoginPage", () => {
  it("renders username and password inputs", () => {
    render(<LoginPage onLoginSuccess={vi.fn()} />);
    expect(screen.getByTestId("username-input")).toBeDefined();
    expect(screen.getByTestId("password-input")).toBeDefined();
    expect(screen.getByTestId("login-submit-btn")).toBeDefined();
  });

  it("calls api.login on form submission", async () => {
    const mockSession = {
      doctor_id: "11111111-1111-1111-1111-111111111111",
      username: "dr_demo",
      expires_at: "2026-10-25T16:00:00Z",
    };
    const loginSpy = vi.spyOn(api, "login").mockResolvedValueOnce(mockSession);
    const onLoginSuccess = vi.fn();

    render(<LoginPage onLoginSuccess={onLoginSuccess} />);

    fireEvent.change(screen.getByTestId("username-input"), {
      target: { value: "dr_demo" },
    });
    fireEvent.change(screen.getByTestId("password-input"), {
      target: { value: "Demo@1234" },
    });
    fireEvent.click(screen.getByTestId("login-submit-btn"));

    await vi.waitFor(() => {
      expect(loginSpy).toHaveBeenCalledWith("dr_demo", "Demo@1234");
      expect(onLoginSuccess).toHaveBeenCalledWith(mockSession);
    });
  });
});

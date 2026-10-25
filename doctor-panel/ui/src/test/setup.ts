import { vi } from "vitest";

// Mock Tauri invoke globally for UI tests
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

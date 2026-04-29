import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("app shell", () => {
  it("renders the connect page first and navigates to review", async () => {
    const user = userEvent.setup();

    render(<App initialEntries={["/"]} />);

    expect(
      screen.getByRole("heading", { name: /connect accounts/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Spotify" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "YouTube Music" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("link", { name: /review/i }));

    expect(
      screen.getByRole("heading", { name: /matching review/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Confidence")).toBeInTheDocument();
  });
});

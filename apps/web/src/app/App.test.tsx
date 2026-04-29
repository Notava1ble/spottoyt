import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("app shell", () => {
  it("renders convert first and uses top-level product navigation", async () => {
    const user = userEvent.setup();

    render(<App initialEntries={["/"]} />);

    expect(
      screen.getByRole("navigation", { name: /primary navigation/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /convert/i })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.queryByRole("link", { name: /review/i })).not.toBeInTheDocument();

    expect(
      screen.getByRole("heading", { name: /convert/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Spotify" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "YouTube Music" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /import mock playlist/i }));

    expect(
      screen.getByRole("heading", { name: /matching review/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Confidence")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /reset conversion/i }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("link", { name: /library/i }));

    expect(screen.getByRole("heading", { name: /library/i })).toBeInTheDocument();
    expect(
      screen.getByText(/converted playlists and future maintenance/i),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("link", { name: /settings/i }));

    expect(
      screen.getByRole("heading", { name: /settings/i }),
    ).toBeInTheDocument();
  });
});

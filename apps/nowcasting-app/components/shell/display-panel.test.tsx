import { describe, expect, jest, test } from "@jest/globals";
import { act, fireEvent, render, screen } from "@testing-library/react";

import { useState } from "react";
import DisplayPanel, { DisplayPanelContext, useDisplayPanel } from "./display-panel";
import useGlobalState from "../helpers/globalState";

jest.mock("../charts/pv-remix-chart", () => ({ GENERATION_CHART_KEYS: [] }));
jest.mock("../../hooks/data", () => ({
  useFocusedCountry: () => "gb",
  useGenerationSources: () => ({ data: [] }),
  useNationalForecast: () => ({ data: undefined })
}));

const Harness = () => {
  const [, setShow] = useGlobalState("showNHourView");
  return (
    <>
      <button onClick={() => setShow(true)}>show n-hour</button>
      <DisplayPanel attached open onToggle={() => {}} />
    </>
  );
};

const renderPanel = () => {
  render(<Harness />);
  fireEvent.click(screen.getByText("show n-hour"));
  return screen.getByLabelText("Comparison forecast horizon, in hours") as HTMLSelectElement;
};

describe("display panel", () => {
  test("the N-hour select is a native select with an explicit caret icon", () => {
    const select = renderPanel();
    expect(select.tagName).toBe("SELECT");
    expect(select.style.backgroundImage).toBe("");
    const caret = select.parentElement!.querySelector("svg");
    expect(caret).not.toBeNull();
    expect(caret!.getAttribute("aria-hidden")).toBe("true");
    expect(caret!.getAttribute("class")).toContain("text-interactive");
    expect(caret!.getAttribute("class")).toContain("pointer-events-none");
    // Room reserved for the caret so it does not overlap the value text.
    expect(select.className).toContain("pr-5");
  });

  test("the select still changes the horizon", () => {
    const select = renderPanel();
    fireEvent.change(select, { target: { value: "8" } });
    expect(select.value).toBe("8");
  });

  test("the drawer is narrower than the dock column", () => {
    renderPanel();
    expect(screen.getByLabelText("Display settings").className).toContain("w-52");
  });
});

describe("legend entries open the drawer", () => {
  const Probe = () => {
    const { open } = useDisplayPanel();
    return <span data-testid="open">{String(open)}</span>;
  };
  const Legend = () => {
    const { attract } = useDisplayPanel();
    return <button onClick={attract}>entry</button>;
  };

  test("a click opens the panel through the provider; a click while open nudges it", () => {
    const nudges: number[] = [];
    const Host = () => {
      const [open, setOpen] = useState(false);
      const [nudge, setNudge] = useState(0);
      nudges.push(nudge);
      return (
        <DisplayPanelContext.Provider
          value={{
            open,
            setOpen,
            attract: () => (open ? setNudge((count) => count + 1) : setOpen(true))
          }}
        >
          <Probe />
          <Legend />
        </DisplayPanelContext.Provider>
      );
    };
    render(<Host />);
    expect(screen.getByTestId("open").textContent).toBe("false");
    fireEvent.click(screen.getByText("entry"));
    expect(screen.getByTestId("open").textContent).toBe("true");
    fireEvent.click(screen.getByText("entry"));
    expect(screen.getByTestId("open").textContent).toBe("true");
    expect(nudges[nudges.length - 1]).toBe(1);
  });

  test("the panel plays the nudge class once when nudged while open", () => {
    jest.useFakeTimers();
    const { rerender } = render(<DisplayPanel open onToggle={() => {}} nudge={0} />);
    const panel = () => screen.getByRole("complementary", { name: "Display settings" });
    expect(panel().className).not.toContain("animate-nudge");
    rerender(<DisplayPanel open onToggle={() => {}} nudge={1} />);
    expect(panel().className).toContain("animate-nudge");
    act(() => {
      jest.advanceTimersByTime(500);
    });
    expect(panel().className).not.toContain("animate-nudge");
    jest.useRealTimers();
  });

  test("without a provider a click does nothing", () => {
    render(
      <>
        <Probe />
        <Legend />
      </>
    );
    fireEvent.click(screen.getByText("entry"));
    expect(screen.getByTestId("open").textContent).toBe("false");
  });
});

import { useState } from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";

afterEach(cleanup);
it("keeps a loaded default selection inside a form", async () => {
  function Form({ loaded }: { loaded: boolean }) {
    const [picked, setPicked] = useState<number>();
    const subject = picked ?? (loaded ? 1 : undefined);
    return <form><Select value={String(subject ?? "")} onValueChange={value => setPicked(Number(value))}>
      <SelectTrigger aria-label="Materia"><SelectValue /></SelectTrigger>
      <SelectContent>{loaded && <SelectItem value="1">Piano</SelectItem>}</SelectContent>
    </Select><output>{subject}</output></form>;
  }
  const view = render(<Form loaded={false} />);
  view.rerender(<Form loaded />);
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("1"));
  expect(screen.getByRole("combobox")).toHaveTextContent("Piano");
});

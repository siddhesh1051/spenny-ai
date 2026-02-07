import type { ReactElement } from "react";
import { render } from "@testing-library/react";
import type { RenderOptions } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { ThemeProvider } from "@/components/theme-provider";

function AllThemes({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider defaultTheme="system" storageKey="spenny-theme">
      {children}
    </ThemeProvider>
  );
}

function AllProviders({ children }: { children: React.ReactNode }) {
  return (
    <BrowserRouter>
      <AllThemes>{children}</AllThemes>
    </BrowserRouter>
  );
}

function customRender(
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper">
) {
  return render(ui, {
    wrapper: AllProviders,
    ...options,
  });
}

export * from "@testing-library/react";
export { customRender as render };

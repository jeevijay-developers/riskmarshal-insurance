import { createContext, useContext, useState, useEffect, ReactNode } from "react";

const PageTitleContext = createContext<{ title: string; setTitle: (t: string) => void }>({
  title: "",
  setTitle: () => {},
});

export function PageTitleProvider({ children }: { children: ReactNode }) {
  const [title, setTitle] = useState("");
  return (
    <PageTitleContext.Provider value={{ title, setTitle }}>
      {children}
    </PageTitleContext.Provider>
  );
}

/** Call in each page component to set the header title */
export function useSetPageTitle(title: string) {
  const { setTitle } = useContext(PageTitleContext);
  useEffect(() => { setTitle(title); }, [title, setTitle]);
}

/** Used by DashboardLayout to read the current title */
export function usePageTitle() {
  return useContext(PageTitleContext).title;
}

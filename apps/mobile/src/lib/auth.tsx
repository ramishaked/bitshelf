import { createContext, useContext, useState, type ReactNode } from "react";

// Without a Clerk key the app runs in development mode: no sign-in, straight
// to the tabs. See docs/STATUS.md.
export const clerkEnabled = Boolean(process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY);

interface GuestContextValue {
  isGuest: boolean;
  setGuest: (value: boolean) => void;
}

const GuestContext = createContext<GuestContextValue>({
  isGuest: false,
  setGuest: () => {},
});

// Guest mode skips sign-in and only allows public gallery routes (spec 3)
export function GuestProvider({ children }: { children: ReactNode }) {
  const [isGuest, setGuest] = useState(false);
  return <GuestContext.Provider value={{ isGuest, setGuest }}>{children}</GuestContext.Provider>;
}

export function useGuest() {
  return useContext(GuestContext);
}

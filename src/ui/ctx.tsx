import { createContext, useContext, type ReactNode } from 'react';
import type { Settings } from '../lib/db';

export interface Nav {
  /** Open a page or sheet on top of the current view. */
  push(node: ReactNode): void;
  /** Close the top `n` pages. */
  pop(n?: number): void;
  /** Close pages until `depth` remain. */
  popTo(depth: number): void;
  /** Swap the top page for another without growing the stack. */
  replace(node: ReactNode): void;
  toast(message: string): void;
}

export const NavCtx = createContext<Nav>(null!);
export const useNav = () => useContext(NavCtx);

/** How many pages are open including the one being rendered (0 for a tab). */
export const DepthCtx = createContext(0);
export const useDepth = () => useContext(DepthCtx);

export const SettingsCtx = createContext<{ settings: Settings; update: (fn: (s: Settings) => Settings) => void }>(null!);
export const useSettings = () => useContext(SettingsCtx);

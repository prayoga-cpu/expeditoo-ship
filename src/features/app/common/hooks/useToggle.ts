import { useState, useCallback } from "react";

/**
 * Custom hook for managing boolean toggle state
 * Follows DRY and KISS principles - simple boolean state management
 *
 * @param initialValue - Initial boolean value (default: false)
 * @returns Tuple of [value, toggle function, set function]
 */
export function useToggle(initialValue = false) {
  const [value, setValue] = useState(initialValue);

  const toggle = useCallback(() => {
    setValue((prev) => !prev);
  }, []);

  const setToggle = useCallback((newValue: boolean) => {
    setValue(newValue);
  }, []);

  return [value, toggle, setToggle] as const;
}

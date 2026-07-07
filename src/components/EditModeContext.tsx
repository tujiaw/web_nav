import { createContext, useContext, useState, useCallback, ReactNode } from "react";

type EditModeContextValue = {
  editMode: boolean;
  toggleEditMode: () => void;
};

const EditModeContext = createContext<EditModeContextValue | null>(null);

export function EditModeProvider({ children }: { children: ReactNode }) {
  const [editMode, setEditMode] = useState(false);

  const toggleEditMode = useCallback(() => {
    setEditMode((v) => !v);
  }, []);

  return (
    <EditModeContext.Provider value={{ editMode, toggleEditMode }}>
      {children}
    </EditModeContext.Provider>
  );
}

/** 获取当前是否为编辑模式 */
export function useEditMode(): EditModeContextValue {
  const ctx = useContext(EditModeContext);
  if (!ctx) {
    return { editMode: false, toggleEditMode: () => {} };
  }
  return ctx;
}

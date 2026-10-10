import { createContext, useContext } from 'react'

// Opt-in while the Sports screens are reviewed. Other modules retain their UI.
export const UiStandardsContext = createContext(false)
export const useUiStandards = () => useContext(UiStandardsContext)
export const FieldControlContext = createContext<React.InputHTMLAttributes<HTMLInputElement>>({})
export const useFieldControl = () => useContext(FieldControlContext)

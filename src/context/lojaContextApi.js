import { createContext, useContext } from 'react';

export const LojaContext = createContext();
export const useLojas = () => useContext(LojaContext);

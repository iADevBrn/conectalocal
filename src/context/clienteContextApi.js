import { createContext, useContext } from 'react';

export const ClienteContext = createContext();
export const useCliente = () => useContext(ClienteContext);

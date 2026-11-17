import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { LojaProvider } from './context/lojaContext';
import LandingPage from './pages/landingPage';
import VitrineLoja from './pages/vitrineLoja';
import PainelAdmin from './pages/painelAdmin';
import LoginLojista from './pages/loginLojista';

export default function App() {
  return (
    <LojaProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginLojista />} />
          <Route path="/admin" element={<PainelAdmin />} />
          <Route path="/:slug" element={<VitrineLoja />} />
        </Routes>
      </BrowserRouter>
    </LojaProvider>
  );
}
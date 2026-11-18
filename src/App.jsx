import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { LojaProvider } from './context/lojaContext';

// Code-split all pages to minimize initial bundle
const LandingPage = React.lazy(() => import('./pages/landingPage'));
const LoginLojista = React.lazy(() => import('./pages/loginLojista'));
const VitrineLoja = React.lazy(() => import('./pages/vitrineLoja'));
const PainelAdmin = React.lazy(() => import('./pages/painelAdmin'));

function LoadingFallback() {
  return (
    <div className="v-notfound" style={{ minHeight: '60vh' }}>
      Carregando...
    </div>
  );
}

export default function App() {
  return (
    <LojaProvider>
      <BrowserRouter>
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginLojista />} />
            <Route path="/admin" element={<PainelAdmin />} />
            <Route path="/:slug" element={<VitrineLoja />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </LojaProvider>
  );
}
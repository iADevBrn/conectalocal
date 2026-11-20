import { atributosTema, variaveisTema } from '../lib/tema';

// Envolve qualquer tela com o tema da loja. As cores/fontes valem só aqui dentro
// (nada vaza para a landing, o login ou o painel).
export default function TemaLoja({ tema, corPrimaria, corSecundaria, corFundo, className = '', children }) {
  return (
    <div className={`vitrine ${className}`} {...atributosTema(tema)} style={variaveisTema(corPrimaria, corSecundaria, corFundo)}>
      {children}
    </div>
  );
}

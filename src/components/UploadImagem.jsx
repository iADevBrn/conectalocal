import { useState } from 'react';
import { supabase } from '../lib/supabase';

const BUCKET = 'fotos-publicas';
const TAMANHO_MAXIMO = 5 * 1024 * 1024;
const EXTENSOES_POR_TIPO = {
  'image/avif': 'avif',
  'image/gif': 'gif',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp'
};

export default function UploadImagem({ label, onChange, help, onUploadingChange }) {
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  const selecionarImagem = async (e) => {
    const input = e.currentTarget;
    const arquivo = input.files?.[0];
    input.value = '';
    if (!arquivo) return;

    const extensao = EXTENSOES_POR_TIPO[arquivo.type];
    if (!extensao) {
      setErro('Escolha uma imagem JPG, PNG, WEBP, AVIF ou GIF.');
      return;
    }
    if (arquivo.size > TAMANHO_MAXIMO) {
      setErro('A imagem deve ter no máximo 5 MB.');
      return;
    }

    setErro('');
    setEnviando(true);
    onUploadingChange?.(true);

    try {
      const { data: { user }, error: erroUsuario } = await supabase.auth.getUser();
      if (erroUsuario) throw erroUsuario;
      if (!user) throw new Error('Entre na sua conta antes de enviar uma imagem.');

      const identificador = globalThis.crypto?.randomUUID?.()
        || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const caminho = `${user.id}/${identificador}.${extensao}`;
      const { error: erroUpload } = await supabase.storage
        .from(BUCKET)
        .upload(caminho, arquivo, {
          cacheControl: '31536000',
          contentType: arquivo.type,
          upsert: false
        });
      if (erroUpload) throw erroUpload;

      const { data } = supabase.storage.from(BUCKET).getPublicUrl(caminho);
      if (!data.publicUrl) throw new Error('Não foi possível obter o link da imagem enviada.');
      onChange(data.publicUrl);
    } catch (err) {
      console.error('Erro ao enviar imagem:', err);
      setErro(err.message || 'Não foi possível enviar a imagem. Tente novamente.');
    } finally {
      setEnviando(false);
      onUploadingChange?.(false);
    }
  };

  return (
    <div className="field image-upload">
      <span>{label}</span>
      <small>{help}</small>
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
        aria-label={`Selecionar ${label.toLowerCase()} no dispositivo`}
        onChange={selecionarImagem}
        disabled={enviando}
      />
      {enviando && <small role="status">Enviando imagem...</small>}
      {erro && <small className="image-upload-error" role="alert">{erro}</small>}
    </div>
  );
}

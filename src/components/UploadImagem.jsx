import { useId, useState } from 'react';
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

export default function UploadImagem({ label, value, onChange, help, onUploadingChange }) {
  const inputId = useId();
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [nomeArquivo, setNomeArquivo] = useState('');

  const removerImagem = () => {
    onChange('');
    setNomeArquivo('');
    setErro('');
  };

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
      setNomeArquivo(arquivo.name);
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
        id={inputId}
        className="image-upload-input"
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
        aria-label={`${value ? 'Trocar' : 'Adicionar'} ${label.toLowerCase()}`}
        onChange={selecionarImagem}
        disabled={enviando}
      />
      {value ? (
        <div className="image-upload-state image-upload-selected">
          <img src={value} alt="" aria-hidden="true" />
          <div className="image-upload-details">
            <strong title={nomeArquivo || 'Imagem atual'}>{nomeArquivo || 'Imagem atual'}</strong>
            <small>{enviando ? 'Enviando imagem...' : 'Imagem adicionada'}</small>
            <div className="image-upload-actions">
              <label htmlFor={inputId} className="btn btn-ghost btn-sm image-upload-trigger">
                Trocar imagem
              </label>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={removerImagem}
                disabled={enviando}
              >
                Remover imagem
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="image-upload-state image-upload-empty">
          <div className="image-upload-placeholder" aria-hidden="true">
            <i className="fa-solid fa-image" />
          </div>
          <div>
            <strong>Nenhuma imagem adicionada</strong>
            <small>JPG, PNG, WEBP, AVIF ou GIF · até 5 MB</small>
          </div>
          <label htmlFor={inputId} className="btn btn-primary btn-sm image-upload-trigger" aria-disabled={enviando}>
            {enviando ? 'Enviando...' : 'Adicionar imagem'}
          </label>
        </div>
      )}
      {erro && <small className="image-upload-error" role="alert">{erro}</small>}
    </div>
  );
}

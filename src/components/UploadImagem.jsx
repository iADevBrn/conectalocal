import { useEffect, useId, useRef, useState } from 'react';
import ReactCrop, { centerCrop, convertToPixelCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { supabase } from '../lib/supabase';

const BUCKET = 'fotos-publicas';
const TAMANHO_MAXIMO = 5 * 1024 * 1024;
const DIMENSAO_MAXIMA = 2048;
const EXTENSOES_POR_TIPO = {
  'image/avif': 'avif',
  'image/gif': 'gif',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp'
};

export default function UploadImagem({ label, value, onChange, help, onUploadingChange, aspectRatio = 1 }) {
  const inputId = useId();
  const imagemRef = useRef(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [nomeArquivo, setNomeArquivo] = useState('');
  const [arquivoPendente, setArquivoPendente] = useState(null);
  const [imagemOrigem, setImagemOrigem] = useState('');
  const [imagemCarregada, setImagemCarregada] = useState(false);
  const [crop, setCrop] = useState(null);

  useEffect(() => {
    if (!imagemOrigem) return undefined;
    return () => URL.revokeObjectURL(imagemOrigem);
  }, [imagemOrigem]);

  const limparRecorte = () => {
    setArquivoPendente(null);
    setImagemOrigem('');
    setImagemCarregada(false);
    setCrop(null);
    setErro('');
    onUploadingChange?.(false);
  };

  const removerImagem = () => {
    onChange('');
    setNomeArquivo('');
    setErro('');
  };

  const selecionarImagem = (e) => {
    const input = e.currentTarget;
    const arquivo = input.files?.[0];
    input.value = '';
    if (!arquivo) return;

    if (!EXTENSOES_POR_TIPO[arquivo.type]) {
      setErro('Escolha uma imagem JPG, PNG, WEBP, AVIF ou GIF.');
      return;
    }
    if (arquivo.size > TAMANHO_MAXIMO) {
      setErro('A imagem deve ter no máximo 5 MB.');
      return;
    }

    setErro('');
    setArquivoPendente(arquivo);
    setImagemCarregada(false);
    setCrop(null);
    setImagemOrigem(URL.createObjectURL(arquivo));
    onUploadingChange?.(true);
  };

  const enviarArquivo = async (arquivo, nomeExibicao) => {
    setErro('');
    setEnviando(true);

    try {
      const extensao = EXTENSOES_POR_TIPO[arquivo.type];
      if (!extensao) throw new Error('O formato do recorte não é compatível.');

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
      setNomeArquivo(nomeExibicao);
      limparRecorte();
    } catch (err) {
      console.error('Erro ao enviar imagem:', err);
      setErro(err.message || 'Não foi possível enviar a imagem. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  };

  const usarImagemInteira = () => {
    if (arquivoPendente) enviarArquivo(arquivoPendente, arquivoPendente.name);
  };

  const prepararRecorte = (e) => {
    const imagem = e.currentTarget;
    const dimensoes = { width: imagem.naturalWidth, height: imagem.naturalHeight };
    const cropInicial = aspectRatio
      ? makeAspectCrop({ unit: '%', width: 90 }, aspectRatio, dimensoes.width, dimensoes.height)
      : { unit: '%', x: 5, y: 5, width: 90, height: 90 };
    const novoCrop = centerCrop(cropInicial, dimensoes.width, dimensoes.height);
    setCrop(novoCrop);
    setImagemCarregada(true);
  };

  const recortarEEnviar = async () => {
    const imagem = imagemRef.current;
    if (!arquivoPendente || !imagem || !imagemCarregada || !imagem.width || !imagem.height) return;

    setEnviando(true);
    setErro('');
    try {
      const area = convertToPixelCrop(crop, imagem.width, imagem.height);
      const escalaX = imagem.naturalWidth / imagem.width;
      const escalaY = imagem.naturalHeight / imagem.height;
      const origemX = Math.max(0, Math.floor(area.x * escalaX));
      const origemY = Math.max(0, Math.floor(area.y * escalaY));
      const larguraOrigem = Math.min(imagem.naturalWidth - origemX, Math.ceil(area.width * escalaX));
      const alturaOrigem = Math.min(imagem.naturalHeight - origemY, Math.ceil(area.height * escalaY));
      if (larguraOrigem < 1 || alturaOrigem < 1) throw new Error('Selecione uma área válida para recortar.');

      const escalaSaida = Math.min(1, DIMENSAO_MAXIMA / Math.max(larguraOrigem, alturaOrigem));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(larguraOrigem * escalaSaida));
      canvas.height = Math.max(1, Math.round(alturaOrigem * escalaSaida));
      const contexto = canvas.getContext('2d');
      if (!contexto) throw new Error('Não foi possível preparar o recorte da imagem.');

      contexto.drawImage(
        imagem,
        origemX,
        origemY,
        larguraOrigem,
        alturaOrigem,
        0,
        0,
        canvas.width,
        canvas.height
      );

      const tipoSaida = arquivoPendente.type === 'image/jpeg'
        ? 'image/jpeg'
        : arquivoPendente.type === 'image/webp'
          ? 'image/webp'
          : 'image/png';
      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob(
          (resultado) => resultado ? resolve(resultado) : reject(new Error('Não foi possível gerar o recorte.')),
          tipoSaida,
          0.92
        );
      });
      if (blob.size > TAMANHO_MAXIMO) {
        throw new Error('O recorte ficou maior que 5 MB. Selecione uma área menor ou use uma imagem JPG.');
      }

      const extensao = EXTENSOES_POR_TIPO[blob.type];
      if (!extensao) throw new Error('O navegador não conseguiu gerar um formato de imagem compatível.');
      const nomeBase = arquivoPendente.name.replace(/\.[^.]+$/, '') || 'imagem';
      const arquivoRecortado = new File([blob], `${nomeBase}-recortada.${extensao}`, {
        type: blob.type,
        lastModified: Date.now()
      });
      await enviarArquivo(arquivoRecortado, arquivoPendente.name);
    } catch (err) {
      console.error('Erro ao recortar imagem:', err);
      setErro(err.message || 'Não foi possível recortar a imagem. Tente novamente.');
      setEnviando(false);
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
        disabled={enviando || Boolean(imagemOrigem)}
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
                disabled={enviando || Boolean(imagemOrigem)}
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
          <label htmlFor={inputId} className="btn btn-primary btn-sm image-upload-trigger" aria-disabled={enviando || Boolean(imagemOrigem)}>
            {enviando ? 'Enviando...' : 'Adicionar imagem'}
          </label>
        </div>
      )}
      {erro && !imagemOrigem && <small className="image-upload-error" role="alert">{erro}</small>}

      {imagemOrigem && (
        <div className="image-crop-overlay" role="dialog" aria-modal="true" aria-labelledby={`${inputId}-crop-title`}>
          <section className="image-crop-dialog">
            <h2 id={`${inputId}-crop-title`}>Recorte da imagem</h2>
            <p>
              {aspectRatio
                ? 'Arraste e ajuste o enquadramento. A proporção da imagem será mantida.'
                : 'Arraste e ajuste livremente a área que deseja usar.'}
            </p>
            {arquivoPendente?.type === 'image/gif' && (
              <small className="image-crop-note">Ao recortar, o GIF será salvo como uma imagem estática.</small>
            )}
            <div className="image-crop-stage">
              <ReactCrop
                aspect={aspectRatio || undefined}
                crop={crop}
                onChange={(_, percentCrop) => setCrop(percentCrop)}
                keepSelection
                ariaLabels={{
                  cropArea: 'Área do recorte',
                  nwDragHandle: 'Redimensionar pelo canto superior esquerdo',
                  nDragHandle: 'Redimensionar pelo topo',
                  neDragHandle: 'Redimensionar pelo canto superior direito',
                  eDragHandle: 'Redimensionar pela direita',
                  seDragHandle: 'Redimensionar pelo canto inferior direito',
                  sDragHandle: 'Redimensionar pela base',
                  swDragHandle: 'Redimensionar pelo canto inferior esquerdo',
                  wDragHandle: 'Redimensionar pela esquerda'
                }}
              >
                <img
                  ref={imagemRef}
                  src={imagemOrigem}
                  alt="Ajuste a área que deseja manter"
                  className="image-crop-preview"
                  onLoad={prepararRecorte}
                  onError={() => setErro('Não foi possível abrir esta imagem. Tente outro arquivo.')}
                />
              </ReactCrop>
            </div>
            {erro && <small className="image-upload-error" role="alert">{erro}</small>}
            <div className="image-crop-actions">
              <button type="button" className="btn btn-ghost" onClick={limparRecorte} disabled={enviando}>
                Cancelar
              </button>
              <button type="button" className="btn btn-ghost" onClick={usarImagemInteira} disabled={enviando}>
                Usar imagem inteira
              </button>
              <button type="button" className="btn btn-primary" onClick={recortarEEnviar} disabled={enviando || !imagemCarregada}>
                {enviando ? 'Processando...' : 'Recortar e adicionar'}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

import { normalizarTelefone } from '../lib/telefone';

export default function HeroLoja({ loja, tema, demo = false }) {
  const compacto = tema.cabecalho === 'simples';
  const capaStyle = tema.capaUrl
    ? { backgroundImage: `linear-gradient(to bottom, rgb(0 0 0 / .15), rgb(0 0 0 / .45)), url("${tema.capaUrl}")` }
    : undefined;
  const whats = `https://wa.me/${normalizarTelefone(loja.telefone)}`;

  return (
    <section className={`v-hero ${compacto ? 'is-compact' : ''}`}>
      {!compacto && <div className="v-cover" data-capa={tema.capaUrl ? 'imagem' : tema.capa} style={capaStyle} />}

      <div className="v-wrap v-hero-body">
        <img className="v-avatar" src={loja.logo} alt="" />
        <div className="v-hero-text">
          <h1 className="v-title">{loja.nome}</h1>
          {loja.subtitulo && <p className="v-subtitle">{loja.subtitulo}</p>}
        </div>

        {tema.sobre && <p className="v-about">{tema.sobre}</p>}

        <div className="v-meta">
          {tema.horarioTexto && (
            <span className="v-meta-item">
              <i className="fa-regular fa-clock" /> {tema.horarioTexto}
            </span>
          )}
          {tema.endereco &&
            (tema.mapaLink ? (
              <a className="v-meta-item is-link" href={tema.mapaLink} target="_blank" rel="noopener noreferrer">
                <i className="fa-solid fa-location-dot" /> {tema.endereco}
              </a>
            ) : (
              <span className="v-meta-item">
                <i className="fa-solid fa-location-dot" /> {tema.endereco}
              </span>
            ))}
          {tema.instagram && (
            <a
              className="v-meta-item is-link"
              href={`https://instagram.com/${tema.instagram}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <i className="fa-brands fa-instagram" /> @{tema.instagram}
            </a>
          )}
          {!demo && (
            <a className="v-meta-item is-link is-whats" href={whats} target="_blank" rel="noopener noreferrer">
              <i className="fa-brands fa-whatsapp" /> WhatsApp
            </a>
          )}
        </div>
      </div>
    </section>
  );
}

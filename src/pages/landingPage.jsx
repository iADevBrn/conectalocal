import { Link } from 'react-router-dom';
import { PALETAS } from '../lib/tema';

const RECURSOS = [
  { icone: 'fa-link', titulo: 'Seu link, sua vitrine', texto: 'Uma página linda com o nome do seu negócio, pronta para colocar na bio do Instagram e no WhatsApp.' },
  { icone: 'fa-bag-shopping', titulo: 'Pedidos no WhatsApp', texto: 'O cliente monta a sacola, aplica cupom e envia o pedido já formatado direto para você.' },
  { icone: 'fa-calendar-check', titulo: 'Agenda online', texto: 'Serviços, profissionais e horários livres em tempo real. Sem conflito, sem confusão.' },
  { icone: 'fa-palette', titulo: 'Com a sua cara', texto: 'Cores, fontes, capa, modo claro ou escuro e estilo dos cantos. Sua marca, do seu jeito.' },
  { icone: 'fa-ticket', titulo: 'Cupons de desconto', texto: 'Crie códigos promocionais para atrair e fidelizar clientes em segundos.' },
  { icone: 'fa-mobile-screen', titulo: 'Painel no celular', texto: 'Atualize preços, horários e equipe de qualquer lugar, sem precisar de computador.' }
];

export default function LandingPage() {
  return (
    <div className="lp">
      <div className="container">
        <nav className="lp-nav">
          <Link to="/" className="lp-logo">
            <svg width="38" height="38" viewBox="0 0 38 38" fill="none" aria-hidden="true"><rect width="38" height="38" rx="10" fill="currentColor"/><path d="M11 19h16M19 11v16" stroke="white" stroke-width="3" stroke-linecap="round"/></svg>
            ConectaLocal
          </Link>
          <div className="lp-nav-links">
            <Link to="/login" className="btn btn-ghost btn-sm">Entrar</Link>
            <Link to="/login" className="btn btn-primary btn-sm">Criar minha vitrine</Link>
          </div>
        </nav>

        <header className="lp-hero">
          <div>
            <span className="lp-badge"><i className="fa-solid fa-wand-magic-sparkles" /> Cardápio digital e agenda online</span>
            <h1 className="lp-h1">Seu negócio local, <em>a um clique</em> do cliente.</h1>
            <p className="lp-lead">
              Crie em minutos uma vitrine bonita para receber pedidos ou agendamentos pelo WhatsApp. Sem
              programar, sem complicação, com a identidade da sua marca.
            </p>
            <div className="lp-cta">
              <Link to="/login" className="btn btn-primary btn-lg">Criar minha vitrine</Link>
              <Link to="/raizes" className="btn btn-ghost btn-lg">Ver exemplo ao vivo</Link>
            </div>
            <div className="lp-proof">
              <span><i className="fa-solid fa-circle-check" />Pronto em minutos</span>
              <span><i className="fa-solid fa-circle-check" />Pedidos no seu WhatsApp</span>
              <span><i className="fa-solid fa-circle-check" />Funciona no celular</span>
            </div>
          </div>

          <div className="lp-stage" aria-hidden="true">
            <div className="lp-phone">
              <div className="mini-cover" />
              <div className="mini-body">
                <div className="mini-avatar"><svg width="52" height="52" viewBox="0 0 52 52" fill="none" aria-hidden="true"><rect width="52" height="52" rx="14" fill="currentColor"/><path d="M15 26h22M26 15v22" stroke="white" stroke-width="4" stroke-linecap="round"/></svg></div>
                <div className="mini-title">Sabor da Casa</div>
                <div className="mini-sub">Cozinha artesanal</div>
                <div className="mini-chips">
                  <span className="mini-chip on">Tudo</span>
                  <span className="mini-chip">Pratos</span>
                  <span className="mini-chip">Bebidas</span>
                </div>
                <div className="mini-card"><div><b>Combo da Casa</b><small>Prato + bebida</small></div><span className="mini-price">R$ 39,90</span></div>
                <div className="mini-card"><div><b>Sobremesa do dia</b><small>Feita na hora</small></div><span className="mini-price">R$ 14,00</span></div>
                <div className="mini-card"><div><b>Suco natural</b><small>500 ml</small></div><span className="mini-price">R$ 9,50</span></div>
              </div>
            </div>
            <div className="lp-phone is-2">
              <div className="mini-cover is-pink" style={{ height: 70 }} />
              <div className="mini-body">
                <div className="mini-title" style={{ marginTop: 14 }}>Barbearia Dom</div>
                <div className="mini-sub" style={{ color: '#be185d' }}>Agende seu horário</div>
                <div className="mini-slots">
                  <span className="mini-slot">09:00</span>
                  <span className="mini-slot off">09:30</span>
                  <span className="mini-slot on">10:00</span>
                  <span className="mini-slot">10:30</span>
                  <span className="mini-slot off">11:00</span>
                  <span className="mini-slot">11:30</span>
                </div>
              </div>
            </div>
          </div>
        </header>

        <section className="lp-section">
          <span className="lp-eyebrow">Tudo em um só lugar</span>
          <h2 className="lp-h2">Ferramentas simples para vender mais</h2>
          <p className="lp-sub">Feito para restaurantes, doçarias, barbearias, salões, clínicas e qualquer negócio que atende por WhatsApp.</p>
          <div className="lp-grid">
            {RECURSOS.map((r) => (
              <article key={r.titulo} className="lp-feature">
                <div className="lp-icon"><i className={`fa-solid ${r.icone}`} /></div>
                <h3>{r.titulo}</h3>
                <p>{r.texto}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="lp-section" style={{ paddingTop: 0 }}>
          <span className="lp-eyebrow">Personalização</span>
          <h2 className="lp-h2">Deixe com a cara da sua marca</h2>
          <p className="lp-sub">
            Escolha entre paletas ou use a cor do seu logo, troque a fonte, o estilo dos cantos, o modo
            claro/escuro, a capa e adicione endereço, Instagram e horário de funcionamento. Veja tudo mudando
            ao vivo antes de salvar.
          </p>
          <div className="lp-themes">
            {PALETAS.map((p) => (
              <span key={p.id} className="lp-theme-dot" style={{ background: p.primaria }} title={p.nome} />
            ))}
          </div>
        </section>

        <section className="lp-section" style={{ paddingTop: 0 }}>
          <span className="lp-eyebrow">Como funciona</span>
          <h2 className="lp-h2">Do cadastro ao primeiro pedido</h2>
          <div className="lp-steps">
            <div className="lp-step"><h3>Crie sua conta</h3><p>Informe o nome do negócio, o WhatsApp e escolha seu link personalizado.</p></div>
            <div className="lp-step"><h3>Monte sua vitrine</h3><p>Cadastre produtos ou serviços, defina horários e personalize o visual.</p></div>
            <div className="lp-step"><h3>Compartilhe o link</h3><p>Coloque na bio do Instagram e receba pedidos e agendamentos no WhatsApp.</p></div>
          </div>
        </section>

        <section className="lp-band">
          <h2>Pronto para colocar seu negócio no ar?</h2>
          <p>Crie sua vitrine agora e comece a receber pedidos e agendamentos ainda hoje.</p>
          <Link to="/login" className="btn btn-lg">Criar minha vitrine</Link>
        </section>

        <footer className="lp-footer">
          <span>© 2026 ConectaLocal. Todos os direitos reservados.</span>
          <span>Cardápios e agendas para negócios locais.</span>
        </footer>
      </div>
    </div>
  );
}

import { Link } from 'react-router-dom';

export default function LandingPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#fafaf9', color: '#1c1917' }}>
      {/* HEADER */}
      <header style={{ background: '#fff', borderBottom: '1px solid #e7e5e4', padding: '1.1rem 2rem' }}>
        <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <strong style={{ fontSize: '1.4rem', color: '#1c1917' }}>
              Conecta<span style={{ color: '#b45309' }}>Local</span>
            </strong>
          </div>

          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <Link to="/login" style={{ textDecoration: 'none', color: '#44403c', fontWeight: 600 }}>
              Entrar
            </Link>
            <Link
              to="/login"
              style={{
                background: '#b45309',
                color: '#fff',
                padding: '0.6rem 1.25rem',
                borderRadius: '9999px',
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: '0.9rem'
              }}
            >
              Criar Minha Vitrine
            </Link>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section style={{ padding: '5rem 2rem', textAlign: 'center', maxWidth: '820px', margin: '0 auto' }}>
        <span
          style={{
            background: '#fef3c7',
            color: '#92400e',
            padding: '0.4rem 1rem',
            borderRadius: '9999px',
            fontSize: '0.85rem',
            fontWeight: 700
          }}
        >
          Plataforma Completa para Negócios Locais
        </span>

        <h1 style={{ fontSize: '2.8rem', lineHeight: 1.15, margin: '1.25rem 0', fontFamily: 'Playfair Display, serif' }}>
          Seu cardápio digital ou agenda online em um único link profissional.
        </h1>

        <p style={{ fontSize: '1.15rem', color: '#57534e', marginBottom: '2.25rem', lineHeight: 1.6 }}>
          Ideal para restaurantes, docerias, barbearias e clínicas. Personalize com a sua marca,
          receba pedidos sem taxas por venda ou deixe seus clientes agendarem horários sozinhos.
        </p>

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link
            to="/login"
            style={{
              background: '#1c1917',
              color: '#fff',
              padding: '0.95rem 2rem',
              borderRadius: '9999px',
              textDecoration: 'none',
              fontWeight: 600,
              fontSize: '1rem'
            }}
          >
            Começar Gratuitamente
          </Link>

          <Link
            to="/raizes"
            style={{
              background: '#fff',
              color: '#1c1917',
              border: '1px solid #d6d3d1',
              padding: '0.95rem 2rem',
              borderRadius: '9999px',
              textDecoration: 'none',
              fontWeight: 600,
              fontSize: '1rem'
            }}
          >
            Ver Demonstração (Restaurante)
          </Link>
        </div>
      </section>

      {/* DOIS MODOS */}
      <section className="container" style={{ padding: '2rem 2rem 5rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
        <div className="checkout-card" style={{ background: '#fff' }}>
          <span style={{ color: '#b45309', fontWeight: 700, fontSize: '0.85rem' }}>MODO CATÁLOGO & DELIVERY</span>
          <h3 style={{ margin: '0.5rem 0' }}>Restaurantes, Docerias e Lojas</h3>
          <p style={{ color: '#57534e', lineHeight: 1.6 }}>
            Cardápio interativo por categorias, sacola de compras, aplicação de cupons de desconto
            e envio direto do pedido formatado.
          </p>
        </div>

        <div className="checkout-card" style={{ background: '#fff' }}>
          <span style={{ color: '#b45309', fontWeight: 700, fontSize: '0.85rem' }}>MODO AGENDA INTELIGENTE</span>
          <h3 style={{ margin: '0.5rem 0' }}>Barbearias, Salões e Clínicas</h3>
          <p style={{ color: '#57534e', lineHeight: 1.6 }}>
            O cliente escolhe o serviço, seleciona o profissional preferido e visualiza apenas os horários
            realmente livres no dia, sem conflito de agenda.
          </p>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ background: '#1c1917', color: '#a8a29e', padding: '2rem', textAlign: 'center' }}>
        <p>&copy; 2026 ConectaLocal. Todos os direitos reservados.</p>
      </footer>
    </div>
  );
}
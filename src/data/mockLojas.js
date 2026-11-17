export const LOJAS_MOCK = {
  "raizes": {
    id: 1,
    slug: "raizes",
    nome: "Raízes",
    subtitulo: "COZINHA ORIGEM",
    telefone: "5543999999999",
    logo: "/img/logotipo.png",
    corPrimaria: "#b45309",   // Laranja/Âmbar original do Raízes
    corSecundaria: "#92400e",
    cupons: [
      { codigo: "BEMVINDO10", descontoPercentual: 10 },
      { codigo: "RAIZES20", descontoPercentual: 20 }
    ],
    categorias: [
      { id: "entradas", nome: "Para Começar (Entradas)" },
      { id: "parrilla", nome: "Parrilla Raízes" },
      { id: "hamburgueres", nome: "Hambúrgueres & Para Compartilhar" },
      { id: "bebidas", nome: "Bebidas & Drinks" }
    ],
    produtos: [
      {
        id: 1,
        categoriaId: "entradas",
        tag: "Entrada",
        nome: "Empanadas x4",
        descricao: "Massa crocante de canjica de milho com recheio à escolha: carne, frango ou queijo.",
        preco: 24.00
      },
      {
        id: 2,
        categoriaId: "entradas",
        tag: "Entrada",
        nome: "Encocado Caribeño",
        descricao: "Camarões ao molho cremoso de coco, gratinados e servidos com patacones crocantes.",
        preco: 58.00
      },
      {
        id: 3,
        categoriaId: "parrilla",
        tag: "Parrilla · Bovina",
        nome: "Contra Filé na Chapa",
        descricao: "400 g de contra filé na chapa, com batatas cozidas, salada, chimichurri e banana-da-terra madura.",
        preco: 82.00
      },
      {
        id: 4,
        categoriaId: "hamburgueres",
        tag: "Para compartilhar",
        nome: "Picada Colombianíssima",
        descricao: "Contrafilé, frango, carne suína, linguiça colombiana, costela suína, torresmo crocante e batatas fritas.",
        opcoes: [
          { label: "Para 2", preco: 98.00 },
          { label: "Para 4", preco: 185.00 }
        ]
      },
      {
        id: 5,
        categoriaId: "bebidas",
        tag: "Drink",
        nome: "Limonero 43",
        descricao: "Licor 43, Sprite e limão.",
        preco: 28.00
      }
    ]
  },

  // EXEMPLO DE SEGUNDO CLIENTE NO MESMO DOMÍNIO (/doceria-ana)
  "doceria-ana": {
    id: 2,
    slug: "doceria-ana",
    nome: "Doceria da Ana",
    subtitulo: "CONFEITARIA ARTESANAL",
    telefone: "5543988888888",
    logo: "/img/logotipo.png",
    corPrimaria: "#be185d",   // Rosa escuro (muda o site inteiro automaticamente)
    corSecundaria: "#9d174d",
    cupons: [
      { codigo: "DOCE15", descontoPercentual: 15 }
    ],
    categorias: [
      { id: "bolos", nome: "Bolos Festivos" },
      { id: "docinhos", nome: "Cento de Doces" }
    ],
    produtos: [
      {
        id: 101,
        categoriaId: "bolos",
        tag: "Mais Pedido",
        nome: "Bolo Red Velvet",
        descricao: "Massa aveludada com recheio de cream cheese e frutas vermelhas.",
        opcoes: [
          { label: "1,5 kg (15 fatias)", preco: 110.00 },
          { label: "2,5 kg (25 fatias)", preco: 175.00 }
        ]
      },
      {
        id: 102,
        categoriaId: "docinhos",
        tag: "Festa",
        nome: "Brigadeiro Belga (50 un.)",
        descricao: "Feito com chocolate meio amargo Callebaut.",
        preco: 85.00
      }
    ]
  }
};
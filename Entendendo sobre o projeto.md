ventsy/
├── src/
│   ├── app/              # Roteamento e Layouts (App Router)
│   │   ├── (auth)/       # Grupo de rotas para Login/Cadastro
│   │   ├── (dashboard)/  # Grupo de rotas protegidas (Painel)
│   │   ├── api/          # Route Handlers (Backend interno)
│   │   └── layout.tsx    # Layout raiz (Providers, Fonts, etc)
│   ├── components/       # Componentes de UI reaproveitáveis
│   │   ├── ui/           # Componentes base (Botões, Inputs - Shadcn style)
│   │   ├── forms/        # Formulários específicos
│   │   └── shared/       # Componentes globais (Navbar, Footer)
│   ├── lib/              # Configurações de clientes (Supabase, Utils)
│   │   ├── supabase/     # Cliente do banco e tipos do banco
│   │   └── utils.ts      # Funções utilitárias (Tailwind merge, etc)
│   ├── services/         # Lógica de negócio e chamadas ao banco (Server Actions)
│   └── hooks/            # Hooks customizados para o front-end
├── public/               # Ativos estáticos (Logos, Ícones)
├── supabase/             # Migrations e configurações do CLI local
├── .env.local            # Variáveis de ambiente
└── next.config.js        # Configurações do Next.js

APP/ --» Ficam as páginas e rotas

page.tsx - rota
layout.tsx - estrutura compartilhada (header, sidebar, etc)
cada pasta = uma rota

COMPONENTS/ --» Reutilização -- Se usa em mais de um lugar vira componente

LIB/ --» Coisas mais técnicas e utilitárias.

SERVICES/ --» Regras do Negócio - organiza chamadas externas
         --» Evita misturar lógica dentro do componente

HOOKS/ --»  Custom hooks do React

STYLES/ --» Estilos - CSS 

PUBLIC/ --» Arquivos estáticos

TYPES/ --»  Tipagens - TypeScript

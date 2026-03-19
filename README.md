# VENTSY — Next.js

Plataforma de busca de espaços para eventos, migrada de HTML puro para **Next.js 14** com App Router.

## Estrutura do projeto

```
ventsy-next/
├── app/
│   ├── layout.tsx          # Layout raiz (fonte, metadata, CSS global)
│   ├── globals.css         # Todos os estilos (migrados do HTML original)
│   ├── page.tsx            # Página inicial
│   ├── busca/page.tsx      # Resultados de busca (= buscapropriedade.html)
│   ├── propriedade/page.tsx# Detalhe do espaço (= propriedade.html)
│   └── cadastro/page.tsx      # Login (= login.html)
│   └── como-funciona/page.tsx      # Login (= login.html)
│   └── fale-conosco/page.tsx      # Login (= login.html)
│   └── login/page.tsx      # Login (= login.html)
│   └── planos/page.tsx 
│   └── privacidade/page.tsx      # Login (= login.html)
│   └── termos/page.tsx      # Login (= login.html)
├── components/
│   ├── Header.tsx          # Cabeçalho fixo com logo + busca + menu
│   ├── SearchBar.tsx       # Barra de busca completa (Onde/Quando/Evento/Convidados)
│   ├── OndeSearch.tsx      # Input de localização estilo Airbnb com Supabase
│   ├── EventoDropdown.tsx  # Seletor multi-evento em grid
│   ├── HomeFeed.tsx        # Feed principal: busca Supabase e renderiza categorias
│   ├── CategorySection.tsx # Seção de categoria com carrossel
│   ├── PropertyCard.tsx    # Card de propriedade (básico / pro / ultra)
│   └── Footer.tsx          # Rodapé
│   └── FilterModal.tsx         
│   └── SearchResultCard.tsx
├── lib/
│   ├── supabase.ts         # Cliente Supabase
│   └── data.ts             # Constantes: CATS, ESTADOS, EVENTOS_CATS, DEMO_PROPS, helpers
├── next.config.js
├── tsconfig.json
└── package.json
└──.env.local
└──.gitignore
└──eslint.config.mjs
└──next.config.is
└──next.config.ts
└──next-end.d.ts
└── package-lock.json 
└── postcss.config.mjs
└── README.md
├── .netx/
│   ├── dev/         
│   └── types/ 
│   ├── _event_22208.json_         
├── .vercel/
│    ├── cache/
│    ├── project.json
│    ├── README.txt
├── {app,components,lib,public}/empty
├── node_modules/....
├── public
│    ├── file.svg
│    ├── globe.svg
│    ├── next.svg
│    ├── vercel.svg
│    ├── window.svg
├── .git/   
     ├──hooks/
     ├──info/ 
     ├──logs/
     ├──objects/
     ├──refs/
     ├──COMMIT_EDITMSG
     ├──config
     ├──description
     ├──FETCH_HEAD
     ├──HEAD
     ├──index
                 

```

## Como rodar

```bash
# Instalar dependências
npm install

# Rodar em desenvolvimento
npm run dev

# Acessar em
http://localhost:3000
```

## Variáveis de ambiente (opcional)

Crie um `.env.local` na raiz:

```
NEXT_PUBLIC_SUPABASE_URL=https://hxvlfalgrduitevbhqvq.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_chave_aqui
```

## O que foi migrado

| HTML original | Next.js |
|---|---|
| `index.html` | `app/page.tsx` + `HomeFeed.tsx` |
| `buscapropriedade.html` | `app/busca/page.tsx` |
| `propriedade.html` | `app/propriedade/page.tsx` |
| `login.html` | `app/login/page.tsx` |
| `<script>` inline | Componentes React com hooks |
| `flatpickr` CDN | `import flatpickr` (npm) |
| `supabase` CDN | `@supabase/supabase-js` (npm) |
| CSS inline `<style>` | `app/globals.css` |

## Próximos passos sugeridos

- `app/cadastro/page.tsx` — Cadastro de espaço
- `app/dashboard/page.tsx` — Dashboard do proprietário
- `app/planos/page.tsx` — Planos e preços
- `app/como-funciona/page.tsx` — Como funciona
- `app/fale-conosco/page.tsx` — Contato
- Adicionar `middleware.ts` para proteger rotas autenticadas
- Substituir `img` por `next/image` para otimização automática

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      acesso_eventos_log: {
        Row: {
          credencial_id: string | null
          criado_em: string
          direcao: string
          evento_id: string | null
          id: string
          ponto: string | null
          usuario_id: string
          zona: string
        }
        Insert: {
          credencial_id?: string | null
          criado_em?: string
          direcao: string
          evento_id?: string | null
          id?: string
          ponto?: string | null
          usuario_id: string
          zona?: string
        }
        Update: {
          credencial_id?: string | null
          criado_em?: string
          direcao?: string
          evento_id?: string | null
          id?: string
          ponto?: string | null
          usuario_id?: string
          zona?: string
        }
        Relationships: [
          {
            foreignKeyName: "acesso_eventos_log_credencial_id_fkey"
            columns: ["credencial_id"]
            isOneToOne: false
            referencedRelation: "credenciais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acesso_eventos_log_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "clientes_eventos"
            referencedColumns: ["id"]
          },
        ]
      }
      acesso_ocorrencias: {
        Row: {
          atualizado_em: string
          criado_em: string
          descricao: string | null
          evento_id: string | null
          gravidade: string
          id: string
          local: string | null
          responsavel: string | null
          status: string
          tipo: string
          titulo: string
          usuario_id: string
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          descricao?: string | null
          evento_id?: string | null
          gravidade?: string
          id?: string
          local?: string | null
          responsavel?: string | null
          status?: string
          tipo?: string
          titulo: string
          usuario_id: string
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          descricao?: string | null
          evento_id?: string | null
          gravidade?: string
          id?: string
          local?: string | null
          responsavel?: string | null
          status?: string
          tipo?: string
          titulo?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "acesso_ocorrencias_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "clientes_eventos"
            referencedColumns: ["id"]
          },
        ]
      }
      acesso_zonas: {
        Row: {
          ativo: boolean
          atualizado_em: string
          capacidade: number
          codigo: string
          cor: string | null
          criado_em: string
          evento_id: string | null
          id: string
          nome: string
          ordem: number
          tipos_permitidos: string[]
          usuario_id: string
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          capacidade?: number
          codigo: string
          cor?: string | null
          criado_em?: string
          evento_id?: string | null
          id?: string
          nome: string
          ordem?: number
          tipos_permitidos?: string[]
          usuario_id: string
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          capacidade?: number
          codigo?: string
          cor?: string | null
          criado_em?: string
          evento_id?: string | null
          id?: string
          nome?: string
          ordem?: number
          tipos_permitidos?: string[]
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "acesso_zonas_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "clientes_eventos"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_auditoria: {
        Row: {
          acao: string
          alvo: string | null
          ator_email: string | null
          ator_id: string | null
          criado_em: string
          detalhe: Json | null
          id: number
          modulo: string
        }
        Insert: {
          acao: string
          alvo?: string | null
          ator_email?: string | null
          ator_id?: string | null
          criado_em?: string
          detalhe?: Json | null
          id?: never
          modulo: string
        }
        Update: {
          acao?: string
          alvo?: string | null
          ator_email?: string | null
          ator_id?: string | null
          criado_em?: string
          detalhe?: Json | null
          id?: never
          modulo?: string
        }
        Relationships: []
      }
      admin_membros: {
        Row: {
          ativo: boolean
          atualizado_em: string
          concedido_por: string | null
          criado_em: string
          papel: string
          permissoes: Json
          usuario_id: string
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          concedido_por?: string | null
          criado_em?: string
          papel?: string
          permissoes?: Json
          usuario_id: string
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          concedido_por?: string | null
          criado_em?: string
          papel?: string
          permissoes?: Json
          usuario_id?: string
        }
        Relationships: []
      }
      analytics_eventos: {
        Row: {
          cidade: string | null
          created_at: string | null
          evento_tipo: string
          id: string
          propriedade_id: string
        }
        Insert: {
          cidade?: string | null
          created_at?: string | null
          evento_tipo: string
          id?: string
          propriedade_id: string
        }
        Update: {
          cidade?: string | null
          created_at?: string | null
          evento_tipo?: string
          id?: string
          propriedade_id?: string
        }
        Relationships: []
      }
      analytics_restaurante: {
        Row: {
          created_at: string | null
          evento_tipo: string
          id: string
          origem: string | null
          restaurante_id: string | null
        }
        Insert: {
          created_at?: string | null
          evento_tipo: string
          id?: string
          origem?: string | null
          restaurante_id?: string | null
        }
        Update: {
          created_at?: string | null
          evento_tipo?: string
          id?: string
          origem?: string | null
          restaurante_id?: string | null
        }
        Relationships: []
      }
      assinaturas: {
        Row: {
          atualizado_em: string
          criado_em: string
          downgrade_para: string | null
          fim_periodo: string
          gateway_ref: string | null
          id: string
          inicio_periodo: string
          metodo_pagamento: string | null
          moeda: string
          plano_ativo: string
          status: string
          usuario_id: string
          valor_pago: number
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          downgrade_para?: string | null
          fim_periodo?: string
          gateway_ref?: string | null
          id?: string
          inicio_periodo?: string
          metodo_pagamento?: string | null
          moeda?: string
          plano_ativo?: string
          status?: string
          usuario_id: string
          valor_pago?: number
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          downgrade_para?: string | null
          fim_periodo?: string
          gateway_ref?: string | null
          id?: string
          inicio_periodo?: string
          metodo_pagamento?: string | null
          moeda?: string
          plano_ativo?: string
          status?: string
          usuario_id?: string
          valor_pago?: number
        }
        Relationships: []
      }
      ativos: {
        Row: {
          ano_fabricacao: number | null
          apolice: string | null
          atualizado_em: string
          baixado_em: string | null
          categoria: string
          codigo: string | null
          criado_em: string
          data_aquisicao: string | null
          descricao: string | null
          estado: string
          fornecedor_id: string | null
          foto_url: string | null
          garantia_ate: string | null
          id: string
          localizacao: string | null
          marca: string | null
          metodo_deprec: string
          modelo: string | null
          motivo_baixa: string | null
          nome: string
          num_serie: string | null
          obs: string | null
          placa: string | null
          propriedade_id: number | null
          renavam: string | null
          responsavel: string | null
          seguradora: string | null
          seguro_ate: string | null
          usuario_id: string
          valor_aquisicao_num: number
          valor_baixa_num: number | null
          valor_residual_num: number
          vida_util_meses: number | null
        }
        Insert: {
          ano_fabricacao?: number | null
          apolice?: string | null
          atualizado_em?: string
          baixado_em?: string | null
          categoria?: string
          codigo?: string | null
          criado_em?: string
          data_aquisicao?: string | null
          descricao?: string | null
          estado?: string
          fornecedor_id?: string | null
          foto_url?: string | null
          garantia_ate?: string | null
          id?: string
          localizacao?: string | null
          marca?: string | null
          metodo_deprec?: string
          modelo?: string | null
          motivo_baixa?: string | null
          nome: string
          num_serie?: string | null
          obs?: string | null
          placa?: string | null
          propriedade_id?: number | null
          renavam?: string | null
          responsavel?: string | null
          seguradora?: string | null
          seguro_ate?: string | null
          usuario_id: string
          valor_aquisicao_num?: number
          valor_baixa_num?: number | null
          valor_residual_num?: number
          vida_util_meses?: number | null
        }
        Update: {
          ano_fabricacao?: number | null
          apolice?: string | null
          atualizado_em?: string
          baixado_em?: string | null
          categoria?: string
          codigo?: string | null
          criado_em?: string
          data_aquisicao?: string | null
          descricao?: string | null
          estado?: string
          fornecedor_id?: string | null
          foto_url?: string | null
          garantia_ate?: string | null
          id?: string
          localizacao?: string | null
          marca?: string | null
          metodo_deprec?: string
          modelo?: string | null
          motivo_baixa?: string | null
          nome?: string
          num_serie?: string | null
          obs?: string | null
          placa?: string | null
          propriedade_id?: number | null
          renavam?: string | null
          responsavel?: string | null
          seguradora?: string | null
          seguro_ate?: string | null
          usuario_id?: string
          valor_aquisicao_num?: number
          valor_baixa_num?: number | null
          valor_residual_num?: number
          vida_util_meses?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ativos_propriedade_id_fkey"
            columns: ["propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
        ]
      }
      ativos_docs: {
        Row: {
          arquivo_nome: string | null
          arquivo_tamanho: number | null
          arquivo_tipo: string | null
          arquivo_url: string | null
          ativo_id: string
          criado_em: string
          id: string
          nome: string
          obs: string | null
          tipo: string
          usuario_id: string
          validade: string | null
        }
        Insert: {
          arquivo_nome?: string | null
          arquivo_tamanho?: number | null
          arquivo_tipo?: string | null
          arquivo_url?: string | null
          ativo_id: string
          criado_em?: string
          id?: string
          nome: string
          obs?: string | null
          tipo?: string
          usuario_id: string
          validade?: string | null
        }
        Update: {
          arquivo_nome?: string | null
          arquivo_tamanho?: number | null
          arquivo_tipo?: string | null
          arquivo_url?: string | null
          ativo_id?: string
          criado_em?: string
          id?: string
          nome?: string
          obs?: string | null
          tipo?: string
          usuario_id?: string
          validade?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ativos_docs_ativo_id_fkey"
            columns: ["ativo_id"]
            isOneToOne: false
            referencedRelation: "ativos"
            referencedColumns: ["id"]
          },
        ]
      }
      ativos_manutencao: {
        Row: {
          ativo_id: string
          criado_em: string
          custo_num: number
          data_abertura: string
          data_conclusao: string | null
          descricao: string | null
          fornecedor_id: string | null
          id: string
          obs: string | null
          os_id: string | null
          prazo: string | null
          prioridade: string
          responsavel: string | null
          status: string
          tipo: string
          titulo: string
          usuario_id: string
        }
        Insert: {
          ativo_id: string
          criado_em?: string
          custo_num?: number
          data_abertura?: string
          data_conclusao?: string | null
          descricao?: string | null
          fornecedor_id?: string | null
          id?: string
          obs?: string | null
          os_id?: string | null
          prazo?: string | null
          prioridade?: string
          responsavel?: string | null
          status?: string
          tipo?: string
          titulo: string
          usuario_id: string
        }
        Update: {
          ativo_id?: string
          criado_em?: string
          custo_num?: number
          data_abertura?: string
          data_conclusao?: string | null
          descricao?: string | null
          fornecedor_id?: string | null
          id?: string
          obs?: string | null
          os_id?: string | null
          prazo?: string | null
          prioridade?: string
          responsavel?: string | null
          status?: string
          tipo?: string
          titulo?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ativos_manutencao_ativo_id_fkey"
            columns: ["ativo_id"]
            isOneToOne: false
            referencedRelation: "ativos"
            referencedColumns: ["id"]
          },
        ]
      }
      ativos_mov: {
        Row: {
          ativo_id: string
          criado_em: string
          data: string
          de_local: string | null
          de_propriedade_id: number | null
          de_responsavel: string | null
          descricao: string | null
          id: string
          para_local: string | null
          para_propriedade_id: number | null
          para_responsavel: string | null
          tipo: string
          usuario_id: string
          valor_num: number | null
        }
        Insert: {
          ativo_id: string
          criado_em?: string
          data?: string
          de_local?: string | null
          de_propriedade_id?: number | null
          de_responsavel?: string | null
          descricao?: string | null
          id?: string
          para_local?: string | null
          para_propriedade_id?: number | null
          para_responsavel?: string | null
          tipo?: string
          usuario_id: string
          valor_num?: number | null
        }
        Update: {
          ativo_id?: string
          criado_em?: string
          data?: string
          de_local?: string | null
          de_propriedade_id?: number | null
          de_responsavel?: string | null
          descricao?: string | null
          id?: string
          para_local?: string | null
          para_propriedade_id?: number | null
          para_responsavel?: string | null
          tipo?: string
          usuario_id?: string
          valor_num?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ativos_mov_ativo_id_fkey"
            columns: ["ativo_id"]
            isOneToOne: false
            referencedRelation: "ativos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ativos_mov_de_propriedade_id_fkey"
            columns: ["de_propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ativos_mov_para_propriedade_id_fkey"
            columns: ["para_propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
        ]
      }
      auditoria_log: {
        Row: {
          acao: string
          antes: Json | null
          ator_email: string | null
          ator_id: string | null
          ator_nome: string | null
          criado_em: string
          depois: Json | null
          descricao: string | null
          entidade: string | null
          entidade_id: string | null
          id: number
          ip: string | null
          meta: Json | null
          sensivel: boolean
          sucesso: boolean
          user_agent: string | null
          usuario_id: string
        }
        Insert: {
          acao: string
          antes?: Json | null
          ator_email?: string | null
          ator_id?: string | null
          ator_nome?: string | null
          criado_em?: string
          depois?: Json | null
          descricao?: string | null
          entidade?: string | null
          entidade_id?: string | null
          id?: never
          ip?: string | null
          meta?: Json | null
          sensivel?: boolean
          sucesso?: boolean
          user_agent?: string | null
          usuario_id: string
        }
        Update: {
          acao?: string
          antes?: Json | null
          ator_email?: string | null
          ator_id?: string | null
          ator_nome?: string | null
          criado_em?: string
          depois?: Json | null
          descricao?: string | null
          entidade?: string | null
          entidade_id?: string | null
          id?: never
          ip?: string | null
          meta?: Json | null
          sensivel?: boolean
          sucesso?: boolean
          user_agent?: string | null
          usuario_id?: string
        }
        Relationships: []
      }
      automacoes: {
        Row: {
          acao: string
          acao_config: Json
          ativo: boolean
          atualizado_em: string
          condicao: Json
          criado_em: string
          gatilho: string
          id: string
          n_exec: number
          nome: string
          ultima_exec: string | null
          usuario_id: string
        }
        Insert: {
          acao?: string
          acao_config?: Json
          ativo?: boolean
          atualizado_em?: string
          condicao?: Json
          criado_em?: string
          gatilho: string
          id?: string
          n_exec?: number
          nome: string
          ultima_exec?: string | null
          usuario_id: string
        }
        Update: {
          acao?: string
          acao_config?: Json
          ativo?: boolean
          atualizado_em?: string
          condicao?: Json
          criado_em?: string
          gatilho?: string
          id?: string
          n_exec?: number
          nome?: string
          ultima_exec?: string | null
          usuario_id?: string
        }
        Relationships: []
      }
      automacoes_log: {
        Row: {
          acao: string | null
          alvo_id: string | null
          alvo_label: string | null
          alvo_tipo: string | null
          automacao_id: string | null
          canal: string | null
          criado_em: string
          dedup_key: string
          detalhe: string | null
          gatilho: string | null
          id: string
          sucesso: boolean
          usuario_id: string
        }
        Insert: {
          acao?: string | null
          alvo_id?: string | null
          alvo_label?: string | null
          alvo_tipo?: string | null
          automacao_id?: string | null
          canal?: string | null
          criado_em?: string
          dedup_key: string
          detalhe?: string | null
          gatilho?: string | null
          id?: string
          sucesso?: boolean
          usuario_id: string
        }
        Update: {
          acao?: string | null
          alvo_id?: string | null
          alvo_label?: string | null
          alvo_tipo?: string | null
          automacao_id?: string | null
          canal?: string | null
          criado_em?: string
          dedup_key?: string
          detalhe?: string | null
          gatilho?: string | null
          id?: string
          sucesso?: boolean
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automacoes_log_automacao_id_fkey"
            columns: ["automacao_id"]
            isOneToOne: false
            referencedRelation: "automacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      avaliacoes: {
        Row: {
          autor: string | null
          avatar: string | null
          criado_em: string
          data: string | null
          destaque: boolean
          evento_tipo: string | null
          id: number
          nota: number
          oculta: boolean
          propriedade_id: number | null
          respondido_em: string | null
          resposta: string | null
          texto: string | null
          user_id: string | null
          verificada: boolean
        }
        Insert: {
          autor?: string | null
          avatar?: string | null
          criado_em?: string
          data?: string | null
          destaque?: boolean
          evento_tipo?: string | null
          id?: never
          nota?: number
          oculta?: boolean
          propriedade_id?: number | null
          respondido_em?: string | null
          resposta?: string | null
          texto?: string | null
          user_id?: string | null
          verificada?: boolean
        }
        Update: {
          autor?: string | null
          avatar?: string | null
          criado_em?: string
          data?: string | null
          destaque?: boolean
          evento_tipo?: string | null
          id?: never
          nota?: number
          oculta?: boolean
          propriedade_id?: number | null
          respondido_em?: string | null
          resposta?: string | null
          texto?: string | null
          user_id?: string | null
          verificada?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "avaliacoes_propriedade_fk"
            columns: ["propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
        ]
      }
      avaliacoes_evento: {
        Row: {
          criado_em: string
          id: number
          propriedade_id: number | null
          verificada: boolean | null
        }
        Insert: {
          criado_em?: string
          id?: number
          propriedade_id?: number | null
          verificada?: boolean | null
        }
        Update: {
          criado_em?: string
          id?: number
          propriedade_id?: number | null
          verificada?: boolean | null
        }
        Relationships: []
      }
      avaliacoes_restaurante: {
        Row: {
          aprovada: boolean | null
          comentario: string | null
          criado_em: string | null
          id: string
          motivo_remocao: string | null
          nome_avaliador: string | null
          nota: number | null
          removida: boolean | null
          resposta_dono: string | null
          resposta_em: string | null
          restaurante_id: string | null
          solicitacao_remocao: boolean | null
          usuario_id: string | null
        }
        Insert: {
          aprovada?: boolean | null
          comentario?: string | null
          criado_em?: string | null
          id?: string
          motivo_remocao?: string | null
          nome_avaliador?: string | null
          nota?: number | null
          removida?: boolean | null
          resposta_dono?: string | null
          resposta_em?: string | null
          restaurante_id?: string | null
          solicitacao_remocao?: boolean | null
          usuario_id?: string | null
        }
        Update: {
          aprovada?: boolean | null
          comentario?: string | null
          criado_em?: string | null
          id?: string
          motivo_remocao?: string | null
          nome_avaliador?: string | null
          nota?: number | null
          removida?: boolean | null
          resposta_dono?: string | null
          resposta_em?: string | null
          restaurante_id?: string | null
          solicitacao_remocao?: boolean | null
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "avaliacoes_restaurante_restaurante_id_fkey"
            columns: ["restaurante_id"]
            isOneToOne: false
            referencedRelation: "restaurantes"
            referencedColumns: ["id"]
          },
        ]
      }
      bar_evento: {
        Row: {
          atualizado_em: string
          consumo: Json
          criado_em: string
          custo_num: number
          drinks: Json
          evento_id: string
          id: string
          obs: string | null
          perdas_num: number
          receita_num: number
          tipo: string
          usuario_id: string
        }
        Insert: {
          atualizado_em?: string
          consumo?: Json
          criado_em?: string
          custo_num?: number
          drinks?: Json
          evento_id: string
          id?: string
          obs?: string | null
          perdas_num?: number
          receita_num?: number
          tipo?: string
          usuario_id: string
        }
        Update: {
          atualizado_em?: string
          consumo?: Json
          criado_em?: string
          custo_num?: number
          drinks?: Json
          evento_id?: string
          id?: string
          obs?: string | null
          perdas_num?: number
          receita_num?: number
          tipo?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bar_evento_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "clientes_eventos"
            referencedColumns: ["id"]
          },
        ]
      }
      bilheteria_cupons: {
        Row: {
          ativo: boolean
          atualizado_em: string
          bilheteria_id: string
          codigo: string
          criado_em: string
          id: string
          limite: number
          tipo: string
          usados: number
          usuario_id: string
          validade: string | null
          valor_num: number
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          bilheteria_id: string
          codigo: string
          criado_em?: string
          id?: string
          limite?: number
          tipo?: string
          usados?: number
          usuario_id: string
          validade?: string | null
          valor_num?: number
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          bilheteria_id?: string
          codigo?: string
          criado_em?: string
          id?: string
          limite?: number
          tipo?: string
          usados?: number
          usuario_id?: string
          validade?: string | null
          valor_num?: number
        }
        Relationships: [
          {
            foreignKeyName: "bilheteria_cupons_bilheteria_id_fkey"
            columns: ["bilheteria_id"]
            isOneToOne: false
            referencedRelation: "bilheteria_eventos"
            referencedColumns: ["id"]
          },
        ]
      }
      bilheteria_eventos: {
        Row: {
          atualizado_em: string
          campos_extras: Json
          capacidade: number
          criado_em: string
          descricao: string | null
          evento_id: string | null
          id: string
          imagem_url: string | null
          local_texto: string | null
          moeda: string
          pagina_token: string
          propriedade_id: number | null
          status: string
          taxa_servico: number
          titulo: string
          usuario_id: string
          venda_fim: string | null
          venda_inicio: string | null
        }
        Insert: {
          atualizado_em?: string
          campos_extras?: Json
          capacidade?: number
          criado_em?: string
          descricao?: string | null
          evento_id?: string | null
          id?: string
          imagem_url?: string | null
          local_texto?: string | null
          moeda?: string
          pagina_token: string
          propriedade_id?: number | null
          status?: string
          taxa_servico?: number
          titulo: string
          usuario_id: string
          venda_fim?: string | null
          venda_inicio?: string | null
        }
        Update: {
          atualizado_em?: string
          campos_extras?: Json
          capacidade?: number
          criado_em?: string
          descricao?: string | null
          evento_id?: string | null
          id?: string
          imagem_url?: string | null
          local_texto?: string | null
          moeda?: string
          pagina_token?: string
          propriedade_id?: number | null
          status?: string
          taxa_servico?: number
          titulo?: string
          usuario_id?: string
          venda_fim?: string | null
          venda_inicio?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bilheteria_eventos_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "clientes_eventos"
            referencedColumns: ["id"]
          },
        ]
      }
      bloqueios_recorrentes: {
        Row: {
          ativo: boolean
          criado_em: string
          dia_semana: number
          espaco_id: number | null
          hora_fim: string
          hora_inicio: string
          id: number
          motivo: string | null
          propriedade_id: number
          usuario_id: string
        }
        Insert: {
          ativo?: boolean
          criado_em?: string
          dia_semana: number
          espaco_id?: number | null
          hora_fim?: string
          hora_inicio?: string
          id?: never
          motivo?: string | null
          propriedade_id: number
          usuario_id: string
        }
        Update: {
          ativo?: boolean
          criado_em?: string
          dia_semana?: number
          espaco_id?: number | null
          hora_fim?: string
          hora_inicio?: string
          id?: never
          motivo?: string | null
          propriedade_id?: number
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bloqueios_recorrentes_espaco_id_fkey"
            columns: ["espaco_id"]
            isOneToOne: false
            referencedRelation: "espacos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bloqueios_recorrentes_propriedade_id_fkey"
            columns: ["propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
        ]
      }
      buscas: {
        Row: {
          created_at: string | null
          id: string
          tipo_evento: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          tipo_evento: string
        }
        Update: {
          created_at?: string | null
          id?: string
          tipo_evento?: string
        }
        Relationships: []
      }
      buscas_log: {
        Row: {
          criado_em: string | null
          id: string
          resultados: number | null
          termo: string
        }
        Insert: {
          criado_em?: string | null
          id?: string
          resultados?: number | null
          termo: string
        }
        Update: {
          criado_em?: string | null
          id?: string
          resultados?: number | null
          termo?: string
        }
        Relationships: []
      }
      cadastros_incompletos: {
        Row: {
          atualizado_em: string
          criado_em: string
          documento: string | null
          email: string
          erro_msg: string | null
          id: string
          nome: string | null
          origem: string | null
          ref_codigo: string | null
          status: string
          tipo_doc: string | null
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          documento?: string | null
          email: string
          erro_msg?: string | null
          id?: string
          nome?: string | null
          origem?: string | null
          ref_codigo?: string | null
          status?: string
          tipo_doc?: string | null
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          documento?: string | null
          email?: string
          erro_msg?: string | null
          id?: string
          nome?: string | null
          origem?: string | null
          ref_codigo?: string | null
          status?: string
          tipo_doc?: string | null
        }
        Relationships: []
      }
      campanhas: {
        Row: {
          agendada_para: string | null
          assunto: string | null
          atualizado_em: string
          canal: string
          corpo: string
          criado_em: string
          enviada_em: string | null
          id: string
          n_abertos: number
          n_clicados: number
          n_descadastros: number
          n_entregues: number
          n_enviados: number
          n_falhas: number
          n_total: number
          nome: string
          segmento: Json
          status: string
          usuario_id: string
        }
        Insert: {
          agendada_para?: string | null
          assunto?: string | null
          atualizado_em?: string
          canal?: string
          corpo?: string
          criado_em?: string
          enviada_em?: string | null
          id?: string
          n_abertos?: number
          n_clicados?: number
          n_descadastros?: number
          n_entregues?: number
          n_enviados?: number
          n_falhas?: number
          n_total?: number
          nome: string
          segmento?: Json
          status?: string
          usuario_id: string
        }
        Update: {
          agendada_para?: string | null
          assunto?: string | null
          atualizado_em?: string
          canal?: string
          corpo?: string
          criado_em?: string
          enviada_em?: string | null
          id?: string
          n_abertos?: number
          n_clicados?: number
          n_descadastros?: number
          n_entregues?: number
          n_enviados?: number
          n_falhas?: number
          n_total?: number
          nome?: string
          segmento?: Json
          status?: string
          usuario_id?: string
        }
        Relationships: []
      }
      campanhas_envios: {
        Row: {
          aberto_em: string | null
          campanha_id: string
          clicado_em: string | null
          cliente_id: string | null
          contato: string
          criado_em: string
          enviado_em: string | null
          erro: string | null
          id: string
          nome: string | null
          status: string
          usuario_id: string
          vars: Json
        }
        Insert: {
          aberto_em?: string | null
          campanha_id: string
          clicado_em?: string | null
          cliente_id?: string | null
          contato: string
          criado_em?: string
          enviado_em?: string | null
          erro?: string | null
          id?: string
          nome?: string | null
          status?: string
          usuario_id: string
          vars?: Json
        }
        Update: {
          aberto_em?: string | null
          campanha_id?: string
          clicado_em?: string | null
          cliente_id?: string | null
          contato?: string
          criado_em?: string
          enviado_em?: string | null
          erro?: string | null
          id?: string
          nome?: string | null
          status?: string
          usuario_id?: string
          vars?: Json
        }
        Relationships: [
          {
            foreignKeyName: "campanhas_envios_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "campanhas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campanhas_envios_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      cardapio_categorias: {
        Row: {
          id: string
          nome: string
          ordem: number | null
          restaurante_id: string | null
        }
        Insert: {
          id?: string
          nome: string
          ordem?: number | null
          restaurante_id?: string | null
        }
        Update: {
          id?: string
          nome?: string
          ordem?: number | null
          restaurante_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cardapio_categorias_restaurante_id_fkey"
            columns: ["restaurante_id"]
            isOneToOne: false
            referencedRelation: "restaurantes"
            referencedColumns: ["id"]
          },
        ]
      }
      cardapio_itens: {
        Row: {
          categoria_id: string | null
          criado_em: string | null
          descricao: string | null
          destaque: boolean | null
          disponivel: boolean | null
          foto_url: string | null
          id: string
          nome: string
          ordem: number | null
          preco: number | null
          restaurante_id: string | null
        }
        Insert: {
          categoria_id?: string | null
          criado_em?: string | null
          descricao?: string | null
          destaque?: boolean | null
          disponivel?: boolean | null
          foto_url?: string | null
          id?: string
          nome: string
          ordem?: number | null
          preco?: number | null
          restaurante_id?: string | null
        }
        Update: {
          categoria_id?: string | null
          criado_em?: string | null
          descricao?: string | null
          destaque?: boolean | null
          disponivel?: boolean | null
          foto_url?: string | null
          id?: string
          nome?: string
          ordem?: number | null
          preco?: number | null
          restaurante_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cardapio_itens_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "cardapio_categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cardapio_itens_restaurante_id_fkey"
            columns: ["restaurante_id"]
            isOneToOne: false
            referencedRelation: "restaurantes"
            referencedColumns: ["id"]
          },
        ]
      }
      cardapios: {
        Row: {
          ativo: boolean
          atualizado_em: string
          criado_em: string
          id: string
          itens: Json
          nome: string
          obs: string | null
          preco_pessoa_num: number
          tipo: string
          usuario_id: string
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          id?: string
          itens?: Json
          nome: string
          obs?: string | null
          preco_pessoa_num?: number
          tipo?: string
          usuario_id: string
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          id?: string
          itens?: Json
          nome?: string
          obs?: string | null
          preco_pessoa_num?: number
          tipo?: string
          usuario_id?: string
        }
        Relationships: []
      }
      catering_evento: {
        Row: {
          ajustes: Json
          atualizado_em: string
          baixado_em: string | null
          cardapio_id: string | null
          consumo_movs: string[]
          convidados: number
          criado_em: string
          custo_previsto_num: number
          custo_real_num: number
          evento_id: string
          fator_ajuste: number
          id: string
          obs: string | null
          receita_num: number
          requisicao_id: string | null
          restricoes: Json
          usuario_id: string
        }
        Insert: {
          ajustes?: Json
          atualizado_em?: string
          baixado_em?: string | null
          cardapio_id?: string | null
          consumo_movs?: string[]
          convidados?: number
          criado_em?: string
          custo_previsto_num?: number
          custo_real_num?: number
          evento_id: string
          fator_ajuste?: number
          id?: string
          obs?: string | null
          receita_num?: number
          requisicao_id?: string | null
          restricoes?: Json
          usuario_id: string
        }
        Update: {
          ajustes?: Json
          atualizado_em?: string
          baixado_em?: string | null
          cardapio_id?: string | null
          consumo_movs?: string[]
          convidados?: number
          criado_em?: string
          custo_previsto_num?: number
          custo_real_num?: number
          evento_id?: string
          fator_ajuste?: number
          id?: string
          obs?: string | null
          receita_num?: number
          requisicao_id?: string | null
          restricoes?: Json
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "catering_evento_cardapio_id_fkey"
            columns: ["cardapio_id"]
            isOneToOne: false
            referencedRelation: "cardapios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catering_evento_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "clientes_eventos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catering_evento_requisicao_id_fkey"
            columns: ["requisicao_id"]
            isOneToOne: false
            referencedRelation: "requisicoes"
            referencedColumns: ["id"]
          },
        ]
      }
      centros_custo: {
        Row: {
          ativo: boolean
          criado_em: string
          id: string
          nome: string
          ref_id: string | null
          tipo: string
          usuario_id: string
        }
        Insert: {
          ativo?: boolean
          criado_em?: string
          id?: string
          nome: string
          ref_id?: string | null
          tipo?: string
          usuario_id: string
        }
        Update: {
          ativo?: boolean
          criado_em?: string
          id?: string
          nome?: string
          ref_id?: string | null
          tipo?: string
          usuario_id?: string
        }
        Relationships: []
      }
      clientes: {
        Row: {
          aniversario: string | null
          atualizado_em: string
          cidade: string | null
          criado_em: string
          doc: string | null
          email: string | null
          endereco: string | null
          estado: string | null
          id: string
          nome: string
          obs: string | null
          origem: string | null
          segmento: string | null
          tags: string[]
          telefone: string | null
          tipo: string
          usuario_id: string
          vip: boolean
          whatsapp: string | null
        }
        Insert: {
          aniversario?: string | null
          atualizado_em?: string
          cidade?: string | null
          criado_em?: string
          doc?: string | null
          email?: string | null
          endereco?: string | null
          estado?: string | null
          id?: string
          nome: string
          obs?: string | null
          origem?: string | null
          segmento?: string | null
          tags?: string[]
          telefone?: string | null
          tipo?: string
          usuario_id: string
          vip?: boolean
          whatsapp?: string | null
        }
        Update: {
          aniversario?: string | null
          atualizado_em?: string
          cidade?: string | null
          criado_em?: string
          doc?: string | null
          email?: string | null
          endereco?: string | null
          estado?: string | null
          id?: string
          nome?: string
          obs?: string | null
          origem?: string | null
          segmento?: string | null
          tags?: string[]
          telefone?: string | null
          tipo?: string
          usuario_id?: string
          vip?: boolean
          whatsapp?: string | null
        }
        Relationships: []
      }
      clientes_eventos: {
        Row: {
          atracoes: string | null
          atualizado_em: string
          checkin_materiais: string | null
          checklist: Json | null
          cliente_id: string | null
          como_conheceu: string | null
          contato_emergencia: string | null
          criado_em: string
          data_fim: string | null
          data_inicio: string | null
          documento: string | null
          email: string | null
          forma_pagamento: string | null
          formato_recepcao: string | null
          fornecedores: string | null
          horario_desmontagem: string | null
          horario_fim: string | null
          horario_inicio: string | null
          horario_montagem: string | null
          id: string
          indicado_por_id: string | null
          layout_mesas: string | null
          motivo_descarte: string | null
          necessidades_tecnicas: string | null
          nome_evento: string
          observacoes: string | null
          parceiro_id: string | null
          parcelas: Json | null
          propriedade_id: number | null
          qtd_adultos: number | null
          qtd_criancas: number | null
          quem_contratou: string
          restricoes_alimentares: string | null
          servicos_casa: string | null
          status: string
          taxas_extras: string | null
          telefones: string[] | null
          tipo_evento: string | null
          usuario_id: string
          valor_total: string | null
          valor_total_num: number | null
          vendedor_equipe_id: number | null
          vip_autoridades: string | null
        }
        Insert: {
          atracoes?: string | null
          atualizado_em?: string
          checkin_materiais?: string | null
          checklist?: Json | null
          cliente_id?: string | null
          como_conheceu?: string | null
          contato_emergencia?: string | null
          criado_em?: string
          data_fim?: string | null
          data_inicio?: string | null
          documento?: string | null
          email?: string | null
          forma_pagamento?: string | null
          formato_recepcao?: string | null
          fornecedores?: string | null
          horario_desmontagem?: string | null
          horario_fim?: string | null
          horario_inicio?: string | null
          horario_montagem?: string | null
          id?: string
          indicado_por_id?: string | null
          layout_mesas?: string | null
          motivo_descarte?: string | null
          necessidades_tecnicas?: string | null
          nome_evento: string
          observacoes?: string | null
          parceiro_id?: string | null
          parcelas?: Json | null
          propriedade_id?: number | null
          qtd_adultos?: number | null
          qtd_criancas?: number | null
          quem_contratou: string
          restricoes_alimentares?: string | null
          servicos_casa?: string | null
          status?: string
          taxas_extras?: string | null
          telefones?: string[] | null
          tipo_evento?: string | null
          usuario_id: string
          valor_total?: string | null
          valor_total_num?: number | null
          vendedor_equipe_id?: number | null
          vip_autoridades?: string | null
        }
        Update: {
          atracoes?: string | null
          atualizado_em?: string
          checkin_materiais?: string | null
          checklist?: Json | null
          cliente_id?: string | null
          como_conheceu?: string | null
          contato_emergencia?: string | null
          criado_em?: string
          data_fim?: string | null
          data_inicio?: string | null
          documento?: string | null
          email?: string | null
          forma_pagamento?: string | null
          formato_recepcao?: string | null
          fornecedores?: string | null
          horario_desmontagem?: string | null
          horario_fim?: string | null
          horario_inicio?: string | null
          horario_montagem?: string | null
          id?: string
          indicado_por_id?: string | null
          layout_mesas?: string | null
          motivo_descarte?: string | null
          necessidades_tecnicas?: string | null
          nome_evento?: string
          observacoes?: string | null
          parceiro_id?: string | null
          parcelas?: Json | null
          propriedade_id?: number | null
          qtd_adultos?: number | null
          qtd_criancas?: number | null
          quem_contratou?: string
          restricoes_alimentares?: string | null
          servicos_casa?: string | null
          status?: string
          taxas_extras?: string | null
          telefones?: string[] | null
          tipo_evento?: string | null
          usuario_id?: string
          valor_total?: string | null
          valor_total_num?: number | null
          vendedor_equipe_id?: number | null
          vip_autoridades?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clientes_eventos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clientes_eventos_propriedade_id_fkey"
            columns: ["propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clientes_eventos_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "perfis_publicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clientes_eventos_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_ce_indicado_por"
            columns: ["indicado_por_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_ce_parceiro"
            columns: ["parceiro_id"]
            isOneToOne: false
            referencedRelation: "parceiros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_ce_vendedor_equipe"
            columns: ["vendedor_equipe_id"]
            isOneToOne: false
            referencedRelation: "equipe"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes_interacoes: {
        Row: {
          cliente_id: string
          conteudo: string | null
          criado_em: string
          data: string
          id: string
          tipo: string
          usuario_id: string
        }
        Insert: {
          cliente_id: string
          conteudo?: string | null
          criado_em?: string
          data?: string
          id?: string
          tipo?: string
          usuario_id: string
        }
        Update: {
          cliente_id?: string
          conteudo?: string | null
          criado_em?: string
          data?: string
          id?: string
          tipo?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clientes_interacoes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      clima_snapshots: {
        Row: {
          capturado_em: string
          dia: string | null
          evento_id: string
          fonte: string
          id: string
          latitude: number | null
          longitude: number | null
          previsao: Json
          usuario_id: string
        }
        Insert: {
          capturado_em?: string
          dia?: string | null
          evento_id: string
          fonte?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          previsao?: Json
          usuario_id: string
        }
        Update: {
          capturado_em?: string
          dia?: string | null
          evento_id?: string
          fonte?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          previsao?: Json
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clima_snapshots_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: true
            referencedRelation: "clientes_eventos"
            referencedColumns: ["id"]
          },
        ]
      }
      comissoes: {
        Row: {
          aprovada_em: string | null
          apurada_em: string | null
          atualizado_em: string
          base_num: number
          beneficiario_id: string | null
          beneficiario_nome: string | null
          beneficiario_tipo: string
          competencia: string | null
          criado_em: string
          evento_id: string | null
          id: string
          lancamento_id: number | null
          meio: string | null
          obs: string | null
          origem: string
          pago_em: string | null
          percentual: number | null
          regra_id: string | null
          status: string
          usuario_id: string
          valor_num: number
        }
        Insert: {
          aprovada_em?: string | null
          apurada_em?: string | null
          atualizado_em?: string
          base_num?: number
          beneficiario_id?: string | null
          beneficiario_nome?: string | null
          beneficiario_tipo: string
          competencia?: string | null
          criado_em?: string
          evento_id?: string | null
          id?: string
          lancamento_id?: number | null
          meio?: string | null
          obs?: string | null
          origem?: string
          pago_em?: string | null
          percentual?: number | null
          regra_id?: string | null
          status?: string
          usuario_id: string
          valor_num?: number
        }
        Update: {
          aprovada_em?: string | null
          apurada_em?: string | null
          atualizado_em?: string
          base_num?: number
          beneficiario_id?: string | null
          beneficiario_nome?: string | null
          beneficiario_tipo?: string
          competencia?: string | null
          criado_em?: string
          evento_id?: string | null
          id?: string
          lancamento_id?: number | null
          meio?: string | null
          obs?: string | null
          origem?: string
          pago_em?: string | null
          percentual?: number | null
          regra_id?: string | null
          status?: string
          usuario_id?: string
          valor_num?: number
        }
        Relationships: [
          {
            foreignKeyName: "comissoes_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "clientes_eventos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comissoes_regra_id_fkey"
            columns: ["regra_id"]
            isOneToOne: false
            referencedRelation: "comissoes_regras"
            referencedColumns: ["id"]
          },
        ]
      }
      comissoes_regras: {
        Row: {
          ativo: boolean
          atualizado_em: string
          base: string
          beneficiario_id: string | null
          beneficiario_tipo: string
          condicao: Json
          criado_em: string
          id: string
          nome: string
          percentual: number | null
          prioridade: number
          usuario_id: string
          valor_fixo_num: number | null
          vigencia_fim: string | null
          vigencia_inicio: string | null
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          base?: string
          beneficiario_id?: string | null
          beneficiario_tipo?: string
          condicao?: Json
          criado_em?: string
          id?: string
          nome?: string
          percentual?: number | null
          prioridade?: number
          usuario_id: string
          valor_fixo_num?: number | null
          vigencia_fim?: string | null
          vigencia_inicio?: string | null
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          base?: string
          beneficiario_id?: string | null
          beneficiario_tipo?: string
          condicao?: Json
          criado_em?: string
          id?: string
          nome?: string
          percentual?: number | null
          prioridade?: number
          usuario_id?: string
          valor_fixo_num?: number | null
          vigencia_fim?: string | null
          vigencia_inicio?: string | null
        }
        Relationships: []
      }
      comodidades: {
        Row: {
          id: number
          nome: string
        }
        Insert: {
          id?: number
          nome: string
        }
        Update: {
          id?: number
          nome?: string
        }
        Relationships: []
      }
      compliance_checklists: {
        Row: {
          atualizado_em: string
          criado_em: string
          id: string
          itens: Json
          nome: string
          tipo_evento: string | null
          usuario_id: string
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          id?: string
          itens?: Json
          nome: string
          tipo_evento?: string | null
          usuario_id: string
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          id?: string
          itens?: Json
          nome?: string
          tipo_evento?: string | null
          usuario_id?: string
        }
        Relationships: []
      }
      conciliacao_extrato: {
        Row: {
          conta_bancaria_id: string | null
          criado_em: string
          data: string
          descricao: string | null
          id: string
          lancamento_id: number | null
          status: string
          usuario_id: string
          valor_num: number
        }
        Insert: {
          conta_bancaria_id?: string | null
          criado_em?: string
          data: string
          descricao?: string | null
          id?: string
          lancamento_id?: number | null
          status?: string
          usuario_id: string
          valor_num?: number
        }
        Update: {
          conta_bancaria_id?: string | null
          criado_em?: string
          data?: string
          descricao?: string | null
          id?: string
          lancamento_id?: number | null
          status?: string
          usuario_id?: string
          valor_num?: number
        }
        Relationships: [
          {
            foreignKeyName: "conciliacao_extrato_conta_bancaria_id_fkey"
            columns: ["conta_bancaria_id"]
            isOneToOne: false
            referencedRelation: "contas_bancarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conciliacao_extrato_lancamento_id_fkey"
            columns: ["lancamento_id"]
            isOneToOne: false
            referencedRelation: "lancamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      contas_bancarias: {
        Row: {
          ativo: boolean
          atualizado_em: string
          banco: string | null
          criado_em: string
          id: string
          nome: string
          saldo_inicial_num: number
          tipo: string
          usuario_id: string
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          banco?: string | null
          criado_em?: string
          id?: string
          nome: string
          saldo_inicial_num?: number
          tipo?: string
          usuario_id: string
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          banco?: string | null
          criado_em?: string
          id?: string
          nome?: string
          saldo_inicial_num?: number
          tipo?: string
          usuario_id?: string
        }
        Relationships: []
      }
      contas_pagar: {
        Row: {
          anexo_nome: string | null
          anexo_url: string | null
          aprovado: boolean
          aprovado_em: string | null
          atualizado_em: string
          categoria: string
          criado_em: string
          descricao: string
          fornecedor_id: string | null
          id: string
          lancamento_id: number | null
          metodo: string | null
          obs: string | null
          ordem_compra_id: string | null
          pago_em: string | null
          plano_conta: string | null
          recorrencia: Json
          recorrencia_pai: string | null
          recorrente: boolean
          status: string
          usuario_id: string
          valor_num: number
          vencimento: string | null
        }
        Insert: {
          anexo_nome?: string | null
          anexo_url?: string | null
          aprovado?: boolean
          aprovado_em?: string | null
          atualizado_em?: string
          categoria?: string
          criado_em?: string
          descricao: string
          fornecedor_id?: string | null
          id?: string
          lancamento_id?: number | null
          metodo?: string | null
          obs?: string | null
          ordem_compra_id?: string | null
          pago_em?: string | null
          plano_conta?: string | null
          recorrencia?: Json
          recorrencia_pai?: string | null
          recorrente?: boolean
          status?: string
          usuario_id: string
          valor_num?: number
          vencimento?: string | null
        }
        Update: {
          anexo_nome?: string | null
          anexo_url?: string | null
          aprovado?: boolean
          aprovado_em?: string | null
          atualizado_em?: string
          categoria?: string
          criado_em?: string
          descricao?: string
          fornecedor_id?: string | null
          id?: string
          lancamento_id?: number | null
          metodo?: string | null
          obs?: string | null
          ordem_compra_id?: string | null
          pago_em?: string | null
          plano_conta?: string | null
          recorrencia?: Json
          recorrencia_pai?: string | null
          recorrente?: boolean
          status?: string
          usuario_id?: string
          valor_num?: number
          vencimento?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contas_pagar_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contas_pagar_lancamento_id_fkey"
            columns: ["lancamento_id"]
            isOneToOne: false
            referencedRelation: "lancamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contas_pagar_ordem_compra_id_fkey"
            columns: ["ordem_compra_id"]
            isOneToOne: false
            referencedRelation: "pedidos_compra"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contas_pagar_recorrencia_pai_fkey"
            columns: ["recorrencia_pai"]
            isOneToOne: false
            referencedRelation: "contas_pagar"
            referencedColumns: ["id"]
          },
        ]
      }
      contratos: {
        Row: {
          assinado_em: string | null
          atualizado_em: string
          cancelado_em: string | null
          cliente_id: string | null
          conteudo_final: string
          criado_em: string
          enviado_em: string | null
          evento_id: string | null
          id: string
          link_token: string | null
          moeda: string
          motivo: string | null
          multa_num: number | null
          numero: string
          observacoes: string | null
          pdf_url: string | null
          proposta_id: string | null
          rescindido_em: string | null
          status: string
          template_id: string | null
          titulo: string | null
          usuario_id: string
          valor_num: number
          variaveis: Json
          vencimento: string | null
        }
        Insert: {
          assinado_em?: string | null
          atualizado_em?: string
          cancelado_em?: string | null
          cliente_id?: string | null
          conteudo_final?: string
          criado_em?: string
          enviado_em?: string | null
          evento_id?: string | null
          id?: string
          link_token?: string | null
          moeda?: string
          motivo?: string | null
          multa_num?: number | null
          numero: string
          observacoes?: string | null
          pdf_url?: string | null
          proposta_id?: string | null
          rescindido_em?: string | null
          status?: string
          template_id?: string | null
          titulo?: string | null
          usuario_id: string
          valor_num?: number
          variaveis?: Json
          vencimento?: string | null
        }
        Update: {
          assinado_em?: string | null
          atualizado_em?: string
          cancelado_em?: string | null
          cliente_id?: string | null
          conteudo_final?: string
          criado_em?: string
          enviado_em?: string | null
          evento_id?: string | null
          id?: string
          link_token?: string | null
          moeda?: string
          motivo?: string | null
          multa_num?: number | null
          numero?: string
          observacoes?: string | null
          pdf_url?: string | null
          proposta_id?: string | null
          rescindido_em?: string | null
          status?: string
          template_id?: string | null
          titulo?: string | null
          usuario_id?: string
          valor_num?: number
          variaveis?: Json
          vencimento?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contratos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "clientes_eventos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "contratos_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      contratos_assinaturas: {
        Row: {
          assinatura_img: string | null
          assinou_em: string | null
          contrato_id: string
          criado_em: string
          email: string | null
          hash: string | null
          id: string
          ip: string | null
          metodo: string | null
          obrigatorio: boolean
          ordem: number
          papel: string
          signatario_doc: string | null
          signatario_nome: string
          user_agent: string | null
          usuario_id: string
        }
        Insert: {
          assinatura_img?: string | null
          assinou_em?: string | null
          contrato_id: string
          criado_em?: string
          email?: string | null
          hash?: string | null
          id?: string
          ip?: string | null
          metodo?: string | null
          obrigatorio?: boolean
          ordem?: number
          papel?: string
          signatario_doc?: string | null
          signatario_nome: string
          user_agent?: string | null
          usuario_id: string
        }
        Update: {
          assinatura_img?: string | null
          assinou_em?: string | null
          contrato_id?: string
          criado_em?: string
          email?: string | null
          hash?: string | null
          id?: string
          ip?: string | null
          metodo?: string | null
          obrigatorio?: boolean
          ordem?: number
          papel?: string
          signatario_doc?: string | null
          signatario_nome?: string
          user_agent?: string | null
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contratos_assinaturas_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
        ]
      }
      contratos_templates: {
        Row: {
          ativo: boolean
          atualizado_em: string
          clausulas: Json
          corpo: string
          criado_em: string
          id: string
          nome: string
          tipo_evento: string | null
          usuario_id: string
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          clausulas?: Json
          corpo?: string
          criado_em?: string
          id?: string
          nome: string
          tipo_evento?: string | null
          usuario_id: string
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          clausulas?: Json
          corpo?: string
          criado_em?: string
          id?: string
          nome?: string
          tipo_evento?: string | null
          usuario_id?: string
        }
        Relationships: []
      }
      conversas: {
        Row: {
          created_at: string | null
          id: string
          owner_id: string
          propriedade_id: number
          ultima_mensagem: string | null
          ultima_mensagem_em: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          owner_id: string
          propriedade_id: number
          ultima_mensagem?: string | null
          ultima_mensagem_em?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          owner_id?: string
          propriedade_id?: number
          ultima_mensagem?: string | null
          ultima_mensagem_em?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversas_propriedade_id_fkey"
            columns: ["propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
        ]
      }
      convidados: {
        Row: {
          acompanhantes: number
          atualizado_em: string
          criado_em: string
          email: string | null
          evento_id: string
          id: string
          mesa: string | null
          nome: string
          observacao: string | null
          origem: string
          restricao_alimentar: string | null
          status: string
          telefone: string | null
          usuario_id: string
        }
        Insert: {
          acompanhantes?: number
          atualizado_em?: string
          criado_em?: string
          email?: string | null
          evento_id: string
          id?: string
          mesa?: string | null
          nome: string
          observacao?: string | null
          origem?: string
          restricao_alimentar?: string | null
          status?: string
          telefone?: string | null
          usuario_id: string
        }
        Update: {
          acompanhantes?: number
          atualizado_em?: string
          criado_em?: string
          email?: string | null
          evento_id?: string
          id?: string
          mesa?: string | null
          nome?: string
          observacao?: string | null
          origem?: string
          restricao_alimentar?: string | null
          status?: string
          telefone?: string | null
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "convidados_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "clientes_eventos"
            referencedColumns: ["id"]
          },
        ]
      }
      cotacao_itens: {
        Row: {
          cotacao_id: string
          criado_em: string
          descricao: string | null
          disponivel: boolean
          id: string
          prazo_dias: number | null
          quantidade: number
          requisicao_item_id: string | null
          usuario_id: string
          valor_unit_num: number
        }
        Insert: {
          cotacao_id: string
          criado_em?: string
          descricao?: string | null
          disponivel?: boolean
          id?: string
          prazo_dias?: number | null
          quantidade?: number
          requisicao_item_id?: string | null
          usuario_id: string
          valor_unit_num?: number
        }
        Update: {
          cotacao_id?: string
          criado_em?: string
          descricao?: string | null
          disponivel?: boolean
          id?: string
          prazo_dias?: number | null
          quantidade?: number
          requisicao_item_id?: string | null
          usuario_id?: string
          valor_unit_num?: number
        }
        Relationships: [
          {
            foreignKeyName: "cotacao_itens_cotacao_id_fkey"
            columns: ["cotacao_id"]
            isOneToOne: false
            referencedRelation: "cotacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotacao_itens_requisicao_item_id_fkey"
            columns: ["requisicao_item_id"]
            isOneToOne: false
            referencedRelation: "requisicao_itens"
            referencedColumns: ["id"]
          },
        ]
      }
      cotacoes: {
        Row: {
          anexo_nome: string | null
          anexo_url: string | null
          atualizado_em: string
          condicao: string | null
          criado_em: string
          enviada_em: string | null
          escolhida: boolean
          fornecedor_id: string | null
          fornecedor_nome: string | null
          id: string
          obs: string | null
          prazo_dias: number | null
          recebida_em: string | null
          requisicao_id: string
          status: string
          usuario_id: string
          validade: string | null
          valor_total_num: number
        }
        Insert: {
          anexo_nome?: string | null
          anexo_url?: string | null
          atualizado_em?: string
          condicao?: string | null
          criado_em?: string
          enviada_em?: string | null
          escolhida?: boolean
          fornecedor_id?: string | null
          fornecedor_nome?: string | null
          id?: string
          obs?: string | null
          prazo_dias?: number | null
          recebida_em?: string | null
          requisicao_id: string
          status?: string
          usuario_id: string
          validade?: string | null
          valor_total_num?: number
        }
        Update: {
          anexo_nome?: string | null
          anexo_url?: string | null
          atualizado_em?: string
          condicao?: string | null
          criado_em?: string
          enviada_em?: string | null
          escolhida?: boolean
          fornecedor_id?: string | null
          fornecedor_nome?: string | null
          id?: string
          obs?: string | null
          prazo_dias?: number | null
          recebida_em?: string | null
          requisicao_id?: string
          status?: string
          usuario_id?: string
          validade?: string | null
          valor_total_num?: number
        }
        Relationships: [
          {
            foreignKeyName: "cotacoes_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotacoes_requisicao_id_fkey"
            columns: ["requisicao_id"]
            isOneToOne: false
            referencedRelation: "requisicoes"
            referencedColumns: ["id"]
          },
        ]
      }
      credenciais: {
        Row: {
          atualizado_em: string
          categoria_ingresso_id: string | null
          criado_em: string
          doc: string | null
          empresa: string | null
          evento_id: string | null
          foto_url: string | null
          id: string
          nome: string
          obs: string | null
          qr_token: string
          status: string
          tipo: string
          usuario_id: string
          zonas: string[]
        }
        Insert: {
          atualizado_em?: string
          categoria_ingresso_id?: string | null
          criado_em?: string
          doc?: string | null
          empresa?: string | null
          evento_id?: string | null
          foto_url?: string | null
          id?: string
          nome: string
          obs?: string | null
          qr_token: string
          status?: string
          tipo?: string
          usuario_id: string
          zonas?: string[]
        }
        Update: {
          atualizado_em?: string
          categoria_ingresso_id?: string | null
          criado_em?: string
          doc?: string | null
          empresa?: string | null
          evento_id?: string | null
          foto_url?: string | null
          id?: string
          nome?: string
          obs?: string | null
          qr_token?: string
          status?: string
          tipo?: string
          usuario_id?: string
          zonas?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "credenciais_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "clientes_eventos"
            referencedColumns: ["id"]
          },
        ]
      }
      creditos_bonus: {
        Row: {
          criado_em: string
          dias: number
          id: string
          origem_indicacao_id: string | null
          tipo: string
          usado: boolean
          usado_em: string | null
          usuario_id: string
        }
        Insert: {
          criado_em?: string
          dias?: number
          id?: string
          origem_indicacao_id?: string | null
          tipo?: string
          usado?: boolean
          usado_em?: string | null
          usuario_id: string
        }
        Update: {
          criado_em?: string
          dias?: number
          id?: string
          origem_indicacao_id?: string | null
          tipo?: string
          usado?: boolean
          usado_em?: string | null
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "creditos_bonus_origem_indicacao_id_fkey"
            columns: ["origem_indicacao_id"]
            isOneToOne: false
            referencedRelation: "indicacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creditos_bonus_origem_indicacao_id_fkey"
            columns: ["origem_indicacao_id"]
            isOneToOne: false
            referencedRelation: "v_indicacoes_dashboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creditos_bonus_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "perfis_publicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creditos_bonus_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      cupons: {
        Row: {
          ativo: boolean | null
          codigo: string
          criado_em: string | null
          descricao: string | null
          id: string
          limite: number | null
          plano: string | null
          tipo: string
          usos_atual: number | null
          validade: string | null
          valor: number
        }
        Insert: {
          ativo?: boolean | null
          codigo: string
          criado_em?: string | null
          descricao?: string | null
          id?: string
          limite?: number | null
          plano?: string | null
          tipo: string
          usos_atual?: number | null
          validade?: string | null
          valor: number
        }
        Update: {
          ativo?: boolean | null
          codigo?: string
          criado_em?: string | null
          descricao?: string | null
          id?: string
          limite?: number | null
          plano?: string | null
          tipo?: string
          usos_atual?: number | null
          validade?: string | null
          valor?: number
        }
        Relationships: []
      }
      descadastros: {
        Row: {
          canal: string
          cliente_id: string | null
          contato: string
          criado_em: string
          id: string
          usuario_id: string
        }
        Insert: {
          canal?: string
          cliente_id?: string | null
          contato: string
          criado_em?: string
          id?: string
          usuario_id: string
        }
        Update: {
          canal?: string
          cliente_id?: string | null
          contato?: string
          criado_em?: string
          id?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "descadastros_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      diary_entries: {
        Row: {
          content: string
          created_at: string
          id: string
          is_important: boolean
          lead_id: string | null
          reminder_date: string | null
          tags: string[]
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_important?: boolean
          lead_id?: string | null
          reminder_date?: string | null
          tags?: string[]
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_important?: boolean
          lead_id?: string | null
          reminder_date?: string | null
          tags?: string[]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "diary_entries_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "clientes_eventos"
            referencedColumns: ["id"]
          },
        ]
      }
      disponibilidade: {
        Row: {
          bloqueado: boolean
          data: string
          min_horas: number | null
          motivo: string | null
          preco: number | null
          prop_id: number
        }
        Insert: {
          bloqueado?: boolean
          data: string
          min_horas?: number | null
          motivo?: string | null
          preco?: number | null
          prop_id?: number
        }
        Update: {
          bloqueado?: boolean
          data?: string
          min_horas?: number | null
          motivo?: string | null
          preco?: number | null
          prop_id?: number
        }
        Relationships: []
      }
      documentos: {
        Row: {
          arquivo_nome: string | null
          arquivo_tamanho: number | null
          arquivo_tipo: string | null
          arquivo_url: string | null
          categoria: string
          created_at: string
          dias_aviso: number
          emissao: string | null
          endereco_orgao: string | null
          horario_orgao: string | null
          id: number
          link_renovacao: string | null
          login_portal: string | null
          nome: string
          numero: string | null
          obs: string | null
          orgao: string | null
          passo_online: string | null
          passo_presencial: string | null
          prop_id: number | null
          senha_portal: string | null
          telefone_orgao: string | null
          usuario_id: string
          vencimento: string | null
        }
        Insert: {
          arquivo_nome?: string | null
          arquivo_tamanho?: number | null
          arquivo_tipo?: string | null
          arquivo_url?: string | null
          categoria?: string
          created_at?: string
          dias_aviso?: number
          emissao?: string | null
          endereco_orgao?: string | null
          horario_orgao?: string | null
          id?: never
          link_renovacao?: string | null
          login_portal?: string | null
          nome: string
          numero?: string | null
          obs?: string | null
          orgao?: string | null
          passo_online?: string | null
          passo_presencial?: string | null
          prop_id?: number | null
          senha_portal?: string | null
          telefone_orgao?: string | null
          usuario_id: string
          vencimento?: string | null
        }
        Update: {
          arquivo_nome?: string | null
          arquivo_tamanho?: number | null
          arquivo_tipo?: string | null
          arquivo_url?: string | null
          categoria?: string
          created_at?: string
          dias_aviso?: number
          emissao?: string | null
          endereco_orgao?: string | null
          horario_orgao?: string | null
          id?: never
          link_renovacao?: string | null
          login_portal?: string | null
          nome?: string
          numero?: string | null
          obs?: string | null
          orgao?: string | null
          passo_online?: string | null
          passo_presencial?: string | null
          prop_id?: number | null
          senha_portal?: string | null
          telefone_orgao?: string | null
          usuario_id?: string
          vencimento?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documentos_prop_id_fkey"
            columns: ["prop_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
        ]
      }
      documentos_restaurante: {
        Row: {
          arquivo_url: string | null
          categoria: string | null
          criado_em: string | null
          id: string
          nome: string
          observacoes: string | null
          restaurante_id: string | null
          validade: string | null
        }
        Insert: {
          arquivo_url?: string | null
          categoria?: string | null
          criado_em?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          restaurante_id?: string | null
          validade?: string | null
        }
        Update: {
          arquivo_url?: string | null
          categoria?: string | null
          criado_em?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          restaurante_id?: string | null
          validade?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documentos_restaurante_restaurante_id_fkey"
            columns: ["restaurante_id"]
            isOneToOne: false
            referencedRelation: "restaurantes"
            referencedColumns: ["id"]
          },
        ]
      }
      empresa_config: {
        Row: {
          atualizado_em: string
          cnpj: string | null
          config_fiscal: Json
          contatos: Json
          cores_marca: Json
          criado_em: string
          endereco: Json
          exclusao_solicitada_em: string | null
          fantasia: string | null
          fuso: string
          idioma: string
          ie: string | null
          im: string | null
          logo_url: string | null
          moeda: string
          notificacoes: Json
          preferencias: Json
          razao_social: string | null
          retencao_meses: number
          usuario_id: string
        }
        Insert: {
          atualizado_em?: string
          cnpj?: string | null
          config_fiscal?: Json
          contatos?: Json
          cores_marca?: Json
          criado_em?: string
          endereco?: Json
          exclusao_solicitada_em?: string | null
          fantasia?: string | null
          fuso?: string
          idioma?: string
          ie?: string | null
          im?: string | null
          logo_url?: string | null
          moeda?: string
          notificacoes?: Json
          preferencias?: Json
          razao_social?: string | null
          retencao_meses?: number
          usuario_id: string
        }
        Update: {
          atualizado_em?: string
          cnpj?: string | null
          config_fiscal?: Json
          contatos?: Json
          cores_marca?: Json
          criado_em?: string
          endereco?: Json
          exclusao_solicitada_em?: string | null
          fantasia?: string | null
          fuso?: string
          idioma?: string
          ie?: string | null
          im?: string | null
          logo_url?: string | null
          moeda?: string
          notificacoes?: Json
          preferencias?: Json
          razao_social?: string | null
          retencao_meses?: number
          usuario_id?: string
        }
        Relationships: []
      }
      equipamentos: {
        Row: {
          ativo: boolean
          atualizado_em: string
          categoria: string
          criado_em: string
          custo_locacao_num: number
          descricao: string | null
          fornecedor_id: string | null
          foto_url: string | null
          id: string
          nome: string
          obs: string | null
          preco_locacao_num: number
          proprio: boolean
          quantidade_total: number
          sku: string | null
          unidade: string
          usuario_id: string
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          categoria?: string
          criado_em?: string
          custo_locacao_num?: number
          descricao?: string | null
          fornecedor_id?: string | null
          foto_url?: string | null
          id?: string
          nome: string
          obs?: string | null
          preco_locacao_num?: number
          proprio?: boolean
          quantidade_total?: number
          sku?: string | null
          unidade?: string
          usuario_id: string
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          categoria?: string
          criado_em?: string
          custo_locacao_num?: number
          descricao?: string | null
          fornecedor_id?: string | null
          foto_url?: string | null
          id?: string
          nome?: string
          obs?: string | null
          preco_locacao_num?: number
          proprio?: boolean
          quantidade_total?: number
          sku?: string | null
          unidade?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipamentos_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
        ]
      }
      equipamentos_alocacao: {
        Row: {
          atualizado_em: string
          criado_em: string
          custo_unit_num: number
          equipamento_id: string
          evento_id: string | null
          fim: string
          id: string
          inicio: string
          obs: string | null
          preco_unit_num: number
          qtd_avaria: number
          quantidade: number
          reserva_id: string | null
          status: string
          usuario_id: string
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          custo_unit_num?: number
          equipamento_id: string
          evento_id?: string | null
          fim: string
          id?: string
          inicio: string
          obs?: string | null
          preco_unit_num?: number
          qtd_avaria?: number
          quantidade?: number
          reserva_id?: string | null
          status?: string
          usuario_id: string
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          custo_unit_num?: number
          equipamento_id?: string
          evento_id?: string | null
          fim?: string
          id?: string
          inicio?: string
          obs?: string | null
          preco_unit_num?: number
          qtd_avaria?: number
          quantidade?: number
          reserva_id?: string | null
          status?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipamentos_alocacao_equipamento_id_fkey"
            columns: ["equipamento_id"]
            isOneToOne: false
            referencedRelation: "equipamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipamentos_alocacao_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "clientes_eventos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipamentos_alocacao_reserva_id_fkey"
            columns: ["reserva_id"]
            isOneToOne: false
            referencedRelation: "reservas"
            referencedColumns: ["id"]
          },
        ]
      }
      equipe: {
        Row: {
          admissao: string | null
          atualizado_em: string
          banco: Json
          cargo: string | null
          centro_custo_id: string | null
          contrato: string
          cpf: string | null
          created_at: string
          criado_em: string
          departamento: string | null
          dependentes: number
          desligado_em: string | null
          email: string | null
          foto_url: string | null
          gestor_id: number | null
          id: number
          jornada: string | null
          motivo_desligamento: string | null
          nascimento: string | null
          nome: string
          obs: string | null
          prop_id: number | null
          rg: string | null
          salario: number
          status: string
          telefone: string | null
          usuario_id: string
        }
        Insert: {
          admissao?: string | null
          atualizado_em?: string
          banco?: Json
          cargo?: string | null
          centro_custo_id?: string | null
          contrato?: string
          cpf?: string | null
          created_at?: string
          criado_em?: string
          departamento?: string | null
          dependentes?: number
          desligado_em?: string | null
          email?: string | null
          foto_url?: string | null
          gestor_id?: number | null
          id?: never
          jornada?: string | null
          motivo_desligamento?: string | null
          nascimento?: string | null
          nome: string
          obs?: string | null
          prop_id?: number | null
          rg?: string | null
          salario?: number
          status?: string
          telefone?: string | null
          usuario_id: string
        }
        Update: {
          admissao?: string | null
          atualizado_em?: string
          banco?: Json
          cargo?: string | null
          centro_custo_id?: string | null
          contrato?: string
          cpf?: string | null
          created_at?: string
          criado_em?: string
          departamento?: string | null
          dependentes?: number
          desligado_em?: string | null
          email?: string | null
          foto_url?: string | null
          gestor_id?: number | null
          id?: never
          jornada?: string | null
          motivo_desligamento?: string | null
          nascimento?: string | null
          nome?: string
          obs?: string | null
          prop_id?: number | null
          rg?: string | null
          salario?: number
          status?: string
          telefone?: string | null
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipe_gestor_id_fkey"
            columns: ["gestor_id"]
            isOneToOne: false
            referencedRelation: "equipe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipe_prop_id_fkey"
            columns: ["prop_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
        ]
      }
      escalas: {
        Row: {
          atualizado_em: string
          criado_em: string
          data: string
          evento_id: string | null
          funcao: string
          id: string
          necessario: number
          obs: string | null
          propriedade_id: string | null
          reserva_id: string | null
          status: string
          turno: string
          usuario_id: string
          valor_diaria_ref_num: number
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          data?: string
          evento_id?: string | null
          funcao?: string
          id?: string
          necessario?: number
          obs?: string | null
          propriedade_id?: string | null
          reserva_id?: string | null
          status?: string
          turno?: string
          usuario_id: string
          valor_diaria_ref_num?: number
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          data?: string
          evento_id?: string | null
          funcao?: string
          id?: string
          necessario?: number
          obs?: string | null
          propriedade_id?: string | null
          reserva_id?: string | null
          status?: string
          turno?: string
          usuario_id?: string
          valor_diaria_ref_num?: number
        }
        Relationships: [
          {
            foreignKeyName: "escalas_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "clientes_eventos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escalas_reserva_id_fkey"
            columns: ["reserva_id"]
            isOneToOne: false
            referencedRelation: "reservas"
            referencedColumns: ["id"]
          },
        ]
      }
      escalas_alocacao: {
        Row: {
          atualizado_em: string
          conta_pagar_id: string | null
          criado_em: string
          equipe_id: number | null
          escala_id: string
          fim_previsto: string | null
          freelancer_id: string | null
          id: string
          inicio_previsto: string | null
          obs: string | null
          pago: boolean
          status: string
          usuario_id: string
          valor_diaria_num: number
        }
        Insert: {
          atualizado_em?: string
          conta_pagar_id?: string | null
          criado_em?: string
          equipe_id?: number | null
          escala_id: string
          fim_previsto?: string | null
          freelancer_id?: string | null
          id?: string
          inicio_previsto?: string | null
          obs?: string | null
          pago?: boolean
          status?: string
          usuario_id: string
          valor_diaria_num?: number
        }
        Update: {
          atualizado_em?: string
          conta_pagar_id?: string | null
          criado_em?: string
          equipe_id?: number | null
          escala_id?: string
          fim_previsto?: string | null
          freelancer_id?: string | null
          id?: string
          inicio_previsto?: string | null
          obs?: string | null
          pago?: boolean
          status?: string
          usuario_id?: string
          valor_diaria_num?: number
        }
        Relationships: [
          {
            foreignKeyName: "escala_aloc_conta_pagar_id_fkey"
            columns: ["conta_pagar_id"]
            isOneToOne: false
            referencedRelation: "contas_pagar"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escala_aloc_equipe_id_fkey"
            columns: ["equipe_id"]
            isOneToOne: false
            referencedRelation: "equipe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escalas_alocacao_escala_id_fkey"
            columns: ["escala_id"]
            isOneToOne: false
            referencedRelation: "escalas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escalas_alocacao_freelancer_id_fkey"
            columns: ["freelancer_id"]
            isOneToOne: false
            referencedRelation: "freelancers"
            referencedColumns: ["id"]
          },
        ]
      }
      espacos: {
        Row: {
          area_m2: number | null
          ativo: boolean
          atualizado_em: string
          buffer_minutos: number
          capacidade: number | null
          cor: string | null
          criado_em: string
          id: number
          nome: string
          ordem: number
          propriedade_id: number
          reservavel_isolado: boolean
          tipo: string
          usuario_id: string
        }
        Insert: {
          area_m2?: number | null
          ativo?: boolean
          atualizado_em?: string
          buffer_minutos?: number
          capacidade?: number | null
          cor?: string | null
          criado_em?: string
          id?: never
          nome: string
          ordem?: number
          propriedade_id: number
          reservavel_isolado?: boolean
          tipo?: string
          usuario_id: string
        }
        Update: {
          area_m2?: number | null
          ativo?: boolean
          atualizado_em?: string
          buffer_minutos?: number
          capacidade?: number | null
          cor?: string | null
          criado_em?: string
          id?: never
          nome?: string
          ordem?: number
          propriedade_id?: number
          reservavel_isolado?: boolean
          tipo?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "espacos_propriedade_id_fkey"
            columns: ["propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
        ]
      }
      estacionamento_acessos: {
        Row: {
          atualizado_em: string
          contato: string | null
          cor_veiculo: string | null
          credencial_id: string | null
          criado_em: string
          entrada: string | null
          evento_id: string | null
          id: string
          lancamento_id: number | null
          metodo: string | null
          modelo: string | null
          motorista: string | null
          obs: string | null
          pago: boolean
          placa: string
          saida: string | null
          setor_id: string | null
          status: string
          tipo: string
          usuario_id: string
          valet: boolean
          valet_local: string | null
          valet_status: string
          valor_num: number
        }
        Insert: {
          atualizado_em?: string
          contato?: string | null
          cor_veiculo?: string | null
          credencial_id?: string | null
          criado_em?: string
          entrada?: string | null
          evento_id?: string | null
          id?: string
          lancamento_id?: number | null
          metodo?: string | null
          modelo?: string | null
          motorista?: string | null
          obs?: string | null
          pago?: boolean
          placa?: string
          saida?: string | null
          setor_id?: string | null
          status?: string
          tipo?: string
          usuario_id: string
          valet?: boolean
          valet_local?: string | null
          valet_status?: string
          valor_num?: number
        }
        Update: {
          atualizado_em?: string
          contato?: string | null
          cor_veiculo?: string | null
          credencial_id?: string | null
          criado_em?: string
          entrada?: string | null
          evento_id?: string | null
          id?: string
          lancamento_id?: number | null
          metodo?: string | null
          modelo?: string | null
          motorista?: string | null
          obs?: string | null
          pago?: boolean
          placa?: string
          saida?: string | null
          setor_id?: string | null
          status?: string
          tipo?: string
          usuario_id?: string
          valet?: boolean
          valet_local?: string | null
          valet_status?: string
          valor_num?: number
        }
        Relationships: [
          {
            foreignKeyName: "estacionamento_acessos_credencial_id_fkey"
            columns: ["credencial_id"]
            isOneToOne: false
            referencedRelation: "credenciais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estacionamento_acessos_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "clientes_eventos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estacionamento_acessos_lancamento_id_fkey"
            columns: ["lancamento_id"]
            isOneToOne: false
            referencedRelation: "lancamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estacionamento_acessos_setor_id_fkey"
            columns: ["setor_id"]
            isOneToOne: false
            referencedRelation: "estacionamento_setores"
            referencedColumns: ["id"]
          },
        ]
      }
      estacionamento_setores: {
        Row: {
          ativo: boolean
          atualizado_em: string
          capacidade: number
          cobranca: string
          cor: string | null
          criado_em: string
          id: string
          nome: string
          ordem: number
          preco_num: number
          propriedade_id: number | null
          tipo: string
          usuario_id: string
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          capacidade?: number
          cobranca?: string
          cor?: string | null
          criado_em?: string
          id?: string
          nome: string
          ordem?: number
          preco_num?: number
          propriedade_id?: number | null
          tipo?: string
          usuario_id: string
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          capacidade?: number
          cobranca?: string
          cor?: string | null
          criado_em?: string
          id?: string
          nome?: string
          ordem?: number
          preco_num?: number
          propriedade_id?: number | null
          tipo?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "estacionamento_setores_propriedade_id_fkey"
            columns: ["propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
        ]
      }
      estoque_mov: {
        Row: {
          criado_em: string
          custo_total_num: number
          custo_unit_num: number
          evento_id: string | null
          id: string
          local_destino: string | null
          local_origem: string | null
          lote: string | null
          motivo: string | null
          produto_id: string
          quantidade: number
          recebimento_id: string | null
          tipo: string
          usuario_id: string
          validade: string | null
        }
        Insert: {
          criado_em?: string
          custo_total_num?: number
          custo_unit_num?: number
          evento_id?: string | null
          id?: string
          local_destino?: string | null
          local_origem?: string | null
          lote?: string | null
          motivo?: string | null
          produto_id: string
          quantidade: number
          recebimento_id?: string | null
          tipo?: string
          usuario_id: string
          validade?: string | null
        }
        Update: {
          criado_em?: string
          custo_total_num?: number
          custo_unit_num?: number
          evento_id?: string | null
          id?: string
          local_destino?: string | null
          local_origem?: string | null
          lote?: string | null
          motivo?: string | null
          produto_id?: string
          quantidade?: number
          recebimento_id?: string | null
          tipo?: string
          usuario_id?: string
          validade?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "estoque_mov_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "clientes_eventos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_mov_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      evento_layout: {
        Row: {
          ajustes: Json
          atualizado_em: string
          criado_em: string
          evento_id: string
          id: string
          layout_id: string | null
          mapa_mesas: Json
          usuario_id: string
        }
        Insert: {
          ajustes?: Json
          atualizado_em?: string
          criado_em?: string
          evento_id: string
          id?: string
          layout_id?: string | null
          mapa_mesas?: Json
          usuario_id: string
        }
        Update: {
          ajustes?: Json
          atualizado_em?: string
          criado_em?: string
          evento_id?: string
          id?: string
          layout_id?: string | null
          mapa_mesas?: Json
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "evento_layout_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: true
            referencedRelation: "clientes_eventos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evento_layout_layout_id_fkey"
            columns: ["layout_id"]
            isOneToOne: false
            referencedRelation: "layouts"
            referencedColumns: ["id"]
          },
        ]
      }
      expo_mapa: {
        Row: {
          area_m2: number | null
          atualizado_em: string
          codigo: string
          cor: string | null
          criado_em: string
          evento_id: string
          expositor_id: string | null
          id: string
          obs: string | null
          posicao: Json
          preco_num: number | null
          status: string
          tipo: string
          usuario_id: string
        }
        Insert: {
          area_m2?: number | null
          atualizado_em?: string
          codigo: string
          cor?: string | null
          criado_em?: string
          evento_id: string
          expositor_id?: string | null
          id?: string
          obs?: string | null
          posicao?: Json
          preco_num?: number | null
          status?: string
          tipo?: string
          usuario_id: string
        }
        Update: {
          area_m2?: number | null
          atualizado_em?: string
          codigo?: string
          cor?: string | null
          criado_em?: string
          evento_id?: string
          expositor_id?: string | null
          id?: string
          obs?: string | null
          posicao?: Json
          preco_num?: number | null
          status?: string
          tipo?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expo_mapa_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "clientes_eventos"
            referencedColumns: ["id"]
          },
        ]
      }
      expositores: {
        Row: {
          atualizado_em: string
          contato: string | null
          contrato_id: string | null
          credencial_id: string | null
          criado_em: string
          doc: string | null
          email: string | null
          empresa: string
          estande_id: string | null
          evento_id: string
          id: string
          lancamento_id: string | null
          necessidades: Json
          obs: string | null
          status: string
          telefone: string | null
          usuario_id: string
          valor_num: number
        }
        Insert: {
          atualizado_em?: string
          contato?: string | null
          contrato_id?: string | null
          credencial_id?: string | null
          criado_em?: string
          doc?: string | null
          email?: string | null
          empresa: string
          estande_id?: string | null
          evento_id: string
          id?: string
          lancamento_id?: string | null
          necessidades?: Json
          obs?: string | null
          status?: string
          telefone?: string | null
          usuario_id: string
          valor_num?: number
        }
        Update: {
          atualizado_em?: string
          contato?: string | null
          contrato_id?: string | null
          credencial_id?: string | null
          criado_em?: string
          doc?: string | null
          email?: string | null
          empresa?: string
          estande_id?: string | null
          evento_id?: string
          id?: string
          lancamento_id?: string | null
          necessidades?: Json
          obs?: string | null
          status?: string
          telefone?: string | null
          usuario_id?: string
          valor_num?: number
        }
        Relationships: [
          {
            foreignKeyName: "expositores_estande_id_fkey"
            columns: ["estande_id"]
            isOneToOne: false
            referencedRelation: "expo_mapa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expositores_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "clientes_eventos"
            referencedColumns: ["id"]
          },
        ]
      }
      faturas: {
        Row: {
          atualizado_em: string
          cliente_id: string | null
          criado_em: string
          descricao: string | null
          evento_id: string | null
          id: string
          lancamento_id: number | null
          link_pagamento: string | null
          meio: string | null
          nota_id: string | null
          pago_em: string | null
          parcela_id: number | null
          provedor_pgto: string | null
          provedor_pgto_id: string | null
          status: string
          usuario_id: string
          valor_num: number
          vencimento: string | null
        }
        Insert: {
          atualizado_em?: string
          cliente_id?: string | null
          criado_em?: string
          descricao?: string | null
          evento_id?: string | null
          id?: string
          lancamento_id?: number | null
          link_pagamento?: string | null
          meio?: string | null
          nota_id?: string | null
          pago_em?: string | null
          parcela_id?: number | null
          provedor_pgto?: string | null
          provedor_pgto_id?: string | null
          status?: string
          usuario_id: string
          valor_num?: number
          vencimento?: string | null
        }
        Update: {
          atualizado_em?: string
          cliente_id?: string | null
          criado_em?: string
          descricao?: string | null
          evento_id?: string | null
          id?: string
          lancamento_id?: number | null
          link_pagamento?: string | null
          meio?: string | null
          nota_id?: string | null
          pago_em?: string | null
          parcela_id?: number | null
          provedor_pgto?: string | null
          provedor_pgto_id?: string | null
          status?: string
          usuario_id?: string
          valor_num?: number
          vencimento?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "faturas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faturas_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "clientes_eventos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faturas_lancamento_id_fkey"
            columns: ["lancamento_id"]
            isOneToOne: false
            referencedRelation: "lancamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faturas_nota_id_fkey"
            columns: ["nota_id"]
            isOneToOne: false
            referencedRelation: "notas_fiscais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faturas_parcela_id_fkey"
            columns: ["parcela_id"]
            isOneToOne: false
            referencedRelation: "parcelas"
            referencedColumns: ["id"]
          },
        ]
      }
      favoritos: {
        Row: {
          created_at: string | null
          id: string
          property_id: number
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          property_id: number
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          property_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favoritos_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
        ]
      }
      fechamentos: {
        Row: {
          criado_em: string
          fechado_em: string
          id: string
          mes: string
          observacao: string | null
          status: string
          usuario_id: string
        }
        Insert: {
          criado_em?: string
          fechado_em?: string
          id?: string
          mes: string
          observacao?: string | null
          status?: string
          usuario_id: string
        }
        Update: {
          criado_em?: string
          fechado_em?: string
          id?: string
          mes?: string
          observacao?: string | null
          status?: string
          usuario_id?: string
        }
        Relationships: []
      }
      feedbacks: {
        Row: {
          atualizado_em: string
          autor_contato: string | null
          autor_nome: string | null
          canal: string
          cliente_id: string | null
          comentario: string | null
          criado_em: string
          criterios: Json
          evento_id: string | null
          id: string
          nota_geral: number | null
          permite_publicar: boolean
          pontos_negativos: string | null
          pontos_positivos: string | null
          promovida_avaliacao_id: number | null
          propriedade_id: number | null
          resolvido_em: string | null
          respondido_em: string | null
          resposta_privada: string | null
          status: string
          usuario_id: string
        }
        Insert: {
          atualizado_em?: string
          autor_contato?: string | null
          autor_nome?: string | null
          canal?: string
          cliente_id?: string | null
          comentario?: string | null
          criado_em?: string
          criterios?: Json
          evento_id?: string | null
          id?: string
          nota_geral?: number | null
          permite_publicar?: boolean
          pontos_negativos?: string | null
          pontos_positivos?: string | null
          promovida_avaliacao_id?: number | null
          propriedade_id?: number | null
          resolvido_em?: string | null
          respondido_em?: string | null
          resposta_privada?: string | null
          status?: string
          usuario_id: string
        }
        Update: {
          atualizado_em?: string
          autor_contato?: string | null
          autor_nome?: string | null
          canal?: string
          cliente_id?: string | null
          comentario?: string | null
          criado_em?: string
          criterios?: Json
          evento_id?: string | null
          id?: string
          nota_geral?: number | null
          permite_publicar?: boolean
          pontos_negativos?: string | null
          pontos_positivos?: string | null
          promovida_avaliacao_id?: number | null
          propriedade_id?: number | null
          resolvido_em?: string | null
          respondido_em?: string | null
          resposta_privada?: string | null
          status?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedbacks_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedbacks_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "clientes_eventos"
            referencedColumns: ["id"]
          },
        ]
      }
      feedbacks_acoes: {
        Row: {
          concluida_em: string | null
          criado_em: string
          descricao: string
          feedback_id: string
          id: string
          prazo: string | null
          responsavel: string | null
          status: string
          usuario_id: string
        }
        Insert: {
          concluida_em?: string | null
          criado_em?: string
          descricao: string
          feedback_id: string
          id?: string
          prazo?: string | null
          responsavel?: string | null
          status?: string
          usuario_id: string
        }
        Update: {
          concluida_em?: string | null
          criado_em?: string
          descricao?: string
          feedback_id?: string
          id?: string
          prazo?: string | null
          responsavel?: string | null
          status?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedbacks_acoes_feedback_id_fkey"
            columns: ["feedback_id"]
            isOneToOne: false
            referencedRelation: "feedbacks"
            referencedColumns: ["id"]
          },
        ]
      }
      financeiro_restaurante: {
        Row: {
          categoria: string | null
          comprovante_url: string | null
          criado_em: string | null
          data_lancamento: string
          descricao: string
          id: string
          restaurante_id: string | null
          tipo: string
          valor: number
        }
        Insert: {
          categoria?: string | null
          comprovante_url?: string | null
          criado_em?: string | null
          data_lancamento?: string
          descricao: string
          id?: string
          restaurante_id?: string | null
          tipo: string
          valor: number
        }
        Update: {
          categoria?: string | null
          comprovante_url?: string | null
          criado_em?: string | null
          data_lancamento?: string
          descricao?: string
          id?: string
          restaurante_id?: string | null
          tipo?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_restaurante_restaurante_id_fkey"
            columns: ["restaurante_id"]
            isOneToOne: false
            referencedRelation: "restaurantes"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_provedores: {
        Row: {
          ambiente: string
          ativo: boolean
          atualizado_em: string
          cnpj: string | null
          empresa_token: string | null
          endpoint: string | null
          provedor: string
          token: string | null
          usuario_id: string
        }
        Insert: {
          ambiente?: string
          ativo?: boolean
          atualizado_em?: string
          cnpj?: string | null
          empresa_token?: string | null
          endpoint?: string | null
          provedor?: string
          token?: string | null
          usuario_id: string
        }
        Update: {
          ambiente?: string
          ativo?: boolean
          atualizado_em?: string
          cnpj?: string | null
          empresa_token?: string | null
          endpoint?: string | null
          provedor?: string
          token?: string | null
          usuario_id?: string
        }
        Relationships: []
      }
      folha_pagamento: {
        Row: {
          criado_em: string | null
          descontos: number | null
          extras: number | null
          funcionario_id: string | null
          id: string
          mes_referencia: string
          observacoes: string | null
          pago_em: string | null
          restaurante_id: string | null
          salario_base: number | null
          status: string | null
          total_liquido: number | null
        }
        Insert: {
          criado_em?: string | null
          descontos?: number | null
          extras?: number | null
          funcionario_id?: string | null
          id?: string
          mes_referencia: string
          observacoes?: string | null
          pago_em?: string | null
          restaurante_id?: string | null
          salario_base?: number | null
          status?: string | null
          total_liquido?: number | null
        }
        Update: {
          criado_em?: string | null
          descontos?: number | null
          extras?: number | null
          funcionario_id?: string | null
          id?: string
          mes_referencia?: string
          observacoes?: string | null
          pago_em?: string | null
          restaurante_id?: string | null
          salario_base?: number | null
          status?: string | null
          total_liquido?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "folha_pagamento_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folha_pagamento_restaurante_id_fkey"
            columns: ["restaurante_id"]
            isOneToOne: false
            referencedRelation: "restaurantes"
            referencedColumns: ["id"]
          },
        ]
      }
      fornecedores: {
        Row: {
          ativo: boolean
          atualizado_em: string
          avaliacao_media: number
          avaliacao_n: number
          banco: Json
          categoria: string
          chave_pix: string | null
          cidade: string | null
          condicoes_pagamento: string | null
          contato: string | null
          criado_em: string
          doc: string | null
          email: string | null
          endereco: string | null
          estado: string | null
          fantasia: string | null
          homologacao: string
          id: string
          nome: string
          obs: string | null
          prazo_entrega_dias: number | null
          site: string | null
          tags: string[]
          telefone: string | null
          tipo: string
          usuario_id: string
          whatsapp: string | null
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          avaliacao_media?: number
          avaliacao_n?: number
          banco?: Json
          categoria?: string
          chave_pix?: string | null
          cidade?: string | null
          condicoes_pagamento?: string | null
          contato?: string | null
          criado_em?: string
          doc?: string | null
          email?: string | null
          endereco?: string | null
          estado?: string | null
          fantasia?: string | null
          homologacao?: string
          id?: string
          nome: string
          obs?: string | null
          prazo_entrega_dias?: number | null
          site?: string | null
          tags?: string[]
          telefone?: string | null
          tipo?: string
          usuario_id: string
          whatsapp?: string | null
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          avaliacao_media?: number
          avaliacao_n?: number
          banco?: Json
          categoria?: string
          chave_pix?: string | null
          cidade?: string | null
          condicoes_pagamento?: string | null
          contato?: string | null
          criado_em?: string
          doc?: string | null
          email?: string | null
          endereco?: string | null
          estado?: string | null
          fantasia?: string | null
          homologacao?: string
          id?: string
          nome?: string
          obs?: string | null
          prazo_entrega_dias?: number | null
          site?: string | null
          tags?: string[]
          telefone?: string | null
          tipo?: string
          usuario_id?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      fornecedores_avaliacoes: {
        Row: {
          comentario: string | null
          criado_em: string
          criterios: Json
          data: string
          evento_id: string | null
          fornecedor_id: string
          id: string
          nota: number
          usuario_id: string
        }
        Insert: {
          comentario?: string | null
          criado_em?: string
          criterios?: Json
          data?: string
          evento_id?: string | null
          fornecedor_id: string
          id?: string
          nota?: number
          usuario_id: string
        }
        Update: {
          comentario?: string | null
          criado_em?: string
          criterios?: Json
          data?: string
          evento_id?: string | null
          fornecedor_id?: string
          id?: string
          nota?: number
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fornecedores_avaliacoes_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "clientes_eventos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fornecedores_avaliacoes_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
        ]
      }
      fornecedores_contatos: {
        Row: {
          cargo: string | null
          criado_em: string
          email: string | null
          fornecedor_id: string
          id: string
          nome: string
          obs: string | null
          principal: boolean
          telefone: string | null
          usuario_id: string
          whatsapp: string | null
        }
        Insert: {
          cargo?: string | null
          criado_em?: string
          email?: string | null
          fornecedor_id: string
          id?: string
          nome: string
          obs?: string | null
          principal?: boolean
          telefone?: string | null
          usuario_id: string
          whatsapp?: string | null
        }
        Update: {
          cargo?: string | null
          criado_em?: string
          email?: string | null
          fornecedor_id?: string
          id?: string
          nome?: string
          obs?: string | null
          principal?: boolean
          telefone?: string | null
          usuario_id?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fornecedores_contatos_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
        ]
      }
      fornecedores_docs: {
        Row: {
          arquivo_nome: string | null
          arquivo_tamanho: number | null
          arquivo_tipo: string | null
          arquivo_url: string | null
          criado_em: string
          emissao: string | null
          fornecedor_id: string
          id: string
          nome: string
          numero: string | null
          obs: string | null
          tipo: string
          usuario_id: string
          validade: string | null
        }
        Insert: {
          arquivo_nome?: string | null
          arquivo_tamanho?: number | null
          arquivo_tipo?: string | null
          arquivo_url?: string | null
          criado_em?: string
          emissao?: string | null
          fornecedor_id: string
          id?: string
          nome: string
          numero?: string | null
          obs?: string | null
          tipo?: string
          usuario_id: string
          validade?: string | null
        }
        Update: {
          arquivo_nome?: string | null
          arquivo_tamanho?: number | null
          arquivo_tipo?: string | null
          arquivo_url?: string | null
          criado_em?: string
          emissao?: string | null
          fornecedor_id?: string
          id?: string
          nome?: string
          numero?: string | null
          obs?: string | null
          tipo?: string
          usuario_id?: string
          validade?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fornecedores_docs_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
        ]
      }
      fornecedores_restaurante: {
        Row: {
          ativo: boolean | null
          categoria: string | null
          contato: string | null
          criado_em: string | null
          email: string | null
          id: string
          nome: string
          observacoes: string | null
          restaurante_id: string | null
          whatsapp: string | null
        }
        Insert: {
          ativo?: boolean | null
          categoria?: string | null
          contato?: string | null
          criado_em?: string | null
          email?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          restaurante_id?: string | null
          whatsapp?: string | null
        }
        Update: {
          ativo?: boolean | null
          categoria?: string | null
          contato?: string | null
          criado_em?: string | null
          email?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          restaurante_id?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fornecedores_restaurante_restaurante_id_fkey"
            columns: ["restaurante_id"]
            isOneToOne: false
            referencedRelation: "restaurantes"
            referencedColumns: ["id"]
          },
        ]
      }
      fotos_imovel: {
        Row: {
          alt: string | null
          created_at: string | null
          focal_x: number | null
          focal_y: number | null
          id: string
          ordem: number | null
          propriedade_id: number | null
          secao: string | null
          tipo: string | null
          url: string | null
        }
        Insert: {
          alt?: string | null
          created_at?: string | null
          focal_x?: number | null
          focal_y?: number | null
          id?: string
          ordem?: number | null
          propriedade_id?: number | null
          secao?: string | null
          tipo?: string | null
          url?: string | null
        }
        Update: {
          alt?: string | null
          created_at?: string | null
          focal_x?: number | null
          focal_y?: number | null
          id?: string
          ordem?: number | null
          propriedade_id?: number | null
          secao?: string | null
          tipo?: string | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fotos_imovel_propriedade_id_fkey"
            columns: ["propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
        ]
      }
      fotos_restaurante: {
        Row: {
          criado_em: string | null
          id: string
          legenda: string | null
          ordem: number | null
          restaurante_id: string | null
          url: string
        }
        Insert: {
          criado_em?: string | null
          id?: string
          legenda?: string | null
          ordem?: number | null
          restaurante_id?: string | null
          url: string
        }
        Update: {
          criado_em?: string | null
          id?: string
          legenda?: string | null
          ordem?: number | null
          restaurante_id?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "fotos_restaurante_restaurante_id_fkey"
            columns: ["restaurante_id"]
            isOneToOne: false
            referencedRelation: "restaurantes"
            referencedColumns: ["id"]
          },
        ]
      }
      freelancers: {
        Row: {
          ativo: boolean
          atualizado_em: string
          avaliacao: number | null
          chave_pix: string | null
          contato: string | null
          criado_em: string
          doc: string | null
          email: string | null
          funcao: string
          id: string
          nome: string
          obs: string | null
          usuario_id: string
          valor_diaria_num: number
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          avaliacao?: number | null
          chave_pix?: string | null
          contato?: string | null
          criado_em?: string
          doc?: string | null
          email?: string | null
          funcao?: string
          id?: string
          nome: string
          obs?: string | null
          usuario_id: string
          valor_diaria_num?: number
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          avaliacao?: number | null
          chave_pix?: string | null
          contato?: string | null
          criado_em?: string
          doc?: string | null
          email?: string | null
          funcao?: string
          id?: string
          nome?: string
          obs?: string | null
          usuario_id?: string
          valor_diaria_num?: number
        }
        Relationships: []
      }
      frota: {
        Row: {
          atualizado_em: string
          capacidade: number | null
          capacidade_unidade: string
          criado_em: string
          id: string
          motorista: string | null
          motorista_contato: string | null
          nome: string
          obs: string | null
          placa: string | null
          status: string
          tipo: string
          usuario_id: string
        }
        Insert: {
          atualizado_em?: string
          capacidade?: number | null
          capacidade_unidade?: string
          criado_em?: string
          id?: string
          motorista?: string | null
          motorista_contato?: string | null
          nome: string
          obs?: string | null
          placa?: string | null
          status?: string
          tipo?: string
          usuario_id: string
        }
        Update: {
          atualizado_em?: string
          capacidade?: number | null
          capacidade_unidade?: string
          criado_em?: string
          id?: string
          motorista?: string | null
          motorista_contato?: string | null
          nome?: string
          obs?: string | null
          placa?: string | null
          status?: string
          tipo?: string
          usuario_id?: string
        }
        Relationships: []
      }
      frota_viagens: {
        Row: {
          carga: string | null
          criado_em: string
          destino: string | null
          evento_id: string | null
          frota_id: string
          id: string
          obs: string | null
          origem: string | null
          partida: string | null
          retorno: string | null
          status: string
          usuario_id: string
        }
        Insert: {
          carga?: string | null
          criado_em?: string
          destino?: string | null
          evento_id?: string | null
          frota_id: string
          id?: string
          obs?: string | null
          origem?: string | null
          partida?: string | null
          retorno?: string | null
          status?: string
          usuario_id: string
        }
        Update: {
          carga?: string | null
          criado_em?: string
          destino?: string | null
          evento_id?: string | null
          frota_id?: string
          id?: string
          obs?: string | null
          origem?: string | null
          partida?: string | null
          retorno?: string | null
          status?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "frota_viagens_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "clientes_eventos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "frota_viagens_frota_id_fkey"
            columns: ["frota_id"]
            isOneToOne: false
            referencedRelation: "frota"
            referencedColumns: ["id"]
          },
        ]
      }
      funcionarios: {
        Row: {
          ativo: boolean | null
          cargo: string | null
          criado_em: string | null
          data_admissao: string | null
          foto_url: string | null
          id: string
          nome: string
          restaurante_id: string | null
          salario_base: number | null
          telefone: string | null
        }
        Insert: {
          ativo?: boolean | null
          cargo?: string | null
          criado_em?: string | null
          data_admissao?: string | null
          foto_url?: string | null
          id?: string
          nome: string
          restaurante_id?: string | null
          salario_base?: number | null
          telefone?: string | null
        }
        Update: {
          ativo?: boolean | null
          cargo?: string | null
          criado_em?: string | null
          data_admissao?: string | null
          foto_url?: string | null
          id?: string
          nome?: string
          restaurante_id?: string | null
          salario_base?: number | null
          telefone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "funcionarios_restaurante_id_fkey"
            columns: ["restaurante_id"]
            isOneToOne: false
            referencedRelation: "restaurantes"
            referencedColumns: ["id"]
          },
        ]
      }
      historico_assinaturas: {
        Row: {
          criado_em: string
          gateway_ref: string | null
          id: string
          metodo_pagamento: string | null
          observacao: string | null
          plano_anterior: string | null
          plano_novo: string
          tipo_evento: string
          usuario_id: string
          valor_cobrado: number | null
        }
        Insert: {
          criado_em?: string
          gateway_ref?: string | null
          id?: string
          metodo_pagamento?: string | null
          observacao?: string | null
          plano_anterior?: string | null
          plano_novo: string
          tipo_evento: string
          usuario_id: string
          valor_cobrado?: number | null
        }
        Update: {
          criado_em?: string
          gateway_ref?: string | null
          id?: string
          metodo_pagamento?: string | null
          observacao?: string | null
          plano_anterior?: string | null
          plano_novo?: string
          tipo_evento?: string
          usuario_id?: string
          valor_cobrado?: number | null
        }
        Relationships: []
      }
      host_mp: {
        Row: {
          atualizado_em: string
          conectado: boolean
          mp_access_token: string | null
          mp_public_key: string | null
          mp_refresh_token: string | null
          mp_user_id: string | null
          oauth_state: string | null
          usuario_id: string
        }
        Insert: {
          atualizado_em?: string
          conectado?: boolean
          mp_access_token?: string | null
          mp_public_key?: string | null
          mp_refresh_token?: string | null
          mp_user_id?: string | null
          oauth_state?: string | null
          usuario_id: string
        }
        Update: {
          atualizado_em?: string
          conectado?: boolean
          mp_access_token?: string | null
          mp_public_key?: string | null
          mp_refresh_token?: string | null
          mp_user_id?: string | null
          oauth_state?: string | null
          usuario_id?: string
        }
        Relationships: []
      }
      indicacoes: {
        Row: {
          bonus_creditado: boolean
          bonus_creditado_em: string | null
          created_at: string
          id: string
          indicado_id: string
          indicador_id: string
          nome_propriedade: string | null
          status: string
        }
        Insert: {
          bonus_creditado?: boolean
          bonus_creditado_em?: string | null
          created_at?: string
          id?: string
          indicado_id: string
          indicador_id: string
          nome_propriedade?: string | null
          status?: string
        }
        Update: {
          bonus_creditado?: boolean
          bonus_creditado_em?: string | null
          created_at?: string
          id?: string
          indicado_id?: string
          indicador_id?: string
          nome_propriedade?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "indicacoes_indicado_id_fkey"
            columns: ["indicado_id"]
            isOneToOne: false
            referencedRelation: "perfis_publicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "indicacoes_indicado_id_fkey"
            columns: ["indicado_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "indicacoes_indicador_id_fkey"
            columns: ["indicador_id"]
            isOneToOne: false
            referencedRelation: "perfis_publicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "indicacoes_indicador_id_fkey"
            columns: ["indicador_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      ingressos: {
        Row: {
          atualizado_em: string
          bilheteria_id: string
          categoria_id: string
          checkin_em: string | null
          comprador_doc: string | null
          comprador_nome: string | null
          credencial_id: string | null
          criado_em: string
          email: string | null
          extras: Json | null
          id: string
          meia: boolean
          pedido_id: string
          qr_token: string
          status: string
          usuario_id: string
          valor_num: number
        }
        Insert: {
          atualizado_em?: string
          bilheteria_id: string
          categoria_id: string
          checkin_em?: string | null
          comprador_doc?: string | null
          comprador_nome?: string | null
          credencial_id?: string | null
          criado_em?: string
          email?: string | null
          extras?: Json | null
          id?: string
          meia?: boolean
          pedido_id: string
          qr_token: string
          status?: string
          usuario_id: string
          valor_num?: number
        }
        Update: {
          atualizado_em?: string
          bilheteria_id?: string
          categoria_id?: string
          checkin_em?: string | null
          comprador_doc?: string | null
          comprador_nome?: string | null
          credencial_id?: string | null
          criado_em?: string
          email?: string | null
          extras?: Json | null
          id?: string
          meia?: boolean
          pedido_id?: string
          qr_token?: string
          status?: string
          usuario_id?: string
          valor_num?: number
        }
        Relationships: [
          {
            foreignKeyName: "ingressos_bilheteria_id_fkey"
            columns: ["bilheteria_id"]
            isOneToOne: false
            referencedRelation: "bilheteria_eventos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingressos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "ingressos_categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingressos_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos_ingresso"
            referencedColumns: ["id"]
          },
        ]
      }
      ingressos_categorias: {
        Row: {
          ativo: boolean
          atualizado_em: string
          bilheteria_id: string
          criado_em: string
          descricao: string | null
          id: string
          kit: Json | null
          lote: number
          lote_nome: string | null
          max_por_pedido: number
          meia: boolean
          meia_percent: number
          nome: string
          ordem: number
          por_pessoa: boolean
          preco_num: number
          quantidade: number
          usuario_id: string
          venda_fim: string | null
          venda_inicio: string | null
          vendido: number
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          bilheteria_id: string
          criado_em?: string
          descricao?: string | null
          id?: string
          kit?: Json | null
          lote?: number
          lote_nome?: string | null
          max_por_pedido?: number
          meia?: boolean
          meia_percent?: number
          nome: string
          ordem?: number
          por_pessoa?: boolean
          preco_num?: number
          quantidade?: number
          usuario_id: string
          venda_fim?: string | null
          venda_inicio?: string | null
          vendido?: number
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          bilheteria_id?: string
          criado_em?: string
          descricao?: string | null
          id?: string
          kit?: Json | null
          lote?: number
          lote_nome?: string | null
          max_por_pedido?: number
          meia?: boolean
          meia_percent?: number
          nome?: string
          ordem?: number
          por_pessoa?: boolean
          preco_num?: number
          quantidade?: number
          usuario_id?: string
          venda_fim?: string | null
          venda_inicio?: string | null
          vendido?: number
        }
        Relationships: [
          {
            foreignKeyName: "ingressos_categorias_bilheteria_id_fkey"
            columns: ["bilheteria_id"]
            isOneToOne: false
            referencedRelation: "bilheteria_eventos"
            referencedColumns: ["id"]
          },
        ]
      }
      integracoes: {
        Row: {
          api_key: string | null
          atualizado_em: string
          criado_em: string
          id: number
          modelo: string | null
          provider: string
          usuario_id: string
        }
        Insert: {
          api_key?: string | null
          atualizado_em?: string
          criado_em?: string
          id?: never
          modelo?: string | null
          provider?: string
          usuario_id: string
        }
        Update: {
          api_key?: string | null
          atualizado_em?: string
          criado_em?: string
          id?: never
          modelo?: string | null
          provider?: string
          usuario_id?: string
        }
        Relationships: []
      }
      integracoes_chaves: {
        Row: {
          criado_em: string
          escopos: string[]
          id: string
          last4: string
          nome: string
          prefixo: string
          rate_limit: number | null
          revogada: boolean
          token_hash: string
          ultimo_uso: string | null
          usuario_id: string
        }
        Insert: {
          criado_em?: string
          escopos?: string[]
          id?: string
          last4: string
          nome: string
          prefixo: string
          rate_limit?: number | null
          revogada?: boolean
          token_hash: string
          ultimo_uso?: string | null
          usuario_id: string
        }
        Update: {
          criado_em?: string
          escopos?: string[]
          id?: string
          last4?: string
          nome?: string
          prefixo?: string
          rate_limit?: number | null
          revogada?: boolean
          token_hash?: string
          ultimo_uso?: string | null
          usuario_id?: string
        }
        Relationships: []
      }
      integracoes_conexoes: {
        Row: {
          atualizado_em: string
          chave: string
          conectado_em: string | null
          config: Json
          criado_em: string
          id: string
          status: string
          ultimo_erro: string | null
          ultimo_uso: string | null
          usuario_id: string
        }
        Insert: {
          atualizado_em?: string
          chave: string
          conectado_em?: string | null
          config?: Json
          criado_em?: string
          id?: string
          status?: string
          ultimo_erro?: string | null
          ultimo_uso?: string | null
          usuario_id: string
        }
        Update: {
          atualizado_em?: string
          chave?: string
          conectado_em?: string | null
          config?: Json
          criado_em?: string
          id?: string
          status?: string
          ultimo_erro?: string | null
          ultimo_uso?: string | null
          usuario_id?: string
        }
        Relationships: []
      }
      integracoes_segredos: {
        Row: {
          atualizado_em: string
          chave: string
          id: string
          segredo: Json
          usuario_id: string
        }
        Insert: {
          atualizado_em?: string
          chave: string
          id?: string
          segredo?: Json
          usuario_id: string
        }
        Update: {
          atualizado_em?: string
          chave?: string
          id?: string
          segredo?: Json
          usuario_id?: string
        }
        Relationships: []
      }
      integracoes_webhooks: {
        Row: {
          ativo: boolean
          atualizado_em: string
          criado_em: string
          descricao: string | null
          evento: string
          id: string
          segredo: string
          ultimo_em: string | null
          ultimo_status: number | null
          url: string
          usuario_id: string
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          descricao?: string | null
          evento: string
          id?: string
          segredo: string
          ultimo_em?: string | null
          ultimo_status?: number | null
          url: string
          usuario_id: string
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          descricao?: string | null
          evento?: string
          id?: string
          segredo?: string
          ultimo_em?: string | null
          ultimo_status?: number | null
          url?: string
          usuario_id?: string
        }
        Relationships: []
      }
      integracoes_webhooks_log: {
        Row: {
          criado_em: string
          erro: string | null
          evento: string
          http_status: number
          id: string
          ok: boolean
          payload: Json | null
          proxima_tentativa_em: string | null
          tentativa: number
          usuario_id: string
          webhook_id: string
        }
        Insert: {
          criado_em?: string
          erro?: string | null
          evento: string
          http_status?: number
          id?: string
          ok?: boolean
          payload?: Json | null
          proxima_tentativa_em?: string | null
          tentativa?: number
          usuario_id: string
          webhook_id: string
        }
        Update: {
          criado_em?: string
          erro?: string | null
          evento?: string
          http_status?: number
          id?: string
          ok?: boolean
          payload?: Json | null
          proxima_tentativa_em?: string | null
          tentativa?: number
          usuario_id?: string
          webhook_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "integracoes_webhooks_log_webhook_id_fkey"
            columns: ["webhook_id"]
            isOneToOne: false
            referencedRelation: "integracoes_webhooks"
            referencedColumns: ["id"]
          },
        ]
      }
      inventarios: {
        Row: {
          ajustes: number
          atualizado_em: string
          criado_em: string
          data: string
          id: string
          itens: Json
          local: string | null
          obs: string | null
          status: string
          usuario_id: string
        }
        Insert: {
          ajustes?: number
          atualizado_em?: string
          criado_em?: string
          data?: string
          id?: string
          itens?: Json
          local?: string | null
          obs?: string | null
          status?: string
          usuario_id: string
        }
        Update: {
          ajustes?: number
          atualizado_em?: string
          criado_em?: string
          data?: string
          id?: string
          itens?: Json
          local?: string | null
          obs?: string | null
          status?: string
          usuario_id?: string
        }
        Relationships: []
      }
      juridico_contratos: {
        Row: {
          atualizado_em: string
          aviso_previo_dias: number
          categoria: string
          contraparte: string | null
          criado_em: string
          documento_url: string | null
          fornecedor_id: number | null
          id: string
          inicio: string | null
          moeda: string
          numero: string | null
          objeto: string | null
          obs: string | null
          renovacao: string
          responsavel: string | null
          status: string
          titulo: string | null
          usuario_id: string
          valor_num: number
          vigencia_fim: string | null
        }
        Insert: {
          atualizado_em?: string
          aviso_previo_dias?: number
          categoria?: string
          contraparte?: string | null
          criado_em?: string
          documento_url?: string | null
          fornecedor_id?: number | null
          id?: string
          inicio?: string | null
          moeda?: string
          numero?: string | null
          objeto?: string | null
          obs?: string | null
          renovacao?: string
          responsavel?: string | null
          status?: string
          titulo?: string | null
          usuario_id: string
          valor_num?: number
          vigencia_fim?: string | null
        }
        Update: {
          atualizado_em?: string
          aviso_previo_dias?: number
          categoria?: string
          contraparte?: string | null
          criado_em?: string
          documento_url?: string | null
          fornecedor_id?: number | null
          id?: string
          inicio?: string | null
          moeda?: string
          numero?: string | null
          objeto?: string | null
          obs?: string | null
          renovacao?: string
          responsavel?: string | null
          status?: string
          titulo?: string | null
          usuario_id?: string
          valor_num?: number
          vigencia_fim?: string | null
        }
        Relationships: []
      }
      juridico_processos: {
        Row: {
          advogado: string | null
          anexos: Json
          atualizado_em: string
          criado_em: string
          id: string
          moeda: string
          numero: string | null
          obs: string | null
          parte: string | null
          polo: string
          prazo: string | null
          proximo_passo: string | null
          status: string
          tipo: string
          usuario_id: string
          valor_envolvido_num: number
          vara_orgao: string | null
        }
        Insert: {
          advogado?: string | null
          anexos?: Json
          atualizado_em?: string
          criado_em?: string
          id?: string
          moeda?: string
          numero?: string | null
          obs?: string | null
          parte?: string | null
          polo?: string
          prazo?: string | null
          proximo_passo?: string | null
          status?: string
          tipo?: string
          usuario_id: string
          valor_envolvido_num?: number
          vara_orgao?: string | null
        }
        Update: {
          advogado?: string | null
          anexos?: Json
          atualizado_em?: string
          criado_em?: string
          id?: string
          moeda?: string
          numero?: string | null
          obs?: string | null
          parte?: string | null
          polo?: string
          prazo?: string | null
          proximo_passo?: string | null
          status?: string
          tipo?: string
          usuario_id?: string
          valor_envolvido_num?: number
          vara_orgao?: string | null
        }
        Relationships: []
      }
      lancamentos: {
        Row: {
          ativo_id: string | null
          categoria: string | null
          centro_custo_id: string | null
          comissao_id: string | null
          competencia: string | null
          conciliado: boolean
          conta_bancaria_id: string | null
          conta_id: string | null
          created_at: string
          data: string
          descricao: string | null
          expositor_id: string | null
          fornecedor_id: string | null
          id: number
          metodo_pagamento: string | null
          observacao: string | null
          patrocinador_id: string | null
          pedido_ingresso_id: string | null
          prop_id: number | null
          recorrente: boolean
          reserva_id: string | null
          status: string
          tipo: string
          tipo_evento: string | null
          usuario_id: string
          valor: number
        }
        Insert: {
          ativo_id?: string | null
          categoria?: string | null
          centro_custo_id?: string | null
          comissao_id?: string | null
          competencia?: string | null
          conciliado?: boolean
          conta_bancaria_id?: string | null
          conta_id?: string | null
          created_at?: string
          data?: string
          descricao?: string | null
          expositor_id?: string | null
          fornecedor_id?: string | null
          id?: never
          metodo_pagamento?: string | null
          observacao?: string | null
          patrocinador_id?: string | null
          pedido_ingresso_id?: string | null
          prop_id?: number | null
          recorrente?: boolean
          reserva_id?: string | null
          status?: string
          tipo: string
          tipo_evento?: string | null
          usuario_id: string
          valor: number
        }
        Update: {
          ativo_id?: string | null
          categoria?: string | null
          centro_custo_id?: string | null
          comissao_id?: string | null
          competencia?: string | null
          conciliado?: boolean
          conta_bancaria_id?: string | null
          conta_id?: string | null
          created_at?: string
          data?: string
          descricao?: string | null
          expositor_id?: string | null
          fornecedor_id?: string | null
          id?: never
          metodo_pagamento?: string | null
          observacao?: string | null
          patrocinador_id?: string | null
          pedido_ingresso_id?: string | null
          prop_id?: number | null
          recorrente?: boolean
          reserva_id?: string | null
          status?: string
          tipo?: string
          tipo_evento?: string | null
          usuario_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "lancamentos_ativo_id_fkey"
            columns: ["ativo_id"]
            isOneToOne: false
            referencedRelation: "ativos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "centros_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_comissao_id_fkey"
            columns: ["comissao_id"]
            isOneToOne: false
            referencedRelation: "comissoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_conta_bancaria_id_fkey"
            columns: ["conta_bancaria_id"]
            isOneToOne: false
            referencedRelation: "contas_bancarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "plano_contas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_expositor_id_fkey"
            columns: ["expositor_id"]
            isOneToOne: false
            referencedRelation: "expositores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_patrocinador_id_fkey"
            columns: ["patrocinador_id"]
            isOneToOne: false
            referencedRelation: "patrocinadores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_pedido_ingresso_id_fkey"
            columns: ["pedido_ingresso_id"]
            isOneToOne: false
            referencedRelation: "pedidos_ingresso"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_prop_id_fkey"
            columns: ["prop_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_reserva_id_fkey"
            columns: ["reserva_id"]
            isOneToOne: false
            referencedRelation: "reservas"
            referencedColumns: ["id"]
          },
        ]
      }
      layouts: {
        Row: {
          area_m2: number | null
          atualizado_em: string
          capacidade: number | null
          criado_em: string
          elementos: Json
          espaco_id: number | null
          id: string
          nome: string
          obs: string | null
          planta_url: string | null
          propriedade_id: number | null
          tipo_setup: string
          usuario_id: string
        }
        Insert: {
          area_m2?: number | null
          atualizado_em?: string
          capacidade?: number | null
          criado_em?: string
          elementos?: Json
          espaco_id?: number | null
          id?: string
          nome: string
          obs?: string | null
          planta_url?: string | null
          propriedade_id?: number | null
          tipo_setup?: string
          usuario_id: string
        }
        Update: {
          area_m2?: number | null
          atualizado_em?: string
          capacidade?: number | null
          criado_em?: string
          elementos?: Json
          espaco_id?: number | null
          id?: string
          nome?: string
          obs?: string | null
          planta_url?: string | null
          propriedade_id?: number | null
          tipo_setup?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "layouts_espaco_id_fkey"
            columns: ["espaco_id"]
            isOneToOne: false
            referencedRelation: "espacos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "layouts_propriedade_id_fkey"
            columns: ["propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
        ]
      }
      lgpd_consentimentos: {
        Row: {
          base_legal: string
          canal: string
          concedido_em: string
          criado_em: string
          evidencia: string | null
          finalidade: string | null
          id: string
          revogado_em: string | null
          titular_id: string | null
          titular_nome: string | null
          titular_tipo: string
          usuario_id: string
        }
        Insert: {
          base_legal?: string
          canal?: string
          concedido_em?: string
          criado_em?: string
          evidencia?: string | null
          finalidade?: string | null
          id?: string
          revogado_em?: string | null
          titular_id?: string | null
          titular_nome?: string | null
          titular_tipo?: string
          usuario_id: string
        }
        Update: {
          base_legal?: string
          canal?: string
          concedido_em?: string
          criado_em?: string
          evidencia?: string | null
          finalidade?: string | null
          id?: string
          revogado_em?: string | null
          titular_id?: string | null
          titular_nome?: string | null
          titular_tipo?: string
          usuario_id?: string
        }
        Relationships: []
      }
      lgpd_politicas: {
        Row: {
          atualizado_em: string
          conteudo: string | null
          criado_em: string
          id: string
          publicada: boolean
          resumo: string | null
          tipo: string
          titulo: string | null
          url: string | null
          usuario_id: string
          versao: string
          vigente_desde: string | null
        }
        Insert: {
          atualizado_em?: string
          conteudo?: string | null
          criado_em?: string
          id?: string
          publicada?: boolean
          resumo?: string | null
          tipo?: string
          titulo?: string | null
          url?: string | null
          usuario_id: string
          versao?: string
          vigente_desde?: string | null
        }
        Update: {
          atualizado_em?: string
          conteudo?: string | null
          criado_em?: string
          id?: string
          publicada?: boolean
          resumo?: string | null
          tipo?: string
          titulo?: string | null
          url?: string | null
          usuario_id?: string
          versao?: string
          vigente_desde?: string | null
        }
        Relationships: []
      }
      lgpd_retencao: {
        Row: {
          acao_apos: string
          atualizado_em: string
          base_legal: string
          criado_em: string
          gatilho: string
          id: string
          obs: string | null
          prazo_meses: number
          responsavel: string | null
          tipo_dado: string
          usuario_id: string
        }
        Insert: {
          acao_apos?: string
          atualizado_em?: string
          base_legal?: string
          criado_em?: string
          gatilho?: string
          id?: string
          obs?: string | null
          prazo_meses?: number
          responsavel?: string | null
          tipo_dado: string
          usuario_id: string
        }
        Update: {
          acao_apos?: string
          atualizado_em?: string
          base_legal?: string
          criado_em?: string
          gatilho?: string
          id?: string
          obs?: string | null
          prazo_meses?: number
          responsavel?: string | null
          tipo_dado?: string
          usuario_id?: string
        }
        Relationships: []
      }
      lgpd_solicitacoes: {
        Row: {
          anexos: Json
          atualizado_em: string
          canal: string
          concluida_em: string | null
          criado_em: string
          id: string
          prazo: string | null
          resposta: string | null
          status: string
          tipo: string
          titular_contato: string | null
          titular_id: string | null
          titular_nome: string | null
          titular_tipo: string
          usuario_id: string
        }
        Insert: {
          anexos?: Json
          atualizado_em?: string
          canal?: string
          concluida_em?: string | null
          criado_em?: string
          id?: string
          prazo?: string | null
          resposta?: string | null
          status?: string
          tipo?: string
          titular_contato?: string | null
          titular_id?: string | null
          titular_nome?: string | null
          titular_tipo?: string
          usuario_id: string
        }
        Update: {
          anexos?: Json
          atualizado_em?: string
          canal?: string
          concluida_em?: string | null
          criado_em?: string
          id?: string
          prazo?: string | null
          resposta?: string | null
          status?: string
          tipo?: string
          titular_contato?: string | null
          titular_id?: string | null
          titular_nome?: string | null
          titular_tipo?: string
          usuario_id?: string
        }
        Relationships: []
      }
      licencas: {
        Row: {
          atualizado_em: string
          criado_em: string
          custo_num: number | null
          dias_aviso: number
          documento_nome: string | null
          documento_url: string | null
          emissao: string | null
          escopo: string
          evento_id: string | null
          id: string
          lancamento_id: number | null
          numero: string | null
          obrigatorio: boolean
          obs: string | null
          orgao: string | null
          orgao_contato: string | null
          propriedade_id: number | null
          protocolo: string | null
          responsavel: string | null
          status: string
          tipo: string
          titulo: string | null
          usuario_id: string
          validade: string | null
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          custo_num?: number | null
          dias_aviso?: number
          documento_nome?: string | null
          documento_url?: string | null
          emissao?: string | null
          escopo?: string
          evento_id?: string | null
          id?: string
          lancamento_id?: number | null
          numero?: string | null
          obrigatorio?: boolean
          obs?: string | null
          orgao?: string | null
          orgao_contato?: string | null
          propriedade_id?: number | null
          protocolo?: string | null
          responsavel?: string | null
          status?: string
          tipo?: string
          titulo?: string | null
          usuario_id: string
          validade?: string | null
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          custo_num?: number | null
          dias_aviso?: number
          documento_nome?: string | null
          documento_url?: string | null
          emissao?: string | null
          escopo?: string
          evento_id?: string | null
          id?: string
          lancamento_id?: number | null
          numero?: string | null
          obrigatorio?: boolean
          obs?: string | null
          orgao?: string | null
          orgao_contato?: string | null
          propriedade_id?: number | null
          protocolo?: string | null
          responsavel?: string | null
          status?: string
          tipo?: string
          titulo?: string | null
          usuario_id?: string
          validade?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "licencas_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "clientes_eventos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "licencas_lancamento_id_fkey"
            columns: ["lancamento_id"]
            isOneToOne: false
            referencedRelation: "lancamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "licencas_propriedade_id_fkey"
            columns: ["propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
        ]
      }
      listas: {
        Row: {
          atualizado_em: string
          autor_nome: string | null
          capa_url: string | null
          categoria: string | null
          cidade: string | null
          criado_em: string
          curtidas: number
          descricao: string | null
          id: string
          n_itens: number
          publica: boolean
          salvos: number
          slug: string
          titulo: string
          usuario_id: string
        }
        Insert: {
          atualizado_em?: string
          autor_nome?: string | null
          capa_url?: string | null
          categoria?: string | null
          cidade?: string | null
          criado_em?: string
          curtidas?: number
          descricao?: string | null
          id?: string
          n_itens?: number
          publica?: boolean
          salvos?: number
          slug: string
          titulo: string
          usuario_id: string
        }
        Update: {
          atualizado_em?: string
          autor_nome?: string | null
          capa_url?: string | null
          categoria?: string | null
          cidade?: string | null
          criado_em?: string
          curtidas?: number
          descricao?: string | null
          id?: string
          n_itens?: number
          publica?: boolean
          salvos?: number
          slug?: string
          titulo?: string
          usuario_id?: string
        }
        Relationships: []
      }
      listas_interacoes: {
        Row: {
          autor_id: string | null
          criado_em: string
          id: string
          lista_id: string | null
          tipo: string
          user_id: string
        }
        Insert: {
          autor_id?: string | null
          criado_em?: string
          id?: string
          lista_id?: string | null
          tipo: string
          user_id: string
        }
        Update: {
          autor_id?: string | null
          criado_em?: string
          id?: string
          lista_id?: string | null
          tipo?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "listas_interacoes_lista_id_fkey"
            columns: ["lista_id"]
            isOneToOne: false
            referencedRelation: "listas"
            referencedColumns: ["id"]
          },
        ]
      }
      listas_itens: {
        Row: {
          comentario: string | null
          criado_em: string
          id: string
          lista_id: string
          nome_externo: string | null
          nota: number | null
          ordem: number
          propriedade_id: number | null
          ref_cidade: string | null
          ref_imagem: string | null
          ref_nome: string | null
          tipo: string
          usuario_id: string
        }
        Insert: {
          comentario?: string | null
          criado_em?: string
          id?: string
          lista_id: string
          nome_externo?: string | null
          nota?: number | null
          ordem?: number
          propriedade_id?: number | null
          ref_cidade?: string | null
          ref_imagem?: string | null
          ref_nome?: string | null
          tipo?: string
          usuario_id: string
        }
        Update: {
          comentario?: string | null
          criado_em?: string
          id?: string
          lista_id?: string
          nome_externo?: string | null
          nota?: number | null
          ordem?: number
          propriedade_id?: number | null
          ref_cidade?: string | null
          ref_imagem?: string | null
          ref_nome?: string | null
          tipo?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "listas_itens_lista_id_fkey"
            columns: ["lista_id"]
            isOneToOne: false
            referencedRelation: "listas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listas_itens_propriedade_fk"
            columns: ["propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
        ]
      }
      logistica_chegadas: {
        Row: {
          atualizado_em: string
          checklist: Json
          contato: string | null
          criado_em: string
          doca: string | null
          duracao_min: number
          evento_id: string | null
          fornecedor_id: string | null
          id: string
          item: string
          obs: string | null
          placa: string | null
          previsto: string | null
          responsavel: string | null
          status: string
          usuario_id: string
          veiculo: string | null
        }
        Insert: {
          atualizado_em?: string
          checklist?: Json
          contato?: string | null
          criado_em?: string
          doca?: string | null
          duracao_min?: number
          evento_id?: string | null
          fornecedor_id?: string | null
          id?: string
          item: string
          obs?: string | null
          placa?: string | null
          previsto?: string | null
          responsavel?: string | null
          status?: string
          usuario_id: string
          veiculo?: string | null
        }
        Update: {
          atualizado_em?: string
          checklist?: Json
          contato?: string | null
          criado_em?: string
          doca?: string | null
          duracao_min?: number
          evento_id?: string | null
          fornecedor_id?: string | null
          id?: string
          item?: string
          obs?: string | null
          placa?: string | null
          previsto?: string | null
          responsavel?: string | null
          status?: string
          usuario_id?: string
          veiculo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "logistica_chegadas_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "clientes_eventos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "logistica_chegadas_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
        ]
      }
      logistica_janelas: {
        Row: {
          atualizado_em: string
          criado_em: string
          espaco_id: number | null
          evento_id: string | null
          fim: string
          id: string
          inicio: string
          obs: string | null
          propriedade_id: number | null
          reserva_id: string | null
          tipo: string
          titulo: string | null
          usuario_id: string
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          espaco_id?: number | null
          evento_id?: string | null
          fim: string
          id?: string
          inicio: string
          obs?: string | null
          propriedade_id?: number | null
          reserva_id?: string | null
          tipo?: string
          titulo?: string | null
          usuario_id: string
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          espaco_id?: number | null
          evento_id?: string | null
          fim?: string
          id?: string
          inicio?: string
          obs?: string | null
          propriedade_id?: number | null
          reserva_id?: string | null
          tipo?: string
          titulo?: string | null
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "logistica_janelas_espaco_id_fkey"
            columns: ["espaco_id"]
            isOneToOne: false
            referencedRelation: "espacos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "logistica_janelas_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "clientes_eventos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "logistica_janelas_propriedade_id_fkey"
            columns: ["propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "logistica_janelas_reserva_id_fkey"
            columns: ["reserva_id"]
            isOneToOne: false
            referencedRelation: "reservas"
            referencedColumns: ["id"]
          },
        ]
      }
      manutencao_os: {
        Row: {
          abertura: string
          anexos: Json
          ativo_id: string | null
          ativo_nome: string | null
          atualizado_em: string
          checklist: Json
          conclusao: string | null
          criado_em: string
          custo_mao_obra_num: number
          custo_pecas_num: number
          custo_total_num: number | null
          descricao: string | null
          espaco_id: number | null
          evento_id: string | null
          id: string
          lancamento_id: number | null
          obs: string | null
          pecas: Json
          plano_id: string | null
          prazo: string | null
          prioridade: string
          propriedade_id: number | null
          responsavel_id: string | null
          responsavel_nome: string | null
          responsavel_tipo: string | null
          solicitante: string | null
          status: string
          tipo: string
          titulo: string
          usuario_id: string
        }
        Insert: {
          abertura?: string
          anexos?: Json
          ativo_id?: string | null
          ativo_nome?: string | null
          atualizado_em?: string
          checklist?: Json
          conclusao?: string | null
          criado_em?: string
          custo_mao_obra_num?: number
          custo_pecas_num?: number
          custo_total_num?: number | null
          descricao?: string | null
          espaco_id?: number | null
          evento_id?: string | null
          id?: string
          lancamento_id?: number | null
          obs?: string | null
          pecas?: Json
          plano_id?: string | null
          prazo?: string | null
          prioridade?: string
          propriedade_id?: number | null
          responsavel_id?: string | null
          responsavel_nome?: string | null
          responsavel_tipo?: string | null
          solicitante?: string | null
          status?: string
          tipo?: string
          titulo: string
          usuario_id: string
        }
        Update: {
          abertura?: string
          anexos?: Json
          ativo_id?: string | null
          ativo_nome?: string | null
          atualizado_em?: string
          checklist?: Json
          conclusao?: string | null
          criado_em?: string
          custo_mao_obra_num?: number
          custo_pecas_num?: number
          custo_total_num?: number | null
          descricao?: string | null
          espaco_id?: number | null
          evento_id?: string | null
          id?: string
          lancamento_id?: number | null
          obs?: string | null
          pecas?: Json
          plano_id?: string | null
          prazo?: string | null
          prioridade?: string
          propriedade_id?: number | null
          responsavel_id?: string | null
          responsavel_nome?: string | null
          responsavel_tipo?: string | null
          solicitante?: string | null
          status?: string
          tipo?: string
          titulo?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "manut_os_espaco_id_fkey"
            columns: ["espaco_id"]
            isOneToOne: false
            referencedRelation: "espacos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manut_os_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "clientes_eventos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manut_os_lancamento_id_fkey"
            columns: ["lancamento_id"]
            isOneToOne: false
            referencedRelation: "lancamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manut_os_propriedade_id_fkey"
            columns: ["propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manutencao_os_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "manutencao_planos"
            referencedColumns: ["id"]
          },
        ]
      }
      manutencao_planos: {
        Row: {
          ativo: boolean
          ativo_id: string | null
          ativo_nome: string | null
          atualizado_em: string
          checklist: Json
          criado_em: string
          custo_estimado_num: number
          descricao: string | null
          espaco_id: number | null
          id: string
          intervalo: number
          obs: string | null
          periodicidade: string
          prioridade: string
          propriedade_id: number | null
          proxima_data: string | null
          responsavel_id: string | null
          responsavel_nome: string | null
          responsavel_tipo: string | null
          tipo: string
          titulo: string
          ultima_geracao: string | null
          usuario_id: string
        }
        Insert: {
          ativo?: boolean
          ativo_id?: string | null
          ativo_nome?: string | null
          atualizado_em?: string
          checklist?: Json
          criado_em?: string
          custo_estimado_num?: number
          descricao?: string | null
          espaco_id?: number | null
          id?: string
          intervalo?: number
          obs?: string | null
          periodicidade?: string
          prioridade?: string
          propriedade_id?: number | null
          proxima_data?: string | null
          responsavel_id?: string | null
          responsavel_nome?: string | null
          responsavel_tipo?: string | null
          tipo?: string
          titulo: string
          ultima_geracao?: string | null
          usuario_id: string
        }
        Update: {
          ativo?: boolean
          ativo_id?: string | null
          ativo_nome?: string | null
          atualizado_em?: string
          checklist?: Json
          criado_em?: string
          custo_estimado_num?: number
          descricao?: string | null
          espaco_id?: number | null
          id?: string
          intervalo?: number
          obs?: string | null
          periodicidade?: string
          prioridade?: string
          propriedade_id?: number | null
          proxima_data?: string | null
          responsavel_id?: string | null
          responsavel_nome?: string | null
          responsavel_tipo?: string | null
          tipo?: string
          titulo?: string
          ultima_geracao?: string | null
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "manut_planos_espaco_id_fkey"
            columns: ["espaco_id"]
            isOneToOne: false
            referencedRelation: "espacos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manut_planos_propriedade_id_fkey"
            columns: ["propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_acoes: {
        Row: {
          atualizado_em: string
          canal_id: string | null
          criado_em: string
          data: string
          id: string
          investimento_num: number
          resultado: Json
          status: string
          tipo: string
          titulo: string
          usuario_id: string
        }
        Insert: {
          atualizado_em?: string
          canal_id?: string | null
          criado_em?: string
          data?: string
          id?: string
          investimento_num?: number
          resultado?: Json
          status?: string
          tipo?: string
          titulo: string
          usuario_id: string
        }
        Update: {
          atualizado_em?: string
          canal_id?: string | null
          criado_em?: string
          data?: string
          id?: string
          investimento_num?: number
          resultado?: Json
          status?: string
          tipo?: string
          titulo?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_acoes_canal_id_fkey"
            columns: ["canal_id"]
            isOneToOne: false
            referencedRelation: "marketing_canais"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_canais: {
        Row: {
          ativo: boolean
          atualizado_em: string
          criado_em: string
          custo_mensal_num: number
          id: string
          nome: string
          origem_key: string
          tipo: string
          usuario_id: string
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          custo_mensal_num?: number
          id?: string
          nome: string
          origem_key?: string
          tipo?: string
          usuario_id: string
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          custo_mensal_num?: number
          id?: string
          nome?: string
          origem_key?: string
          tipo?: string
          usuario_id?: string
        }
        Relationships: []
      }
      mensagens: {
        Row: {
          conversation_id: string
          created_at: string | null
          id: string
          sender_id: string
          text: string
        }
        Insert: {
          conversation_id: string
          created_at?: string | null
          id?: string
          sender_id: string
          text: string
        }
        Update: {
          conversation_id?: string
          created_at?: string | null
          id?: string
          sender_id?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "mensagens_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversas"
            referencedColumns: ["id"]
          },
        ]
      }
      mensagens_contato: {
        Row: {
          assunto: string | null
          criado_em: string
          email: string | null
          id: number
          lida: boolean
          mensagem: string
          nome: string | null
          perfil: string | null
          telefone: string | null
        }
        Insert: {
          assunto?: string | null
          criado_em?: string
          email?: string | null
          id?: never
          lida?: boolean
          mensagem: string
          nome?: string | null
          perfil?: string | null
          telefone?: string | null
        }
        Update: {
          assunto?: string | null
          criado_em?: string
          email?: string | null
          id?: never
          lida?: boolean
          mensagem?: string
          nome?: string | null
          perfil?: string | null
          telefone?: string | null
        }
        Relationships: []
      }
      metas: {
        Row: {
          alvo_num: number
          area: string
          atualizado_em: string
          criado_em: string
          id: string
          metrica: string
          obs: string | null
          periodo: string
          propriedade_id: number | null
          realizado_num: number | null
          responsavel: string | null
          usuario_id: string
        }
        Insert: {
          alvo_num?: number
          area?: string
          atualizado_em?: string
          criado_em?: string
          id?: string
          metrica: string
          obs?: string | null
          periodo: string
          propriedade_id?: number | null
          realizado_num?: number | null
          responsavel?: string | null
          usuario_id: string
        }
        Update: {
          alvo_num?: number
          area?: string
          atualizado_em?: string
          criado_em?: string
          id?: string
          metrica?: string
          obs?: string | null
          periodo?: string
          propriedade_id?: number | null
          realizado_num?: number | null
          responsavel?: string | null
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "metas_propriedade_id_fkey"
            columns: ["propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
        ]
      }
      metas_financeiras: {
        Row: {
          alvo: number
          atualizado_em: string
          criado_em: string
          id: number
          metrica: string
          periodo: string
          usuario_id: string
        }
        Insert: {
          alvo: number
          atualizado_em?: string
          criado_em?: string
          id?: never
          metrica: string
          periodo?: string
          usuario_id?: string
        }
        Update: {
          alvo?: number
          atualizado_em?: string
          criado_em?: string
          id?: never
          metrica?: string
          periodo?: string
          usuario_id?: string
        }
        Relationships: []
      }
      notas_fiscais: {
        Row: {
          aliquota_iss: number | null
          atualizado_em: string
          cancelada_em: string | null
          cliente_id: string | null
          codigo_servico: string | null
          contrato_id: string | null
          criado_em: string
          descontos_num: number
          discriminacao: string | null
          emitida_em: string | null
          evento_id: string | null
          id: string
          iss_num: number
          motivo_cancelamento: string | null
          numero: string
          numero_seq: number
          parcela_id: number | null
          pdf_url: string | null
          provedor: string | null
          provedor_id: string | null
          provedor_msg: string | null
          regime: string | null
          retencoes: Json
          serie: string | null
          status: string
          tipo: string
          tomador_doc: string | null
          tomador_email: string | null
          tomador_nome: string | null
          total_retencoes_num: number
          usuario_id: string
          valor_liquido_num: number
          valor_servicos_num: number
          valor_total_num: number
          xml_url: string | null
        }
        Insert: {
          aliquota_iss?: number | null
          atualizado_em?: string
          cancelada_em?: string | null
          cliente_id?: string | null
          codigo_servico?: string | null
          contrato_id?: string | null
          criado_em?: string
          descontos_num?: number
          discriminacao?: string | null
          emitida_em?: string | null
          evento_id?: string | null
          id?: string
          iss_num?: number
          motivo_cancelamento?: string | null
          numero: string
          numero_seq?: number
          parcela_id?: number | null
          pdf_url?: string | null
          provedor?: string | null
          provedor_id?: string | null
          provedor_msg?: string | null
          regime?: string | null
          retencoes?: Json
          serie?: string | null
          status?: string
          tipo?: string
          tomador_doc?: string | null
          tomador_email?: string | null
          tomador_nome?: string | null
          total_retencoes_num?: number
          usuario_id: string
          valor_liquido_num?: number
          valor_servicos_num?: number
          valor_total_num?: number
          xml_url?: string | null
        }
        Update: {
          aliquota_iss?: number | null
          atualizado_em?: string
          cancelada_em?: string | null
          cliente_id?: string | null
          codigo_servico?: string | null
          contrato_id?: string | null
          criado_em?: string
          descontos_num?: number
          discriminacao?: string | null
          emitida_em?: string | null
          evento_id?: string | null
          id?: string
          iss_num?: number
          motivo_cancelamento?: string | null
          numero?: string
          numero_seq?: number
          parcela_id?: number | null
          pdf_url?: string | null
          provedor?: string | null
          provedor_id?: string | null
          provedor_msg?: string | null
          regime?: string | null
          retencoes?: Json
          serie?: string | null
          status?: string
          tipo?: string
          tomador_doc?: string | null
          tomador_email?: string | null
          tomador_nome?: string | null
          total_retencoes_num?: number
          usuario_id?: string
          valor_liquido_num?: number
          valor_servicos_num?: number
          valor_total_num?: number
          xml_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notas_fiscais_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notas_fiscais_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notas_fiscais_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "clientes_eventos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notas_fiscais_parcela_id_fkey"
            columns: ["parcela_id"]
            isOneToOne: false
            referencedRelation: "parcelas"
            referencedColumns: ["id"]
          },
        ]
      }
      notificacoes: {
        Row: {
          corpo: string | null
          criado_em: string
          id: string
          lida: boolean
          link: string | null
          origem: string | null
          tipo: string
          titulo: string
          urgencia: string
          usuario_id: string
        }
        Insert: {
          corpo?: string | null
          criado_em?: string
          id?: string
          lida?: boolean
          link?: string | null
          origem?: string | null
          tipo?: string
          titulo: string
          urgencia?: string
          usuario_id: string
        }
        Update: {
          corpo?: string | null
          criado_em?: string
          id?: string
          lida?: boolean
          link?: string | null
          origem?: string | null
          tipo?: string
          titulo?: string
          urgencia?: string
          usuario_id?: string
        }
        Relationships: []
      }
      okrs: {
        Row: {
          atualizado_em: string
          criado_em: string
          id: string
          krs: Json
          objetivo: string
          obs: string | null
          trimestre: string
          usuario_id: string
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          id?: string
          krs?: Json
          objetivo: string
          obs?: string | null
          trimestre: string
          usuario_id: string
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          id?: string
          krs?: Json
          objetivo?: string
          obs?: string | null
          trimestre?: string
          usuario_id?: string
        }
        Relationships: []
      }
      pacotes: {
        Row: {
          ativo: boolean
          atualizado_em: string
          criado_em: string
          descricao: string | null
          id: string
          itens: Json
          nome: string
          propriedade_id: number | null
          usuario_id: string
          valor_num: number
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          descricao?: string | null
          id?: string
          itens?: Json
          nome: string
          propriedade_id?: number | null
          usuario_id: string
          valor_num?: number
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          descricao?: string | null
          id?: string
          itens?: Json
          nome?: string
          propriedade_id?: number | null
          usuario_id?: string
          valor_num?: number
        }
        Relationships: [
          {
            foreignKeyName: "pacotes_propriedade_id_fkey"
            columns: ["propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
        ]
      }
      pagamentos: {
        Row: {
          atualizado_em: string | null
          comissao_ventsy: number | null
          criado_em: string | null
          cupom_codigo: string | null
          cupom_id: string | null
          external_ref: string | null
          id: string
          meses: number
          metodo: string
          modelo_taxa: string | null
          mp_payment_id: string | null
          mp_status: string | null
          mp_status_detail: string | null
          nfe: Json | null
          parcela_id: number | null
          plano_id: string
          repasse_anfitriao: number | null
          reserva_id: string | null
          status: string
          taxa_anfitriao: number | null
          taxa_hospede: number | null
          usuario_id: string
          valor: number
          valor_base: number | null
        }
        Insert: {
          atualizado_em?: string | null
          comissao_ventsy?: number | null
          criado_em?: string | null
          cupom_codigo?: string | null
          cupom_id?: string | null
          external_ref?: string | null
          id?: string
          meses?: number
          metodo: string
          modelo_taxa?: string | null
          mp_payment_id?: string | null
          mp_status?: string | null
          mp_status_detail?: string | null
          nfe?: Json | null
          parcela_id?: number | null
          plano_id: string
          repasse_anfitriao?: number | null
          reserva_id?: string | null
          status?: string
          taxa_anfitriao?: number | null
          taxa_hospede?: number | null
          usuario_id: string
          valor: number
          valor_base?: number | null
        }
        Update: {
          atualizado_em?: string | null
          comissao_ventsy?: number | null
          criado_em?: string | null
          cupom_codigo?: string | null
          cupom_id?: string | null
          external_ref?: string | null
          id?: string
          meses?: number
          metodo?: string
          modelo_taxa?: string | null
          mp_payment_id?: string | null
          mp_status?: string | null
          mp_status_detail?: string | null
          nfe?: Json | null
          parcela_id?: number | null
          plano_id?: string
          repasse_anfitriao?: number | null
          reserva_id?: string | null
          status?: string
          taxa_anfitriao?: number | null
          taxa_hospede?: number | null
          usuario_id?: string
          valor?: number
          valor_base?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pagamentos_cupom_id_fkey"
            columns: ["cupom_id"]
            isOneToOne: false
            referencedRelation: "cupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamentos_reserva_id_fkey"
            columns: ["reserva_id"]
            isOneToOne: false
            referencedRelation: "reservas"
            referencedColumns: ["id"]
          },
        ]
      }
      parceiros: {
        Row: {
          ativo: boolean
          atualizado_em: string
          banco: Json
          chave_pix: string | null
          cidade: string | null
          contato: string | null
          criado_em: string
          doc: string | null
          email: string | null
          estado: string | null
          id: string
          nome: string
          obs: string | null
          percentual_padrao: number | null
          telefone: string | null
          tipo: string
          usuario_id: string
          whatsapp: string | null
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          banco?: Json
          chave_pix?: string | null
          cidade?: string | null
          contato?: string | null
          criado_em?: string
          doc?: string | null
          email?: string | null
          estado?: string | null
          id?: string
          nome: string
          obs?: string | null
          percentual_padrao?: number | null
          telefone?: string | null
          tipo?: string
          usuario_id: string
          whatsapp?: string | null
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          banco?: Json
          chave_pix?: string | null
          cidade?: string | null
          contato?: string | null
          criado_em?: string
          doc?: string | null
          email?: string | null
          estado?: string | null
          id?: string
          nome?: string
          obs?: string | null
          percentual_padrao?: number | null
          telefone?: string | null
          tipo?: string
          usuario_id?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      parcelas: {
        Row: {
          atualizado_em: string
          criado_em: string
          descricao: string | null
          evento_id: string
          id: number
          lancamento_id: number | null
          metodo_pagamento: string | null
          nota_id: string | null
          numero: number | null
          pago_em: string | null
          status: string
          usuario_id: string
          valor: number
          vencimento: string | null
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          descricao?: string | null
          evento_id: string
          id?: never
          lancamento_id?: number | null
          metodo_pagamento?: string | null
          nota_id?: string | null
          numero?: number | null
          pago_em?: string | null
          status?: string
          usuario_id?: string
          valor?: number
          vencimento?: string | null
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          descricao?: string | null
          evento_id?: string
          id?: never
          lancamento_id?: number | null
          metodo_pagamento?: string | null
          nota_id?: string | null
          numero?: number | null
          pago_em?: string | null
          status?: string
          usuario_id?: string
          valor?: number
          vencimento?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "parcelas_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "clientes_eventos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parcelas_lancamento_id_fkey"
            columns: ["lancamento_id"]
            isOneToOne: false
            referencedRelation: "lancamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parcelas_nota_id_fkey"
            columns: ["nota_id"]
            isOneToOne: false
            referencedRelation: "notas_fiscais"
            referencedColumns: ["id"]
          },
        ]
      }
      patrocinadores: {
        Row: {
          atualizado_em: string
          contato: string | null
          contrato_id: string | null
          cota_id: string | null
          criado_em: string
          email: string | null
          entregaveis_status: Json
          evento_id: string
          id: string
          lancamento_id: string | null
          marca: string
          obs: string | null
          status: string
          telefone: string | null
          usuario_id: string
          valor_num: number
        }
        Insert: {
          atualizado_em?: string
          contato?: string | null
          contrato_id?: string | null
          cota_id?: string | null
          criado_em?: string
          email?: string | null
          entregaveis_status?: Json
          evento_id: string
          id?: string
          lancamento_id?: string | null
          marca: string
          obs?: string | null
          status?: string
          telefone?: string | null
          usuario_id: string
          valor_num?: number
        }
        Update: {
          atualizado_em?: string
          contato?: string | null
          contrato_id?: string | null
          cota_id?: string | null
          criado_em?: string
          email?: string | null
          entregaveis_status?: Json
          evento_id?: string
          id?: string
          lancamento_id?: string | null
          marca?: string
          obs?: string | null
          status?: string
          telefone?: string | null
          usuario_id?: string
          valor_num?: number
        }
        Relationships: [
          {
            foreignKeyName: "patrocinadores_cota_id_fkey"
            columns: ["cota_id"]
            isOneToOne: false
            referencedRelation: "patrocinio_cotas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patrocinadores_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "clientes_eventos"
            referencedColumns: ["id"]
          },
        ]
      }
      patrocinio_cotas: {
        Row: {
          atualizado_em: string
          cor: string | null
          criado_em: string
          entregaveis: Json
          evento_id: string
          id: string
          nome: string
          obs: string | null
          ordem: number
          preco_num: number
          quantidade: number | null
          usuario_id: string
        }
        Insert: {
          atualizado_em?: string
          cor?: string | null
          criado_em?: string
          entregaveis?: Json
          evento_id: string
          id?: string
          nome: string
          obs?: string | null
          ordem?: number
          preco_num?: number
          quantidade?: number | null
          usuario_id: string
        }
        Update: {
          atualizado_em?: string
          cor?: string | null
          criado_em?: string
          entregaveis?: Json
          evento_id?: string
          id?: string
          nome?: string
          obs?: string | null
          ordem?: number
          preco_num?: number
          quantidade?: number | null
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "patrocinio_cotas_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "clientes_eventos"
            referencedColumns: ["id"]
          },
        ]
      }
      pedidos_compra: {
        Row: {
          atualizado_em: string
          condicao: string | null
          cotacao_id: string | null
          criado_em: string
          enviado_em: string | null
          fornecedor_id: string | null
          fornecedor_nome: string | null
          id: string
          itens: Json
          numero: string | null
          obs: string | null
          previsao_entrega: string | null
          requisicao_id: string | null
          status: string
          usuario_id: string
          valor_total_num: number
        }
        Insert: {
          atualizado_em?: string
          condicao?: string | null
          cotacao_id?: string | null
          criado_em?: string
          enviado_em?: string | null
          fornecedor_id?: string | null
          fornecedor_nome?: string | null
          id?: string
          itens?: Json
          numero?: string | null
          obs?: string | null
          previsao_entrega?: string | null
          requisicao_id?: string | null
          status?: string
          usuario_id: string
          valor_total_num?: number
        }
        Update: {
          atualizado_em?: string
          condicao?: string | null
          cotacao_id?: string | null
          criado_em?: string
          enviado_em?: string | null
          fornecedor_id?: string | null
          fornecedor_nome?: string | null
          id?: string
          itens?: Json
          numero?: string | null
          obs?: string | null
          previsao_entrega?: string | null
          requisicao_id?: string | null
          status?: string
          usuario_id?: string
          valor_total_num?: number
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_compra_cotacao_id_fkey"
            columns: ["cotacao_id"]
            isOneToOne: false
            referencedRelation: "cotacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_compra_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_compra_requisicao_id_fkey"
            columns: ["requisicao_id"]
            isOneToOne: false
            referencedRelation: "requisicoes"
            referencedColumns: ["id"]
          },
        ]
      }
      pedidos_ingresso: {
        Row: {
          atualizado_em: string
          bilheteria_id: string
          canal: string
          comprador_doc: string | null
          comprador_email: string | null
          comprador_nome: string
          criado_em: string
          cupom_codigo: string | null
          cupom_id: string | null
          desconto_num: number
          id: string
          moeda: string
          mp_payment_id: string | null
          mp_preference_id: string | null
          mp_status: string | null
          pago_em: string | null
          status: string
          subtotal_num: number
          taxa_num: number
          telefone: string | null
          total_num: number
          usuario_id: string
        }
        Insert: {
          atualizado_em?: string
          bilheteria_id: string
          canal?: string
          comprador_doc?: string | null
          comprador_email?: string | null
          comprador_nome: string
          criado_em?: string
          cupom_codigo?: string | null
          cupom_id?: string | null
          desconto_num?: number
          id?: string
          moeda?: string
          mp_payment_id?: string | null
          mp_preference_id?: string | null
          mp_status?: string | null
          pago_em?: string | null
          status?: string
          subtotal_num?: number
          taxa_num?: number
          telefone?: string | null
          total_num?: number
          usuario_id: string
        }
        Update: {
          atualizado_em?: string
          bilheteria_id?: string
          canal?: string
          comprador_doc?: string | null
          comprador_email?: string | null
          comprador_nome?: string
          criado_em?: string
          cupom_codigo?: string | null
          cupom_id?: string | null
          desconto_num?: number
          id?: string
          moeda?: string
          mp_payment_id?: string | null
          mp_preference_id?: string | null
          mp_status?: string | null
          pago_em?: string | null
          status?: string
          subtotal_num?: number
          taxa_num?: number
          telefone?: string | null
          total_num?: number
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_ingresso_bilheteria_id_fkey"
            columns: ["bilheteria_id"]
            isOneToOne: false
            referencedRelation: "bilheteria_eventos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_ingresso_cupom_id_fkey"
            columns: ["cupom_id"]
            isOneToOne: false
            referencedRelation: "bilheteria_cupons"
            referencedColumns: ["id"]
          },
        ]
      }
      pesquisas: {
        Row: {
          ativo: boolean
          atualizado_em: string
          criado_em: string
          descricao: string | null
          dias_apos: number | null
          gatilho: string
          id: string
          perguntas: Json
          tipo: string
          titulo: string
          usuario_id: string
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          descricao?: string | null
          dias_apos?: number | null
          gatilho?: string
          id?: string
          perguntas?: Json
          tipo?: string
          titulo: string
          usuario_id: string
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          descricao?: string | null
          dias_apos?: number | null
          gatilho?: string
          id?: string
          perguntas?: Json
          tipo?: string
          titulo?: string
          usuario_id?: string
        }
        Relationships: []
      }
      pesquisas_respostas: {
        Row: {
          autor_contato: string | null
          autor_nome: string | null
          categoria: string | null
          cliente_id: string | null
          comentario: string | null
          criado_em: string
          evento_id: string | null
          id: string
          nps: number | null
          pesquisa_id: string
          propriedade_id: number | null
          respostas: Json
          usuario_id: string
        }
        Insert: {
          autor_contato?: string | null
          autor_nome?: string | null
          categoria?: string | null
          cliente_id?: string | null
          comentario?: string | null
          criado_em?: string
          evento_id?: string | null
          id?: string
          nps?: number | null
          pesquisa_id: string
          propriedade_id?: number | null
          respostas?: Json
          usuario_id: string
        }
        Update: {
          autor_contato?: string | null
          autor_nome?: string | null
          categoria?: string | null
          cliente_id?: string | null
          comentario?: string | null
          criado_em?: string
          evento_id?: string | null
          id?: string
          nps?: number | null
          pesquisa_id?: string
          propriedade_id?: number | null
          respostas?: Json
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pesquisas_respostas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pesquisas_respostas_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "clientes_eventos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pesquisas_respostas_pesquisa_id_fkey"
            columns: ["pesquisa_id"]
            isOneToOne: false
            referencedRelation: "pesquisas"
            referencedColumns: ["id"]
          },
        ]
      }
      plano_contas: {
        Row: {
          ativo: boolean
          atualizado_em: string
          categoria_legada: string | null
          codigo: string
          criado_em: string
          dre_linha: string | null
          grupo: string | null
          id: string
          nome: string
          tipo: string
          usuario_id: string
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          categoria_legada?: string | null
          codigo: string
          criado_em?: string
          dre_linha?: string | null
          grupo?: string | null
          id?: string
          nome: string
          tipo: string
          usuario_id: string
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          categoria_legada?: string | null
          codigo?: string
          criado_em?: string
          dre_linha?: string | null
          grupo?: string | null
          id?: string
          nome?: string
          tipo?: string
          usuario_id?: string
        }
        Relationships: []
      }
      plano_contingencia: {
        Row: {
          acao: string | null
          atualizado_em: string
          checklist: Json
          comunicado_template: string | null
          criado_em: string
          evento_id: string
          gatilho: Json
          id: string
          ordem: number
          responsavel: string | null
          status: string
          tipo_risco: string
          usuario_id: string
        }
        Insert: {
          acao?: string | null
          atualizado_em?: string
          checklist?: Json
          comunicado_template?: string | null
          criado_em?: string
          evento_id: string
          gatilho?: Json
          id?: string
          ordem?: number
          responsavel?: string | null
          status?: string
          tipo_risco?: string
          usuario_id: string
        }
        Update: {
          acao?: string | null
          atualizado_em?: string
          checklist?: Json
          comunicado_template?: string | null
          criado_em?: string
          evento_id?: string
          gatilho?: Json
          id?: string
          ordem?: number
          responsavel?: string | null
          status?: string
          tipo_risco?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plano_contingencia_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "clientes_eventos"
            referencedColumns: ["id"]
          },
        ]
      }
      planos_anunciantes: {
        Row: {
          ativo: boolean | null
          id: string
          plano: string | null
          user_id: string
          validade: string | null
        }
        Insert: {
          ativo?: boolean | null
          id?: string
          plano?: string | null
          user_id: string
          validade?: string | null
        }
        Update: {
          ativo?: boolean | null
          id?: string
          plano?: string | null
          user_id?: string
          validade?: string | null
        }
        Relationships: []
      }
      planos_config: {
        Row: {
          atualizado_em: string | null
          id: string
          items: string[]
          preco: number
          status: string
        }
        Insert: {
          atualizado_em?: string | null
          id: string
          items?: string[]
          preco?: number
          status?: string
        }
        Update: {
          atualizado_em?: string | null
          id?: string
          items?: string[]
          preco?: number
          status?: string
        }
        Relationships: []
      }
      plataforma_config: {
        Row: {
          atualizado_em: string
          atualizado_por: string | null
          chave: string
          valor: Json
        }
        Insert: {
          atualizado_em?: string
          atualizado_por?: string | null
          chave: string
          valor: Json
        }
        Update: {
          atualizado_em?: string
          atualizado_por?: string | null
          chave?: string
          valor?: Json
        }
        Relationships: []
      }
      ponto_registros: {
        Row: {
          alocacao_id: string | null
          atraso_min: number
          atualizado_em: string
          criado_em: string
          data: string
          entrada: string | null
          equipe_id: number | null
          evento_id: string | null
          extras_min: number
          freelancer_id: string | null
          id: string
          intervalo_min: number
          jornada_min: number
          local: string | null
          noturno_min: number
          obs: string | null
          origem: string
          saida: string | null
          saldo_min: number
          trabalhado_min: number
          usuario_id: string
        }
        Insert: {
          alocacao_id?: string | null
          atraso_min?: number
          atualizado_em?: string
          criado_em?: string
          data?: string
          entrada?: string | null
          equipe_id?: number | null
          evento_id?: string | null
          extras_min?: number
          freelancer_id?: string | null
          id?: string
          intervalo_min?: number
          jornada_min?: number
          local?: string | null
          noturno_min?: number
          obs?: string | null
          origem?: string
          saida?: string | null
          saldo_min?: number
          trabalhado_min?: number
          usuario_id: string
        }
        Update: {
          alocacao_id?: string | null
          atraso_min?: number
          atualizado_em?: string
          criado_em?: string
          data?: string
          entrada?: string | null
          equipe_id?: number | null
          evento_id?: string | null
          extras_min?: number
          freelancer_id?: string | null
          id?: string
          intervalo_min?: number
          jornada_min?: number
          local?: string | null
          noturno_min?: number
          obs?: string | null
          origem?: string
          saida?: string | null
          saldo_min?: number
          trabalhado_min?: number
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ponto_equipe_id_fkey"
            columns: ["equipe_id"]
            isOneToOne: false
            referencedRelation: "equipe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ponto_registros_alocacao_id_fkey"
            columns: ["alocacao_id"]
            isOneToOne: false
            referencedRelation: "escalas_alocacao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ponto_registros_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "clientes_eventos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ponto_registros_freelancer_id_fkey"
            columns: ["freelancer_id"]
            isOneToOne: false
            referencedRelation: "freelancers"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_acessos: {
        Row: {
          aceito_em: string | null
          boas_vindas: string | null
          criado_em: string
          email: string
          evento_id: string
          id: string
          modulos: Json | null
          status: string
          token: string
          ultimo_acesso_em: string | null
          user_id: string | null
          usuario_id: string
        }
        Insert: {
          aceito_em?: string | null
          boas_vindas?: string | null
          criado_em?: string
          email: string
          evento_id: string
          id?: string
          modulos?: Json | null
          status?: string
          token: string
          ultimo_acesso_em?: string | null
          user_id?: string | null
          usuario_id: string
        }
        Update: {
          aceito_em?: string | null
          boas_vindas?: string | null
          criado_em?: string
          email?: string
          evento_id?: string
          id?: string
          modulos?: Json | null
          status?: string
          token?: string
          ultimo_acesso_em?: string | null
          user_id?: string | null
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_acessos_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "clientes_eventos"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_config: {
        Row: {
          ativo: boolean
          atualizado_em: string
          boas_vindas: string | null
          cor: string
          criado_em: string
          modulos: Json
          usuario_id: string
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          boas_vindas?: string | null
          cor?: string
          criado_em?: string
          modulos?: Json
          usuario_id: string
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          boas_vindas?: string | null
          cor?: string
          criado_em?: string
          modulos?: Json
          usuario_id?: string
        }
        Relationships: []
      }
      precos_regras: {
        Row: {
          ajuste_tipo: string
          ajuste_valor: number
          ativo: boolean
          condicao: Json
          criado_em: string
          id: string
          nome: string | null
          prioridade: number
          tabela_id: string
          tipo: string
          usuario_id: string
        }
        Insert: {
          ajuste_tipo?: string
          ajuste_valor?: number
          ativo?: boolean
          condicao?: Json
          criado_em?: string
          id?: string
          nome?: string | null
          prioridade?: number
          tabela_id: string
          tipo: string
          usuario_id: string
        }
        Update: {
          ajuste_tipo?: string
          ajuste_valor?: number
          ativo?: boolean
          condicao?: Json
          criado_em?: string
          id?: string
          nome?: string | null
          prioridade?: number
          tabela_id?: string
          tipo?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "precos_regras_tabela_id_fkey"
            columns: ["tabela_id"]
            isOneToOne: false
            referencedRelation: "precos_tabela"
            referencedColumns: ["id"]
          },
        ]
      }
      precos_tabela: {
        Row: {
          ativo: boolean
          atualizado_em: string
          base: string
          concorrencia_num: number | null
          criado_em: string
          custo_num: number | null
          espaco_id: number | null
          id: string
          moeda: string
          nome: string
          propriedade_id: number | null
          usuario_id: string
          valor_base_num: number
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          base?: string
          concorrencia_num?: number | null
          criado_em?: string
          custo_num?: number | null
          espaco_id?: number | null
          id?: string
          moeda?: string
          nome: string
          propriedade_id?: number | null
          usuario_id: string
          valor_base_num?: number
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          base?: string
          concorrencia_num?: number | null
          criado_em?: string
          custo_num?: number | null
          espaco_id?: number | null
          id?: string
          moeda?: string
          nome?: string
          propriedade_id?: number | null
          usuario_id?: string
          valor_base_num?: number
        }
        Relationships: [
          {
            foreignKeyName: "precos_tabela_propriedade_id_fkey"
            columns: ["propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
        ]
      }
      producao: {
        Row: {
          atualizado_em: string
          briefing: Json
          criado_em: string
          evento_id: string
          id: string
          observacoes: string | null
          status: string
          usuario_id: string
        }
        Insert: {
          atualizado_em?: string
          briefing?: Json
          criado_em?: string
          evento_id: string
          id?: string
          observacoes?: string | null
          status?: string
          usuario_id: string
        }
        Update: {
          atualizado_em?: string
          briefing?: Json
          criado_em?: string
          evento_id?: string
          id?: string
          observacoes?: string | null
          status?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "producao_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: true
            referencedRelation: "clientes_eventos"
            referencedColumns: ["id"]
          },
        ]
      }
      producao_tarefas: {
        Row: {
          anexos: Json
          atualizado_em: string
          categoria: string
          criado_em: string
          depende_de: string | null
          id: string
          obs: string | null
          ordem: number
          prazo: string | null
          prioridade: string
          producao_id: string
          responsavel: string
          responsavel_id: string | null
          responsavel_nome: string | null
          status: string
          titulo: string
          usuario_id: string
        }
        Insert: {
          anexos?: Json
          atualizado_em?: string
          categoria?: string
          criado_em?: string
          depende_de?: string | null
          id?: string
          obs?: string | null
          ordem?: number
          prazo?: string | null
          prioridade?: string
          producao_id: string
          responsavel?: string
          responsavel_id?: string | null
          responsavel_nome?: string | null
          status?: string
          titulo: string
          usuario_id: string
        }
        Update: {
          anexos?: Json
          atualizado_em?: string
          categoria?: string
          criado_em?: string
          depende_de?: string | null
          id?: string
          obs?: string | null
          ordem?: number
          prazo?: string | null
          prioridade?: string
          producao_id?: string
          responsavel?: string
          responsavel_id?: string | null
          responsavel_nome?: string | null
          status?: string
          titulo?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "producao_tarefas_depende_de_fkey"
            columns: ["depende_de"]
            isOneToOne: false
            referencedRelation: "producao_tarefas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producao_tarefas_producao_id_fkey"
            columns: ["producao_id"]
            isOneToOne: false
            referencedRelation: "producao"
            referencedColumns: ["id"]
          },
        ]
      }
      produtos: {
        Row: {
          ativo: boolean
          atualizado_em: string
          categoria: string
          criado_em: string
          custo_medio_num: number
          estoque_atual: number
          estoque_minimo: number
          id: string
          local: string
          nome: string
          obs: string | null
          perecivel: boolean
          sku: string | null
          unidade: string
          usuario_id: string
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          categoria?: string
          criado_em?: string
          custo_medio_num?: number
          estoque_atual?: number
          estoque_minimo?: number
          id?: string
          local?: string
          nome: string
          obs?: string | null
          perecivel?: boolean
          sku?: string | null
          unidade?: string
          usuario_id: string
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          categoria?: string
          criado_em?: string
          custo_medio_num?: number
          estoque_atual?: number
          estoque_minimo?: number
          id?: string
          local?: string
          nome?: string
          obs?: string | null
          perecivel?: boolean
          sku?: string | null
          unidade?: string
          usuario_id?: string
        }
        Relationships: []
      }
      promocoes_restaurante: {
        Row: {
          ativa: boolean | null
          codigo_cupom: string | null
          criado_em: string | null
          data_fim: string | null
          data_inicio: string | null
          descricao: string | null
          dias_semana: string[] | null
          horario_fim: string | null
          horario_inicio: string | null
          id: string
          restaurante_id: string | null
          tipo: string | null
          titulo: string
          valor_desconto: number | null
        }
        Insert: {
          ativa?: boolean | null
          codigo_cupom?: string | null
          criado_em?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          descricao?: string | null
          dias_semana?: string[] | null
          horario_fim?: string | null
          horario_inicio?: string | null
          id?: string
          restaurante_id?: string | null
          tipo?: string | null
          titulo: string
          valor_desconto?: number | null
        }
        Update: {
          ativa?: boolean | null
          codigo_cupom?: string | null
          criado_em?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          descricao?: string | null
          dias_semana?: string[] | null
          horario_fim?: string | null
          horario_inicio?: string | null
          id?: string
          restaurante_id?: string | null
          tipo?: string | null
          titulo?: string
          valor_desconto?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "promocoes_restaurante_restaurante_id_fkey"
            columns: ["restaurante_id"]
            isOneToOne: false
            referencedRelation: "restaurantes"
            referencedColumns: ["id"]
          },
        ]
      }
      propostas: {
        Row: {
          aceita_em: string | null
          atualizado_em: string
          cliente_id: string | null
          condicoes: string | null
          condicoes_pagamento: Json
          criado_em: string
          desconto_num: number
          enviada_em: string | null
          evento_id: string | null
          id: string
          itens: Json
          link_token: string
          moeda: string
          motivo_recusa: string | null
          numero: number
          observacoes: string | null
          propriedade_id: number | null
          recusada_em: string | null
          status: string
          subtotal_num: number
          titulo: string
          total_num: number
          usuario_id: string
          validade: string | null
          vista_em: string | null
        }
        Insert: {
          aceita_em?: string | null
          atualizado_em?: string
          cliente_id?: string | null
          condicoes?: string | null
          condicoes_pagamento?: Json
          criado_em?: string
          desconto_num?: number
          enviada_em?: string | null
          evento_id?: string | null
          id?: string
          itens?: Json
          link_token?: string
          moeda?: string
          motivo_recusa?: string | null
          numero?: number
          observacoes?: string | null
          propriedade_id?: number | null
          recusada_em?: string | null
          status?: string
          subtotal_num?: number
          titulo?: string
          total_num?: number
          usuario_id: string
          validade?: string | null
          vista_em?: string | null
        }
        Update: {
          aceita_em?: string | null
          atualizado_em?: string
          cliente_id?: string | null
          condicoes?: string | null
          condicoes_pagamento?: Json
          criado_em?: string
          desconto_num?: number
          enviada_em?: string | null
          evento_id?: string | null
          id?: string
          itens?: Json
          link_token?: string
          moeda?: string
          motivo_recusa?: string | null
          numero?: number
          observacoes?: string | null
          propriedade_id?: number | null
          recusada_em?: string | null
          status?: string
          subtotal_num?: number
          titulo?: string
          total_num?: number
          usuario_id?: string
          validade?: string | null
          vista_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "propostas_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "clientes_eventos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "propostas_propriedade_id_fkey"
            columns: ["propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
        ]
      }
      propostas_templates: {
        Row: {
          atualizado_em: string
          condicoes: string | null
          condicoes_pagamento: Json
          criado_em: string
          id: string
          itens: Json
          nome: string
          observacoes: string | null
          tipo_evento: string | null
          titulo: string | null
          usuario_id: string
        }
        Insert: {
          atualizado_em?: string
          condicoes?: string | null
          condicoes_pagamento?: Json
          criado_em?: string
          id?: string
          itens?: Json
          nome: string
          observacoes?: string | null
          tipo_evento?: string | null
          titulo?: string | null
          usuario_id: string
        }
        Update: {
          atualizado_em?: string
          condicoes?: string | null
          condicoes_pagamento?: Json
          criado_em?: string
          id?: string
          itens?: Json
          nome?: string
          observacoes?: string | null
          tipo_evento?: string | null
          titulo?: string | null
          usuario_id?: string
        }
        Relationships: []
      }
      propriedades: {
        Row: {
          acessibilidade: boolean | null
          avaliacao: number | null
          bairro: string | null
          bio_responsavel: string | null
          capacidade: number | null
          categoria: string | null
          cep: string | null
          cidade: string | null
          climatizado: boolean | null
          comodidades: string | null
          complemento: string | null
          criadoem: string | null
          custos_extras: Json | null
          descricao: string | null
          destaque: boolean | null
          email_contato: string | null
          endereco: string | null
          estacionamento: boolean | null
          estado: string | null
          evento_casamento: boolean | null
          evento_formatura: boolean | null
          facebook: string | null
          faq: Json | null
          foto_responsavel: string | null
          fotos_verificadas: boolean | null
          ical_token: string
          id: number
          imagem_url: string | null
          instagram: string | null
          latitude: number | null
          linkedin: string | null
          longitude: number | null
          nome: string | null
          nome_responsavel: string | null
          numero: string | null
          publicada: boolean | null
          regras_preco: string | null
          rua: string | null
          servicos_extras: string | null
          site: string | null
          som_alto: boolean | null
          som_tarde: boolean | null
          status_publicacao:
            | Database["public"]["Enums"]["status_pub_enum"]
            | null
          telefone: string | null
          tiktok: string | null
          tipo_evento: string | null
          tipo_propriedade: string | null
          usuario_id: string | null
          valor_base: number | null
          valor_hora: number | null
          valor_periodo: number | null
          whatsapp: string | null
          youtube: string | null
        }
        Insert: {
          acessibilidade?: boolean | null
          avaliacao?: number | null
          bairro?: string | null
          bio_responsavel?: string | null
          capacidade?: number | null
          categoria?: string | null
          cep?: string | null
          cidade?: string | null
          climatizado?: boolean | null
          comodidades?: string | null
          complemento?: string | null
          criadoem?: string | null
          custos_extras?: Json | null
          descricao?: string | null
          destaque?: boolean | null
          email_contato?: string | null
          endereco?: string | null
          estacionamento?: boolean | null
          estado?: string | null
          evento_casamento?: boolean | null
          evento_formatura?: boolean | null
          facebook?: string | null
          faq?: Json | null
          foto_responsavel?: string | null
          fotos_verificadas?: boolean | null
          ical_token?: string
          id?: number
          imagem_url?: string | null
          instagram?: string | null
          latitude?: number | null
          linkedin?: string | null
          longitude?: number | null
          nome?: string | null
          nome_responsavel?: string | null
          numero?: string | null
          publicada?: boolean | null
          regras_preco?: string | null
          rua?: string | null
          servicos_extras?: string | null
          site?: string | null
          som_alto?: boolean | null
          som_tarde?: boolean | null
          status_publicacao?:
            | Database["public"]["Enums"]["status_pub_enum"]
            | null
          telefone?: string | null
          tiktok?: string | null
          tipo_evento?: string | null
          tipo_propriedade?: string | null
          usuario_id?: string | null
          valor_base?: number | null
          valor_hora?: number | null
          valor_periodo?: number | null
          whatsapp?: string | null
          youtube?: string | null
        }
        Update: {
          acessibilidade?: boolean | null
          avaliacao?: number | null
          bairro?: string | null
          bio_responsavel?: string | null
          capacidade?: number | null
          categoria?: string | null
          cep?: string | null
          cidade?: string | null
          climatizado?: boolean | null
          comodidades?: string | null
          complemento?: string | null
          criadoem?: string | null
          custos_extras?: Json | null
          descricao?: string | null
          destaque?: boolean | null
          email_contato?: string | null
          endereco?: string | null
          estacionamento?: boolean | null
          estado?: string | null
          evento_casamento?: boolean | null
          evento_formatura?: boolean | null
          facebook?: string | null
          faq?: Json | null
          foto_responsavel?: string | null
          fotos_verificadas?: boolean | null
          ical_token?: string
          id?: number
          imagem_url?: string | null
          instagram?: string | null
          latitude?: number | null
          linkedin?: string | null
          longitude?: number | null
          nome?: string | null
          nome_responsavel?: string | null
          numero?: string | null
          publicada?: boolean | null
          regras_preco?: string | null
          rua?: string | null
          servicos_extras?: string | null
          site?: string | null
          som_alto?: boolean | null
          som_tarde?: boolean | null
          status_publicacao?:
            | Database["public"]["Enums"]["status_pub_enum"]
            | null
          telefone?: string | null
          tiktok?: string | null
          tipo_evento?: string | null
          tipo_propriedade?: string | null
          usuario_id?: string | null
          valor_base?: number | null
          valor_hora?: number | null
          valor_periodo?: number | null
          whatsapp?: string | null
          youtube?: string | null
        }
        Relationships: []
      }
      propriedadexcomodidades: {
        Row: {
          comodidadeID: string
          propriedadeID: string
        }
        Insert: {
          comodidadeID?: string
          propriedadeID?: string
        }
        Update: {
          comodidadeID?: string
          propriedadeID?: string
        }
        Relationships: []
      }
      rate_limit_hits: {
        Row: {
          chave: string
          contador: number
          janela_inicio: string
        }
        Insert: {
          chave: string
          contador?: number
          janela_inicio: string
        }
        Update: {
          chave?: string
          contador?: number
          janela_inicio?: string
        }
        Relationships: []
      }
      recebimentos: {
        Row: {
          conta_pagar_id: string | null
          criado_em: string
          data: string
          divergencia: boolean
          divergencia_obs: string | null
          id: string
          itens: Json
          nota_fornecedor: string | null
          obs: string | null
          pedido_id: string
          usuario_id: string
          valor_num: number
        }
        Insert: {
          conta_pagar_id?: string | null
          criado_em?: string
          data?: string
          divergencia?: boolean
          divergencia_obs?: string | null
          id?: string
          itens?: Json
          nota_fornecedor?: string | null
          obs?: string | null
          pedido_id: string
          usuario_id: string
          valor_num?: number
        }
        Update: {
          conta_pagar_id?: string | null
          criado_em?: string
          data?: string
          divergencia?: boolean
          divergencia_obs?: string | null
          id?: string
          itens?: Json
          nota_fornecedor?: string | null
          obs?: string | null
          pedido_id?: string
          usuario_id?: string
          valor_num?: number
        }
        Relationships: [
          {
            foreignKeyName: "recebimentos_conta_pagar_id_fkey"
            columns: ["conta_pagar_id"]
            isOneToOne: false
            referencedRelation: "contas_pagar"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recebimentos_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos_compra"
            referencedColumns: ["id"]
          },
        ]
      }
      relatorios_agendados: {
        Row: {
          ativo: boolean
          atualizado_em: string
          criado_em: string
          dashboard: string | null
          destinatarios: string[]
          dia_mes: number | null
          dia_semana: number | null
          formato: string
          frequencia: string
          id: string
          nome: string
          proxima_exec: string | null
          relatorio_id: string | null
          ultima_exec: string | null
          usuario_id: string
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          dashboard?: string | null
          destinatarios?: string[]
          dia_mes?: number | null
          dia_semana?: number | null
          formato?: string
          frequencia?: string
          id?: string
          nome: string
          proxima_exec?: string | null
          relatorio_id?: string | null
          ultima_exec?: string | null
          usuario_id: string
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          dashboard?: string | null
          destinatarios?: string[]
          dia_mes?: number | null
          dia_semana?: number | null
          formato?: string
          frequencia?: string
          id?: string
          nome?: string
          proxima_exec?: string | null
          relatorio_id?: string | null
          ultima_exec?: string | null
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rel_agend_relatorio_id_fkey"
            columns: ["relatorio_id"]
            isOneToOne: false
            referencedRelation: "relatorios_salvos"
            referencedColumns: ["id"]
          },
        ]
      }
      relatorios_salvos: {
        Row: {
          atualizado_em: string
          config: Json
          criado_em: string
          descricao: string | null
          id: string
          nome: string
          usuario_id: string
        }
        Insert: {
          atualizado_em?: string
          config?: Json
          criado_em?: string
          descricao?: string | null
          id?: string
          nome: string
          usuario_id: string
        }
        Update: {
          atualizado_em?: string
          config?: Json
          criado_em?: string
          descricao?: string | null
          id?: string
          nome?: string
          usuario_id?: string
        }
        Relationships: []
      }
      requisicao_itens: {
        Row: {
          criado_em: string
          descricao: string
          id: string
          obs: string | null
          produto_id: string | null
          quantidade: number
          requisicao_id: string
          unidade: string
          usuario_id: string
          valor_estimado_num: number
        }
        Insert: {
          criado_em?: string
          descricao: string
          id?: string
          obs?: string | null
          produto_id?: string | null
          quantidade?: number
          requisicao_id: string
          unidade?: string
          usuario_id: string
          valor_estimado_num?: number
        }
        Update: {
          criado_em?: string
          descricao?: string
          id?: string
          obs?: string | null
          produto_id?: string | null
          quantidade?: number
          requisicao_id?: string
          unidade?: string
          usuario_id?: string
          valor_estimado_num?: number
        }
        Relationships: [
          {
            foreignKeyName: "requisicao_itens_requisicao_id_fkey"
            columns: ["requisicao_id"]
            isOneToOne: false
            referencedRelation: "requisicoes"
            referencedColumns: ["id"]
          },
        ]
      }
      requisicoes: {
        Row: {
          aprovado_em: string | null
          aprovado_por: string | null
          atualizado_em: string
          centro_custo_id: string | null
          criado_em: string
          evento_id: string | null
          id: string
          justificativa: string | null
          numero: string | null
          obs: string | null
          prioridade: string
          reprovado_motivo: string | null
          solicitante: string | null
          status: string
          usuario_id: string
          valor_estimado_num: number
        }
        Insert: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          atualizado_em?: string
          centro_custo_id?: string | null
          criado_em?: string
          evento_id?: string | null
          id?: string
          justificativa?: string | null
          numero?: string | null
          obs?: string | null
          prioridade?: string
          reprovado_motivo?: string | null
          solicitante?: string | null
          status?: string
          usuario_id: string
          valor_estimado_num?: number
        }
        Update: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          atualizado_em?: string
          centro_custo_id?: string | null
          criado_em?: string
          evento_id?: string | null
          id?: string
          justificativa?: string | null
          numero?: string | null
          obs?: string | null
          prioridade?: string
          reprovado_motivo?: string | null
          solicitante?: string | null
          status?: string
          usuario_id?: string
          valor_estimado_num?: number
        }
        Relationships: [
          {
            foreignKeyName: "requisicoes_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "centros_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requisicoes_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "clientes_eventos"
            referencedColumns: ["id"]
          },
        ]
      }
      reservas: {
        Row: {
          atualizado_em: string
          cor: string | null
          criado_em: string
          data_fim: string | null
          data_inicio: string | null
          email: string | null
          espaco_id: number | null
          evento_id: string | null
          fim: string | null
          hold_expira_em: string | null
          horas: number | null
          host_id: string | null
          id: string
          inicio: string | null
          mensagem: string | null
          modo: string | null
          nome: string | null
          obs: string | null
          origem: string
          pessoas: number | null
          propriedade_id: number
          status: string
          telefone: string | null
          tipo_evento: string | null
          titulo: string | null
          usuario_id: string
          valor_estimado: number | null
        }
        Insert: {
          atualizado_em?: string
          cor?: string | null
          criado_em?: string
          data_fim?: string | null
          data_inicio?: string | null
          email?: string | null
          espaco_id?: number | null
          evento_id?: string | null
          fim?: string | null
          hold_expira_em?: string | null
          horas?: number | null
          host_id?: string | null
          id?: string
          inicio?: string | null
          mensagem?: string | null
          modo?: string | null
          nome?: string | null
          obs?: string | null
          origem?: string
          pessoas?: number | null
          propriedade_id: number
          status?: string
          telefone?: string | null
          tipo_evento?: string | null
          titulo?: string | null
          usuario_id: string
          valor_estimado?: number | null
        }
        Update: {
          atualizado_em?: string
          cor?: string | null
          criado_em?: string
          data_fim?: string | null
          data_inicio?: string | null
          email?: string | null
          espaco_id?: number | null
          evento_id?: string | null
          fim?: string | null
          hold_expira_em?: string | null
          horas?: number | null
          host_id?: string | null
          id?: string
          inicio?: string | null
          mensagem?: string | null
          modo?: string | null
          nome?: string | null
          obs?: string | null
          origem?: string
          pessoas?: number | null
          propriedade_id?: number
          status?: string
          telefone?: string | null
          tipo_evento?: string | null
          titulo?: string | null
          usuario_id?: string
          valor_estimado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "reservas_espaco_id_fkey"
            columns: ["espaco_id"]
            isOneToOne: false
            referencedRelation: "espacos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservas_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "clientes_eventos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservas_propriedade_id_fkey"
            columns: ["propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
        ]
      }
      reservas_mesas: {
        Row: {
          criado_em: string | null
          data: string
          horario: string | null
          id: string
          nome_cliente: string
          notificado: boolean | null
          num_pessoas: number | null
          observacoes: string | null
          restaurante_id: string | null
          status: string | null
          telefone: string | null
          tipo: string | null
          whatsapp: string | null
        }
        Insert: {
          criado_em?: string | null
          data: string
          horario?: string | null
          id?: string
          nome_cliente: string
          notificado?: boolean | null
          num_pessoas?: number | null
          observacoes?: string | null
          restaurante_id?: string | null
          status?: string | null
          telefone?: string | null
          tipo?: string | null
          whatsapp?: string | null
        }
        Update: {
          criado_em?: string | null
          data?: string
          horario?: string | null
          id?: string
          nome_cliente?: string
          notificado?: boolean | null
          num_pessoas?: number | null
          observacoes?: string | null
          restaurante_id?: string | null
          status?: string | null
          telefone?: string | null
          tipo?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reservas_mesas_restaurante_id_fkey"
            columns: ["restaurante_id"]
            isOneToOne: false
            referencedRelation: "restaurantes"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurantes: {
        Row: {
          atualizado_em: string | null
          bairro: string | null
          cep: string | null
          cidade: string | null
          criado_em: string | null
          descricao: string | null
          destaque: boolean | null
          dias_fechados: string[] | null
          endereco: string | null
          estado: string | null
          facebook: string | null
          foto_capa: string | null
          horario: Json | null
          id: string
          instagram: string | null
          latitude: number | null
          link_reserva: string | null
          longitude: number | null
          nome: string
          preco_medio: string | null
          publicado: boolean | null
          rejeitado: boolean | null
          site: string | null
          telefone: string | null
          tipo_culinaria: string | null
          usuario_id: string | null
          whatsapp: string | null
        }
        Insert: {
          atualizado_em?: string | null
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          criado_em?: string | null
          descricao?: string | null
          destaque?: boolean | null
          dias_fechados?: string[] | null
          endereco?: string | null
          estado?: string | null
          facebook?: string | null
          foto_capa?: string | null
          horario?: Json | null
          id?: string
          instagram?: string | null
          latitude?: number | null
          link_reserva?: string | null
          longitude?: number | null
          nome: string
          preco_medio?: string | null
          publicado?: boolean | null
          rejeitado?: boolean | null
          site?: string | null
          telefone?: string | null
          tipo_culinaria?: string | null
          usuario_id?: string | null
          whatsapp?: string | null
        }
        Update: {
          atualizado_em?: string | null
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          criado_em?: string | null
          descricao?: string | null
          destaque?: boolean | null
          dias_fechados?: string[] | null
          endereco?: string | null
          estado?: string | null
          facebook?: string | null
          foto_capa?: string | null
          horario?: Json | null
          id?: string
          instagram?: string | null
          latitude?: number | null
          link_reserva?: string | null
          longitude?: number | null
          nome?: string
          preco_medio?: string | null
          publicado?: boolean | null
          rejeitado?: boolean | null
          site?: string | null
          telefone?: string | null
          tipo_culinaria?: string | null
          usuario_id?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      rh_ausencias: {
        Row: {
          atualizado_em: string
          criado_em: string
          decidido_em: string | null
          dias: number
          equipe_id: number
          fim: string | null
          id: string
          inicio: string | null
          obs: string | null
          saldo: number
          status: string
          tipo: string
          usuario_id: string
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          decidido_em?: string | null
          dias?: number
          equipe_id: number
          fim?: string | null
          id?: string
          inicio?: string | null
          obs?: string | null
          saldo?: number
          status?: string
          tipo?: string
          usuario_id: string
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          decidido_em?: string | null
          dias?: number
          equipe_id?: number
          fim?: string | null
          id?: string
          inicio?: string | null
          obs?: string | null
          saldo?: number
          status?: string
          tipo?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rh_ausencias_equipe_id_fkey"
            columns: ["equipe_id"]
            isOneToOne: false
            referencedRelation: "equipe"
            referencedColumns: ["id"]
          },
        ]
      }
      rh_candidatos: {
        Row: {
          atualizado_em: string
          criado_em: string
          curriculo_url: string | null
          email: string | null
          etapa: string
          fonte: string | null
          ia_resumo: string | null
          id: string
          nome: string
          nota: number | null
          obs: string | null
          telefone: string | null
          usuario_id: string
          vaga_id: string | null
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          curriculo_url?: string | null
          email?: string | null
          etapa?: string
          fonte?: string | null
          ia_resumo?: string | null
          id?: string
          nome: string
          nota?: number | null
          obs?: string | null
          telefone?: string | null
          usuario_id: string
          vaga_id?: string | null
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          curriculo_url?: string | null
          email?: string | null
          etapa?: string
          fonte?: string | null
          ia_resumo?: string | null
          id?: string
          nome?: string
          nota?: number | null
          obs?: string | null
          telefone?: string | null
          usuario_id?: string
          vaga_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rh_candidatos_vaga_id_fkey"
            columns: ["vaga_id"]
            isOneToOne: false
            referencedRelation: "rh_vagas"
            referencedColumns: ["id"]
          },
        ]
      }
      rh_documentos: {
        Row: {
          arquivo_url: string | null
          atualizado_em: string
          criado_em: string
          dias_aviso: number
          equipe_id: number
          id: string
          nome: string | null
          obs: string | null
          status: string
          tipo: string
          usuario_id: string
          validade: string | null
        }
        Insert: {
          arquivo_url?: string | null
          atualizado_em?: string
          criado_em?: string
          dias_aviso?: number
          equipe_id: number
          id?: string
          nome?: string | null
          obs?: string | null
          status?: string
          tipo?: string
          usuario_id: string
          validade?: string | null
        }
        Update: {
          arquivo_url?: string | null
          atualizado_em?: string
          criado_em?: string
          dias_aviso?: number
          equipe_id?: number
          id?: string
          nome?: string | null
          obs?: string | null
          status?: string
          tipo?: string
          usuario_id?: string
          validade?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rh_documentos_equipe_id_fkey"
            columns: ["equipe_id"]
            isOneToOne: false
            referencedRelation: "equipe"
            referencedColumns: ["id"]
          },
        ]
      }
      rh_eventos_funcionario: {
        Row: {
          criado_em: string
          dados: Json
          data: string
          descricao: string | null
          equipe_id: number
          id: string
          tipo: string
          titulo: string
          usuario_id: string
        }
        Insert: {
          criado_em?: string
          dados?: Json
          data?: string
          descricao?: string | null
          equipe_id: number
          id?: string
          tipo?: string
          titulo: string
          usuario_id: string
        }
        Update: {
          criado_em?: string
          dados?: Json
          data?: string
          descricao?: string | null
          equipe_id?: number
          id?: string
          tipo?: string
          titulo?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rh_eventos_funcionario_equipe_id_fkey"
            columns: ["equipe_id"]
            isOneToOne: false
            referencedRelation: "equipe"
            referencedColumns: ["id"]
          },
        ]
      }
      rh_vagas: {
        Row: {
          atualizado_em: string
          beneficios: string | null
          criado_em: string
          departamento: string | null
          descricao: string | null
          id: string
          local: string | null
          requisitos: string | null
          salario_max: number | null
          salario_min: number | null
          slug: string | null
          status: string
          tipo_contrato: string
          titulo: string
          usuario_id: string
          vagas: number
        }
        Insert: {
          atualizado_em?: string
          beneficios?: string | null
          criado_em?: string
          departamento?: string | null
          descricao?: string | null
          id?: string
          local?: string | null
          requisitos?: string | null
          salario_max?: number | null
          salario_min?: number | null
          slug?: string | null
          status?: string
          tipo_contrato?: string
          titulo: string
          usuario_id: string
          vagas?: number
        }
        Update: {
          atualizado_em?: string
          beneficios?: string | null
          criado_em?: string
          departamento?: string | null
          descricao?: string | null
          id?: string
          local?: string | null
          requisitos?: string | null
          salario_max?: number | null
          salario_min?: number | null
          slug?: string | null
          status?: string
          tipo_contrato?: string
          titulo?: string
          usuario_id?: string
          vagas?: number
        }
        Relationships: []
      }
      runshow: {
        Row: {
          area: string | null
          atividade: string
          atualizado_em: string
          concluido: boolean
          criado_em: string
          data: string | null
          duracao_min: number
          horario: string
          id: string
          obs: string | null
          ordem: number
          producao_id: string
          recurso: string | null
          responsavel: string | null
          usuario_id: string
        }
        Insert: {
          area?: string | null
          atividade: string
          atualizado_em?: string
          concluido?: boolean
          criado_em?: string
          data?: string | null
          duracao_min?: number
          horario?: string
          id?: string
          obs?: string | null
          ordem?: number
          producao_id: string
          recurso?: string | null
          responsavel?: string | null
          usuario_id: string
        }
        Update: {
          area?: string | null
          atividade?: string
          atualizado_em?: string
          concluido?: boolean
          criado_em?: string
          data?: string | null
          duracao_min?: number
          horario?: string
          id?: string
          obs?: string | null
          ordem?: number
          producao_id?: string
          recurso?: string | null
          responsavel?: string | null
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "runshow_producao_id_fkey"
            columns: ["producao_id"]
            isOneToOne: false
            referencedRelation: "producao"
            referencedColumns: ["id"]
          },
        ]
      }
      seguros: {
        Row: {
          apolice: string | null
          atualizado_em: string
          coberturas: Json
          corretor: string | null
          criado_em: string
          documento_url: string | null
          escopo: string
          evento_id: string | null
          franquia_num: number
          id: string
          lancamento_id: number | null
          obs: string | null
          premio_num: number
          propriedade_id: number | null
          seguradora: string | null
          status: string
          usuario_id: string
          vigencia_fim: string | null
          vigencia_inicio: string | null
        }
        Insert: {
          apolice?: string | null
          atualizado_em?: string
          coberturas?: Json
          corretor?: string | null
          criado_em?: string
          documento_url?: string | null
          escopo?: string
          evento_id?: string | null
          franquia_num?: number
          id?: string
          lancamento_id?: number | null
          obs?: string | null
          premio_num?: number
          propriedade_id?: number | null
          seguradora?: string | null
          status?: string
          usuario_id: string
          vigencia_fim?: string | null
          vigencia_inicio?: string | null
        }
        Update: {
          apolice?: string | null
          atualizado_em?: string
          coberturas?: Json
          corretor?: string | null
          criado_em?: string
          documento_url?: string | null
          escopo?: string
          evento_id?: string | null
          franquia_num?: number
          id?: string
          lancamento_id?: number | null
          obs?: string | null
          premio_num?: number
          propriedade_id?: number | null
          seguradora?: string | null
          status?: string
          usuario_id?: string
          vigencia_fim?: string | null
          vigencia_inicio?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "seguros_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "clientes_eventos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seguros_lancamento_id_fkey"
            columns: ["lancamento_id"]
            isOneToOne: false
            referencedRelation: "lancamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seguros_propriedade_id_fkey"
            columns: ["propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
        ]
      }
      sinistros: {
        Row: {
          anexos: Json
          atualizado_em: string
          criado_em: string
          data: string
          descricao: string | null
          evento_id: string | null
          id: string
          licao: string | null
          protocolo: string | null
          seguro_id: string
          status: string
          usuario_id: string
          valor_estimado_num: number
          valor_indenizado_num: number
        }
        Insert: {
          anexos?: Json
          atualizado_em?: string
          criado_em?: string
          data?: string
          descricao?: string | null
          evento_id?: string | null
          id?: string
          licao?: string | null
          protocolo?: string | null
          seguro_id: string
          status?: string
          usuario_id: string
          valor_estimado_num?: number
          valor_indenizado_num?: number
        }
        Update: {
          anexos?: Json
          atualizado_em?: string
          criado_em?: string
          data?: string
          descricao?: string | null
          evento_id?: string | null
          id?: string
          licao?: string | null
          protocolo?: string | null
          seguro_id?: string
          status?: string
          usuario_id?: string
          valor_estimado_num?: number
          valor_indenizado_num?: number
        }
        Relationships: [
          {
            foreignKeyName: "sinistros_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "clientes_eventos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sinistros_seguro_id_fkey"
            columns: ["seguro_id"]
            isOneToOne: false
            referencedRelation: "seguros"
            referencedColumns: ["id"]
          },
        ]
      }
      sst_epis: {
        Row: {
          atualizado_em: string
          ca: string | null
          criado_em: string
          funcao: string | null
          id: string
          nome: string
          obs: string | null
          quantidade: number
          usuario_id: string
          validade_ca: string | null
        }
        Insert: {
          atualizado_em?: string
          ca?: string | null
          criado_em?: string
          funcao?: string | null
          id?: string
          nome: string
          obs?: string | null
          quantidade?: number
          usuario_id: string
          validade_ca?: string | null
        }
        Update: {
          atualizado_em?: string
          ca?: string | null
          criado_em?: string
          funcao?: string | null
          id?: string
          nome?: string
          obs?: string | null
          quantidade?: number
          usuario_id?: string
          validade_ca?: string | null
        }
        Relationships: []
      }
      sst_ocorrencias: {
        Row: {
          anexos: Json
          atendimento: string | null
          cat_emitida: boolean
          criado_em: string
          data: string
          descricao: string
          evento_id: string | null
          gravidade: string
          id: string
          local: string | null
          pessoa: string | null
          propriedade_id: number | null
          tipo: string
          usuario_id: string
        }
        Insert: {
          anexos?: Json
          atendimento?: string | null
          cat_emitida?: boolean
          criado_em?: string
          data?: string
          descricao?: string
          evento_id?: string | null
          gravidade?: string
          id?: string
          local?: string | null
          pessoa?: string | null
          propriedade_id?: number | null
          tipo?: string
          usuario_id: string
        }
        Update: {
          anexos?: Json
          atendimento?: string | null
          cat_emitida?: boolean
          criado_em?: string
          data?: string
          descricao?: string
          evento_id?: string | null
          gravidade?: string
          id?: string
          local?: string | null
          pessoa?: string | null
          propriedade_id?: number | null
          tipo?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sst_ocorrencias_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "clientes_eventos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sst_ocorrencias_propriedade_id_fkey"
            columns: ["propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
        ]
      }
      sst_planos: {
        Row: {
          atualizado_em: string
          conteudo: Json
          criado_em: string
          evento_id: string | null
          id: string
          nome: string
          obs: string | null
          propriedade_id: number | null
          responsavel: string | null
          status: string
          tipo: string
          usuario_id: string
          validade: string | null
        }
        Insert: {
          atualizado_em?: string
          conteudo?: Json
          criado_em?: string
          evento_id?: string | null
          id?: string
          nome?: string
          obs?: string | null
          propriedade_id?: number | null
          responsavel?: string | null
          status?: string
          tipo?: string
          usuario_id: string
          validade?: string | null
        }
        Update: {
          atualizado_em?: string
          conteudo?: Json
          criado_em?: string
          evento_id?: string | null
          id?: string
          nome?: string
          obs?: string | null
          propriedade_id?: number | null
          responsavel?: string | null
          status?: string
          tipo?: string
          usuario_id?: string
          validade?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sst_planos_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "clientes_eventos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sst_planos_propriedade_id_fkey"
            columns: ["propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
        ]
      }
      sst_recursos_evento: {
        Row: {
          atualizado_em: string
          base: string | null
          criado_em: string
          evento_id: string
          exigido: number
          fornecedor_id: string | null
          id: string
          obrigatorio: boolean
          obs: string | null
          origem: string
          quantidade: number
          status: string
          tipo: string
          usuario_id: string
        }
        Insert: {
          atualizado_em?: string
          base?: string | null
          criado_em?: string
          evento_id: string
          exigido?: number
          fornecedor_id?: string | null
          id?: string
          obrigatorio?: boolean
          obs?: string | null
          origem?: string
          quantidade?: number
          status?: string
          tipo: string
          usuario_id: string
        }
        Update: {
          atualizado_em?: string
          base?: string | null
          criado_em?: string
          evento_id?: string
          exigido?: number
          fornecedor_id?: string | null
          id?: string
          obrigatorio?: boolean
          obs?: string | null
          origem?: string
          quantidade?: number
          status?: string
          tipo?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sst_recursos_evento_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "clientes_eventos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sst_recursos_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
        ]
      }
      sst_simulados: {
        Row: {
          atualizado_em: string
          criado_em: string
          data: string
          evento_id: string | null
          id: string
          observacoes: string | null
          participantes: number
          propriedade_id: number | null
          proxima_data: string | null
          responsavel: string | null
          resultado: string
          tempo_seg: number | null
          tipo: string
          usuario_id: string
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          data?: string
          evento_id?: string | null
          id?: string
          observacoes?: string | null
          participantes?: number
          propriedade_id?: number | null
          proxima_data?: string | null
          responsavel?: string | null
          resultado?: string
          tempo_seg?: number | null
          tipo?: string
          usuario_id: string
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          data?: string
          evento_id?: string | null
          id?: string
          observacoes?: string | null
          participantes?: number
          propriedade_id?: number | null
          proxima_data?: string | null
          responsavel?: string | null
          resultado?: string
          tempo_seg?: number | null
          tipo?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sst_simulados_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "clientes_eventos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sst_simulados_propriedade_id_fkey"
            columns: ["propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
        ]
      }
      sst_treinamentos: {
        Row: {
          atualizado_em: string
          certificado_url: string | null
          criado_em: string
          emissao: string | null
          equipe_id: number | null
          id: string
          instituicao: string | null
          nr: string
          obs: string | null
          pessoa: string | null
          usuario_id: string
          validade: string | null
        }
        Insert: {
          atualizado_em?: string
          certificado_url?: string | null
          criado_em?: string
          emissao?: string | null
          equipe_id?: number | null
          id?: string
          instituicao?: string | null
          nr?: string
          obs?: string | null
          pessoa?: string | null
          usuario_id: string
          validade?: string | null
        }
        Update: {
          atualizado_em?: string
          certificado_url?: string | null
          criado_em?: string
          emissao?: string | null
          equipe_id?: number | null
          id?: string
          instituicao?: string | null
          nr?: string
          obs?: string | null
          pessoa?: string | null
          usuario_id?: string
          validade?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sst_treinamentos_equipe_id_fkey"
            columns: ["equipe_id"]
            isOneToOne: false
            referencedRelation: "equipe"
            referencedColumns: ["id"]
          },
        ]
      }
      taxas: {
        Row: {
          ativo: boolean
          criado_em: string
          id: string
          nome: string
          obrigatoria: boolean
          propriedade_id: number | null
          reembolsavel: boolean
          tipo: string
          usuario_id: string
          valor: number
        }
        Insert: {
          ativo?: boolean
          criado_em?: string
          id?: string
          nome: string
          obrigatoria?: boolean
          propriedade_id?: number | null
          reembolsavel?: boolean
          tipo?: string
          usuario_id: string
          valor?: number
        }
        Update: {
          ativo?: boolean
          criado_em?: string
          id?: string
          nome?: string
          obrigatoria?: boolean
          propriedade_id?: number | null
          reembolsavel?: boolean
          tipo?: string
          usuario_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "taxas_propriedade_id_fkey"
            columns: ["propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
        ]
      }
      terceiros: {
        Row: {
          atualizado_em: string
          aviso_previo_dias: number
          categoria: string
          contrato_id: string | null
          criado_em: string
          custo_interno_mensal_num: number | null
          custo_num: number
          documento_nome: string | null
          documento_url: string | null
          fornecedor_id: string | null
          id: string
          modelo_custo: string
          multa_rescisao: string | null
          obs: string | null
          renovacao_automatica: boolean
          responsavel: string | null
          servico: string
          sla: Json
          status: string
          usuario_id: string
          vigencia_fim: string | null
          vigencia_inicio: string | null
        }
        Insert: {
          atualizado_em?: string
          aviso_previo_dias?: number
          categoria?: string
          contrato_id?: string | null
          criado_em?: string
          custo_interno_mensal_num?: number | null
          custo_num?: number
          documento_nome?: string | null
          documento_url?: string | null
          fornecedor_id?: string | null
          id?: string
          modelo_custo?: string
          multa_rescisao?: string | null
          obs?: string | null
          renovacao_automatica?: boolean
          responsavel?: string | null
          servico: string
          sla?: Json
          status?: string
          usuario_id: string
          vigencia_fim?: string | null
          vigencia_inicio?: string | null
        }
        Update: {
          atualizado_em?: string
          aviso_previo_dias?: number
          categoria?: string
          contrato_id?: string | null
          criado_em?: string
          custo_interno_mensal_num?: number | null
          custo_num?: number
          documento_nome?: string | null
          documento_url?: string | null
          fornecedor_id?: string | null
          id?: string
          modelo_custo?: string
          multa_rescisao?: string | null
          obs?: string | null
          renovacao_automatica?: boolean
          responsavel?: string | null
          servico?: string
          sla?: Json
          status?: string
          usuario_id?: string
          vigencia_fim?: string | null
          vigencia_inicio?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "terceiros_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
        ]
      }
      terceiros_resultados: {
        Row: {
          atualizado_em: string
          competencia: string
          criado_em: string
          custo_num: number
          economia_num: number
          eventos_atendidos: number
          id: string
          obs: string | null
          receita_atribuida_num: number
          satisfacao: number | null
          sla_cumprido_pct: number | null
          terceiro_id: string
          usuario_id: string
        }
        Insert: {
          atualizado_em?: string
          competencia: string
          criado_em?: string
          custo_num?: number
          economia_num?: number
          eventos_atendidos?: number
          id?: string
          obs?: string | null
          receita_atribuida_num?: number
          satisfacao?: number | null
          sla_cumprido_pct?: number | null
          terceiro_id: string
          usuario_id: string
        }
        Update: {
          atualizado_em?: string
          competencia?: string
          criado_em?: string
          custo_num?: number
          economia_num?: number
          eventos_atendidos?: number
          id?: string
          obs?: string | null
          receita_atribuida_num?: number
          satisfacao?: number | null
          sla_cumprido_pct?: number | null
          terceiro_id?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "terceiros_resultados_terceiro_id_fkey"
            columns: ["terceiro_id"]
            isOneToOne: false
            referencedRelation: "terceiros"
            referencedColumns: ["id"]
          },
        ]
      }
      transfer: {
        Row: {
          ativo: boolean
          atualizado_em: string
          capacidade: number
          contato: string | null
          criado_em: string
          evento_id: string | null
          fornecedor_id: string | null
          horarios: Json
          id: string
          motorista: string | null
          obs: string | null
          ponto_embarque: string | null
          rota: string
          tipo: string
          usuario_id: string
          veiculo: string | null
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          capacidade?: number
          contato?: string | null
          criado_em?: string
          evento_id?: string | null
          fornecedor_id?: string | null
          horarios?: Json
          id?: string
          motorista?: string | null
          obs?: string | null
          ponto_embarque?: string | null
          rota?: string
          tipo?: string
          usuario_id: string
          veiculo?: string | null
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          capacidade?: number
          contato?: string | null
          criado_em?: string
          evento_id?: string | null
          fornecedor_id?: string | null
          horarios?: Json
          id?: string
          motorista?: string | null
          obs?: string | null
          ponto_embarque?: string | null
          rota?: string
          tipo?: string
          usuario_id?: string
          veiculo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transfer_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "clientes_eventos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfer_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
        ]
      }
      unidades_acesso: {
        Row: {
          criado_em: string
          id: number
          membro_id: number
          propriedade_id: number
          usuario_id: string
        }
        Insert: {
          criado_em?: string
          id?: never
          membro_id: number
          propriedade_id: number
          usuario_id: string
        }
        Update: {
          criado_em?: string
          id?: never
          membro_id?: number
          propriedade_id?: number
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "unidades_acesso_membro_id_fkey"
            columns: ["membro_id"]
            isOneToOne: false
            referencedRelation: "equipe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unidades_acesso_propriedade_id_fkey"
            columns: ["propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
        ]
      }
      unidades_config: {
        Row: {
          apelido: string | null
          ativo: boolean
          atualizado_em: string
          criado_em: string
          grupo_id: number | null
          id: number
          meta_receita_num: number | null
          obs: string | null
          ordem: number | null
          propriedade_id: number
          royalties_pct: number | null
          taxa_fixa_num: number | null
          usuario_id: string
        }
        Insert: {
          apelido?: string | null
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          grupo_id?: number | null
          id?: never
          meta_receita_num?: number | null
          obs?: string | null
          ordem?: number | null
          propriedade_id: number
          royalties_pct?: number | null
          taxa_fixa_num?: number | null
          usuario_id: string
        }
        Update: {
          apelido?: string | null
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          grupo_id?: number | null
          id?: never
          meta_receita_num?: number | null
          obs?: string | null
          ordem?: number | null
          propriedade_id?: number
          royalties_pct?: number | null
          taxa_fixa_num?: number | null
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "unidades_config_grupo_id_fkey"
            columns: ["grupo_id"]
            isOneToOne: false
            referencedRelation: "unidades_grupos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unidades_config_propriedade_id_fkey"
            columns: ["propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
        ]
      }
      unidades_grupos: {
        Row: {
          atualizado_em: string
          cor: string | null
          criado_em: string
          id: number
          nome: string
          obs: string | null
          tipo: string
          usuario_id: string
        }
        Insert: {
          atualizado_em?: string
          cor?: string | null
          criado_em?: string
          id?: never
          nome: string
          obs?: string | null
          tipo?: string
          usuario_id: string
        }
        Update: {
          atualizado_em?: string
          cor?: string | null
          criado_em?: string
          id?: never
          nome?: string
          obs?: string | null
          tipo?: string
          usuario_id?: string
        }
        Relationships: []
      }
      usuarios: {
        Row: {
          cadastro_completo: boolean | null
          criado_em: string | null
          documento: string | null
          email: string | null
          id: string
          id_prop: number | null
          is_admin: boolean
          nascimento: string | null
          nome: string
          seucodigo: string | null
          telefone: string | null
          tipo_doc: string | null
          usuario: string | null
        }
        Insert: {
          cadastro_completo?: boolean | null
          criado_em?: string | null
          documento?: string | null
          email?: string | null
          id: string
          id_prop?: number | null
          is_admin?: boolean
          nascimento?: string | null
          nome: string
          seucodigo?: string | null
          telefone?: string | null
          tipo_doc?: string | null
          usuario?: string | null
        }
        Update: {
          cadastro_completo?: boolean | null
          criado_em?: string | null
          documento?: string | null
          email?: string | null
          id?: string
          id_prop?: number | null
          is_admin?: boolean
          nascimento?: string | null
          nome?: string
          seucodigo?: string | null
          telefone?: string | null
          tipo_doc?: string | null
          usuario?: string | null
        }
        Relationships: []
      }
      usuarios_papeis: {
        Row: {
          atualizado_em: string
          convite_token: string | null
          criado_em: string
          email: string | null
          equipe_id: number | null
          id: string
          membro_id: string | null
          nome: string
          papel: string
          permissoes: Json
          requer_2fa: boolean
          status: string
          usuario_id: string
        }
        Insert: {
          atualizado_em?: string
          convite_token?: string | null
          criado_em?: string
          email?: string | null
          equipe_id?: number | null
          id?: string
          membro_id?: string | null
          nome: string
          papel?: string
          permissoes?: Json
          requer_2fa?: boolean
          status?: string
          usuario_id: string
        }
        Update: {
          atualizado_em?: string
          convite_token?: string | null
          criado_em?: string
          email?: string | null
          equipe_id?: number | null
          id?: string
          membro_id?: string | null
          nome?: string
          papel?: string
          permissoes?: Json
          requer_2fa?: boolean
          status?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usuarios_papeis_equipe_id_fkey"
            columns: ["equipe_id"]
            isOneToOne: false
            referencedRelation: "equipe"
            referencedColumns: ["id"]
          },
        ]
      }
      videos_propriedade: {
        Row: {
          created_at: string
          id: number
          propriedade_id: number | null
          titulo: string | null
          url: string | null
        }
        Insert: {
          created_at?: string
          id?: number
          propriedade_id?: number | null
          titulo?: string | null
          url?: string | null
        }
        Update: {
          created_at?: string
          id?: number
          propriedade_id?: number | null
          titulo?: string | null
          url?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      perfis_publicos: {
        Row: {
          criado_em: string | null
          id: string | null
          id_prop: number | null
          nome: string | null
          usuario: string | null
        }
        Insert: {
          criado_em?: string | null
          id?: string | null
          id_prop?: number | null
          nome?: string | null
          usuario?: string | null
        }
        Update: {
          criado_em?: string | null
          id?: string | null
          id_prop?: number | null
          nome?: string | null
          usuario?: string | null
        }
        Relationships: []
      }
      v_indicacoes_dashboard: {
        Row: {
          data: string | null
          id: string | null
          indicador_id: string | null
          propriedade: string | null
          recompensa: string | null
          recompensa_label: string | null
          status: string | null
          status_label: string | null
        }
        Insert: {
          data?: never
          id?: string | null
          indicador_id?: string | null
          propriedade?: never
          recompensa?: never
          recompensa_label?: never
          status?: string | null
          status_label?: never
        }
        Update: {
          data?: never
          id?: string | null
          indicador_id?: string | null
          propriedade?: never
          recompensa?: never
          recompensa_label?: never
          status?: string | null
          status_label?: never
        }
        Relationships: [
          {
            foreignKeyName: "indicacoes_indicador_id_fkey"
            columns: ["indicador_id"]
            isOneToOne: false
            referencedRelation: "perfis_publicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "indicacoes_indicador_id_fkey"
            columns: ["indicador_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_leads_remarketing: {
        Row: {
          documento_mascarado: string | null
          email: string | null
          erro_msg: string | null
          horas_desde_inicio: number | null
          id: string | null
          iniciou_em: string | null
          nome: string | null
          ref_codigo: string | null
          status: string | null
          ultima_atividade: string | null
        }
        Insert: {
          documento_mascarado?: never
          email?: string | null
          erro_msg?: string | null
          horas_desde_inicio?: never
          id?: string | null
          iniciou_em?: never
          nome?: string | null
          ref_codigo?: string | null
          status?: string | null
          ultima_atividade?: never
        }
        Update: {
          documento_mascarado?: never
          email?: string | null
          erro_msg?: string | null
          horas_desde_inicio?: never
          id?: string | null
          iniciou_em?: never
          nome?: string | null
          ref_codigo?: string | null
          status?: string | null
          ultima_atividade?: never
        }
        Relationships: []
      }
    }
    Functions: {
      aceitar_proposta: { Args: { p_token: string }; Returns: Json }
      criar_assinatura_basico: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      gerar_codigo_indicacao: { Args: never; Returns: string }
      is_admin: { Args: never; Returns: boolean }
      is_rest_owner: { Args: { rid: string }; Returns: boolean }
      limpar_zumbi_auth: { Args: { p_user_id: string }; Returns: undefined }
      limpar_zumbis_auth: { Args: never; Returns: number }
      marcar_cadastro_convertido: {
        Args: { p_email: string }
        Returns: undefined
      }
      rate_limit_check: {
        Args: { p_chave: string; p_janela_seg: number; p_max: number }
        Returns: boolean
      }
      registrar_erro_cadastro: {
        Args: { p_email: string; p_erro_msg?: string; p_status: string }
        Returns: undefined
      }
      registrar_indicacao: {
        Args: { p_indicado_id: string; p_ref_handle: string }
        Returns: undefined
      }
      salvar_cadastro_incompleto: {
        Args: {
          p_documento?: string
          p_email: string
          p_nome?: string
          p_ref?: string
          p_tipo_doc?: string
        }
        Returns: undefined
      }
      verificar_codigo_indicacao: {
        Args: { p_codigo: string }
        Returns: boolean
      }
      verificar_documento: { Args: { p_documento: string }; Returns: boolean }
      verificar_email: { Args: { p_email: string }; Returns: boolean }
      verificar_usuario: { Args: { p_usuario: string }; Returns: boolean }
    }
    Enums: {
      status_pub_enum: "aguardando" | "aprovada" | "reprovada"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      status_pub_enum: ["aguardando", "aprovada", "reprovada"],
    },
  },
} as const

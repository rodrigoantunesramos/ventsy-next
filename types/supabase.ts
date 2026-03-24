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
      clientes_eventos: {
        Row: {
          atracoes: string | null
          atualizado_em: string
          checkin_materiais: string | null
          checklist: Json | null
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
          layout_mesas: string | null
          motivo_descarte: string | null
          necessidades_tecnicas: string | null
          nome_evento: string
          observacoes: string | null
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
          vip_autoridades: string | null
        }
        Insert: {
          atracoes?: string | null
          atualizado_em?: string
          checkin_materiais?: string | null
          checklist?: Json | null
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
          layout_mesas?: string | null
          motivo_descarte?: string | null
          necessidades_tecnicas?: string | null
          nome_evento: string
          observacoes?: string | null
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
          vip_autoridades?: string | null
        }
        Update: {
          atracoes?: string | null
          atualizado_em?: string
          checkin_materiais?: string | null
          checklist?: Json | null
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
          layout_mesas?: string | null
          motivo_descarte?: string | null
          necessidades_tecnicas?: string | null
          nome_evento?: string
          observacoes?: string | null
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
          vip_autoridades?: string | null
        }
        Relationships: [
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
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
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
      diary_entries: {
        Row: {
          content: string
          created_at: string
          id: string
          is_important: boolean
          reminder_date: string | null
          tags: string[]
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_important?: boolean
          reminder_date?: string | null
          tags?: string[]
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_important?: boolean
          reminder_date?: string | null
          tags?: string[]
          user_id?: string
        }
        Relationships: []
      }
      disponibilidade: {
        Row: {
          data: string
          motivo: string | null
          prop_id: number
        }
        Insert: {
          data: string
          motivo?: string | null
          prop_id?: number
        }
        Update: {
          data?: string
          motivo?: string | null
          prop_id?: number
        }
        Relationships: []
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
          created_at: string | null
          id: string
          ordem: number | null
          propriedade_id: number | null
          secao: string | null
          tipo: string | null
          url: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          ordem?: number | null
          propriedade_id?: number | null
          secao?: string | null
          tipo?: string | null
          url?: string | null
        }
        Update: {
          created_at?: string | null
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
            referencedRelation: "usuarios"
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
      pagamentos: {
        Row: {
          atualizado_em: string | null
          criado_em: string | null
          cupom_codigo: string | null
          cupom_id: string | null
          external_ref: string | null
          id: string
          meses: number
          metodo: string
          mp_payment_id: string | null
          mp_status: string | null
          mp_status_detail: string | null
          nfe: Json | null
          plano_id: string
          status: string
          usuario_id: string
          valor: number
        }
        Insert: {
          atualizado_em?: string | null
          criado_em?: string | null
          cupom_codigo?: string | null
          cupom_id?: string | null
          external_ref?: string | null
          id?: string
          meses?: number
          metodo: string
          mp_payment_id?: string | null
          mp_status?: string | null
          mp_status_detail?: string | null
          nfe?: Json | null
          plano_id: string
          status?: string
          usuario_id: string
          valor: number
        }
        Update: {
          atualizado_em?: string | null
          criado_em?: string | null
          cupom_codigo?: string | null
          cupom_id?: string | null
          external_ref?: string | null
          id?: string
          meses?: number
          metodo?: string
          mp_payment_id?: string | null
          mp_status?: string | null
          mp_status_detail?: string | null
          nfe?: Json | null
          plano_id?: string
          status?: string
          usuario_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "pagamentos_cupom_id_fkey"
            columns: ["cupom_id"]
            isOneToOne: false
            referencedRelation: "cupons"
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
      usuarios: {
        Row: {
          cadastro_completo: boolean | null
          criado_em: string | null
          documento: string | null
          email: string | null
          id: string
          id_prop: number | null
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
          nascimento?: string | null
          nome?: string
          seucodigo?: string | null
          telefone?: string | null
          tipo_doc?: string | null
          usuario?: string | null
        }
        Relationships: []
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
      criar_assinatura_basico: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      gerar_codigo_indicacao: { Args: never; Returns: string }
      is_rest_owner: { Args: { rid: string }; Returns: boolean }
      limpar_zumbi_auth: { Args: { p_user_id: string }; Returns: undefined }
      limpar_zumbis_auth: { Args: never; Returns: number }
      marcar_cadastro_convertido: {
        Args: { p_email: string }
        Returns: undefined
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


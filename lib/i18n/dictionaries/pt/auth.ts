// Namespace `auth` — páginas de autenticação (login, recuperar senha, redefinir
// senha). FONTE DA VERDADE: en/auth.ts e es/auth.ts são tipados por `T` para
// garantir paridade de chaves.

const auth = {
  meta: {
    loginTitulo: 'Entrar',
    loginDescricao: 'Acesse sua conta VENTSY para gerenciar seus espaços, reservas e anúncios.',
  },
  login: {
    tag: 'Acesso',
    bemVindo: 'Bem-vindo de volta à',
    subtitulo: 'Entre com seu e-mail e senha para acessar sua conta.',
    emailLabel: 'E-mail',
    emailPlaceholder: 'seu@email.com',
    senhaLabel: 'Senha',
    senhaPlaceholder: 'Sua senha',
    mostrarSenha: 'Mostrar senha',
    ocultarSenha: 'Ocultar senha',
    esqueceuSenha: 'Esqueceu a senha?',
    entrar: 'Entrar',
    entrando: 'Entrando...',
    ou: 'ou',
    continuarGoogle: 'Continuar com Google',
    semConta: 'Não tem conta?',
    criarConta: 'Criar conta grátis',
    erroCamposObrigatorios: 'Preencha e-mail e senha para continuar.',
    erroGenerico: 'Erro ao fazer login. Tente novamente.',
    erroCredenciais: 'E-mail ou senha incorretos.',
    erroEmailNaoConfirmado: 'Confirme seu e-mail antes de fazer login. Verifique sua caixa de entrada.',
  },
  recuperar: {
    titulo: 'Recuperar senha',
    descricao: 'Informe seu e-mail cadastrado e enviaremos um link para redefinir sua senha.',
    emailPlaceholder: 'seu@email.com',
    emailAriaLabel: 'E-mail para recuperação de senha',
    dialogAriaLabel: 'Recuperar senha',
    cancelar: 'Cancelar',
    enviarLink: 'Enviar link',
    enviando: 'Enviando...',
    sucessoTitulo: 'E-mail enviado!',
    sucessoDescricao: 'Verifique sua caixa de entrada e siga as instruções para redefinir sua senha.',
    fechar: 'Fechar',
  },
  redefinir: {
    titulo: 'Redefinir senha',
    verificando: 'Verificando o link…',
    linkInvalidoInicio: 'Link inválido ou expirado. Volte ao',
    linkInvalidoLink: 'login',
    linkInvalidoFim: 'e solicite um novo e-mail de redefinição.',
    sucesso: 'Senha redefinida com sucesso! Redirecionando para o login…',
    definaNova: 'Defina sua nova senha de acesso.',
    novaSenhaLabel: 'Nova senha',
    novaSenhaPlaceholder: 'Ao menos 8 caracteres',
    confirmarSenhaLabel: 'Confirmar senha',
    mostrarSenha: 'Mostrar senha',
    botao: 'Redefinir senha',
    salvando: 'Salvando…',
    erroSenhaCurta: 'A senha deve ter ao menos 8 caracteres.',
    erroSenhasDiferentes: 'As senhas não conferem.',
    erroGenerico: 'Não foi possível redefinir a senha.',
  },
}

export type T = typeof auth
export default auth

/* =====================================================================
   EcoUso — js/cadastro.js
   Cadastro do usuário. Carregado DEPOIS de js/app.js (usa as funções
   de apoio de lá: criarId, criarElemento, criarIcone, limparErros,
   mostrarErros, registrarAtividade, mostrarAviso etc.).

   A foto de perfil (topo de todas as páginas) leva a cadastro.html.
   Os dados são guardados em texto simples (chave=valor) no localStorage,
   usando objetoParaTexto/textoParaObjeto do app.js. Não há senha: é só
   um perfil de demonstração com coleta mínima de dados (LGPD).

   ÍNDICE
   1. Constantes
   2. Armazenamento do cadastro (ler, salvar, apagar)
   3. Validação
   4. Foto de perfil / nome no topo (todas as páginas)
   5. Página de cadastro (formulário, dados salvos na tela, excluir)
   6. Inicialização
   ===================================================================== */
"use strict";


/* =====================================================================
   1. CONSTANTES
   ===================================================================== */
const CHAVE_CADASTRO = "ecouso_cadastro_v2";   // cadastro do usuário (guardado como texto chave=valor)

const PERFIS = ["Moradia", "Pequeno comércio", "Escola ou associação"];
const LIMITE_NOME_MIN = 2;
const LIMITE_NOME_MAX = 50;
const LIMITE_EMAIL = 100;


/* =====================================================================
   2. ARMAZENAMENTO DO CADASTRO
   ===================================================================== */

/** Confere se o cadastro lido do navegador tem o formato esperado. */
function ehCadastroArmazenado(dados) {
  return Boolean(dados) && typeof dados === "object" &&
    typeof dados.nome === "string" && dados.nome.trim() !== "" &&
    PERFIS.includes(dados.perfil);
}

/** Lê o cadastro salvo. Devolve o objeto ou null (se não existir ou estiver inválido). */
function lerCadastro() {
  try {
    const texto = localStorage.getItem(CHAVE_CADASTRO);
    if (!texto) return null;
    const dados = textoParaObjeto(texto);
    dados.consentimento = dados.consentimento === "sim";   // volta a ser verdadeiro/falso
    return ehCadastroArmazenado(dados) ? dados : null;
  } catch (erro) {
    console.error("Falha ao ler o cadastro.");
    mostrarAviso(MSG_ERRO_CARREGAR);
    return null;
  }
}

/** Grava o cadastro como texto chave=valor. Devolve true/false. */
function salvarCadastro(cadastro) {
  try {
    localStorage.setItem(CHAVE_CADASTRO, objetoParaTexto({ ...cadastro, consentimento: cadastro.consentimento ? "sim" : "nao" }));
    return true;
  } catch (erro) {
    console.error("Falha ao gravar o cadastro.");
    mostrarAviso(MSG_ERRO_SALVAR);
    return false;
  }
}

/** Apaga o cadastro salvo. Devolve true/false. */
function apagarCadastroSalvo() {
  try {
    localStorage.removeItem(CHAVE_CADASTRO);
    return true;
  } catch (erro) {
    console.error("Falha ao apagar o cadastro.");
    mostrarAviso(MSG_ERRO_SALVAR);
    return false;
  }
}


/* =====================================================================
   3. VALIDAÇÃO
   ===================================================================== */

/** Valida os campos do cadastro. Devolve { campo: "mensagem" }; vazio = tudo certo. */
function validarCadastro(dados) {
  const erros = {};

  const nome = String(dados.nome || "").trim();
  if (nome.length < LIMITE_NOME_MIN) {
    erros.nome = `Informe pelo menos ${LIMITE_NOME_MIN} caracteres.`;
  } else if (nome.length > LIMITE_NOME_MAX) {
    erros.nome = `Use no máximo ${LIMITE_NOME_MAX} caracteres.`;
  } else if (!/^[\p{L}\p{N} .'_-]+$/u.test(nome)) {
    erros.nome = "Use apenas letras, números, espaço, ponto, hífen ou apóstrofo.";
  }

  // E-mail é opcional; se vier preenchido, precisa ter formato válido
  const email = String(dados.email || "").trim();
  if (email !== "" && (email.length > LIMITE_EMAIL || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    erros.email = "Informe um e-mail válido ou deixe em branco.";
  }

  if (!PERFIS.includes(dados.perfil)) {
    erros.perfil = "Selecione como você usa o EcoUso.";
  }

  if (dados.consentimento !== true) {
    erros.consentimento = "É preciso concordar para salvar o cadastro.";
  }

  return erros;
}

/** Lê os campos do formulário de cadastro. */
function lerDadosCadastro(formulario) {
  const campos = formulario.elements;
  return {
    nome: campos["nome"].value,
    email: campos["email"].value,
    perfil: campos["perfil"].value,
    consentimento: campos["consentimento"].checked
  };
}


/* =====================================================================
   4. FOTO DE PERFIL / NOME NO TOPO
   ===================================================================== */

/** Atualiza a foto/nome do perfil na barra superior (roda em todas as páginas). */
function atualizarUsuarioNoTopo() {
  const nome = document.getElementById("usuario-nome");
  const subtitulo = document.getElementById("usuario-sub");
  const avatar = document.getElementById("usuario-avatar");
  if (!nome || !subtitulo || !avatar) return;

  const cadastro = lerCadastro();
  if (cadastro) {
    nome.textContent = cadastro.nome;
    subtitulo.textContent = cadastro.perfil;
    avatar.textContent = Array.from(cadastro.nome.trim())[0].toUpperCase();  // inicial do nome
  } else {
    nome.textContent = "Visitante";
    subtitulo.textContent = "Fazer cadastro";
    avatar.replaceChildren(criarIcone("bi-person"));
  }
}


/* =====================================================================
   5. PÁGINA DE CADASTRO
   ===================================================================== */

/** Rótulos mostrados na lista de dados salvos. */
const ROTULOS_CADASTRO = [
  ["nome", "Nome ou apelido"],
  ["email", "E-mail"],
  ["perfil", "Perfil de uso"],
  ["criadoEm", "Cadastrado em"],
  ["atualizadoEm", "Última alteração"]
];

/** Formata uma data/hora ISO (ex.: 2026-11-14T14:19:47Z) como 14/11/2026 11:19. */
function formatarDataHoraTexto(iso) {
  const data = new Date(iso);
  return isNaN(data.getTime()) ? "—" : formatarDataHora(data);
}

/** Preenche o formulário e a lista de dados salvos (se houver cadastro). */
function renderizarCadastro() {
  const formulario = document.getElementById("cadastro-form");
  const lista = document.getElementById("cadastro-dados");
  const cadastro = lerCadastro();
  lista.replaceChildren();

  if (cadastro) {
    formulario.elements["nome"].value = cadastro.nome;
    formulario.elements["email"].value = cadastro.email || "";
    formulario.elements["perfil"].value = cadastro.perfil;
    formulario.elements["consentimento"].checked = cadastro.consentimento === true;

    ROTULOS_CADASTRO.forEach(([campo, rotulo]) => {
      let valor = cadastro[campo] || "Não informado";
      if (campo === "criadoEm" || campo === "atualizadoEm") valor = formatarDataHoraTexto(cadastro[campo]);
      const linha = criarElemento("div", "dado-linha");
      linha.append(criarElemento("dt", "", rotulo), criarElemento("dd", "", valor));
      lista.append(linha);
    });
  } else {
    lista.append(criarElemento("p", "text-secondary mb-0", "Nenhum cadastro salvo ainda."));
  }
  document.getElementById("btn-excluir-cadastro").disabled = !cadastro;
}

/** Mostra a mensagem de sucesso/erro do cadastro (Bootstrap alert). */
function mostrarFeedbackCadastro(tipo, texto) {
  document.getElementById("cadastro-feedback")
    .replaceChildren(criarElemento("div", `alert alert-${tipo} mb-0`, texto));
}

/** Valida e salva o cadastro. */
function tratarEnvioCadastro(formulario) {
  limparErros(formulario);
  const dados = lerDadosCadastro(formulario);
  const erros = validarCadastro(dados);

  if (Object.keys(erros).length > 0) {
    mostrarErros(formulario, erros);
    mostrarFeedbackCadastro("danger", "Corrija os campos destacados e tente novamente.");
    return;
  }

  esconderAviso();
  const existente = lerCadastro();
  const agora = new Date().toISOString();
  const cadastro = {
    id: existente && typeof existente.id === "string" ? existente.id : criarId(),
    nome: dados.nome.trim(),
    email: dados.email.trim().toLowerCase(),
    perfil: dados.perfil,
    consentimento: true,
    criadoEm: existente && typeof existente.criadoEm === "string" ? existente.criadoEm : agora,
    atualizadoEm: agora
  };

  const deuCerto = salvarCadastro(cadastro);
  registrarAtividade(
    existente ? "Editar cadastro" : "Criar cadastro",
    deuCerto ? "cadastro salvo com sucesso" : "não foi possível salvar o cadastro"
  );

  if (deuCerto) {
    mostrarFeedbackCadastro("success", "Cadastro salvo com sucesso!");
    renderizarCadastro();
    atualizarUsuarioNoTopo();
  } else {
    mostrarFeedbackCadastro("danger", MSG_ERRO_SALVAR);
  }
}

/** Exclui o cadastro depois de pedir confirmação. */
function excluirCadastro() {
  if (!window.confirm("Excluir o cadastro salvo neste navegador?")) return;
  const deuCerto = apagarCadastroSalvo();
  registrarAtividade(
    "Excluir cadastro",
    deuCerto ? "cadastro excluído com sucesso" : "não foi possível excluir o cadastro"
  );
  if (deuCerto) {
    document.getElementById("cadastro-form").reset();
    document.getElementById("cadastro-feedback").replaceChildren();
    renderizarCadastro();
    atualizarUsuarioNoTopo();
  }
}

/** Prepara a página de cadastro. */
function iniciarPaginaCadastro() {
  const formulario = document.getElementById("cadastro-form");
  formulario.addEventListener("submit", evento => {
    evento.preventDefault();
    tratarEnvioCadastro(formulario);
  });
  formulario.addEventListener("input", evento => limparErroCampo(evento.target));
  formulario.addEventListener("change", evento => limparErroCampo(evento.target));
  document.getElementById("btn-excluir-cadastro").addEventListener("click", excluirCadastro);
  renderizarCadastro();
}


/* =====================================================================
   6. INICIALIZAÇÃO
   Roda em todas as páginas (atualiza o topo) e, na página de cadastro,
   liga também o formulário.
   ===================================================================== */
document.addEventListener("DOMContentLoaded", () => {
  try {
    atualizarUsuarioNoTopo();
    if (document.getElementById("cadastro-form")) iniciarPaginaCadastro();
  } catch (erro) {
    console.error("Erro ao iniciar o cadastro.", erro);   // detalhe técnico só no console
    mostrarAviso(MSG_ERRO_CARREGAR);
  }
});

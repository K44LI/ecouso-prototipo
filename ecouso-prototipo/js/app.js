/* =====================================================================
   EcoUso — js/app.js
   Todo o JavaScript do protótipo fica neste arquivo.

   ÍNDICE
   1. Constantes e configurações
   2. Utilitários (datas, números, criação de elementos)
   3. Armazenamento (localStorage) com try/catch
   4. Validação dos dados
   5. Painel de registro de atividades (log)
   6. Operações CRUD: adicionar, listar, editar e remover
   7. Menu lateral no celular
   8. Página REGISTRAR (formulário)
   9. Página HISTÓRICO (lista, filtros, edição e remoção)
  10. Página INÍCIO (painel com cartões e gráfico)
  11. MODO NOTURNO (tema claro/escuro)
  12. Inicialização

  O CADASTRO fica em js/cadastro.js (carregado depois deste arquivo).
   ===================================================================== */
"use strict";


/* =====================================================================
   1. CONSTANTES E CONFIGURAÇÕES
   ===================================================================== */

// Chaves usadas no localStorage do navegador
const CHAVE_REGISTROS = "ecouso_registros_v2";
const CHAVE_LOG = "ecouso_atividades_v2";
const CHAVE_TEMA = "ecouso_tema_v1";           // "light" ou "dark"

// Recursos aceitos: ícone (Bootstrap Icons), unidade padrão, classe de cor e meta mensal de ações
const RECURSOS = {
  "Água":      { icone: "bi-droplet", unidade: "litros", classe: "agua",      meta: 5 },
  "Energia":   { icone: "bi-lightning-charge", unidade: "kWh",    classe: "energia",   meta: 5 },
  "Alimentos": { icone: "bi-basket", unidade: "kg",     classe: "alimentos", meta: 5 }
};

// Unidades aceitas no campo "Unidade"
const UNIDADES = ["litros", "kWh", "kg", "unidades"];

// Limites usados na validação
const LIMITE_ACAO_MIN = 5;
const LIMITE_ACAO_MAX = 100;
const LIMITE_QUANTIDADE = 100000;
const DATA_MINIMA = "2020-01-01";
const MAX_ITENS_LOG = 30;

// Mensagens amigáveis: o usuário NUNCA vê a mensagem técnica do erro
const MSG_ERRO_CARREGAR = "Não foi possível carregar os dados. Tente novamente.";
const MSG_ERRO_SALVAR = "Não foi possível salvar os dados. Tente novamente.";


/* =====================================================================
   2. UTILITÁRIOS
   ===================================================================== */

/** Gera um identificador único para cada registro. */
function criarId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** Converte um objeto Date em texto "AAAA-MM-DD" (horário local). */
function dataParaISO(data) {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

/** Data de hoje no formato "AAAA-MM-DD". */
function hojeISO() {
  return dataParaISO(new Date());
}

/** Converte "AAAA-MM-DD" em "DD/MM/AAAA". */
function formatarDataBR(iso) {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

/** Converte um Date em "DD/MM/AAAA HH:MM" (exemplo: 17/11/2026 08:30). */
function formatarDataHora(data) {
  const horas = String(data.getHours()).padStart(2, "0");
  const minutos = String(data.getMinutes()).padStart(2, "0");
  return `${formatarDataBR(dataParaISO(data))} ${horas}:${minutos}`;
}

/** Formata números no padrão brasileiro (vírgula decimal). */
function formatarNumero(numero) {
  return Number(numero).toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

/** Verifica se o texto é uma data real no formato "AAAA-MM-DD". */
function ehDataValida(texto) {
  if (typeof texto !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(texto)) return false;
  const data = new Date(texto + "T00:00:00");
  return !isNaN(data.getTime()) && dataParaISO(data) === texto;
}

/** Confere se o nome existe em RECURSOS (sem aceitar nomes herdados do objeto). */
function ehRecursoValido(nome) {
  return Object.keys(RECURSOS).includes(nome);
}

/** Cria um elemento HTML. O texto entra com textContent (nunca como HTML). */
function criarElemento(tag, classe, texto) {
  const elemento = document.createElement(tag);
  if (classe) elemento.className = classe;
  if (texto !== undefined) elemento.textContent = texto;
  return elemento;
}

/** Cria um ícone do Bootstrap Icons (ex.: "bi-droplet"). Fica escondido de leitores de tela. */
function criarIcone(classe) {
  const icone = criarElemento("i", `bi ${classe}`);
  icone.setAttribute("aria-hidden", "true");
  return icone;
}

/** Cria o rótulo "ícone + nome" de um recurso (Água, Energia ou Alimentos). */
function criarRotuloRecurso(nome, classeDoSpan) {
  const config = RECURSOS[nome];
  const rotulo = criarElemento("span", classeDoSpan || "");
  const icone = criarIcone(config.icone);
  icone.classList.add("icone-recurso", config.classe);
  rotulo.append(icone, nome);
  return rotulo;
}

/** Mostra o aviso de erro no topo da página (mensagem genérica). */
function mostrarAviso(mensagem) {
  const aviso = document.getElementById("aviso-global");
  if (!aviso) return;
  aviso.textContent = mensagem;
  aviso.hidden = false;
}

/** Esconde o aviso de erro. */
function esconderAviso() {
  const aviso = document.getElementById("aviso-global");
  if (aviso) aviso.hidden = true;
}


/* =====================================================================
   3. ARMAZENAMENTO (localStorage)
   Toda leitura/gravação fica dentro de try/catch: o navegador pode
   bloquear o armazenamento ou os dados podem estar corrompidos.
   ===================================================================== */

/*
 * FORMATO DE GRAVAÇÃO
 * O localStorage só guarda texto. Cada item é gravado como uma linha no
 * formato chave=valor&chave=valor (ex.: id=abc&recurso=%C3%81gua&data=2026-11-14),
 * e os itens de uma lista ficam um por linha. Quem faz a conversão é o
 * URLSearchParams, que já codifica acentos e símbolos com segurança.
 */

/** Converte um objeto simples em uma linha de texto. Valores vazios viram "". */
function objetoParaTexto(objeto) {
  const params = new URLSearchParams();
  Object.keys(objeto).forEach(campo => {
    const valor = objeto[campo];
    params.set(campo, valor === null || valor === undefined ? "" : String(valor));
  });
  return params.toString();
}

/** Converte uma linha de texto de volta em objeto (todos os valores voltam como texto). */
function textoParaObjeto(texto) {
  const objeto = {};
  new URLSearchParams(texto).forEach((valor, campo) => { objeto[campo] = valor; });
  return objeto;
}

/** Lê uma lista salva. Se algo falhar, devolve lista vazia e avisa o usuário. */
function lerArmazenamento(chave) {
  try {
    const texto = localStorage.getItem(chave);
    if (!texto) return [];
    return texto.split("\n").filter(linha => linha !== "").map(textoParaObjeto);
  } catch (erro) {
    console.error("Falha ao ler o armazenamento:", chave); // detalhe técnico só no console
    mostrarAviso(MSG_ERRO_CARREGAR);
    return [];
  }
}

/** Grava uma lista (um item por linha). Devolve true se deu certo e false se falhou. */
function salvarArmazenamento(chave, lista) {
  try {
    localStorage.setItem(chave, lista.map(objetoParaTexto).join("\n"));
    return true;
  } catch (erro) {
    console.error("Falha ao gravar no armazenamento:", chave);
    mostrarAviso(MSG_ERRO_SALVAR);
    return false;
  }
}

/** Confere se um item lido do navegador tem o formato esperado (evita dados adulterados). */
function ehRegistroArmazenado(item) {
  return Boolean(item) &&
    typeof item.id === "string" && item.id !== "" &&
    ehRecursoValido(item.recurso) &&
    typeof item.acao === "string" && item.acao !== "" &&
    ehDataValida(item.data);
}

/** Como tudo volta como texto, a quantidade precisa voltar a ser número (ou null). */
function converterRegistroLido(item) {
  const numero = Number(item.quantidade);
  const temQuantidade = item.quantidade !== undefined && item.quantidade !== "" && isFinite(numero);
  return { ...item, quantidade: temQuantidade ? numero : null, unidade: temQuantidade ? (item.unidade || "") : "" };
}

/** Lista de registros salvos (já convertida e filtrada pelo formato). */
function lerRegistros() {
  return lerArmazenamento(CHAVE_REGISTROS).map(converterRegistroLido).filter(ehRegistroArmazenado);
}

/** Lista de atividades salvas (já filtrada pelo formato). */
function lerLog() {
  return lerArmazenamento(CHAVE_LOG).filter(item =>
    item && typeof item.dataHora === "string" && item.dataHora !== "" &&
    typeof item.acao === "string" && typeof item.resultado === "string");
}


/* =====================================================================
   4. VALIDAÇÃO DOS DADOS
   Valida campo vazio, tamanho, formato e tipo antes de usar.
   ===================================================================== */

/**
 * Valida os dados de um registro.
 * Retorna um objeto { nomeDoCampo: "mensagem" }. Vazio = tudo certo.
 */
function validarRegistro(dados) {
  const erros = {};

  // Recurso: obrigatório e precisa ser um dos três
  if (!ehRecursoValido(dados.recurso)) {
    erros.recurso = "Selecione um recurso.";
  }

  // Ação: obrigatória, de 5 a 100 caracteres
  const acao = String(dados.acao || "").trim();
  if (acao.length < LIMITE_ACAO_MIN) {
    erros.acao = `Descreva a ação com pelo menos ${LIMITE_ACAO_MIN} caracteres.`;
  } else if (acao.length > LIMITE_ACAO_MAX) {
    erros.acao = `Use no máximo ${LIMITE_ACAO_MAX} caracteres.`;
  }

  // Quantidade (opcional): número entre 0 e 100000
  const textoQuantidade = String(dados.quantidade ?? "").trim();
  const temQuantidade = textoQuantidade !== "";
  if (temQuantidade) {
    const numero = Number(textoQuantidade.replace(",", "."));
    if (!isFinite(numero) || numero < 0 || numero > LIMITE_QUANTIDADE) {
      erros.quantidade = `Informe um número entre 0 e ${LIMITE_QUANTIDADE}.`;
    }
  }

  // Unidade (opcional): precisa combinar com a quantidade
  const unidade = String(dados.unidade || "");
  if (unidade !== "" && !UNIDADES.includes(unidade)) {
    erros.unidade = "Escolha uma unidade da lista.";
  } else if (temQuantidade && unidade === "" && !erros.quantidade) {
    erros.unidade = "Escolha a unidade da quantidade.";
  } else if (!temQuantidade && unidade !== "") {
    erros.quantidade = "Informe a quantidade ou deixe a unidade em branco.";
  }

  // Data: obrigatória, válida, entre 01/01/2020 e hoje
  if (!ehDataValida(dados.data)) {
    erros.data = "Informe uma data válida.";
  } else if (dados.data > hojeISO()) {
    erros.data = "A data não pode ser no futuro.";
  } else if (dados.data < DATA_MINIMA) {
    erros.data = "Informe uma data a partir de 01/01/2020.";
  }

  return erros;
}

/** Limpa os dados validados e converte a quantidade em número (ou null). */
function normalizarRegistro(dados) {
  const textoQuantidade = String(dados.quantidade ?? "").trim();
  return {
    recurso: dados.recurso,
    acao: String(dados.acao).trim(),
    quantidade: textoQuantidade === "" ? null : Number(textoQuantidade.replace(",", ".")),
    unidade: textoQuantidade === "" ? "" : dados.unidade,
    data: dados.data
  };
}

/** Lê os campos de um formulário (cadastro ou edição) e devolve um objeto. */
function lerDadosFormulario(formulario) {
  const campos = formulario.elements;
  return {
    recurso: campos["recurso"].value,
    acao: campos["acao"].value,
    quantidade: campos["quantidade"].value,
    unidade: campos["unidade"].value,
    data: campos["data"].value
  };
}

/** Remove as marcações de erro de um formulário. */
function limparErros(formulario) {
  formulario.querySelectorAll(".is-invalid").forEach(campo => campo.classList.remove("is-invalid"));
  formulario.querySelectorAll(".invalid-feedback").forEach(msg => { msg.textContent = ""; });
}

/** Remove o erro de um único campo (chamado enquanto a pessoa digita). */
function limparErroCampo(campo) {
  if (!campo.classList) return;
  campo.classList.remove("is-invalid");
}

/** Mostra a mensagem de erro embaixo de cada campo inválido. */
function mostrarErros(formulario, erros) {
  Object.keys(erros).forEach(nome => {
    const campo = formulario.elements[nome];
    if (!campo) return;
    campo.classList.add("is-invalid");
    const area = campo.closest(".campo");
    const mensagem = area ? area.querySelector(".invalid-feedback") : null;
    if (mensagem) mensagem.textContent = erros[nome];
  });
  // Leva o foco ao primeiro campo com erro (ajuda quem usa teclado/leitor de tela)
  const primeiro = formulario.querySelector(".is-invalid");
  if (primeiro) primeiro.focus();
}


/* =====================================================================
   5. PAINEL DE REGISTRO DE ATIVIDADES (data/hora, ação e resultado)
   Exemplo de linha: 17/11/2026 08:30 — item adicionado com sucesso
   ===================================================================== */

/** Guarda uma nova atividade e atualiza o painel na tela. */
function registrarAtividade(acao, resultado) {
  const lista = lerLog();
  lista.unshift({ dataHora: new Date().toISOString(), acao, resultado });
  salvarArmazenamento(CHAVE_LOG, lista.slice(0, MAX_ITENS_LOG));
  renderizarLog();
}

/** Desenha as linhas da tabela do painel de atividades. */
function renderizarLog() {
  const corpo = document.getElementById("log-atividades");
  if (!corpo) return; // a página atual não tem o painel

  const lista = lerLog();
  corpo.replaceChildren();

  if (lista.length === 0) {
    const linha = criarElemento("tr");
    const celula = criarElemento("td", "text-secondary", "Ainda não há operações registradas.");
    celula.colSpan = 3;
    linha.append(celula);
    corpo.append(linha);
    return;
  }

  lista.forEach(item => {
    const data = new Date(item.dataHora);
    const textoData = isNaN(data.getTime()) ? "—" : formatarDataHora(data);
    const linha = criarElemento("tr");
    linha.append(
      criarElemento("td", "text-nowrap", textoData),
      criarElemento("td", "", item.acao),
      criarElemento("td", "", item.resultado)
    );
    corpo.append(linha);
  });
}


/* =====================================================================
   6. OPERAÇÕES CRUD
   Adicionar • Listar • Editar • Remover
   Cada uma devolve true/false e escreve no painel de atividades.
   ===================================================================== */

/** LISTAR — devolve todos os registros salvos. */
function listarRegistros() {
  return lerRegistros();
}

/** ADICIONAR — cria um novo registro no início da lista. */
function adicionarRegistro(dados) {
  const lista = lerRegistros();
  lista.unshift({ id: criarId(), ...dados });
  const deuCerto = salvarArmazenamento(CHAVE_REGISTROS, lista);
  registrarAtividade(
    `Adicionar: ${dados.recurso} — ${dados.acao}`,
    deuCerto ? "item adicionado com sucesso" : "não foi possível adicionar o item"
  );
  return deuCerto;
}

/** EDITAR — atualiza o registro que tem o id informado. */
function editarRegistro(id, dados) {
  const lista = lerRegistros();
  const posicao = lista.findIndex(item => item.id === id);
  if (posicao === -1) {
    registrarAtividade("Editar registro", "item não encontrado");
    return false;
  }
  lista[posicao] = { id, ...dados };
  const deuCerto = salvarArmazenamento(CHAVE_REGISTROS, lista);
  registrarAtividade(
    `Editar: ${dados.recurso} — ${dados.acao}`,
    deuCerto ? "item editado com sucesso" : "não foi possível editar o item"
  );
  return deuCerto;
}

/** REMOVER — exclui o registro que tem o id informado. */
function removerRegistro(id) {
  const lista = lerRegistros();
  const item = lista.find(registro => registro.id === id);
  if (!item) {
    registrarAtividade("Remover registro", "item não encontrado");
    return false;
  }
  const deuCerto = salvarArmazenamento(CHAVE_REGISTROS, lista.filter(registro => registro.id !== id));
  registrarAtividade(
    `Remover: ${item.recurso} — ${item.acao}`,
    deuCerto ? "item removido com sucesso" : "não foi possível remover o item"
  );
  return deuCerto;
}


/* =====================================================================
   7. MENU LATERAL NO CELULAR
   O botão de menu abre/fecha o menu; o fundo escuro e a tecla Esc fecham.
   ===================================================================== */
function configurarMenuMobile() {
  const botao = document.getElementById("btn-menu");
  const menu = document.getElementById("sidebar");
  const fundo = document.getElementById("sidebar-overlay");
  if (!botao || !menu || !fundo) return;

  function alternar(abrir) {
    menu.classList.toggle("aberto", abrir);
    fundo.classList.toggle("ativo", abrir);
    botao.setAttribute("aria-expanded", String(abrir));
  }

  botao.addEventListener("click", () => alternar(!menu.classList.contains("aberto")));
  fundo.addEventListener("click", () => alternar(false));
  document.addEventListener("keydown", evento => {
    if (evento.key === "Escape") alternar(false);
  });
}


/* =====================================================================
   8. PÁGINA REGISTRAR (formulário principal da solução)
   ===================================================================== */

/** Mostra uma mensagem de sucesso/erro abaixo do formulário (Bootstrap alert). */
function mostrarFeedbackFormulario(tipo, texto) {
  const area = document.getElementById("form-feedback");
  if (!area) return;
  area.replaceChildren(criarElemento("div", `alert alert-${tipo} mb-0`, texto));
}

/** Trata o envio do formulário: valida, salva e informa o resultado. */
function tratarEnvioRegistro(formulario) {
  limparErros(formulario);
  const dados = lerDadosFormulario(formulario);
  const erros = validarRegistro(dados);

  if (Object.keys(erros).length > 0) {
    mostrarErros(formulario, erros);
    mostrarFeedbackFormulario("danger", "Corrija os campos destacados e tente novamente.");
    return;
  }

  esconderAviso();
  if (adicionarRegistro(normalizarRegistro(dados))) {
    formulario.reset();
    formulario.elements["data"].value = hojeISO();
    mostrarFeedbackFormulario("success", "Registro salvo com sucesso!");
  } else {
    mostrarFeedbackFormulario("danger", MSG_ERRO_SALVAR);
  }
}

/** Prepara a página de registro de ações. */
function iniciarPaginaRegistrar() {
  const formulario = document.getElementById("consumo-form");
  const campoData = formulario.elements["data"];
  campoData.max = hojeISO();    // o calendário não deixa escolher datas futuras
  campoData.value = hojeISO();  // sugere a data de hoje

  formulario.addEventListener("submit", evento => {
    evento.preventDefault();    // impede o recarregamento da página
    tratarEnvioRegistro(formulario);
  });
  // Tira o vermelho do campo assim que a pessoa começa a corrigir
  formulario.addEventListener("input", evento => limparErroCampo(evento.target));
  formulario.addEventListener("change", evento => limparErroCampo(evento.target));
}


/* =====================================================================
   9. PÁGINA HISTÓRICO
   ===================================================================== */

// Filtros atuais da listagem
const filtros = { recurso: "", busca: "" };

/** Aplica os filtros de recurso e de texto na lista. */
function filtrarRegistros(lista) {
  const termo = filtros.busca.toLowerCase();
  return lista.filter(item => {
    const combinaRecurso = filtros.recurso === "" || item.recurso === filtros.recurso;
    const combinaTexto = termo === "" ||
      item.acao.toLowerCase().includes(termo) ||
      item.recurso.toLowerCase().includes(termo);
    return combinaRecurso && combinaTexto;
  });
}

/** Monta o cartão de um registro usando métodos do DOM (sem innerHTML). */
function criarCartao(registro) {
  const config = RECURSOS[registro.recurso];
  const cartao = criarElemento("article", `registro ${config.classe}`);

  // Linha de cima: recurso e data
  const topo = criarElemento("div", "registro-topo");
  const data = criarElemento("time", "registro-data", formatarDataBR(registro.data));
  data.dateTime = registro.data;
  topo.append(criarRotuloRecurso(registro.recurso, "registro-recurso"), data);

  // Descrição da ação
  const acao = criarElemento("p", "registro-acao", registro.acao);

  cartao.append(topo, acao);

  // Quantidade (só aparece se foi informada)
  if (typeof registro.quantidade === "number") {
    cartao.append(criarElemento("p", "registro-qtd", `Quantidade: ${formatarNumero(registro.quantidade)} ${registro.unidade}`));
  }

  // Botões Editar e Remover (identificados por data-atributos)
  const botoes = criarElemento("div", "registro-botoes");
  const editar = criarElemento("button", "btn btn-sm btn-outline-success", "Editar");
  editar.type = "button";
  editar.dataset.acao = "editar";
  editar.dataset.id = registro.id;
  const remover = criarElemento("button", "btn btn-sm btn-outline-danger", "Remover");
  remover.type = "button";
  remover.dataset.acao = "remover";
  remover.dataset.id = registro.id;
  botoes.append(editar, remover);
  cartao.append(botoes);

  return cartao;
}

/** LISTAR na tela: desenha os cartões, o contador e o estado vazio. */
function renderizarHistorico() {
  const container = document.getElementById("lista-registros");
  const vazio = document.getElementById("historico-vazio");
  const contador = document.getElementById("contador");

  const todos = listarRegistros();
  const filtrados = filtrarRegistros(todos);

  container.replaceChildren(...filtrados.map(criarCartao));
  contador.textContent = `${filtrados.length} de ${todos.length} registro(s)`;

  // Texto do estado vazio muda se não há registros ou se o filtro não achou nada
  vazio.hidden = filtrados.length > 0;
  document.getElementById("vazio-titulo").textContent =
    todos.length === 0 ? "Nenhum registro por enquanto" : "Nenhum registro encontrado";
  document.getElementById("vazio-texto").textContent =
    todos.length === 0
      ? "Adicione sua primeira ação para começar a acompanhar seus hábitos."
      : "Tente outro recurso ou outra palavra na busca.";
}

/* ---------- Edição (modal do Bootstrap) ---------- */

/** Abre o modal já preenchido com os dados do registro. */
function abrirEdicao(id) {
  const registro = lerRegistros().find(item => item.id === id);
  if (!registro) {
    mostrarAviso(MSG_ERRO_CARREGAR);
    return;
  }
  if (typeof bootstrap === "undefined") {   // Bootstrap não carregou (sem internet)
    mostrarAviso("Não foi possível abrir a edição. Tente novamente.");
    return;
  }

  const formulario = document.getElementById("editar-form");
  limparErros(formulario);
  document.getElementById("editar-feedback").textContent = "";

  const campos = formulario.elements;
  campos["registroId"].value = registro.id;
  campos["recurso"].value = registro.recurso;
  campos["acao"].value = registro.acao;
  campos["quantidade"].value = typeof registro.quantidade === "number" ? registro.quantidade : "";
  campos["unidade"].value = registro.unidade || "";
  campos["data"].value = registro.data;
  campos["data"].max = hojeISO();

  bootstrap.Modal.getOrCreateInstance(document.getElementById("editar-modal")).show();
}

/** Trata o envio do formulário de edição. */
function tratarEnvioEdicao(formulario) {
  limparErros(formulario);
  const saida = document.getElementById("editar-feedback");
  saida.textContent = "";

  const dados = lerDadosFormulario(formulario);
  const erros = validarRegistro(dados);
  if (Object.keys(erros).length > 0) {
    mostrarErros(formulario, erros);
    saida.textContent = "Corrija os campos destacados.";
    return;
  }

  const id = formulario.elements["registroId"].value;
  if (editarRegistro(id, normalizarRegistro(dados))) {
    bootstrap.Modal.getOrCreateInstance(document.getElementById("editar-modal")).hide();
    renderizarHistorico();
  } else {
    saida.textContent = MSG_ERRO_SALVAR;
  }
}

/** Liga os eventos do formulário de edição. */
function configurarEdicao() {
  const formulario = document.getElementById("editar-form");
  formulario.addEventListener("submit", evento => {
    evento.preventDefault();
    tratarEnvioEdicao(formulario);
  });
  formulario.addEventListener("input", evento => limparErroCampo(evento.target));
  formulario.addEventListener("change", evento => limparErroCampo(evento.target));
}

/** Pergunta antes de remover e atualiza a lista. */
function confirmarRemocao(id) {
  if (!window.confirm("Deseja realmente remover este registro?")) return;
  removerRegistro(id);
  renderizarHistorico();
}

/** Prepara a página de histórico: filtros, cliques e primeira listagem. */
function iniciarPaginaHistorico() {
  const parametros = new URLSearchParams(window.location.search);

  // Filtros que podem chegar pela URL (menu lateral e busca do topo)
  const recursoUrl = parametros.get("recurso") || "";
  filtros.recurso = ehRecursoValido(recursoUrl) ? recursoUrl : "";
  filtros.busca = (parametros.get("q") || "").trim().slice(0, LIMITE_ACAO_MAX);

  const selecao = document.getElementById("filtro-recurso");
  const busca = document.getElementById("busca-topo");
  selecao.value = filtros.recurso;
  busca.value = filtros.busca;

  selecao.addEventListener("change", () => {
    filtros.recurso = ehRecursoValido(selecao.value) ? selecao.value : "";
    renderizarHistorico();
  });
  busca.addEventListener("input", () => {
    filtros.busca = busca.value.trim();
    renderizarHistorico();
  });
  // Nesta página a busca do topo filtra na hora, sem recarregar
  busca.form.addEventListener("submit", evento => evento.preventDefault());

  // Um único "ouvinte" para todos os botões Editar/Remover (delegação de eventos)
  document.getElementById("lista-registros").addEventListener("click", evento => {
    const botao = evento.target.closest("button[data-acao]");
    if (!botao) return;
    if (botao.dataset.acao === "editar") abrirEdicao(botao.dataset.id);
    if (botao.dataset.acao === "remover") confirmarRemocao(botao.dataset.id);
  });

  configurarEdicao();
  renderizarHistorico();
}


/* =====================================================================
   10. PÁGINA INÍCIO (painel)
   ===================================================================== */

/** Conta ações e soma quantidades por recurso. */
function calcularResumo(registros) {
  const mesAtual = hojeISO().slice(0, 7);          // "AAAA-MM"
  const resumo = {};
  Object.keys(RECURSOS).forEach(nome => {
    resumo[nome] = { total: 0, mes: 0, quantidade: 0 };
  });

  registros.forEach(registro => {
    const item = resumo[registro.recurso];
    item.total += 1;
    if (registro.data.startsWith(mesAtual)) item.mes += 1;
    // Só soma quando a unidade é a "natural" do recurso (litros, kWh ou kg)
    if (typeof registro.quantidade === "number" && registro.unidade === RECURSOS[registro.recurso].unidade) {
      item.quantidade += registro.quantidade;
    }
  });
  return resumo;
}

/** Preenche os três cartões (Água, Energia, Alimentos). */
function renderizarCartoes(resumo) {
  document.querySelectorAll(".stat-card").forEach(cartao => {
    const nome = cartao.dataset.recurso;
    if (!ehRecursoValido(nome)) return;
    const dados = resumo[nome];
    const meta = RECURSOS[nome].meta;
    const percentual = Math.min(100, Math.round((dados.mes / meta) * 100));

    cartao.querySelector('[data-campo="total"]').textContent = dados.total;
    cartao.querySelector('[data-campo="mes"]').textContent = dados.mes;
    cartao.querySelector('[data-campo="meta"]').textContent = meta;
    cartao.querySelector('[data-campo="quantidade"]').textContent =
      `${formatarNumero(dados.quantidade)} ${RECURSOS[nome].unidade}`;

    const selo = cartao.querySelector('[data-campo="selo"]');
    const atingiu = dados.mes >= meta;
    selo.textContent = atingiu ? "Meta atingida" : `Faltam ${meta - dados.mes}`;
    selo.classList.toggle("ok", atingiu);

    const progresso = cartao.querySelector(".progress");
    progresso.setAttribute("aria-valuenow", String(percentual));
    cartao.querySelector('[data-campo="barra"]').style.width = `${percentual}%`;
  });
}

/** Desenha o gráfico de barras: ações do mês × meta, por recurso. */
function renderizarGrafico(resumo) {
  const grafico = document.getElementById("grafico");
  if (!grafico) return;

  const nomes = Object.keys(RECURSOS);
  // A maior barra define a escala (100% da altura)
  const maximo = Math.max(...nomes.map(nome => Math.max(resumo[nome].mes, RECURSOS[nome].meta)), 1);

  const grupos = nomes.map(nome => {
    const grupo = criarElemento("div", "grafico-grupo");
    const barras = criarElemento("div", "grafico-barras");

    [["registrada", resumo[nome].mes], ["meta", RECURSOS[nome].meta]].forEach(([tipo, valor]) => {
      const barra = criarElemento("div", tipo === "meta" ? "grafico-barra meta" : "grafico-barra");
      barra.style.height = `${(valor / maximo) * 100}%`;
      barra.append(criarElemento("span", "grafico-valor", String(valor)));
      barras.append(barra);
    });

    grupo.append(barras, criarElemento("span", "grafico-nome", nome));
    return grupo;
  });

  grafico.replaceChildren(...grupos);
  // Texto alternativo para leitores de tela
  grafico.setAttribute("aria-label", "Gráfico de barras. " + nomes
    .map(nome => `${nome}: ${resumo[nome].mes} ações no mês, meta ${RECURSOS[nome].meta}.`)
    .join(" "));
}

/** Tabela com as 5 últimas ações. */
function renderizarUltimasAcoes(registros) {
  const corpo = document.getElementById("ultimas-acoes");
  if (!corpo) return;
  corpo.replaceChildren();

  if (registros.length === 0) {
    const linha = criarElemento("tr");
    const celula = criarElemento("td", "text-secondary", "Nenhuma ação registrada ainda.");
    celula.colSpan = 3;
    linha.append(celula);
    corpo.append(linha);
    return;
  }

  registros.slice(0, 5).forEach(registro => {
    const linha = criarElemento("tr");
    const celulaRecurso = criarElemento("td", "text-nowrap");
    celulaRecurso.append(criarRotuloRecurso(registro.recurso));
    linha.append(
      criarElemento("td", "text-nowrap", formatarDataBR(registro.data)),
      celulaRecurso,
      criarElemento("td", "", registro.acao)
    );
    corpo.append(linha);
  });
}

/** Atualiza tudo o que aparece na página inicial. */
function renderizarPainel() {
  const registros = listarRegistros();
  const resumo = calcularResumo(registros);
  document.getElementById("total-geral").textContent = registros.length;
  renderizarCartoes(resumo);
  renderizarGrafico(resumo);
  renderizarUltimasAcoes(registros);
}

/** Cria registros FICTÍCIOS para demonstração. */
function carregarExemplos() {
  const base = [
    ["Água", "Reaproveitei a água da máquina de lavar no quintal", 40, "litros", 0],
    ["Água", "Fechei a torneira enquanto escovava os dentes", 12, "litros", 1],
    ["Energia", "Apaguei as luzes dos cômodos vazios", 1.5, "kWh", 2],
    ["Energia", "Desliguei aparelhos da tomada à noite", 2, "kWh", 3],
    ["Alimentos", "Planejei as compras da semana com lista", 3, "kg", 4],
    ["Alimentos", "Aproveitei as sobras no almoço do dia seguinte", 1, "kg", 5]
  ];

  const exemplos = base.map(([recurso, acao, quantidade, unidade, diasAtras]) => {
    const data = new Date();
    data.setDate(data.getDate() - diasAtras);
    return { id: criarId(), recurso, acao, quantidade, unidade, data: dataParaISO(data) };
  });

  const deuCerto = salvarArmazenamento(CHAVE_REGISTROS, [...exemplos, ...lerRegistros()]);
  registrarAtividade(
    "Carregar dados de exemplo",
    deuCerto ? `${exemplos.length} itens adicionados com sucesso` : "não foi possível adicionar os itens"
  );
  renderizarPainel();
}

/** Apaga todos os registros deste navegador (ajuda na privacidade). */
function apagarTodosOsDados() {
  if (!window.confirm("Apagar todos os registros salvos neste navegador?")) return;
  const deuCerto = salvarArmazenamento(CHAVE_REGISTROS, []);
  registrarAtividade(
    "Apagar todos os registros",
    deuCerto ? "dados apagados com sucesso" : "não foi possível apagar os dados"
  );
  renderizarPainel();
}

/** Prepara a página inicial. */
function iniciarPaginaInicio() {
  document.getElementById("btn-exemplos").addEventListener("click", carregarExemplos);
  document.getElementById("btn-limpar").addEventListener("click", apagarTodosOsDados);
  renderizarPainel();
}


/* =====================================================================
   11. MODO NOTURNO
   O tema é guardado no localStorage. O Bootstrap escurece seus
   componentes sozinho quando <html data-bs-theme="dark">; o CSS próprio
   troca as variáveis (veja a seção 14 do style.css).
   ===================================================================== */

/** Tema que está valendo agora: "dark" ou "light". */
function temaAtual() {
  return document.documentElement.getAttribute("data-bs-theme") === "dark" ? "dark" : "light";
}

/** Atualiza o ícone e os textos de acessibilidade do botão de tema. */
function atualizarBotaoTema() {
  const botao = document.getElementById("btn-tema");
  if (!botao) return;
  const escuro = temaAtual() === "dark";
  botao.replaceChildren(criarIcone(escuro ? "bi-sun" : "bi-moon-stars"));
  botao.setAttribute("aria-pressed", String(escuro));
  botao.setAttribute("aria-label", escuro ? "Ativar modo claro" : "Ativar modo noturno");
}

/** Aplica o tema na página. */
function aplicarTema(tema) {
  document.documentElement.setAttribute("data-bs-theme", tema);
  atualizarBotaoTema();
}

/** Alterna entre claro e noturno e guarda a escolha. */
function alternarTema() {
  const novo = temaAtual() === "dark" ? "light" : "dark";
  aplicarTema(novo);
  try {
    localStorage.setItem(CHAVE_TEMA, novo);
  } catch (erro) {
    console.error("Falha ao salvar o tema.");   // o tema vale só nesta página; sem aviso ao usuário
  }
}

/** Define o tema inicial: o salvo ou, na falta dele, o do sistema operacional. */
function iniciarTema() {
  let salvo = null;
  try {
    salvo = localStorage.getItem(CHAVE_TEMA);
  } catch (erro) {
    salvo = null;
  }
  const sistemaEscuro = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  aplicarTema(salvo === "dark" || salvo === "light" ? salvo : (sistemaEscuro ? "dark" : "light"));

  const botao = document.getElementById("btn-tema");
  if (botao) botao.addEventListener("click", alternarTema);
}


/* =====================================================================
   12. INICIALIZAÇÃO
   Cada página tem elementos com ids diferentes; o código descobre
   em qual página está e liga só o que é necessário.
   ===================================================================== */
function iniciarAplicacao() {
  try {
    iniciarTema();
    configurarMenuMobile();
    renderizarLog();

    if (document.getElementById("consumo-form")) iniciarPaginaRegistrar();
    if (document.getElementById("lista-registros")) iniciarPaginaHistorico();
    if (document.getElementById("painel-recursos")) iniciarPaginaInicio();
  } catch (erro) {
    console.error("Erro ao iniciar a página.", erro);   // detalhe técnico só no console
    mostrarAviso(MSG_ERRO_CARREGAR);
  }
}

document.addEventListener("DOMContentLoaded", iniciarAplicacao);

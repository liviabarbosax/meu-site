// --- Dados Persistentes (Lidos apenas uma vez) ---
let fornecedores = JSON.parse(localStorage.getItem('fornecedores')) || ['Fornecedor Exemplo'];
let produtos = JSON.parse(localStorage.getItem('produtos')) || [];
let carrinho = JSON.parse(localStorage.getItem('carrinho')) || [];
let cotacoes = JSON.parse(localStorage.getItem('cotacoes')) || [];
let kits = JSON.parse(localStorage.getItem('kits')) || [];
let cupons = JSON.parse(localStorage.getItem('cupons')) || [];

// --- Variáveis de Estado (Memória Temporária) ---
let kitProdutosTemporario = [];
let produtoEditId = null;
let cotacaoAtual = null;
let modalAtual = null; // Usado para modais de confirmação/detalhes
let modalPrecificacaoAberto = false; // Flag para o novo modal

// --- Configurações de Lojas (Constante) ---
const lojasConfig = {
    shopee: { nome: "Shopee", taxaFixa: 5.00, comissao: 0.20, logo: 'shopee-logo.svg' },
    ml_premium: { nome: "ML Premium", taxaFixa: 6.00, comissao: 0.165, logo: 'ml-logo.svg' },
    amazon: { nome: "Amazon", taxaFixa: 2.00, comissao: 0.14, logo: 'amazon-logo.svg' },
    tiktok: { nome: "TikTok Shop", taxaFixa: 2.00, comissao: 0.06, logo: 'tiktok-logo.svg' },
    facebook: { nome: "Facebook", taxaFixa: 0.00, comissao: 0.00, logo: 'facebook-logo.svg' },
    whatsapp: { nome: "WhatsApp", taxaFixa: 0.00, comissao: 0.00, logo: 'whatsapp-logo.svg' },
};

// --- Função Helper para Salvar ---
function salvarDados(chave, dados) {
    localStorage.setItem(chave, JSON.stringify(dados));
}

// --- Inicialização ---
document.addEventListener('DOMContentLoaded', () => {
    atualizarDropdownFornecedores();
    renderizarCarrinho();
    showPage('dashboard');

    // --- Event Listeners ---
    document.getElementById('carrinho-descontos').addEventListener('input', calcularTotais);
    document.getElementById('carrinho-frete').addEventListener('input', calcularTotais);
    document.getElementById('filtro-status-cotacao').addEventListener('change', renderizarCotacoes);
    document.getElementById('produto-form').addEventListener('submit', handleSalvarProduto);
    document.getElementById('novo-fornecedor').addEventListener('keypress', (e) => { if (e.key === 'Enter') adicionarFornecedor(); });
    document.getElementById('kit-form').addEventListener('submit', handleSalvarKit);
    document.getElementById('filtro-produtos-kit').addEventListener('input', filtrarProdutosParaKit);
    document.getElementById('cupom-form').addEventListener('submit', salvarCupom);
    // REMOVIDO: document.getElementById('filtro-lojas').addEventListener('input', renderizarProdutosLojas);
    document.getElementById('produto-imagem').addEventListener('change', previewImagemProduto);

    // Event listener para fechar modal de precificação clicando no overlay
    document.body.addEventListener('click', (event) => {
        if (event.target.classList.contains('modal-precificacao-overlay') && modalPrecificacaoAberto) {
            fecharModalPrecificacao();
        }
    });
});

// --- Navegação e Exibição ---
function showPage(pageId) {
    // Esconde todas as páginas e mostra a selecionada
    document.querySelectorAll('.page-content').forEach(page => page.classList.add('hidden'));
    const pageElement = document.getElementById(pageId + '-page');
    if (pageElement) {
        pageElement.classList.remove('hidden');
    } else {
        console.error(`Página com ID ${pageId}-page não encontrada!`);
        // Opcional: redirecionar para dashboard ou mostrar erro
        document.getElementById('dashboard-page')?.classList.remove('hidden');
        pageId = 'dashboard'; // Atualiza pageId para marcar o item correto no menu
    }


    // Atualiza o item ativo na sidebar
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        // Verifica se o onclick do item corresponde à página atual
        if (item.getAttribute('onclick')?.includes(`showPage('${pageId}')`)) {
            item.classList.add('active');
        }
    });

    // Rola para o topo
    const mainContent = document.querySelector('main');
    if (mainContent) mainContent.scrollTop = 0;

    // Lógica específica ao carregar
    switch (pageId) {
        case 'dashboard': calcularDashboard(); break;
        case 'produtos': if (!produtoEditId) limparFormularioProduto(); break;
        case 'catalogo': carregarFiltrosCatalogo(); aplicarFiltros(); break;
        case 'cotacoes': renderizarCotacoes(); break;
        // REMOVIDO: case 'lojas': renderizarProdutosLojas(); break;
        case 'kits': inicializarPaginaKits(); break;
        case 'financeiro': calcularEstatisticasFinanceiras(); break;
        case 'marketing': inicializarPaginaMarketing(); break;
    }
    fecharCarrinho();
    fecharModalPrecificacao(); // Garante que o modal de precificação feche ao navegar
}
function irParaCadastroProduto() { showPage('produtos'); limparFormularioProduto(); }

// --- Dashboard ---
// ... (código do Dashboard - calcularDashboard, renderizarCotacoesPendentesDashboard - permanece o mesmo) ...
function calcularDashboard() {
    const hoje = new Date();
    const inicioDoMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);

    const cotacoesConvertidasMes = cotacoes.filter(c => c.status === 'Convertida' && new Date(c.dataGeracao) >= inicioDoMes);
    const vendasMes = cotacoesConvertidasMes.reduce((acc, c) => acc + (parseFloat(c.totalGeral.replace(/[^0-9,-]+/g,"").replace(",",".")) || 0), 0);

    let lucroMes = 0;
    cotacoesConvertidasMes.forEach(cotacao => {
        cotacao.itens.forEach(item => {
            const custoItem = item.isKit ? item.custo : (item.custo + item.picking);
            lucroMes += (item.precoVenda - custoItem) * item.quantidade;
        });
        lucroMes += (parseFloat(cotacao.frete.replace(/[^0-9,-]+/g,"").replace(",",".")) || 0);
        lucroMes -= (parseFloat(cotacao.descontos.replace(/[^0-9,-]+/g,"").replace(",",".")) || 0);
    });

    const cotacoesPendentes = cotacoes.filter(c => c.status === 'Pendente').length;
    const totalProdutos = produtos.length; // Inclui produtos normais apenas

    document.getElementById('dash-vendas-mes').textContent = formatarMoeda(vendasMes);
    document.getElementById('dash-lucro-mes').textContent = formatarMoeda(lucroMes);
    document.getElementById('dash-cotacoes-pendentes').textContent = cotacoesPendentes;
    document.getElementById('dash-total-produtos').textContent = totalProdutos; // Considerar adicionar Kits aqui se desejado
    renderizarCotacoesPendentesDashboard();
}

function renderizarCotacoesPendentesDashboard() {
    const cotacoesPendentes = cotacoes.filter(c => c.status === 'Pendente').sort((a, b) => new Date(b.dataGeracao) - new Date(a.dataGeracao)); // Ordena por data
    const listaContainer = document.getElementById('dash-lista-cotacoes');
    listaContainer.innerHTML = '';

    if (cotacoesPendentes.length === 0) {
        listaContainer.innerHTML = '<p class="text-gray-400 text-center p-4">🎉 Nenhuma cotação pendente!</p>';
        return;
    }
    cotacoesPendentes.slice(0, 5).forEach(cotacao => { // Mostra as 5 mais recentes
        listaContainer.innerHTML += `<div class="bg-gray-800 rounded-lg p-4 flex justify-between items-center"><div><h4 class="text-white font-bold">${cotacao.id}</h4><p class="text-gray-300 text-sm">${cotacao.cliente} - ${cotacao.local}</p><p class="text-gray-400 text-xs">${formatarData(new Date(cotacao.dataGeracao))}</p></div><div class="text-right"><p class="text-white font-bold text-lg">${cotacao.totalGeral}</p><button onclick="alterarStatusCotacao('${cotacao.id}', 'Convertida')" class="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm mt-1">✅ Converter</button></div></div>`;
    });
}


// --- Fornecedores ---
// ... (código dos Fornecedores - carregarFornecedoresSelect, etc - permanece o mesmo) ...
function carregarFornecedoresSelect(selectId) {
    const select = document.getElementById(selectId);
    if (!select) return;
    const valorAtual = select.value;
    select.innerHTML = `<option value="">Selecione...</option>`;
    fornecedores.forEach(f => {
        const option = document.createElement('option');
        option.value = f;
        option.textContent = f;
        select.appendChild(option);
    });
    select.value = valorAtual;
}
function atualizarDropdownFornecedores() {
    ['fornecedores-select', 'produto-fornecedor', 'filtro-fornecedor'].forEach(id => carregarFornecedoresSelect(id));
}
function adicionarFornecedor() {
    const input = document.getElementById('novo-fornecedor');
    const novo = input.value.trim();
    if (!novo) { mostrarNotificacao('Digite o nome do fornecedor!', 'error'); return; }
    if (fornecedores.includes(novo)) { mostrarNotificacao('Fornecedor já cadastrado!', 'error'); return; }
    fornecedores.push(novo);
    salvarDados('fornecedores', fornecedores);
    atualizarDropdownFornecedores();
    input.value = '';
    mostrarNotificacao('Fornecedor adicionado com sucesso!', 'success');
}
function removerFornecedor() {
    const select = document.getElementById('fornecedores-select');
    const selecionado = select.value;
    if (!selecionado) { mostrarNotificacao('Selecione um fornecedor para remover!', 'error'); return; }
    if (produtos.some(p => p.fornecedor === selecionado)) {
        mostrarNotificacao('Não é possível remover: existem produtos associados a este fornecedor!', 'error');
        return;
    }
    fornecedores = fornecedores.filter(f => f !== selecionado);
    salvarDados('fornecedores', fornecedores);
    atualizarDropdownFornecedores();
    mostrarNotificacao('Fornecedor removido com sucesso!', 'success');
}


// --- Produtos ---
// ... (código dos Produtos - handleSalvarProduto, editarProduto, etc - permanece o mesmo) ...
function handleSalvarProduto(e) {
    e.preventDefault();
    const fileInput = document.getElementById('produto-imagem');
    const file = fileInput.files[0];

    const produtoData = {
        sku: document.getElementById('produto-sku').value.trim(),
        nome: document.getElementById('produto-nome').value.trim(),
        categoria: document.getElementById('produto-categoria').value.trim(),
        fornecedor: document.getElementById('produto-fornecedor').value,
        custo: parseFloat(document.getElementById('produto-custo').value) || 0,
        picking: parseFloat(document.getElementById('produto-picking').value) || 0,
        precoVenda: parseFloat(document.getElementById('produto-preco-venda').value) || 0,
        peso: parseFloat(document.getElementById('produto-peso').value) || 0,
        comprimento: parseInt(document.getElementById('produto-comprimento').value) || 0,
        largura: parseInt(document.getElementById('produto-largura').value) || 0,
        altura: parseInt(document.getElementById('produto-altura').value) || 0,
    };

    if (!produtoData.sku || !produtoData.nome || !produtoData.categoria || !produtoData.fornecedor || produtoData.custo < 0 || produtoData.peso <= 0) {
        mostrarNotificacao('Preencha os campos obrigatórios (*) com valores válidos!', 'error');
        return;
    }

    const salvar = (imageUrl) => {
        produtoData.imagem = imageUrl;
        if (produtoEditId) {
            const index = produtos.findIndex(p => p.id === produtoEditId);
            if (index !== -1) {
                if (!imageUrl && produtos[index].imagem) {
                    produtoData.imagem = produtos[index].imagem;
                }
                produtos[index] = { ...produtos[index], ...produtoData, dataAtualizacao: new Date().toISOString() };
                mostrarNotificacao('Produto atualizado com sucesso!', 'success');
            }
        } else {
            produtoData.id = Date.now();
            produtoData.dataCadastro = new Date().toISOString();
            produtos.push(produtoData);
            mostrarNotificacao('Produto salvo com sucesso!', 'success');
        }
        salvarDados('produtos', produtos);
        limparFormularioProduto();
        showPage('catalogo');
    };

    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => salvar(e.target.result);
        reader.readAsDataURL(file);
    } else {
        salvar(produtoEditId ? (produtos.find(p=>p.id===produtoEditId)?.imagem || null) : null);
    }
}
function editarProduto(id) {
    const produto = produtos.find(p => p.id === id);
    if (!produto) return;
    produtoEditId = id;

    document.getElementById('produto-id-edit').value = id;
    document.getElementById('produto-sku').value = produto.sku;
    document.getElementById('produto-nome').value = produto.nome;
    document.getElementById('produto-categoria').value = produto.categoria;
    document.getElementById('produto-fornecedor').value = produto.fornecedor;
    document.getElementById('produto-custo').value = produto.custo.toFixed(2);
    document.getElementById('produto-picking').value = produto.picking.toFixed(2);
    document.getElementById('produto-preco-venda').value = produto.precoVenda.toFixed(2);
    document.getElementById('produto-peso').value = produto.peso.toFixed(2);
    document.getElementById('produto-comprimento').value = produto.comprimento;
    document.getElementById('produto-largura').value = produto.largura;
    document.getElementById('produto-altura').value = produto.altura;

    const imgPreview = document.getElementById('produto-imagem-preview');
    if (produto.imagem) {
        imgPreview.src = produto.imagem;
        imgPreview.classList.remove('hidden');
    } else {
        imgPreview.classList.add('hidden');
    }
    document.getElementById('produto-imagem').value = '';

    document.getElementById('produto-form-titulo').innerHTML = `<span class="mr-2">✏️</span> Editando Produto`;
    showPage('produtos');
}
function limparFormularioProduto() {
    produtoEditId = null;
    document.getElementById('produto-form').reset();
    document.getElementById('produto-id-edit').value = '';

    Object.assign(document.getElementById('produto-custo'), {value: '0.00'});
    Object.assign(document.getElementById('produto-picking'), {value: '2.00'});
    Object.assign(document.getElementById('produto-preco-venda'), {value: '0.00'});
    Object.assign(document.getElementById('produto-peso'), {value: '0.00'});
    Object.assign(document.getElementById('produto-comprimento'), {value: '0'});
    Object.assign(document.getElementById('produto-largura'), {value: '0'});
    Object.assign(document.getElementById('produto-altura'), {value: '0'});

    const imgPreview = document.getElementById('produto-imagem-preview');
    imgPreview.classList.add('hidden');
    imgPreview.src = '#';
    document.getElementById('produto-form-titulo').innerHTML = `<span class="mr-2">📦</span> Cadastrar Novo Produto`;
    document.querySelectorAll('#produto-form .border-red-500').forEach(el => el.classList.remove('border-red-500'));
}
function previewImagemProduto(event) {
    const reader = new FileReader();
    const imgPreview = document.getElementById('produto-imagem-preview');
    reader.onload = function(){
        imgPreview.src = reader.result;
        imgPreview.classList.remove('hidden');
    };
    if (event.target.files[0]) {
        reader.readAsDataURL(event.target.files[0]);
    } else {
        imgPreview.classList.add('hidden');
        imgPreview.src = '#';
    }
}
function excluirProduto(id) {
    abrirModalConfirmacao(`Tem certeza que deseja excluir este produto? Kits que o utilizam também podem ser afetados.`, () => confirmarExclusaoProduto(id));
}
function confirmarExclusaoProduto(id) {
    produtos = produtos.filter(p => p.id !== id);
    salvarDados('produtos', produtos);

    let kitsAfetados = false;
    kits.forEach(kit => {
        const tamanhoOriginal = kit.produtos.length;
        kit.produtos = kit.produtos.filter(p => p.id !== id);
        if(kit.produtos.length < tamanhoOriginal) {
            kitsAfetados = true;
            kit.custoTotal = kit.produtos.reduce((a, p) => a + p.custo + p.picking, 0);
        }
    });
    if(kitsAfetados) salvarDados('kits', kits);

    // Re-renderiza páginas visíveis
    if(document.getElementById('catalogo-page')?.offsetParent !== null) aplicarFiltros();
    // REMOVIDO: if(document.getElementById('lojas-page')?.offsetParent !== null) renderizarProdutosLojas();
    if(document.getElementById('kits-page')?.offsetParent !== null) renderizarListaKits();

    mostrarNotificacao('Produto excluído com sucesso!', 'success');
    fecharModal();
}

// --- Catálogo ---
function carregarFiltrosCatalogo() {
    carregarFornecedoresSelect('filtro-fornecedor');
    const filtroCategoria = document.getElementById('filtro-categoria');
    const categorias = [...new Set(produtos.map(p => p.categoria))].sort();
    const valorAtual = filtroCategoria.value;
    filtroCategoria.innerHTML = '<option value="">Todas categorias</option>';
    categorias.forEach(c => {
        const option = document.createElement('option');
        option.value = c;
        option.textContent = c;
        filtroCategoria.appendChild(option);
    });
    filtroCategoria.value = valorAtual;
}
function aplicarFiltros() {
    const busca = document.getElementById('filtro-busca').value.toLowerCase();
    const categoria = document.getElementById('filtro-categoria').value;
    const fornecedor = document.getElementById('filtro-fornecedor').value;
    const produtosFiltrados = produtos.filter(p =>
        (!busca || p.nome.toLowerCase().includes(busca) || p.sku.toLowerCase().includes(busca)) &&
        (!categoria || p.categoria === categoria) &&
        (!fornecedor || p.fornecedor === fornecedor)
    );
    renderizarCatalogo(produtosFiltrados);
}
function limparFiltros() {
    document.getElementById('filtro-busca').value = '';
    document.getElementById('filtro-categoria').value = '';
    document.getElementById('filtro-fornecedor').value = '';
    aplicarFiltros();
}

// ATUALIZADO: renderizarCatalogo inclui o botão de precificação
function renderizarCatalogo(produtosParaMostrar) {
    const catalogoLista = document.getElementById('catalogo-lista');
    catalogoLista.innerHTML = '';
    if (produtosParaMostrar.length === 0) {
        catalogoLista.innerHTML = '<p class="text-gray-400 col-span-full text-center py-10">Nenhum produto encontrado.</p>';
        return;
    }
    produtosParaMostrar.forEach(produto => {
        const custoTotal = produto.custo + produto.picking;
        catalogoLista.innerHTML += `
            <div class="custom-card rounded-lg overflow-hidden flex flex-col">
                <img src="${produto.imagem || 'https://via.placeholder.com/300'}" alt="${produto.nome}" class="w-full h-48 object-cover" onerror="this.src='https://via.placeholder.com/300';">
                <div class="p-4 flex flex-col flex-grow">
                    <h4 class="font-bold text-white text-base mb-1 truncate">${produto.nome}</h4>
                    <p class="text-gray-400 text-xs mb-0.5">SKU: ${produto.sku}</p>
                    <p class="text-gray-400 text-xs mb-0.5">Cat: ${produto.categoria}</p>
                    <p class="text-gray-400 text-xs mb-2">For: ${produto.fornecedor}</p>
                    <div class="flex justify-between text-sm mb-3 mt-auto pt-2">
                        <span class="text-gray-300 text-xs">Custo: ${formatarMoeda(custoTotal)}</span>
                        <span class="text-white font-bold text-base">${formatarMoeda(produto.precoVenda)}</span>
                    </div>
                    <div class="flex gap-2">
                        <button onclick="adicionarAoCarrinho(${produto.id})" class="flex-1 bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded text-xs font-medium">🛒</button>
                        <button onclick="editarProduto(${produto.id})" class="flex-1 custom-accent custom-accent-hover text-white px-2 py-1 rounded text-xs font-medium">✏️</button>
                        <button onclick="excluirProduto(${produto.id})" class="flex-1 bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded text-xs font-medium">🗑️</button>
                        {/* NOVO BOTÃO DE PRECIFICAR */}
                        <button onclick="abrirModalPrecificacao(${produto.id})" class="precificacao-btn">💰</button>
                    </div>
                </div>
            </div>`;
    });
}


// --- Carrinho ---
// ... (código do Carrinho - abrirCarrinho, fecharCarrinho, etc - permanece o mesmo) ...
function abrirCarrinho() {
    document.getElementById('carrinho-painel').classList.add('show');
    document.getElementById('carrinho-overlay').classList.add('show');
}
function fecharCarrinho() {
    document.getElementById('carrinho-painel').classList.remove('show');
    document.getElementById('carrinho-overlay').classList.remove('show');
    document.getElementById('resumo-container').classList.add('hidden');
    document.getElementById('resumo-whatsapp').value = '';
    cotacaoAtual = null;
}
function renderizarCarrinho() {
    const listaItens = document.getElementById('carrinho-itens-lista');
    listaItens.innerHTML = '';
    if (carrinho.length === 0) {
        listaItens.innerHTML = '<p class="text-gray-400 text-center p-4 text-sm">Seu carrinho está vazio.</p>';
    } else {
        carrinho.forEach(item => {
            const subtotal = item.precoVenda * item.quantidade;
            listaItens.innerHTML += `
                <div class="flex items-center gap-3 p-3 custom-card rounded-lg mb-3">
                    <img src="${item.imagem || 'https://via.placeholder.com/64'}" alt="${item.nome}" class="w-12 h-12 object-cover rounded flex-shrink-0" onerror="this.src='https://via.placeholder.com/64';">
                    <div class="flex-1 min-w-0">
                        <p class="text-white font-semibold truncate text-sm">${item.nome}</p>
                        <p class="text-gray-400 text-xs">SKU: ${item.sku}</p>
                        <p class="text-gray-300 text-xs">Unit: ${formatarMoeda(item.precoVenda)}</p>
                    </div>
                    <div class="flex flex-col items-end">
                        <div class="flex items-center gap-1 mb-1">
                            <button onclick="mudarQuantidade(${item.id}, -1, ${item.isKit})" class="bg-gray-700 hover:bg-gray-600 w-6 h-6 rounded font-bold text-sm">-</button>
                            <span class="text-white w-6 text-center text-sm">${item.quantidade}</span>
                            <button onclick="mudarQuantidade(${item.id}, 1, ${item.isKit})" class="bg-gray-700 hover:bg-gray-600 w-6 h-6 rounded font-bold text-sm">+</button>
                        </div>
                        <p class="text-white font-bold text-sm">${formatarMoeda(subtotal)}</p>
                        <button onclick="removerDoCarrinho(${item.id}, ${item.isKit})" class="text-red-500 hover:text-red-400 text-xs mt-1">Remover</button>
                    </div>
                </div>`;
        });
    }
    document.getElementById('carrinho-contador').textContent = carrinho.reduce((acc, i) => acc + i.quantidade, 0);
    calcularTotais();
}
function mudarQuantidade(id, delta, isKit) {
    const idx = carrinho.findIndex(i => i.id === id && i.isKit === isKit);
    if (idx === -1) return;
    carrinho[idx].quantidade += delta;
    if (carrinho[idx].quantidade <= 0) {
        carrinho.splice(idx, 1);
    }
    salvarDados('carrinho', carrinho);
    renderizarCarrinho();
}
function removerDoCarrinho(id, isKit) {
    carrinho = carrinho.filter(i => !(i.id === id && i.isKit === isKit));
    salvarDados('carrinho', carrinho);
    renderizarCarrinho();
}
function limparCarrinho() {
    carrinho = [];
    salvarDados('carrinho', carrinho);
    renderizarCarrinho();
    document.getElementById('carrinho-descontos').value = '0';
    document.getElementById('carrinho-frete').value = '0';
    calcularTotais();
    mostrarNotificacao('Carrinho limpo!', 'success');
}
function calcularTotais() {
    const d = parseFloat(document.getElementById('carrinho-descontos').value) || 0;
    const f = parseFloat(document.getElementById('carrinho-frete').value) || 0;
    const s = carrinho.reduce((a, i) => a + (i.precoVenda * i.quantidade), 0);
    const t = s - d + f;
    document.getElementById('total-subtotal').textContent = formatarMoeda(s);
    document.getElementById('total-descontos').textContent = `- ${formatarMoeda(d)}`;
    document.getElementById('total-frete').textContent = formatarMoeda(f);
    document.getElementById('total-geral').textContent = formatarMoeda(t);
}
function adicionarAoCarrinho(id) {
    const p = produtos.find(x => x.id === id);
    if (!p) return;
    const i = carrinho.find(item => item.id === id && !item.isKit);
    if (i) {
        i.quantidade++;
    } else {
        carrinho.push({ ...p, quantidade: 1, isKit: false });
    }
    salvarDados('carrinho', carrinho);
    mostrarNotificacao(`${p.nome} adicionado ao carrinho!`, 'success');
    renderizarCarrinho();
    abrirCarrinho();
}

// --- Cotações ---
// ... (código das Cotações - gerarResumoWhatsapp, etc - permanece o mesmo) ...
function gerarResumoWhatsapp() {
    if (carrinho.length === 0) { mostrarNotificacao('Carrinho vazio!', 'error'); return; }
    const n = document.getElementById('cliente-nome').value.trim() || "Cliente";
    const w = formatarTelefone(document.getElementById('cliente-whatsapp').value);
    const c = document.getElementById('cliente-cidade').value.trim() || "N/I";
    const e = document.getElementById('cliente-estado').value.trim().toUpperCase() || "SP";
    const l = `${c}/${e}`;
    const v = parseInt(document.getElementById('cliente-validade').value);
    const dA = new Date();
    const dV = new Date(dA);
    dV.setDate(dA.getDate() + v);
    const nextId = (cotacoes.length > 0 ? Math.max(...cotacoes.map(c => c.idNumero)) : 0) + 1;
    const idF = `ORC-${String(nextId).padStart(4, '0')}`;
    calcularTotais();
    const sT = document.getElementById('total-subtotal').textContent;
    const dT = document.getElementById('total-descontos').textContent;
    const fT = document.getElementById('total-frete').textContent;
    const tT = document.getElementById('total-geral').textContent;
    let txt = `*ORÇAMENTO #${idF}* - ${formatarData(dA).split(',')[0]}\n_(Válido até ${formatarData(dV).split(',')[0]})_\n\n*Cliente:* ${n}\n*Contato:* ${w}\n*Local:* ${l}\n\n*Itens:*\n`;
    carrinho.forEach(i => { txt += ` • ${i.nome} (${i.sku}) - ${i.quantidade}x ${formatarMoeda(i.precoVenda)} = ${formatarMoeda(i.precoVenda*i.quantidade)}\n`; });
    txt += `\n*Totais:*\n • Produtos: ${sT}\n • Descontos: ${dT.replace('-','')}\n • Frete: ${fT}\n* • TOTAL: ${tT}*\n\n_Obs: Sujeito à disponibilidade._`;
    document.getElementById('resumo-whatsapp').value = txt;
    document.getElementById('resumo-container').classList.remove('hidden');
    cotacaoAtual = { id: idF, idNumero: nextId, dataGeracao: dA.toISOString(), dataValidade: dV.toISOString(), cliente: n, whatsapp: w, local: l, itens: [...carrinho], subtotal: sT, descontos: dT, frete: fT, totalGeral: tT, status: 'Pendente' };
    mostrarNotificacao('Resumo para WhatsApp gerado!', 'success');
}
function copiarResumo() {
    const r = document.getElementById('resumo-whatsapp');
    r.select();
    if (navigator.clipboard) {
        navigator.clipboard.writeText(r.value).then(() => mostrarNotificacao('Resumo copiado!', 'success')).catch(() => mostrarNotificacao('Erro ao copiar.', 'error'));
    } else {
        try {
            document.execCommand('copy');
            mostrarNotificacao('Resumo copiado!', 'success');
        } catch (err) {
            mostrarNotificacao('Erro ao copiar.', 'error');
        }
    }
}
function salvarCotacao() {
    if (!cotacaoAtual) { mostrarNotificacao('Gere o resumo antes de salvar!', 'error'); return; }
    cotacoes.push(cotacaoAtual);
    salvarDados('cotacoes', cotacoes);
    mostrarNotificacao(`Cotação ${cotacaoAtual.id} salva com sucesso!`, 'success');
    limparCarrinho();
    document.getElementById('cliente-nome').value = '';
    document.getElementById('cliente-whatsapp').value = '';
    document.getElementById('cliente-cidade').value = '';
    document.getElementById('cliente-estado').value = '';
    document.getElementById('resumo-container').classList.add('hidden');
    document.getElementById('resumo-whatsapp').value = '';
    cotacaoAtual = null;
    fecharCarrinho();
    if (!document.getElementById('cotacoes-page')?.classList.contains('hidden')) renderizarCotacoes();
}
function renderizarCotacoes() {
    const cS = cotacoes;
    const t = cS.length;
    const p = cS.filter(c => c.status === 'Pendente').length;
    const cv = t - p;
    const tx = (t === 0) ? 0 : (cv / t) * 100;

    document.getElementById('stat-total').textContent = t;
    document.getElementById('stat-pendente').textContent = p;
    document.getElementById('stat-convertida').textContent = cv;
    document.getElementById('stat-taxa').textContent = `${tx.toFixed(0)}%`;

    const f = document.getElementById('filtro-status-cotacao').value;
    const lC = document.getElementById('lista-cotacoes');
    lC.innerHTML = '';
    const cF = (f === 'Todos') ? cS : cS.filter(c => c.status === f);

    if (cF.length === 0) {
        lC.innerHTML = '<p class="text-gray-400 text-center p-6 text-sm">📋 Nenhuma cotação encontrada para este status.</p>';
        return;
    }
    cF.slice().reverse().forEach(c => {
        const sC = c.status === 'Pendente' ? 'bg-yellow-500' : 'bg-green-500';
        lC.innerHTML += `
            <div class="custom-card rounded-lg p-4 hover:shadow-md transition-shadow duration-150">
                <div class="flex justify-between items-start mb-2">
                    <div class="mr-4">
                        <h4 class="text-base font-bold text-white mb-0.5">${c.id}</h4>
                        <p class="text-gray-300 text-xs">Cli: ${c.cliente || 'N/I'}</p>
                        <p class="text-gray-400 text-xs">Data: ${formatarData(new Date(c.dataGeracao))}</p>
                    </div>
                    <div class="text-right flex-shrink-0">
                        <span class="${sC} text-white px-2 py-0.5 rounded-full text-xs font-medium">${c.status}</span>
                        <p class="text-lg font-bold text-white mt-1">${c.totalGeral}</p>
                    </div>
                </div>
                <div class="flex flex-wrap gap-1.5 mt-2">
                    <button onclick="verDetalhesCotacao('${c.id}')" class="bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded text-xs">👁️</button>
                    ${c.status === 'Pendente' ? `<button onclick="alterarStatusCotacao('${c.id}', 'Convertida')" class="bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded text-xs">✅</button>` : ''}
                    ${c.status === 'Convertida' ? `<button onclick="alterarStatusCotacao('${c.id}', 'Pendente')" class="bg-yellow-600 hover:bg-yellow-700 text-white px-2 py-1 rounded text-xs">⏳</button>` : ''}
                    <button onclick="abrirModalConfirmacao('Tem certeza que deseja excluir a cotação ${c.id}?', () => confirmarExclusaoCotacao('${c.id}'))" class="bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded text-xs">🗑️</button>
                </div>
            </div>`;
    });
}
function alterarStatusCotacao(id, nS) {
    const idx = cotacoes.findIndex(c => c.id === id);
    if (idx === -1) return;
    cotacoes[idx].status = nS;
    salvarDados('cotacoes', cotacoes);
    renderizarCotacoes();
    if (!document.getElementById('dashboard-page')?.classList.contains('hidden')) calcularDashboard();
    mostrarNotificacao(`Status da cotação ${id} alterado para ${nS}!`, 'success');
}
function confirmarExclusaoCotacao(id) {
    cotacoes = cotacoes.filter(c => c.id !== id);
    salvarDados('cotacoes', cotacoes);
    renderizarCotacoes();
    if (!document.getElementById('dashboard-page')?.classList.contains('hidden')) calcularDashboard();
    mostrarNotificacao(`Cotação ${id} excluída!`, 'success');
    fecharModal();
}
function verDetalhesCotacao(id) {
    const c = cotacoes.find(x => x.id === id);
    if (!c) return;
    const dG = formatarData(new Date(c.dataGeracao));
    const dV = formatarData(new Date(c.dataValidade)).split(',')[0];
    let txt = `ORÇAMENTO #${c.id} – ${dG} (Válido até ${dV})\n\n`;
    txt += `Cliente: ${c.cliente} – WhatsApp: ${c.whatsapp}\nLocal: ${c.local}\n\nItens:\n`;
    c.itens.forEach(i => { txt += ` • ${i.nome} (${i.sku}) - ${i.quantidade}x ${formatarMoeda(i.precoVenda)} = ${formatarMoeda(i.precoVenda * i.quantidade)}\n`; });
    txt += `\nTotais:\n • Produtos: ${c.subtotal}\n • Descontos: ${c.descontos.replace('-','')}\n • Frete: ${c.frete}\n • TOTAL: ${c.totalGeral}\n\nStatus: ${c.status}`;
    abrirModalDetalhes("Detalhes Cotação " + c.id, txt);
}


// --- Lojas --- (REMOVIDO - Lógica agora está no Modal de Precificação)
// As funções renderizarProdutosLojas, recalcularCardProduto, etc., foram removidas.


// --- Kits ---
// ... (código dos Kits - inicializarPaginaKits, etc - permanece o mesmo) ...
function inicializarPaginaKits() {
    carregarProdutosParaKitSelect();
    renderizarListaKits();
    document.getElementById('filtro-kits').addEventListener('input', renderizarListaKits);
}
function carregarProdutosParaKitSelect(filtro = '') {
    const sel = document.getElementById('kit-produtos-select');
    const vAt = sel.value;
    sel.innerHTML = '<option value="">Selecione...</option>';
    const pF = produtos.filter(p => p.nome.toLowerCase().includes(filtro) || p.sku.toLowerCase().includes(filtro));
    pF.forEach(p => {
        const o = document.createElement('option');
        o.value = p.id;
        o.textContent = `${p.nome} (${p.sku})`;
        sel.appendChild(o);
    });
    sel.value = vAt;
}
function filtrarProdutosParaKit() {
    const f = document.getElementById('filtro-produtos-kit').value.toLowerCase();
    carregarProdutosParaKitSelect(f);
}
function adicionarProdutoAoKit() {
    const sel = document.getElementById('kit-produtos-select');
    const pId = parseInt(sel.value);
    if (!pId) { mostrarNotificacao('Selecione um produto para adicionar!', 'error'); return; }
    const p = produtos.find(x => x.id === pId);
    if (!p) { mostrarNotificacao('Produto não encontrado!', 'error'); return; }
    if (kitProdutosTemporario.find(x => x.id === pId)) { mostrarNotificacao('Este produto já foi adicionado ao kit!', 'error'); return; }
    kitProdutosTemporario.push(p);
    renderizarProdutosDoKit();
    sel.value = '';
    mostrarNotificacao('Produto adicionado ao kit!', 'success');
    document.getElementById('filtro-produtos-kit').value = '';
    carregarProdutosParaKitSelect();
}
function renderizarProdutosDoKit() {
    const cont = document.getElementById('kit-produtos-lista');
    cont.innerHTML = '';
    let cT = 0;
    if (kitProdutosTemporario.length === 0) {
        cont.innerHTML = '<p class="text-gray-400 text-center text-xs">Nenhum produto adicionado.</p>';
    } else {
        kitProdutosTemporario.forEach(p => {
            cT += p.custo + p.picking;
            cont.innerHTML += `<div class="flex justify-between items-center p-1 bg-gray-700 rounded border border-gray-600 text-xs"><span class="truncate pr-2">${p.nome} (${p.sku})</span><button type="button" onclick="removerProdutoDoKit(${p.id})" class="text-red-400 hover:text-red-300 ml-1 p-0.5 text-xs">✕</button></div>`;
        });
    }
    document.getElementById('kit-custo-total').textContent = formatarMoeda(cT);
}
function removerProdutoDoKit(pId) {
    kitProdutosTemporario = kitProdutosTemporario.filter(p => p.id !== pId);
    renderizarProdutosDoKit();
    mostrarNotificacao('Produto removido do kit!', 'success');
}
function handleSalvarKit(e) {
    e.preventDefault();
    const kId = document.getElementById('kit-id').value;
    const nK = document.getElementById('kit-nome').value.trim();
    const pVK = parseFloat(document.getElementById('kit-preco-venda').value);

    if (!nK || !pVK || pVK <= 0 || kitProdutosTemporario.length === 0) {
        mostrarNotificacao('Preencha o nome, preço de venda (>0) e adicione pelo menos um produto ao kit!', 'error');
        return;
    }

    const cTK = kitProdutosTemporario.reduce((a, p) => a + p.custo + p.picking, 0);
    const nKi = { id: kId ? parseInt(kId) : Date.now(), nome: nK, produtos: [...kitProdutosTemporario], precoVenda: pVK, custoTotal: cTK };

    if (kId) {
        const i = kits.findIndex(k => k.id === parseInt(kId));
        if (i !== -1) kits[i] = nKi;
    } else {
        kits.push(nKi);
    }

    salvarDados('kits', kits);
    limparFormularioKit();
    renderizarListaKits();
    mostrarNotificacao(kId ? 'Kit atualizado com sucesso!' : 'Kit salvo com sucesso!', 'success');
    // REMOVIDO: if (document.getElementById('lojas-page')?.offsetParent !== null) renderizarProdutosLojas();
}
function limparFormularioKit() {
    document.getElementById('kit-form').reset();
    document.getElementById('kit-id').value = '';
    document.getElementById('kit-preco-venda').value = '0.00';
    document.getElementById('kit-form-titulo').innerHTML = '🧩 Novo Kit';
    kitProdutosTemporario = [];
    renderizarProdutosDoKit();
    document.getElementById('filtro-produtos-kit').value = '';
    carregarProdutosParaKitSelect();
}
function renderizarListaKits() {
    const f = document.getElementById('filtro-kits').value.toLowerCase();
    const cont = document.getElementById('kits-lista-container');
    cont.innerHTML = '';
    const kF = kits.filter(k => k.nome.toLowerCase().includes(f));
    if (kF.length === 0) {
        cont.innerHTML = '<p class="text-gray-400 text-center py-10">Nenhum kit encontrado.</p>';
        return;
    }
    kF.forEach(k => {
        const lK = k.precoVenda - k.custoTotal;
        const mK = (k.precoVenda > 0) ? ((lK / k.precoVenda) * 100) : 0;
        cont.innerHTML += `
            <div class="custom-card rounded-lg p-3">
                <div class="flex justify-between items-start mb-1.5">
                    <div class="flex-1 mr-3">
                        <h4 class="text-sm font-bold text-white mb-0.5 truncate">${k.nome}</h4>
                        <p class="text-gray-400 text-xs">${k.produtos.length} produto(s)</p>
                    </div>
                    <div class="text-right flex-shrink-0">
                        <p class="text-base font-bold text-green-400">${formatarMoeda(k.precoVenda)}</p>
                        <p class="text-xs ${lK >= 0 ? 'text-green-400' : 'text-red-400'}">Lucro Dir: ${formatarMoeda(lK)} (${mK.toFixed(1)}%)</p>
                    </div>
                </div>
                <div class="mb-2 p-1.5 bg-gray-800 rounded text-xs">
                     <p>Custo Total: ${formatarMoeda(k.custoTotal)}</p>
                </div>
                <div class="flex gap-1.5">
                    <button onclick="mostrarDetalhesKit(${k.id})" class="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded text-xs">👁️</button>
                    <button onclick="adicionarKitAoCarrinho(${k.id})" class="flex-1 bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded text-xs">🛒</button>
                    <button onclick="editarKit(${k.id})" class="flex-1 custom-accent custom-accent-hover text-white px-2 py-1 rounded text-xs">✏️</button>
                    <button onclick="excluirKit(${k.id})" class="flex-1 bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded text-xs">🗑️</button>
                </div>
            </div>`;
    });
}
function mostrarDetalhesKit(id) {
    const k = kits.find(x => x.id === id);
    if (!k) return;
    let dH = `<p class="mb-2 text-sm"><strong>Custo Total:</strong> ${formatarMoeda(k.custoTotal)}</p><p class="mb-3 text-sm"><strong>Preço Venda Direta:</strong> ${formatarMoeda(k.precoVenda)}</p><strong class="block mb-1 text-sm">Produtos no Kit:</strong><ul class="list-disc list-inside space-y-1 text-xs max-h-48 overflow-y-auto bg-gray-800 p-2 rounded">`;
    k.produtos.forEach(p => { dH += `<li>${p.nome} (${p.sku}) - Custo Unit: ${formatarMoeda(p.custo+p.picking)}</li>`; });
    dH += `</ul>`;
    abrirModalDetalhes(`Detalhes do Kit: ${k.nome}`, dH, true);
}
function editarKit(id) {
    const k = kits.find(x => x.id === id);
    if (!k) return;
    document.getElementById('kit-id').value = k.id;
    document.getElementById('kit-nome').value = k.nome;
    document.getElementById('kit-preco-venda').value = k.precoVenda.toFixed(2);
    document.getElementById('kit-form-titulo').innerHTML = '✏️ Editando Kit';
    kitProdutosTemporario = [...k.produtos];
    renderizarProdutosDoKit();
}
function excluirKit(id) {
    abrirModalConfirmacao(`Tem certeza que deseja excluir este kit?`, () => confirmarExclusaoKit(id));
}
function confirmarExclusaoKit(id) {
    kits = kits.filter(k => k.id !== id);
    salvarDados('kits', kits);
    renderizarListaKits();
    fecharModal();
    mostrarNotificacao('Kit excluído com sucesso!', 'success');
    // REMOVIDO: if (document.getElementById('lojas-page')?.offsetParent !== null) renderizarProdutosLojas();
}
function adicionarKitAoCarrinho(id) {
    const k = kits.find(x => x.id === id);
    if (!k) { mostrarNotificacao('Kit não encontrado!', 'error'); return; }
    const i = carrinho.find(item => item.id === id && item.isKit);
    if (i) {
        i.quantidade++;
    } else {
        carrinho.push({
            id: k.id, sku: `KIT-${k.id}`, nome: `🧩 ${k.nome}`,
            categoria: 'Kit', fornecedor: 'Kit',
            custo: k.custoTotal, picking: 0,
            precoVenda: k.precoVenda,
            peso: k.produtos.reduce((a, p) => a + p.peso, 0),
            comprimento: 0, largura: 0, altura: 0,
            imagem: null,
            quantidade: 1, isKit: true
        });
    }
    salvarDados('carrinho', carrinho);
    mostrarNotificacao(`Kit ${k.nome} adicionado ao carrinho!`, 'success');
    renderizarCarrinho();
    abrirCarrinho();
}


// --- Marketing/Cupons ---
// ... (código dos Cupons - inicializarPaginaMarketing, etc - permanece o mesmo) ...
function inicializarPaginaMarketing() {
    renderizarListaCupons();
    atualizarEstatisticasCupons();
    document.getElementById('filtro-cupons').addEventListener('input', renderizarListaCupons);
}
function salvarCupom(e) {
    e.preventDefault();
    const cId = document.getElementById('cupom-id').value;
    const cod = document.getElementById('cupom-codigo').value.trim().toUpperCase();
    const tip = document.getElementById('cupom-tipo').value;
    const val = parseFloat(document.getElementById('cupom-valor').value);
    const lim = parseInt(document.getElementById('cupom-usos').value) || 0;
    const act = document.getElementById('cupom-ativo').checked;
    if (!cod || !tip || !val || val <= 0) { mostrarNotificacao('Verifique os campos obrigatórios (Código, Tipo, Valor > 0)!', 'error'); return; }
    const cEx = cupons.find(c => c.codigo === cod && c.id !== (cId ? parseInt(cId) : null));
    if (cEx) { mostrarNotificacao('Este código de cupom já está em uso!', 'error'); return; }
    let uA = 0;
    if (cId) {
        const cA = cupons.find(c => c.id === parseInt(cId));
        uA = cA ? cA.usosAtuais : 0;
    }
    const cup = { id: cId ? parseInt(cId) : Date.now(), codigo: cod, tipo: tip, valor: val, limitUsos: lim, usosAtuais: uA, ativo: act, dataCriacao: cId ? cupons.find(c => c.id === parseInt(cId))?.dataCriacao : new Date().toISOString() };
    if (cId) {
        const i = cupons.findIndex(c => c.id === parseInt(cId));
        if (i !== -1) cupons[i] = cup;
    } else {
        cupons.push(cup);
    }
    salvarDados('cupons', cupons);
    limparFormularioCupom();
    renderizarListaCupons();
    atualizarEstatisticasCupons();
    mostrarNotificacao(cId ? 'Cupom atualizado com sucesso!' : 'Cupom criado com sucesso!', 'success');
}
function limparFormularioCupom() {
    document.getElementById('cupom-form').reset();
    document.getElementById('cupom-id').value = '';
    document.getElementById('cupom-ativo').checked = true;
    document.getElementById('cupom-usos').value = '0';
    document.getElementById('cupom-form-titulo').innerHTML = '🎫 Novo Cupom';
}
function renderizarListaCupons() {
    const f = document.getElementById('filtro-cupons').value.toLowerCase();
    const cont = document.getElementById('lista-cupons');
    cont.innerHTML = '';
    const cF = cupons.filter(c => c.codigo.toLowerCase().includes(f));
    if (cF.length === 0) {
        cont.innerHTML = '<p class="text-gray-400 text-center py-10 text-sm">🎫 Nenhum cupom encontrado.</p>';
        return;
    }
    cF.forEach(c => {
        const sC = c.ativo ? 'bg-green-500' : 'bg-gray-500';
        const sT = c.ativo ? 'Ativo' : 'Inativo';
        const vF = c.tipo === 'fixo' ? formatarMoeda(c.valor) : `${c.valor.toFixed(2)}%`;
        const uE = c.limitUsos > 0 && c.usosAtuais >= c.limitUsos;
        const lT = c.limitUsos === 0 ? `(${c.usosAtuais})` : `(${c.usosAtuais}/${c.limitUsos})`;
        const uC = uE ? 'text-red-400' : 'text-white';
        cont.innerHTML += `
            <div class="custom-card rounded-lg p-3 flex justify-between items-center text-sm">
                <div class="flex-1">
                    <div class="flex items-center gap-2 mb-1">
                        <h4 class="font-bold text-white">${c.codigo}</h4>
                        <span class="${sC} text-white px-2 py-0.5 rounded-full text-xs">${sT}</span>
                    </div>
                    <p class="text-gray-300">Desconto: <span class="font-semibold">${vF}</span></p>
                    <p class="text-gray-300">Usos: <span class="${uC} font-semibold">${lT}</span> ${c.limitUsos === 0 ? 'Ilimitados' : ''}</p>
                </div>
                <div class="flex flex-col sm:flex-row gap-1 ml-2">
                    <button onclick="registrarUsoCupom(${c.id})" class="bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded text-xs ${uE || !c.ativo ? 'opacity-50 cursor-not-allowed' : ''}" ${uE || !c.ativo ? 'disabled' : ''}>+1 Uso</button>
                    <button onclick="editarCupom(${c.id})" class="custom-accent custom-accent-hover text-white px-2 py-1 rounded text-xs">✏️</button>
                    <button onclick="excluirCupom(${c.id})" class="bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded text-xs">🗑️</button>
                </div>
            </div>`;
    });
}
function registrarUsoCupom(id) {
    const i = cupons.findIndex(c => c.id === id);
    if (i === -1 || !cupons[i].ativo) return;
    if (cupons[i].limitUsos > 0 && cupons[i].usosAtuais >= cupons[i].limitUsos) {
        mostrarNotificacao(`Limite de usos para o cupom ${cupons[i].codigo} já foi atingido!`, 'error');
        return;
    }
    cupons[i].usosAtuais++;
    salvarDados('cupons', cupons);
    renderizarListaCupons();
    atualizarEstatisticasCupons();
    mostrarNotificacao(`Uso registrado para ${cupons[i].codigo}`, 'success');
}
function atualizarEstatisticasCupons() {
    const tC = cupons.length;
    const cF = cupons.filter(c => c.tipo === 'fixo').length;
    const cP = tC - cF;
    const tU = cupons.reduce((a, c) => a + c.usosAtuais, 0);
    document.getElementById('stat-cupom-total').textContent = tC;
    document.getElementById('stat-cupom-fixo').textContent = cF;
    document.getElementById('stat-cupom-percentual').textContent = cP;
    document.getElementById('stat-cupom-usos').textContent = tU;
}
function editarCupom(id) {
    const c = cupons.find(x => x.id === id);
    if (!c) return;
    document.getElementById('cupom-id').value = c.id;
    document.getElementById('cupom-codigo').value = c.codigo;
    document.getElementById('cupom-tipo').value = c.tipo;
    document.getElementById('cupom-valor').value = c.valor;
    document.getElementById('cupom-usos').value = c.limitUsos;
    document.getElementById('cupom-ativo').checked = c.ativo;
    document.getElementById('cupom-form-titulo').innerHTML = '✏️ Editando Cupom';
}
function excluirCupom(id) {
    abrirModalConfirmacao(`Tem certeza que deseja excluir este cupom?`, () => confirmarExclusaoCupom(id));
}
function confirmarExclusaoCupom(id) {
    cupons = cupons.filter(c => c.id !== id);
    salvarDados('cupons', cupons);
    renderizarListaCupons();
    atualizarEstatisticasCupons();
    fecharModal();
    mostrarNotificacao('Cupom excluído com sucesso!', 'success');
}

// --- Financeiro ---
// ... (código Financeiro - calcularEstatisticasFinanceiras - permanece o mesmo) ...
function calcularEstatisticasFinanceiras() {
    const cC = cotacoes.filter(c => c.status === 'Convertida');
    const h = new Date();
    const iD = new Date(h.getFullYear(), h.getMonth(), h.getDate());
    const iM = new Date(h.getFullYear(), h.getMonth(), 1);
    const vH = cC.filter(c => new Date(c.dataGeracao) >= iD).reduce((a, c) => a + (parseFloat(c.totalGeral.replace(/[^0-9,-]+/g,"").replace(",",".")) || 0), 0);
    const vM = cC.filter(c => new Date(c.dataGeracao) >= iM).reduce((a, c) => a + (parseFloat(c.totalGeral.replace(/[^0-9,-]+/g,"").replace(",",".")) || 0), 0);
    let lT = 0;
    cC.forEach(ct => {
        ct.itens.forEach(it => {
            const cI = it.isKit ? it.custo : (it.custo + it.picking);
            lT += (it.precoVenda - cI) * it.quantidade;
        });
        lT += (parseFloat(ct.frete.replace(/[^0-9,-]+/g,"").replace(",",".")) || 0);
        lT -= (parseFloat(ct.descontos.replace(/[^0-9,-]+/g,"").replace(",",".")) || 0);
    });
    document.getElementById('financeiro-vendas-hoje').textContent = formatarMoeda(vH);
    document.getElementById('financeiro-vendas-mes').textContent = formatarMoeda(vM);
    document.getElementById('financeiro-lucro-total').textContent = formatarMoeda(lT);
}


// --- Auxiliares ---
// ... (código Auxiliares - formatarMoeda, formatarData, formatarTelefone - permanece o mesmo) ...
function formatarMoeda(valor) {
    return (valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function formatarData(data) {
    if(!data || !(data instanceof Date)) return '-';
    return data.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function formatarTelefone(tel) {
    if (!tel) return "N/I";
    return tel.replace(/\D/g,'');
}

// --- Modais --- (Mantém abrirModalConfirmacao e abrirModalDetalhes)
// ... (código dos Modais antigos - abrirModalConfirmacao, abrirModalDetalhes, fecharModal - permanece o mesmo) ...
function abrirModalConfirmacao(msg, callback) {
    fecharModal(); // Fecha qualquer modal anterior (confirmação ou detalhes)
    fecharModalPrecificacao(); // Fecha modal de precificação também
    const m = document.createElement('div');
    m.id = 'modal-confirmacao';
    m.className = 'fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[1060] p-4';
    m.innerHTML = `
        <div class="custom-card rounded-lg p-6 max-w-xs w-full mx-auto">
            <h3 class="text-base font-bold text-white mb-3">Confirmação</h3>
            <p class="text-gray-300 mb-5 text-sm">${msg}</p>
            <div class="flex gap-2">
                <button id="modal-confirmar-btn" class="flex-1 bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded font-medium text-xs">Confirmar</button>
                <button type="button" onclick="fecharModal()" class="flex-1 bg-gray-600 hover:bg-gray-700 text-white px-3 py-1.5 rounded font-medium text-xs">Cancelar</button>
            </div>
        </div>`;
    document.body.appendChild(m);
    document.getElementById('modal-confirmar-btn').onclick = callback;
    modalAtual = m; // Guarda referência do modal de confirmação/detalhes
}
function abrirModalDetalhes(titulo, conteudo, html = false) {
    fecharModal();
    fecharModalPrecificacao();
    const m = document.createElement('div');
    m.id = 'modal-detalhes';
    m.className = 'fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[1060] p-4';
    const cCont = document.createElement('div');
    cCont.className = "w-full max-h-[60vh] overflow-y-auto p-3 bg-gray-800 border border-gray-600 rounded text-gray-200 text-xs whitespace-pre-wrap";
    if (html) cCont.innerHTML = conteudo;
    else cCont.textContent = conteudo;
    m.innerHTML = `
        <div class="custom-card rounded-lg p-5 max-w-md w-full mx-auto flex flex-col">
            <div class="flex justify-between items-center mb-3">
                <h3 class="text-base font-bold text-white">${titulo}</h3>
                <button type="button" onclick="fecharModal()" class="text-gray-400 hover:text-white text-2xl">&times;</button>
            </div>
            ${cCont.outerHTML}
            <div class="flex gap-3 mt-3">
                <button type="button" onclick="fecharModal()" class="flex-1 custom-accent custom-accent-hover text-white px-3 py-1.5 rounded font-medium text-xs">Fechar</button>
            </div>
        </div>`;
    document.body.appendChild(m);
    modalAtual = m;
}
function fecharModal() { // Fecha modais de confirmação/detalhes
    if (modalAtual) {
        modalAtual.remove();
        modalAtual = null;
    }
}


// --- NOVO: Funções do Modal de Precificação ---

function abrirModalPrecificacao(produtoId) {
    fecharModal(); // Fecha outros modais
    fecharModalPrecificacao(); // Fecha se já houver um aberto

    const produto = produtos.find(p => p.id === produtoId);
    if (!produto) {
        mostrarNotificacao('Produto não encontrado para precificação.', 'error');
        return;
    }

    const custoTotalProduto = produto.custo + produto.picking;
    const idBase = produto.id; // Usaremos apenas o ID do produto para os elementos globais do modal

    // --- Criação do HTML do Modal ---
    const overlay = document.createElement('div');
    overlay.id = 'modal-precificacao-overlay';
    overlay.className = 'modal-precificacao-overlay'; // Começa invisível

    let modalHTML = `
        <div class="modal-precificacao" id="modal-precificacao-${idBase}">
            <div class="modal-precificacao-header">
                <h3 class="modal-precificacao-title" title="Precificação: ${produto.nome}">Precificação: ${produto.nome}</h3>
                <button type="button" class="modal-precificacao-close-btn" onclick="fecharModalPrecificacao()">&times;</button>
            </div>
            <div class="modal-precificacao-content">
                <div class="modal-product-header">
                    <img src="${produto.imagem || 'https://via.placeholder.com/80'}" alt="${produto.nome}" class="modal-product-image" onerror="this.src='https://via.placeholder.com/80';">
                    <div class="modal-product-info">
                        <p><span>SKU:</span> <strong>${produto.sku}</strong></p>
                        <p><span>Custo Total (Produto+Picking):</span> <strong class="text-red-400">${formatarMoeda(custoTotalProduto)}</strong></p>
                        <p><span>Venda Direta Sugerida:</span> <strong>${formatarMoeda(produto.precoVenda)}</strong></p>
                        <p><span>Lucro Venda Direta:</span> <strong class="${(produto.precoVenda - custoTotalProduto) >= 0 ? 'text-green-400' : 'text-red-400'}">${formatarMoeda(produto.precoVenda - custoTotalProduto)}</strong></p>
                    </div>
                </div>

                <h4 class="text-center text-sm font-semibold text-gray-400 mb-4 uppercase tracking-wider">Precificação por Marketplace</h4>
    `;

    // Loop para criar um card de loja para cada marketplace
    Object.keys(lojasConfig).forEach(key => {
        const loja = lojasConfig[key];
        const idLoja = `${key}-${idBase}`; // ID único para elementos desta loja neste modal

        modalHTML += `
            <div class="modal-store-card">
                <div class="store-card-header">
                    <div class="store-info">
                        <img src="assets/logos/${loja.logo}" alt="${loja.nome}" class="store-logo" onerror="this.onerror=null; this.src='https://via.placeholder.com/24/0F172A/94a3b8?text=${loja.nome[0]}';">
                        <span class="store-name">${loja.nome}</span>
                    </div>
                    <span class="store-config">${(loja.comissao * 100).toFixed(1)}% + ${formatarMoeda(loja.taxaFixa)}</span>
                </div>
                <div class="store-pricing-body">
                    <div class="store-pricing-row">
                        <label for="lucro-desejado-${idLoja}" class="store-pricing-label">Lucro Desejado (R$):</label>
                        <input type="number" step="0.01" value="10.00" id="lucro-desejado-${idLoja}" class="store-input" oninput="calcularPrecoLojaModal('${key}', ${idBase}, 'lucro_loja')">
                    </div>
                     <div class="store-pricing-row ideal-price-row">
                        <span class="store-pricing-label">Preço Ideal Sugerido:</span>
                        <span class="store-pricing-value" id="preco-ideal-${idLoja}">R$ 0,00</span>
                    </div>
                    <div class="store-pricing-row">
                        <span class="store-pricing-label">↳ Comissão (${(loja.comissao * 100).toFixed(1)}%):</span>
                        <span class="store-pricing-value store-pricing-detail" id="comissao-valor-${idLoja}">R$ 0,00</span>
                    </div>
                    <div class="store-pricing-row">
                        <span class="store-pricing-label">↳ Taxa Fixa:</span>
                        <span class="store-pricing-value store-pricing-detail" id="taxa-fixa-valor-${idLoja}">R$ 0,00</span>
                    </div>
                    <div class="store-pricing-row final-price-row">
                         <label for="preco-final-${idLoja}" class="store-pricing-label">Preço Final (R$):</label>
                        <input type="number" step="0.01" value="0.00" id="preco-final-${idLoja}" class="store-input" oninput="calcularPrecoLojaModal('${key}', ${idBase}, 'preco_final')">
                    </div>
                    <div class="store-pricing-row final-result-row">
                        <span class="store-pricing-label">↳ Lucro Real (Margem):</span>
                        <span class="store-pricing-value" id="lucro-real-${idLoja}">R$ 0,00 (<span id="margem-real-${idLoja}">0,0%</span>)</span>
                    </div>
                </div>
            </div>`;
    });

    modalHTML += `
            </div> {/* Fim modal-precificacao-content */}
            <div class="modal-precificacao-footer">
                <button type="button" class="modal-close-button" onclick="fecharModalPrecificacao()">Fechar</button>
            </div>
        </div> {/* Fim modal-precificacao */}
    `;

    overlay.innerHTML = modalHTML;
    document.body.appendChild(overlay);

    // Adiciona a classe 'show' após um pequeno delay para a transição funcionar
    setTimeout(() => overlay.classList.add('show'), 10);
    modalPrecificacaoAberto = true;

    // Calcula os preços iniciais para todas as lojas no modal
    Object.keys(lojasConfig).forEach(key => {
        calcularPrecoLojaModal(key, idBase, 'init'); // Trigger inicial
    });
}

function fecharModalPrecificacao() {
    const overlay = document.getElementById('modal-precificacao-overlay');
    if (overlay) {
        overlay.classList.remove('show');
        // Remove o elemento após a transição
        setTimeout(() => {
             if (overlay) overlay.remove(); // Verifica se ainda existe
             modalPrecificacaoAberto = false;
         }, 300); // Tempo igual à transição do CSS
    } else {
        modalPrecificacaoAberto = false; // Garante que a flag esteja correta
    }
}

// NOVA FUNÇÃO: Calcula o preço para UMA loja DENTRO do modal
function calcularPrecoLojaModal(lojaKey, produtoId, trigger) {
    const produto = produtos.find(p => p.id === produtoId);
    if (!produto) return; // Segurança

    const cfg = lojasConfig[lojaKey];
    const idLoja = `${lojaKey}-${produtoId}`; // ID base para os elementos desta loja

    // 1. Encontrar elementos DENTRO DO MODAL
    const lucroDesejadoInput = document.getElementById(`lucro-desejado-${idLoja}`);
    const precoFinalInput = document.getElementById(`preco-final-${idLoja}`);
    const precoIdealSpan = document.getElementById(`preco-ideal-${idLoja}`);
    const comissaoValorSpan = document.getElementById(`comissao-valor-${idLoja}`);
    const taxaFixaValorSpan = document.getElementById(`taxa-fixa-valor-${idLoja}`);
    const lucroRealSpan = document.getElementById(`lucro-real-${idLoja}`);
    const margemRealSpan = document.getElementById(`margem-real-${idLoja}`);

    // Verifica se todos os elementos foram encontrados (importante!)
    if (!lucroDesejadoInput || !precoFinalInput || !precoIdealSpan || !comissaoValorSpan || !taxaFixaValorSpan || !lucroRealSpan || !margemRealSpan) {
        console.error(`Erro: Elementos não encontrados no modal para loja ${lojaKey}, produto ${produtoId}`);
        return;
    }

    // 2. Obter Valores
    const custoTotalProduto = produto.custo + produto.picking;
    const lucroDesejado = parseFloat(lucroDesejadoInput.value) || 0;

    // 3. Calcular Preço Ideal
    const subtotalParaCalculo = custoTotalProduto + lucroDesejado + cfg.taxaFixa;
    const precoIdeal = (cfg.comissao < 1) ? subtotalParaCalculo / (1 - cfg.comissao) : subtotalParaCalculo;

    // 4. Calcular Taxas sobre o Preço Ideal
    const comissaoValorIdeal = precoIdeal * cfg.comissao;
    const taxaFixaValor = cfg.taxaFixa;

    // 5. Atualizar Spans do Preço Ideal e Taxas
    precoIdealSpan.textContent = formatarMoeda(precoIdeal);
    comissaoValorSpan.textContent = formatarMoeda(comissaoValorIdeal);
    taxaFixaValorSpan.textContent = formatarMoeda(taxaFixaValor);

    // 6. Atualizar Preço Final se o gatilho não foi ele mesmo
    if (trigger === 'init' || trigger === 'lucro_loja') {
        precoFinalInput.value = precoIdeal.toFixed(2);
    }

    // 7. Calcular Lucro/Margem Reais com base no Preço Final
    const precoFinalAjustado = parseFloat(precoFinalInput.value) || 0;
    const comissaoReal = precoFinalAjustado * cfg.comissao;
    const receitaLiquida = precoFinalAjustado - comissaoReal - cfg.taxaFixa;
    const lucroReal = receitaLiquida - custoTotalProduto; // Lucro antes de frete embutido (simplificado aqui)
    const margemReal = (precoFinalAjustado > 0) ? (lucroReal / precoFinalAjustado * 100) : 0;

    // 8. Atualizar Spans de Lucro/Margem Reais
    const lucroRealFormatado = formatarMoeda(lucroReal);
    const margemRealFormatada = `${margemReal.toFixed(1).replace('.', ',')}%`;

    lucroRealSpan.textContent = `${lucroRealFormatado} (${margemRealFormatada})`; // Combina na mesma linha
    margemRealSpan.textContent = margemRealFormatada; // Mantém separado se precisar

    // Aplica classes de cor ao valor do lucro real
    const lucroRealElement = lucroRealSpan; // O span principal
    lucroRealElement.classList.remove('profit-positive', 'profit-negative'); // Remove classes antigas
    if (lucroReal > 0) {
        lucroRealElement.classList.add('profit-positive');
    } else if (lucroReal < 0) {
        lucroRealElement.classList.add('profit-negative');
    }
}


// --- Sistema de Notificações ---
// ... (código das Notificações - mostrarNotificacao - permanece o mesmo) ...
function mostrarNotificacao(msg, tipo = 'success') {
    const el = document.getElementById('notification');
    const txt = document.getElementById('notification-text');
    if (!el || !txt) return;

    txt.textContent = msg;
    el.className = 'notification px-4 py-2 rounded-md shadow-lg text-sm font-medium';

    if (tipo === 'success') el.classList.add('bg-green-600', 'text-white');
    else if (tipo === 'error') el.classList.add('bg-red-600', 'text-white');
    else el.classList.add('bg-blue-600', 'text-white');

    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 3000);
}
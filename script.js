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
let modalAtual = null;

// --- Configurações de Lojas (Constante) ---
// Certifique-se que os nomes dos logos correspondem aos arquivos em assets/logos/
const lojasConfig = {
    shopee: { nome: "Shopee", taxaFixa: 5.00, comissao: 0.20, logo: 'shopee-logo.svg' },
    ml_premium: { nome: "ML Premium", taxaFixa: 6.00, comissao: 0.165, logo: 'ml-logo.svg' },
    amazon: { nome: "Amazon", taxaFixa: 2.00, comissao: 0.14, logo: 'amazon-logo.svg' },
    tiktok: { nome: "TikTok Shop", taxaFixa: 2.00, comissao: 0.06, logo: 'tiktok-logo.svg' },
    facebook: { nome: "Facebook", taxaFixa: 0.00, comissao: 0.00, logo: 'facebook-logo.svg' }, // Sem taxas
    whatsapp: { nome: "WhatsApp", taxaFixa: 0.00, comissao: 0.00, logo: 'whatsapp-logo.svg' }, // Sem taxas
};

// --- Função Helper para Salvar ---
function salvarDados(chave, dados) {
    localStorage.setItem(chave, JSON.stringify(dados));
}

// --- Inicialização ---
document.addEventListener('DOMContentLoaded', () => {
    atualizarDropdownFornecedores();
    renderizarCarrinho();
    showPage('dashboard'); // Começa no dashboard

    // --- Event Listeners ---
    document.getElementById('carrinho-descontos').addEventListener('input', calcularTotais);
    document.getElementById('carrinho-frete').addEventListener('input', calcularTotais);
    document.getElementById('filtro-status-cotacao').addEventListener('change', renderizarCotacoes);
    document.getElementById('produto-form').addEventListener('submit', handleSalvarProduto);
    document.getElementById('novo-fornecedor').addEventListener('keypress', (e) => { if (e.key === 'Enter') adicionarFornecedor(); });
    document.getElementById('kit-form').addEventListener('submit', handleSalvarKit);
    document.getElementById('filtro-produtos-kit').addEventListener('input', filtrarProdutosParaKit);
    document.getElementById('cupom-form').addEventListener('submit', salvarCupom);
    document.getElementById('filtro-lojas').addEventListener('input', renderizarProdutosLojas); // Filtro da aba Lojas
    document.getElementById('produto-imagem').addEventListener('change', previewImagemProduto);
});

// --- Navegação e Exibição ---
function showPage(pageId) {
    document.querySelectorAll('.page-content').forEach(page => page.classList.add('hidden'));
    document.getElementById(pageId + '-page')?.classList.remove('hidden');

    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('onclick')?.includes(`showPage('${pageId}')`)) item.classList.add('active');
    });

    const mainContent = document.querySelector('main');
    if (mainContent) mainContent.scrollTop = 0; // Rola para o topo ao mudar de página

    // Lógica específica ao carregar cada página
    switch (pageId) {
        case 'dashboard': calcularDashboard(); break;
        case 'produtos': if (!produtoEditId) limparFormularioProduto(); break; // Limpa se não estiver editando
        case 'catalogo': carregarFiltrosCatalogo(); aplicarFiltros(); break; // Carrega filtros e busca
        case 'cotacoes': renderizarCotacoes(); break;
        case 'lojas': renderizarProdutosLojas(); break; // Renderiza a aba de lojas
        case 'kits': inicializarPaginaKits(); break;
        case 'financeiro': calcularEstatisticasFinanceiras(); break;
        case 'marketing': inicializarPaginaMarketing(); break;
    }
    fecharCarrinho(); // Fecha o carrinho ao navegar
}
function irParaCadastroProduto() { showPage('produtos'); limparFormularioProduto(); }

// --- Dashboard ---
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
    const totalProdutos = produtos.length;

    document.getElementById('dash-vendas-mes').textContent = formatarMoeda(vendasMes);
    document.getElementById('dash-lucro-mes').textContent = formatarMoeda(lucroMes);
    document.getElementById('dash-cotacoes-pendentes').textContent = cotacoesPendentes;
    document.getElementById('dash-total-produtos').textContent = totalProdutos;
    renderizarCotacoesPendentesDashboard();
}

function renderizarCotacoesPendentesDashboard() {
    const cotacoesPendentes = cotacoes.filter(c => c.status === 'Pendente');
    const listaContainer = document.getElementById('dash-lista-cotacoes');
    listaContainer.innerHTML = '';

    if (cotacoesPendentes.length === 0) {
        listaContainer.innerHTML = '<p class="text-gray-400 text-center p-4">🎉 Nenhuma cotação pendente!</p>';
        return;
    }
    cotacoesPendentes.slice(-5).reverse().forEach(cotacao => { // Mostra as 5 últimas pendentes
        listaContainer.innerHTML += `<div class="bg-gray-800 rounded-lg p-4 flex justify-between items-center"><div><h4 class="text-white font-bold">${cotacao.id}</h4><p class="text-gray-300 text-sm">${cotacao.cliente} - ${cotacao.local}</p><p class="text-gray-400 text-xs">${formatarData(new Date(cotacao.dataGeracao))}</p></div><div class="text-right"><p class="text-white font-bold text-lg">${cotacao.totalGeral}</p><button onclick="alterarStatusCotacao('${cotacao.id}', 'Convertida')" class="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm mt-1">✅ Converter</button></div></div>`;
    });
}

// --- Fornecedores ---
function carregarFornecedoresSelect(selectId) {
    const select = document.getElementById(selectId);
    if (!select) return;
    const valorAtual = select.value; // Guarda o valor selecionado antes de limpar
    select.innerHTML = `<option value="">Selecione...</option>`; // Limpa e adiciona a opção padrão
    fornecedores.forEach(f => {
        const option = document.createElement('option');
        option.value = f;
        option.textContent = f;
        select.appendChild(option);
    });
    select.value = valorAtual; // Restaura o valor selecionado se ainda existir
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
    input.value = ''; // Limpa o campo
    mostrarNotificacao('Fornecedor adicionado com sucesso!', 'success');
}
function removerFornecedor() {
    const select = document.getElementById('fornecedores-select');
    const selecionado = select.value;
    if (!selecionado) { mostrarNotificacao('Selecione um fornecedor para remover!', 'error'); return; }
    // Verifica se algum produto usa este fornecedor
    if (produtos.some(p => p.fornecedor === selecionado)) {
        mostrarNotificacao('Não é possível remover: existem produtos associados a este fornecedor!', 'error');
        return;
    }
    fornecedores = fornecedores.filter(f => f !== selecionado); // Remove da lista
    salvarDados('fornecedores', fornecedores);
    atualizarDropdownFornecedores(); // Atualiza os selects
    mostrarNotificacao('Fornecedor removido com sucesso!', 'success');
}

// --- Produtos ---
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

    // Validação básica
    if (!produtoData.sku || !produtoData.nome || !produtoData.categoria || !produtoData.fornecedor || produtoData.custo < 0 || produtoData.peso <= 0) {
        mostrarNotificacao('Preencha os campos obrigatórios (*) com valores válidos!', 'error');
        return;
    }

    const salvar = (imageUrl) => {
        produtoData.imagem = imageUrl; // Define a imagem (pode ser null ou a URL base64)
        if (produtoEditId) { // Editando produto existente
            const index = produtos.findIndex(p => p.id === produtoEditId);
            if (index !== -1) {
                // Mantém a imagem antiga se nenhuma nova foi selecionada na edição
                if (!imageUrl && produtos[index].imagem) {
                    produtoData.imagem = produtos[index].imagem;
                }
                produtos[index] = { ...produtos[index], ...produtoData, dataAtualizacao: new Date().toISOString() };
                mostrarNotificacao('Produto atualizado com sucesso!', 'success');
            }
        } else { // Criando novo produto
            produtoData.id = Date.now(); // ID simples baseado no timestamp
            produtoData.dataCadastro = new Date().toISOString();
            produtos.push(produtoData);
            mostrarNotificacao('Produto salvo com sucesso!', 'success');
        }
        salvarDados('produtos', produtos); // Salva no localStorage
        limparFormularioProduto(); // Limpa o formulário
        showPage('catalogo'); // Vai para a página do catálogo
    };

    if (file) { // Se um arquivo foi selecionado
        const reader = new FileReader();
        reader.onload = (e) => salvar(e.target.result); // Converte para base64 e salva
        reader.readAsDataURL(file);
    } else {
        // Salva sem imagem nova (mantém a antiga se editando, ou null se criando)
        salvar(produtoEditId ? (produtos.find(p=>p.id===produtoEditId)?.imagem || null) : null);
    }
}

function editarProduto(id) {
    const produto = produtos.find(p => p.id === id);
    if (!produto) return;
    produtoEditId = id; // Define o ID que está sendo editado

    // Preenche o formulário com os dados do produto
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

    // Exibe a imagem existente (se houver)
    const imgPreview = document.getElementById('produto-imagem-preview');
    if (produto.imagem) {
        imgPreview.src = produto.imagem;
        imgPreview.classList.remove('hidden');
    } else {
        imgPreview.classList.add('hidden');
    }
    document.getElementById('produto-imagem').value = ''; // Limpa o input de arquivo

    document.getElementById('produto-form-titulo').innerHTML = `<span class="mr-2">✏️</span> Editando Produto`;
    showPage('produtos'); // Muda para a página de produtos (formulário)
}

function limparFormularioProduto() {
    produtoEditId = null; // Limpa o ID de edição
    document.getElementById('produto-form').reset(); // Reseta os campos do formulário
    document.getElementById('produto-id-edit').value = ''; // Limpa o campo oculto do ID

    // Define valores padrão para campos numéricos específicos
    Object.assign(document.getElementById('produto-custo'), {value: '0.00'});
    Object.assign(document.getElementById('produto-picking'), {value: '2.00'}); // Valor padrão comum
    Object.assign(document.getElementById('produto-preco-venda'), {value: '0.00'});
    Object.assign(document.getElementById('produto-peso'), {value: '0.00'});
    Object.assign(document.getElementById('produto-comprimento'), {value: '0'});
    Object.assign(document.getElementById('produto-largura'), {value: '0'});
    Object.assign(document.getElementById('produto-altura'), {value: '0'});

    // Esconde o preview da imagem
    const imgPreview = document.getElementById('produto-imagem-preview');
    imgPreview.classList.add('hidden');
    imgPreview.src = '#';
    document.getElementById('produto-form-titulo').innerHTML = `<span class="mr-2">📦</span> Cadastrar Novo Produto`; // Restaura o título
    // Remove bordas de erro (se houver)
    document.querySelectorAll('#produto-form .border-red-500').forEach(el => el.classList.remove('border-red-500'));
}

function previewImagemProduto(event) {
    const reader = new FileReader();
    const imgPreview = document.getElementById('produto-imagem-preview');
    reader.onload = function(){
        imgPreview.src = reader.result;
        imgPreview.classList.remove('hidden'); // Mostra o preview
    };
    if (event.target.files[0]) {
        reader.readAsDataURL(event.target.files[0]); // Lê o arquivo selecionado
    } else {
        imgPreview.classList.add('hidden'); // Esconde se nenhum arquivo foi selecionado
        imgPreview.src = '#';
    }
}
function excluirProduto(id) {
    abrirModalConfirmacao(`Tem certeza que deseja excluir este produto? Kits que o utilizam também podem ser afetados.`, () => confirmarExclusaoProduto(id));
}
function confirmarExclusaoProduto(id) {
    produtos = produtos.filter(p => p.id !== id); // Remove o produto da lista
    salvarDados('produtos', produtos);

    // Atualiza kits que continham o produto (remove o produto do kit)
    let kitsAfetados = false;
    kits.forEach(kit => {
        const tamanhoOriginal = kit.produtos.length;
        kit.produtos = kit.produtos.filter(p => p.id !== id);
        if(kit.produtos.length < tamanhoOriginal) {
            kitsAfetados = true;
            // Recalcula o custo total do kit
            kit.custoTotal = kit.produtos.reduce((a, p) => a + p.custo + p.picking, 0);
        }
    });
    if(kitsAfetados) salvarDados('kits', kits); // Salva os kits apenas se foram modificados

    // Re-renderiza as páginas relevantes se estiverem visíveis
    if(document.getElementById('catalogo-page')?.offsetParent !== null) aplicarFiltros();
    if(document.getElementById('lojas-page')?.offsetParent !== null) renderizarProdutosLojas();
    if(document.getElementById('kits-page')?.offsetParent !== null) renderizarListaKits();

    mostrarNotificacao('Produto excluído com sucesso!', 'success');
    fecharModal(); // Fecha o modal de confirmação
}

// --- Catálogo ---
function carregarFiltrosCatalogo() {
    carregarFornecedoresSelect('filtro-fornecedor'); // Reutiliza a função dos fornecedores
    const filtroCategoria = document.getElementById('filtro-categoria');
    // Cria lista única de categorias a partir dos produtos existentes
    const categorias = [...new Set(produtos.map(p => p.categoria))].sort();
    const valorAtual = filtroCategoria.value; // Salva o valor atual
    filtroCategoria.innerHTML = '<option value="">Todas categorias</option>'; // Limpa e adiciona padrão
    categorias.forEach(c => {
        const option = document.createElement('option');
        option.value = c;
        option.textContent = c;
        filtroCategoria.appendChild(option);
    });
    filtroCategoria.value = valorAtual; // Restaura o valor
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
    aplicarFiltros(); // Aplica os filtros (que agora estão vazios)
}
function renderizarCatalogo(produtosParaMostrar) {
    const catalogoLista = document.getElementById('catalogo-lista');
    catalogoLista.innerHTML = ''; // Limpa a lista
    if (produtosParaMostrar.length === 0) {
        catalogoLista.innerHTML = '<p class="text-gray-400 col-span-full text-center py-10">Nenhum produto encontrado com os filtros aplicados.</p>';
        return;
    }
    // Cria o HTML para cada produto filtrado
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
                    </div>
                </div>
            </div>`;
    });
}

// --- Carrinho ---
function abrirCarrinho() {
    document.getElementById('carrinho-painel').classList.add('show');
    document.getElementById('carrinho-overlay').classList.add('show');
}
function fecharCarrinho() {
    document.getElementById('carrinho-painel').classList.remove('show');
    document.getElementById('carrinho-overlay').classList.remove('show');
    // Esconde o resumo ao fechar, se estiver visível
    document.getElementById('resumo-container').classList.add('hidden');
    document.getElementById('resumo-whatsapp').value = '';
    cotacaoAtual = null; // Limpa a cotação em andamento
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
                <div class="flex items-center gap-3 p-3 custom-card rounded-lg mb-3"> {/* Adicionado mb-3 */}
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
    // Atualiza o contador do ícone do carrinho
    document.getElementById('carrinho-contador').textContent = carrinho.reduce((acc, i) => acc + i.quantidade, 0);
    calcularTotais(); // Recalcula os totais sempre que o carrinho é renderizado
}
function mudarQuantidade(id, delta, isKit) {
    const idx = carrinho.findIndex(i => i.id === id && i.isKit === isKit);
    if (idx === -1) return;
    carrinho[idx].quantidade += delta;
    if (carrinho[idx].quantidade <= 0) {
        carrinho.splice(idx, 1); // Remove o item se a quantidade for zero ou menos
    }
    salvarDados('carrinho', carrinho);
    renderizarCarrinho(); // Re-renderiza o carrinho
}
function removerDoCarrinho(id, isKit) {
    carrinho = carrinho.filter(i => !(i.id === id && i.isKit === isKit)); // Filtra mantendo todos exceto o item a ser removido
    salvarDados('carrinho', carrinho);
    renderizarCarrinho();
}
function limparCarrinho() {
    carrinho = []; // Esvazia o array
    salvarDados('carrinho', carrinho);
    renderizarCarrinho();
    // Limpa também os campos de desconto e frete
    document.getElementById('carrinho-descontos').value = '0';
    document.getElementById('carrinho-frete').value = '0';
    calcularTotais(); // Recalcula os totais (que serão zero)
    mostrarNotificacao('Carrinho limpo!', 'success');
}
function calcularTotais() {
    const d = parseFloat(document.getElementById('carrinho-descontos').value) || 0;
    const f = parseFloat(document.getElementById('carrinho-frete').value) || 0;
    const s = carrinho.reduce((a, i) => a + (i.precoVenda * i.quantidade), 0); // Subtotal dos itens
    const t = s - d + f; // Total geral
    document.getElementById('total-subtotal').textContent = formatarMoeda(s);
    document.getElementById('total-descontos').textContent = `- ${formatarMoeda(d)}`;
    document.getElementById('total-frete').textContent = formatarMoeda(f);
    document.getElementById('total-geral').textContent = formatarMoeda(t);
}
function adicionarAoCarrinho(id) {
    const p = produtos.find(x => x.id === id); // Encontra o produto pelo ID
    if (!p) return; // Sai se o produto não for encontrado
    const i = carrinho.find(item => item.id === id && !item.isKit); // Verifica se já existe no carrinho
    if (i) {
        i.quantidade++; // Incrementa a quantidade
    } else {
        // Adiciona o produto ao carrinho com quantidade 1
        carrinho.push({ ...p, quantidade: 1, isKit: false });
    }
    salvarDados('carrinho', carrinho);
    mostrarNotificacao(`${p.nome} adicionado ao carrinho!`, 'success');
    renderizarCarrinho();
    abrirCarrinho(); // Abre o painel do carrinho
}

// --- Cotações ---
// ... (código das cotações - gerarResumoWhatsapp, copiarResumo, salvarCotacao, renderizarCotacoes, etc - permanece o mesmo) ...
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
    calcularTotais(); // Garante que os totais estão atualizados
    const sT = document.getElementById('total-subtotal').textContent;
    const dT = document.getElementById('total-descontos').textContent;
    const fT = document.getElementById('total-frete').textContent;
    const tT = document.getElementById('total-geral').textContent;
    let txt = `*ORÇAMENTO #${idF}* - ${formatarData(dA).split(',')[0]}\n_(Válido até ${formatarData(dV).split(',')[0]})_\n\n*Cliente:* ${n}\n*Contato:* ${w}\n*Local:* ${l}\n\n*Itens:*\n`;
    carrinho.forEach(i => { txt += ` • ${i.nome} (${i.sku}) - ${i.quantidade}x ${formatarMoeda(i.precoVenda)} = ${formatarMoeda(i.precoVenda*i.quantidade)}\n`; });
    txt += `\n*Totais:*\n • Produtos: ${sT}\n • Descontos: ${dT.replace('-','')}\n • Frete: ${fT}\n* • TOTAL: ${tT}*\n\n_Obs: Sujeito à disponibilidade._`;
    document.getElementById('resumo-whatsapp').value = txt; // Preenche o textarea
    document.getElementById('resumo-container').classList.remove('hidden'); // Mostra o container do resumo
    // Cria o objeto da cotação para salvar posteriormente
    cotacaoAtual = { id: idF, idNumero: nextId, dataGeracao: dA.toISOString(), dataValidade: dV.toISOString(), cliente: n, whatsapp: w, local: l, itens: [...carrinho], subtotal: sT, descontos: dT, frete: fT, totalGeral: tT, status: 'Pendente' };
    mostrarNotificacao('Resumo para WhatsApp gerado!', 'success');
}
function copiarResumo() {
    const r = document.getElementById('resumo-whatsapp');
    r.select(); // Seleciona o texto no textarea
    if (navigator.clipboard) { // API moderna de clipboard
        navigator.clipboard.writeText(r.value).then(() => mostrarNotificacao('Resumo copiado!', 'success')).catch(() => mostrarNotificacao('Erro ao copiar.', 'error'));
    } else { // Fallback para navegadores antigos
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
    cotacoes.push(cotacaoAtual); // Adiciona a cotação à lista
    salvarDados('cotacoes', cotacoes);
    mostrarNotificacao(`Cotação ${cotacaoAtual.id} salva com sucesso!`, 'success');
    // Limpa tudo relacionado à cotação atual
    limparCarrinho();
    document.getElementById('cliente-nome').value = '';
    document.getElementById('cliente-whatsapp').value = '';
    document.getElementById('cliente-cidade').value = '';
    document.getElementById('cliente-estado').value = '';
    document.getElementById('resumo-container').classList.add('hidden');
    document.getElementById('resumo-whatsapp').value = '';
    cotacaoAtual = null;
    fecharCarrinho(); // Fecha o painel do carrinho
    // Atualiza a lista de cotações se a página estiver visível
    if (!document.getElementById('cotacoes-page')?.classList.contains('hidden')) renderizarCotacoes();
}
function renderizarCotacoes() {
    const cS = cotacoes; // Pega todas as cotações salvas
    const t = cS.length; // Total
    const p = cS.filter(c => c.status === 'Pendente').length; // Pendentes
    const cv = t - p; // Convertidas
    const tx = (t === 0) ? 0 : (cv / t) * 100; // Taxa de conversão

    // Atualiza as estatísticas no topo da página
    document.getElementById('stat-total').textContent = t;
    document.getElementById('stat-pendente').textContent = p;
    document.getElementById('stat-convertida').textContent = cv;
    document.getElementById('stat-taxa').textContent = `${tx.toFixed(0)}%`;

    const f = document.getElementById('filtro-status-cotacao').value; // Pega o filtro selecionado (Todos, Pendente, Convertida)
    const lC = document.getElementById('lista-cotacoes');
    lC.innerHTML = ''; // Limpa a lista
    // Filtra as cotações com base no status selecionado
    const cF = (f === 'Todos') ? cS : cS.filter(c => c.status === f);

    if (cF.length === 0) {
        lC.innerHTML = '<p class="text-gray-400 text-center p-6 text-sm">📋 Nenhuma cotação encontrada para este status.</p>';
        return;
    }
    // Renderiza cada cotação filtrada (em ordem reversa - mais recentes primeiro)
    cF.slice().reverse().forEach(c => {
        const sC = c.status === 'Pendente' ? 'bg-yellow-500' : 'bg-green-500'; // Cor do status
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
    cotacoes[idx].status = nS; // Atualiza o status
    salvarDados('cotacoes', cotacoes);
    renderizarCotacoes(); // Re-renderiza a lista
    // Atualiza o dashboard se estiver visível
    if (!document.getElementById('dashboard-page')?.classList.contains('hidden')) calcularDashboard();
    mostrarNotificacao(`Status da cotação ${id} alterado para ${nS}!`, 'success');
}
function confirmarExclusaoCotacao(id) {
    cotacoes = cotacoes.filter(c => c.id !== id); // Remove a cotação
    salvarDados('cotacoes', cotacoes);
    renderizarCotacoes(); // Re-renderiza
    // Atualiza o dashboard se estiver visível
    if (!document.getElementById('dashboard-page')?.classList.contains('hidden')) calcularDashboard();
    mostrarNotificacao(`Cotação ${id} excluída!`, 'success');
    fecharModal(); // Fecha o modal de confirmação
}
function verDetalhesCotacao(id) {
    const c = cotacoes.find(x => x.id === id);
    if (!c) return;
    const dG = formatarData(new Date(c.dataGeracao));
    const dV = formatarData(new Date(c.dataValidade)).split(',')[0]; // Pega só a data de validade
    // Monta o texto dos detalhes
    let txt = `ORÇAMENTO #${c.id} – ${dG} (Válido até ${dV})\n\n`;
    txt += `Cliente: ${c.cliente} – WhatsApp: ${c.whatsapp}\nLocal: ${c.local}\n\nItens:\n`;
    c.itens.forEach(i => { txt += ` • ${i.nome} (${i.sku}) - ${i.quantidade}x ${formatarMoeda(i.precoVenda)} = ${formatarMoeda(i.precoVenda * i.quantidade)}\n`; });
    txt += `\nTotais:\n • Produtos: ${c.subtotal}\n • Descontos: ${c.descontos.replace('-','')}\n • Frete: ${c.frete}\n • TOTAL: ${c.totalGeral}\n\nStatus: ${c.status}`;
    abrirModalDetalhes("Detalhes Cotação " + c.id, txt); // Abre o modal com os detalhes
}

// --- Lojas ---

// NOVA FUNÇÃO: O "Cérebro" da Calculadora Visual Limpa
function calcularELojaVisual(lojaKey, itemId, isKit, trigger) {
    const item = (isKit ? kits : produtos).find(i => i.id === itemId);
    if (!item) return;

    const cfg = lojasConfig[lojaKey];
    const idBaseCard = `${itemId}-${isKit}`;
    const idLoja = `${lojaKey}-${idBaseCard}`;

    // 1. Encontrar elementos da UI (Inputs e Outputs)
    const lucroGlobalInput = document.getElementById(`lucro-global-${idBaseCard}`);
    const freteInput = document.getElementById(`frete-${idLoja}`);
    const ajusteInput = document.getElementById(`ajuste-${idLoja}`);

    const lucroDesejadoSpan = document.getElementById(`lucro-desejado-${idLoja}`);
    const taxaFixaSpan = document.getElementById(`taxa-fixa-${idLoja}`);
    const baseAntesComissaoSpan = document.getElementById(`base-antes-comissao-${idLoja}`);
    const custoProdutoInfoSpan = document.getElementById(`custo-produto-info-${idLoja}`);
    const subtotalCalcSpan = document.getElementById(`subtotal-calc-${idLoja}`);
    const comissaoInfoSpan = document.getElementById(`comissao-info-${idLoja}`);
    const precoIdealSpan = document.getElementById(`preco-ideal-${idLoja}`);
    const lucroRealSpan = document.getElementById(`lucro-real-${idLoja}`);
    const margemRealSpan = document.getElementById(`margem-real-${idLoja}`);

    // 2. Obter valores de Custo e Inputs
    const custoTotalProduto = isKit ? item.custoTotal : (item.custo + item.picking); // Custo base do item
    const lucroDesejado = parseFloat(lucroGlobalInput.value) || 0;
    const freteGratis = parseFloat(freteInput.value) || 0;

    // 3. Calcular a "Base antes da Comissão" e "Subtotal para Cálculo"
    const baseAntesComissao = lucroDesejado + freteGratis + cfg.taxaFixa;
    const subtotalParaCalculo = baseAntesComissao + custoTotalProduto;

    // 4. Calcular o Preço Ideal
    const precoIdeal = (cfg.comissao < 1) ? subtotalParaCalculo / (1 - cfg.comissao) : subtotalParaCalculo; // Evita divisão por zero se comissão for 100%

    // 5. Atualizar Spans do Cálculo (Passos Intermediários)
    if (lucroDesejadoSpan) lucroDesejadoSpan.textContent = formatarMoeda(lucroDesejado);
    if (taxaFixaSpan) taxaFixaSpan.textContent = formatarMoeda(cfg.taxaFixa);
    if (baseAntesComissaoSpan) baseAntesComissaoSpan.textContent = formatarMoeda(baseAntesComissao);
    if (custoProdutoInfoSpan) custoProdutoInfoSpan.textContent = `+ Custo: ${formatarMoeda(custoTotalProduto)}`;
    if (subtotalCalcSpan) subtotalCalcSpan.textContent = formatarMoeda(subtotalParaCalculo);
    if (comissaoInfoSpan) comissaoInfoSpan.textContent = `/ (1 - Comissão ${(cfg.comissao * 100).toFixed(1).replace('.', ',')}% = ${(1 - cfg.comissao).toFixed(3)})`;
    if (precoIdealSpan) precoIdealSpan.textContent = formatarMoeda(precoIdeal);

    // 6. Se o gatilho NÃO foi o ajuste manual, preenchemos o input de ajuste com o preço ideal
    if (trigger === 'lucro_global' || trigger === 'frete') {
        if (ajusteInput) ajusteInput.value = precoIdeal.toFixed(2);
    }

    // 7. Calcular o Lucro e Margem REAIS baseado no preço final (do input de ajuste)
    const precoFinalAjustado = parseFloat(ajusteInput.value) || 0;
    const comissaoReal = precoFinalAjustado * cfg.comissao;
    const receitaLiquida = precoFinalAjustado - comissaoReal - cfg.taxaFixa;
    const lucroReal = receitaLiquida - custoTotalProduto - freteGratis;
    const margemReal = (precoFinalAjustado > 0) ? (lucroReal / precoFinalAjustado * 100) : 0;

    // 8. Atualizar Spans Finais (Lucro e Margem Reais)
    if (lucroRealSpan) {
        lucroRealSpan.textContent = formatarMoeda(lucroReal);
        lucroRealSpan.classList.toggle('profit-positive', lucroReal >= 0);
        lucroRealSpan.classList.toggle('profit-negative', lucroReal < 0);
    }
    if (margemRealSpan) {
        margemRealSpan.textContent = `${margemReal.toFixed(1).replace('.', ',')}%`;
        margemRealSpan.classList.toggle('profit-positive', lucroReal >= 0);
        margemRealSpan.classList.toggle('profit-negative', lucroReal < 0);
    }

    // 9. Recalcular a Margem Média Geral do Produto
    recalcularMargemMediaVisual(idBaseCard);
}

// NOVA FUNÇÃO AUXILIAR: Recalcula a média do rodapé para o modelo Visual
function recalcularMargemMediaVisual(idBaseCard) {
    let totalMargem = 0;
    let totalLojas = 0;

    Object.keys(lojasConfig).forEach(key => {
        const idLoja = `${key}-${idBaseCard}`;
        const margemSpan = document.getElementById(`margem-real-${idLoja}`); // Pega a margem REAL
        if(margemSpan) {
            const margemValor = parseFloat(margemSpan.textContent.replace('%', '').replace(',', '.')) || 0;
            totalMargem += margemValor;
            totalLojas++;
        }
    });

    const margemMedia = totalLojas > 0 ? totalMargem / totalLojas : 0;
    const margemMediaSpan = document.getElementById(`margem-media-${idBaseCard}`); // Span no footer geral
    if (margemMediaSpan) {
        margemMediaSpan.textContent = `${margemMedia.toFixed(1)}%`.replace('.', ',');
        margemMediaSpan.classList.toggle('profit-positive', margemMedia >= 0);
        margemMediaSpan.classList.toggle('profit-negative', margemMedia < 0);
    }
}

/**
 * ATUALIZADO: Renderiza o layout "Calculadora Visual Limpa"
 */
function renderizarProdutosLojas() {
    // 1. Pegar elementos (igual antes)
    const container = document.getElementById('lista-produtos-lojas-container');
    const filtro = document.getElementById('filtro-lojas').value.toLowerCase();
    const placeholder = document.getElementById('lojas-placeholder');

    // 2. Limpar (igual antes)
    container.innerHTML = '';

    // 3. Pegar e filtrar itens (igual antes)
    const itens = [
        ...produtos.map(p => ({ ...p, isKit: false })),
        ...kits.map(k => ({ id: k.id, sku: `KIT-${k.id}`, nome: `🧩 ${k.nome}`, custo: k.custoTotal, picking: 0, precoVenda: k.precoVenda, imagem: null, isKit: true }))
    ];
    const itensFiltrados = itens.filter(i => !filtro || i.nome.toLowerCase().includes(filtro) || i.sku.toLowerCase().includes(filtro));

    // 4. Placeholder (igual antes)
    placeholder.classList.toggle('hidden', itensFiltrados.length > 0);
    if (itensFiltrados.length === 0) return;

    // 5. Construir os CARDS DE PRODUTO
    itensFiltrados.forEach(item => {
        const custoTotalProduto = item.isKit ? item.custoTotal : (item.custo + item.picking);
        const precoVendaBase = item.precoVenda;
        const lucroVendaBase = precoVendaBase - custoTotalProduto;
        const idBase = `${item.id}-${item.isKit}`;

        // Card principal (igual antes)
        let cardHTML = `<div class="precificacao-card">`;

        // --- 1. Header do Card (Info do Produto + Venda Direta + Lucro Global) --- (igual antes)
        cardHTML += `
            <div class="precificacao-header">
                <img src="${item.imagem || 'https://via.placeholder.com/64'}" alt="${item.nome}" class="precificacao-img" onerror="this.src='https://via.placeholder.com/64';">
                <div class="flex-1 min-w-0">
                    <h3 class="text-lg font-bold text-white truncate">${item.nome}</h3>
                    <p class="text-sm text-gray-400">SKU: ${item.sku}</p>
                    <p class="text-sm text-gray-400">Custo Total: <span class="font-bold text-red-400">${formatarMoeda(custoTotalProduto)}</span></p>
                </div>
                <div class="precificacao-header-stats">
                    <div>
                        <span class="text-xs text-gray-400">Venda Direta</span>
                        <p class="text-base font-bold text-blue-400">${formatarMoeda(precoVendaBase)}</p>
                    </div>
                    <div>
                        <span class="text-xs text-gray-400">Lucro Direto</span>
                        <p class="text-base font-bold ${lucroVendaBase < 0 ? 'text-red-400' : 'text-green-400'}">${formatarMoeda(lucroVendaBase)}</p>
                    </div>
                </div>
            </div>
            <div class="precificacao-controls">
                <label for="lucro-global-${idBase}">💰 Lucro desejado (R$):</label>
                <input type="number" step="0.01" value="10.00" id="lucro-global-${idBase}"
                       oninput="recalcularCardProduto(${item.id}, ${item.isKit})">
            </div>
        `;

        // --- 2. Container para as Calculadoras Visuais das Lojas ---
        cardHTML += `<div class="calculadora-lojas-container">`;

        Object.keys(lojasConfig).forEach(key => {
            const loja = lojasConfig[key];
            const idLoja = `${key}-${idBase}`;

            cardHTML += `
            <div class="calculadora-loja-card">
                <div class="calculadora-header">
                    <img src="assets/logos/${loja.logo}" alt="${loja.nome}" class="loja-logo-calc" onerror="this.onerror=null; this.src='https://via.placeholder.com/24/0F172A/94a3b8?text=${loja.nome[0]}';">
                    <span class="loja-nome-calc">${loja.nome}</span>
                </div>
                <div class="calculadora-body">
                    <div class="calc-step">
                        <span class="calc-label">(+) Seu Lucro Desejado:</span>
                        <span class="calc-value" id="lucro-desejado-${idLoja}">R$ 0,00</span>
                    </div>
                    <div class="calc-step input-step">
                        <span class="calc-label">(+) Frete Embutido:</span>
                        <input type="number" step="0.01" value="0.00" id="frete-${idLoja}" class="calc-input" oninput="calcularELojaVisual('${key}', ${item.id}, ${item.isKit}, 'frete')">
                    </div>
                    <div class="calc-step">
                        <span class="calc-label">(+) Taxa Fixa da Loja:</span>
                        <span class="calc-value" id="taxa-fixa-${idLoja}">R$ 0,00</span>
                    </div>
                    <div class="calc-subtotal">
                        <span class="calc-label">(=) Base (Antes da Comissão):</span>
                        <span class="calc-value" id="base-antes-comissao-${idLoja}">R$ 0,00</span>
                    </div>
                    <div class="calc-info" id="custo-produto-info-${idLoja}">+ Custo: R$ 0,00</div>
                    <div class="calc-subtotal final-subtotal">
                        <span class="calc-label">(=) Subtotal p/ Cálculo:</span>
                        <span class="calc-value" id="subtotal-calc-${idLoja}">R$ 0,00</span>
                    </div>

                    <div class="calc-step formula-step">
                        <span class="calc-label" id="comissao-info-${idLoja}">/ (1 - Comissão 0.0% = 0.000)</span>
                    </div>
                     <div class="calc-result ideal-price">
                        <span class="calc-label">(=) PREÇO IDEAL SUGERIDO:</span>
                        <span class="calc-value" id="preco-ideal-${idLoja}">R$ 0,00</span>
                    </div>

                    <div class="calc-step input-step final-adjust">
                        <span class="calc-label">Ajustar Preço Final:</span>
                        <input type="number" step="0.01" value="0.00" id="ajuste-${idLoja}" class="calc-input final-price-input" oninput="calcularELojaVisual('${key}', ${item.id}, ${item.isKit}, 'ajuste')">
                    </div>
                    <div class="final-output">
                        <div class="calc-result lucro-final">
                            <span class="calc-label">✅ LUCRO REAL:</span>
                            <span class="calc-value" id="lucro-real-${idLoja}">R$ 0,00</span>
                        </div>
                        <div class="calc-result margem-final">
                            <span class="calc-label">📊 MARGEM REAL:</span>
                            <span class="calc-value" id="margem-real-${idLoja}">0,0%</span>
                        </div>
                    </div>
                </div>
            </div>
            `;
        });

        cardHTML += `</div>`; // Fim .calculadora-lojas-container

        // --- 3. Footer do Card (Margem Média) ---
        cardHTML += `
            <div class="precificacao-footer">
                📊 Margem Média Geral (Produto):
                <span class="font-bold text-white" id="margem-media-${idBase}">0.0%</span>
            </div>
        `;

        cardHTML += `</div>`; // Fim .precificacao-card

        // Adiciona o card completo ao container
        container.innerHTML += cardHTML;

        // Dispara o cálculo inicial para preencher tudo
        recalcularCardProduto(item.id, item.isKit);
    });
}


/**
 * ATUALIZADO: Gatilho que recalcula TODAS as lojas de um produto
 * quando o "Lucro desejado" global é alterado.
 */
function recalcularCardProduto(itemId, isKit) {
    Object.keys(lojasConfig).forEach(lojaKey => {
        calcularELojaVisual(lojaKey, itemId, isKit, 'lucro_global');
    });
}

// --- Kits ---
// ... (código dos Kits - inicializarPaginaKits, carregarProdutosParaKitSelect, etc - permanece o mesmo) ...
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
    carregarProdutosParaKitSelect(); // Reseta o filtro do select
}
function renderizarProdutosDoKit() {
    const cont = document.getElementById('kit-produtos-lista');
    cont.innerHTML = '';
    let cT = 0; // Custo Total
    if (kitProdutosTemporario.length === 0) {
        cont.innerHTML = '<p class="text-gray-400 text-center text-xs">Nenhum produto adicionado.</p>';
    } else {
        kitProdutosTemporario.forEach(p => {
            cT += p.custo + p.picking;
            cont.innerHTML += `<div class="flex justify-between items-center p-1 bg-gray-700 rounded border border-gray-600 text-xs"><span class="truncate pr-2">${p.nome} (${p.sku})</span><button type="button" onclick="removerProdutoDoKit(${p.id})" class="text-red-400 hover:text-red-300 ml-1 p-0.5 text-xs">✕</button></div>`;
        });
    }
    document.getElementById('kit-custo-total').textContent = formatarMoeda(cT); // Atualiza o custo total exibido
}
function removerProdutoDoKit(pId) {
    kitProdutosTemporario = kitProdutosTemporario.filter(p => p.id !== pId);
    renderizarProdutosDoKit(); // Re-renderiza a lista e o custo
    mostrarNotificacao('Produto removido do kit!', 'success');
}
function handleSalvarKit(e) {
    e.preventDefault();
    const kId = document.getElementById('kit-id').value; // ID para edição
    const nK = document.getElementById('kit-nome').value.trim();
    const pVK = parseFloat(document.getElementById('kit-preco-venda').value);

    // Validação
    if (!nK || !pVK || pVK <= 0 || kitProdutosTemporario.length === 0) {
        mostrarNotificacao('Preencha o nome, preço de venda (>0) e adicione pelo menos um produto ao kit!', 'error');
        return;
    }

    const cTK = kitProdutosTemporario.reduce((a, p) => a + p.custo + p.picking, 0); // Calcula o custo total
    const nKi = { id: kId ? parseInt(kId) : Date.now(), nome: nK, produtos: [...kitProdutosTemporario], precoVenda: pVK, custoTotal: cTK };

    if (kId) { // Editando
        const i = kits.findIndex(k => k.id === parseInt(kId));
        if (i !== -1) kits[i] = nKi;
    } else { // Criando
        kits.push(nKi);
    }

    salvarDados('kits', kits);
    limparFormularioKit(); // Limpa o form
    renderizarListaKits(); // Atualiza a lista de kits
    mostrarNotificacao(kId ? 'Kit atualizado com sucesso!' : 'Kit salvo com sucesso!', 'success');
    // Atualiza a aba de lojas se estiver visível, pois um kit pode ter sido alterado
    if (document.getElementById('lojas-page')?.offsetParent !== null) renderizarProdutosLojas();
}
function limparFormularioKit() {
    document.getElementById('kit-form').reset();
    document.getElementById('kit-id').value = '';
    document.getElementById('kit-preco-venda').value = '0.00';
    document.getElementById('kit-form-titulo').innerHTML = '🧩 Novo Kit';
    kitProdutosTemporario = []; // Limpa a lista temporária
    renderizarProdutosDoKit(); // Atualiza a exibição da lista e custo
    document.getElementById('filtro-produtos-kit').value = '';
    carregarProdutosParaKitSelect(); // Reseta o select de produtos
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
        const lK = k.precoVenda - k.custoTotal; // Lucro Venda Direta
        const mK = (k.precoVenda > 0) ? ((lK / k.precoVenda) * 100) : 0; // Margem Venda Direta
        cont.innerHTML += `
            <div class="custom-card rounded-lg p-3">
                <div class="flex justify-between items-start mb-1.5">
                    <div class="flex-1 mr-3">
                        <h4 class="text-sm font-bold text-white mb-0.5 truncate">${k.nome}</h4>
                        <p class="text-gray-400 text-xs">${k.produtos.length} produto(s)</p>
                    </div>
                    <div class="text-right flex-shrink-0">
                        <p class="text-base font-bold text-green-400">${formatarMoeda(k.precoVenda)}</p>
                        <p class="text-xs ${lK >= 0 ? 'text-green-400' : 'text-red-400'}">Lucro Dir: ${formatarMoeda(lK)} (${mK.toFixed(1)}%)</p> {/* Mostra Lucro e Margem Direta */}
                    </div>
                </div>
                <div class="mb-2 p-1.5 bg-gray-800 rounded text-xs">
                     <p>Custo Total: ${formatarMoeda(k.custoTotal)}</p> {/* Apenas Custo Total */}
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
    abrirModalDetalhes(`Detalhes do Kit: ${k.nome}`, dH, true); // Abre modal com HTML
}
function editarKit(id) {
    const k = kits.find(x => x.id === id);
    if (!k) return;
    // Preenche o formulário para edição
    document.getElementById('kit-id').value = k.id;
    document.getElementById('kit-nome').value = k.nome;
    document.getElementById('kit-preco-venda').value = k.precoVenda.toFixed(2);
    document.getElementById('kit-form-titulo').innerHTML = '✏️ Editando Kit';
    kitProdutosTemporario = [...k.produtos]; // Carrega os produtos do kit na lista temporária
    renderizarProdutosDoKit(); // Atualiza a exibição
}
function excluirKit(id) {
    abrirModalConfirmacao(`Tem certeza que deseja excluir este kit?`, () => confirmarExclusaoKit(id));
}
function confirmarExclusaoKit(id) {
    kits = kits.filter(k => k.id !== id); // Remove o kit
    salvarDados('kits', kits);
    renderizarListaKits(); // Atualiza a lista
    fecharModal();
    mostrarNotificacao('Kit excluído com sucesso!', 'success');
    // Atualiza a aba de lojas se estiver visível
    if (document.getElementById('lojas-page')?.offsetParent !== null) renderizarProdutosLojas();
}
function adicionarKitAoCarrinho(id) {
    const k = kits.find(x => x.id === id);
    if (!k) { mostrarNotificacao('Kit não encontrado!', 'error'); return; }
    const i = carrinho.find(item => item.id === id && item.isKit); // Verifica se o kit já está no carrinho
    if (i) {
        i.quantidade++; // Incrementa quantidade
    } else {
        // Adiciona o kit ao carrinho
        carrinho.push({
            id: k.id, sku: `KIT-${k.id}`, nome: `🧩 ${k.nome}`, // Adiciona um ícone ao nome
            categoria: 'Kit', fornecedor: 'Kit',
            custo: k.custoTotal, picking: 0, // Custo do kit já inclui picking dos produtos internos
            precoVenda: k.precoVenda,
            peso: k.produtos.reduce((a, p) => a + p.peso, 0), // Soma o peso dos produtos
            comprimento: 0, largura: 0, altura: 0, // Dimensões não aplicáveis diretamente, talvez precise calcular no futuro
            imagem: null, // Kits não têm imagem própria por enquanto
            quantidade: 1, isKit: true // Marca como kit
        });
    }
    salvarDados('carrinho', carrinho);
    mostrarNotificacao(`Kit ${k.nome} adicionado ao carrinho!`, 'success');
    renderizarCarrinho();
    abrirCarrinho();
}


// --- Marketing/Cupons ---
// ... (código dos Cupons - inicializarPaginaMarketing, salvarCupom, etc - permanece o mesmo) ...
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
    // Verifica se o código já existe (ignorando o próprio cupom se estiver editando)
    const cEx = cupons.find(c => c.codigo === cod && c.id !== (cId ? parseInt(cId) : null));
    if (cEx) { mostrarNotificacao('Este código de cupom já está em uso!', 'error'); return; }
    let uA = 0; // Usos Atuais
    if (cId) { // Se está editando, mantém os usos atuais
        const cA = cupons.find(c => c.id === parseInt(cId));
        uA = cA ? cA.usosAtuais : 0;
    }
    const cup = { id: cId ? parseInt(cId) : Date.now(), codigo: cod, tipo: tip, valor: val, limitUsos: lim, usosAtuais: uA, ativo: act, dataCriacao: cId ? cupons.find(c => c.id === parseInt(cId))?.dataCriacao : new Date().toISOString() };
    if (cId) { // Edita
        const i = cupons.findIndex(c => c.id === parseInt(cId));
        if (i !== -1) cupons[i] = cup;
    } else { // Cria
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
    document.getElementById('cupom-ativo').checked = true; // Padrão é ativo
    document.getElementById('cupom-usos').value = '0'; // Padrão é ilimitado
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
        const sC = c.ativo ? 'bg-green-500' : 'bg-gray-500'; // Cor do status
        const sT = c.ativo ? 'Ativo' : 'Inativo'; // Texto do status
        const vF = c.tipo === 'fixo' ? formatarMoeda(c.valor) : `${c.valor.toFixed(2)}%`; // Valor formatado
        const uE = c.limitUsos > 0 && c.usosAtuais >= c.limitUsos; // Usos esgotados?
        const lT = c.limitUsos === 0 ? `(${c.usosAtuais})` : `(${c.usosAtuais}/${c.limitUsos})`; // Texto dos usos
        const uC = uE ? 'text-red-400' : 'text-white'; // Cor do contador de usos
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
    if (i === -1 || !cupons[i].ativo) return; // Não encontrado ou inativo
    if (cupons[i].limitUsos > 0 && cupons[i].usosAtuais >= cupons[i].limitUsos) { // Limite atingido
        mostrarNotificacao(`Limite de usos para o cupom ${cupons[i].codigo} já foi atingido!`, 'error');
        return;
    }
    cupons[i].usosAtuais++; // Incrementa
    salvarDados('cupons', cupons);
    renderizarListaCupons(); // Atualiza a lista
    atualizarEstatisticasCupons(); // Atualiza os totais
    mostrarNotificacao(`Uso registrado para ${cupons[i].codigo}`, 'success');
}
function atualizarEstatisticasCupons() {
    const tC = cupons.length; // Total de cupons
    const cF = cupons.filter(c => c.tipo === 'fixo').length; // Cupons de valor fixo
    const cP = tC - cF; // Cupons percentuais
    const tU = cupons.reduce((a, c) => a + c.usosAtuais, 0); // Total de usos registrados
    document.getElementById('stat-cupom-total').textContent = tC;
    document.getElementById('stat-cupom-fixo').textContent = cF;
    document.getElementById('stat-cupom-percentual').textContent = cP;
    document.getElementById('stat-cupom-usos').textContent = tU;
}
function editarCupom(id) {
    const c = cupons.find(x => x.id === id);
    if (!c) return;
    // Preenche o formulário para edição
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
    cupons = cupons.filter(c => c.id !== id); // Remove o cupom
    salvarDados('cupons', cupons);
    renderizarListaCupons(); // Atualiza a lista
    atualizarEstatisticasCupons(); // Atualiza os totais
    fecharModal();
    mostrarNotificacao('Cupom excluído com sucesso!', 'success');
}


// --- Financeiro ---
// ... (código Financeiro - calcularEstatisticasFinanceiras - permanece o mesmo) ...
function calcularEstatisticasFinanceiras() {
    const cC = cotacoes.filter(c => c.status === 'Convertida'); // Apenas convertidas
    const h = new Date(); // Hoje
    const iD = new Date(h.getFullYear(), h.getMonth(), h.getDate()); // Início do dia de hoje
    const iM = new Date(h.getFullYear(), h.getMonth(), 1); // Início do mês atual
    // Soma o total das cotações convertidas hoje
    const vH = cC.filter(c => new Date(c.dataGeracao) >= iD).reduce((a, c) => a + (parseFloat(c.totalGeral.replace(/[^0-9,-]+/g,"").replace(",",".")) || 0), 0);
    // Soma o total das cotações convertidas neste mês
    const vM = cC.filter(c => new Date(c.dataGeracao) >= iM).reduce((a, c) => a + (parseFloat(c.totalGeral.replace(/[^0-9,-]+/g,"").replace(",",".")) || 0), 0);
    // Calcula o lucro total de todas as cotações convertidas
    let lT = 0;
    cC.forEach(ct => {
        ct.itens.forEach(it => {
            const cI = it.isKit ? it.custo : (it.custo + it.picking); // Custo do item (kit ou produto)
            lT += (it.precoVenda - cI) * it.quantidade; // Lucro do item
        });
        lT += (parseFloat(ct.frete.replace(/[^0-9,-]+/g,"").replace(",",".")) || 0); // Adiciona frete cobrado
        lT -= (parseFloat(ct.descontos.replace(/[^0-9,-]+/g,"").replace(",",".")) || 0); // Subtrai descontos dados
    });
    document.getElementById('financeiro-vendas-hoje').textContent = formatarMoeda(vH);
    document.getElementById('financeiro-vendas-mes').textContent = formatarMoeda(vM);
    document.getElementById('financeiro-lucro-total').textContent = formatarMoeda(lT);
}


// --- Auxiliares ---
function formatarMoeda(valor) {
    // Formata número para BRL (R$ 1.234,56)
    return (valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function formatarData(data) {
    if(!data || !(data instanceof Date)) return '-'; // Retorna '-' se a data for inválida
    // Formata data e hora (dd/mm/aaaa, HH:MM)
    return data.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function formatarTelefone(tel) {
    if (!tel) return "N/I"; // Não informado
    return tel.replace(/\D/g,''); // Remove tudo que não for dígito
}

// --- Modais ---
function abrirModalConfirmacao(msg, callback) {
    fecharModal(); // Fecha qualquer modal anterior
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
    document.getElementById('modal-confirmar-btn').onclick = callback; // Associa a função de callback ao botão confirmar
    modalAtual = m; // Guarda a referência do modal atual
}
function abrirModalDetalhes(titulo, conteudo, html = false) {
    fecharModal();
    const m = document.createElement('div');
    m.id = 'modal-detalhes';
    m.className = 'fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[1060] p-4';
    const cCont = document.createElement('div'); // Container do conteúdo
    cCont.className = "w-full max-h-[60vh] overflow-y-auto p-3 bg-gray-800 border border-gray-600 rounded text-gray-200 text-xs whitespace-pre-wrap"; // Estilos e scroll
    if (html) cCont.innerHTML = conteudo; // Insere como HTML
    else cCont.textContent = conteudo; // Insere como texto (para segurança com dados do usuário)
    m.innerHTML = `
        <div class="custom-card rounded-lg p-5 max-w-md w-full mx-auto flex flex-col">
            <div class="flex justify-between items-center mb-3">
                <h3 class="text-base font-bold text-white">${titulo}</h3>
                <button type="button" onclick="fecharModal()" class="text-gray-400 hover:text-white text-2xl">&times;</button>
            </div>
            ${cCont.outerHTML} {/* Insere o container do conteúdo */}
            <div class="flex gap-3 mt-3">
                <button type="button" onclick="fecharModal()" class="flex-1 custom-accent custom-accent-hover text-white px-3 py-1.5 rounded font-medium text-xs">Fechar</button>
            </div>
        </div>`;
    document.body.appendChild(m);
    modalAtual = m;
}
function fecharModal() {
    const m = modalAtual; // Pega a referência do modal aberto
    if (m) {
        m.remove(); // Remove o elemento do DOM
        modalAtual = null; // Limpa a referência
    }
}

// --- Sistema de Notificações ---
function mostrarNotificacao(msg, tipo = 'success') {
    const el = document.getElementById('notification');
    const txt = document.getElementById('notification-text');
    if (!el || !txt) return; // Sai se os elementos não existirem

    txt.textContent = msg;
    // Reseta as classes de cor e adiciona a classe base
    el.className = 'notification px-4 py-2 rounded-md shadow-lg text-sm font-medium';

    // Adiciona a classe de cor apropriada
    if (tipo === 'success') el.classList.add('bg-green-600', 'text-white');
    else if (tipo === 'error') el.classList.add('bg-red-600', 'text-white');
    else el.classList.add('bg-blue-600', 'text-white'); // Azul como padrão

    el.classList.add('show'); // Mostra a notificação (via CSS)
    // Esconde a notificação após 3 segundos
    setTimeout(() => el.classList.remove('show'), 3000);
}
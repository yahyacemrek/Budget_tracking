/**
 * PENNYWISE PRO - NİHAİ APP.JS
 * Bütçe, Ekstre, Canlı Yatırım ve Nakit Entegrasyon Motoru
 */

// ==========================================
// 1. VERİTABANI SERVİSİ (LocalStorage API)
// ==========================================
const DBService = {
    async getTransactions() { return JSON.parse(localStorage.getItem('pw_transactions')) || []; },
    async saveTransactions(data) { localStorage.setItem('pw_transactions', JSON.stringify(data)); },
    
    async getBudgets() { return JSON.parse(localStorage.getItem('pw_budgets')) || []; },
    async saveBudgets(data) { localStorage.setItem('pw_budgets', JSON.stringify(data)); },

    async getInvestments() { return JSON.parse(localStorage.getItem('pw_investments')) || []; },
    async saveInvestments(data) { localStorage.setItem('pw_investments', JSON.stringify(data)); }
};

// ==========================================
// 2. CANLI PİYASA API SERVİSİ (Simülasyon)
// ==========================================
const LiveMarketAPI = {
    async getLatestPrices() {
        try {
            await new Promise(resolve => setTimeout(resolve, 800)); 
            return {
                "Altın": 2450.40,   // Gram Altın
                "Gümüş": 32.65,     // Gram Gümüş
                "Dolar": 32.20,     // USD/TRY
                "Euro": 35.10,      // EUR/TRY
                "Hisse": 315.50,    // Örnek Hisse
                "Kripto": 2250000   // Örnek BTC
            };
        } catch (error) {
            console.error("API Bağlantı Hatası:", error);
            return null;
        }
    }
};

// ==========================================
// 3. UYGULAMA DURUMU (State)
// ==========================================
let currentTransactions = [];
let currentBudgets = [];
let currentInvestments = [];
let selectedPeriod = ""; 

// ==========================================
// 4. DOM ELEMENTLERİ
// ==========================================
const alertBox = document.getElementById('alert-container');
const elNavCashBalance = document.getElementById('nav-cash-balance');
const elNavInvBalance = document.getElementById('nav-inv-balance');

// Bütçe Elemanları
const inputPeriod = document.getElementById('statement-month');
const labelPeriodBadge = document.getElementById('statement-period-badge');
const listTransactionTable = document.getElementById('transaction-list');
const listBudgetContainer = document.getElementById('budget-list');
const elTotalIncome = document.getElementById('total-income');
const elTotalExpense = document.getElementById('total-expense');
const elNetBalance = document.getElementById('net-balance');

// Bütçe Formları
const formTx = document.getElementById('transaction-form');
const formBg = document.getElementById('budget-form');
const btnBgSubmit = document.getElementById('budget-submit-btn');
const fieldBgEditId = document.getElementById('edit-budget-category-id');

// Yatırım Elemanları
const formInv = document.getElementById('investment-form');
const listInvTable = document.getElementById('investment-list');
const autoPriceSwitch = document.getElementById('inv-auto-price');
const manualPriceContainer = document.getElementById('manual-price-container');
const manualPriceInput = document.getElementById('inv-manual-current');
const selectInvAction = document.getElementById('inv-action');
const btnInvSubmit = document.getElementById('inv-submit-btn');

// ==========================================
// 5. BAŞLANGIÇ (Init)
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    const today = new Date();
    const currentMonth = String(today.getMonth() + 1).padStart(2, '0');
    selectedPeriod = `${today.getFullYear()}-${currentMonth}`;
    inputPeriod.value = selectedPeriod;

    currentTransactions = await DBService.getTransactions();
    currentBudgets = await DBService.getBudgets();
    currentInvestments = await DBService.getInvestments();

    // Event Listeners
    inputPeriod.addEventListener('change', (e) => {
        selectedPeriod = e.target.value;
        updateUI();
    });

    autoPriceSwitch.addEventListener('change', function() {
        if(this.checked) {
            manualPriceContainer.style.display = 'none';
            manualPriceInput.removeAttribute('required');
        } else {
            manualPriceContainer.style.display = 'block';
            manualPriceInput.setAttribute('required', 'true');
        }
    });

    // Dinamik Form UI Değişimi (Alış/Satış Seçimine Göre Buton Rengi Değişir)
    selectInvAction.addEventListener('change', function() {
        if (this.value === 'sell') {
            btnInvSubmit.className = "btn btn-danger w-100 rounded-pill fw-semibold";
            btnInvSubmit.innerHTML = '<i class="bi bi-cash-coin me-1"></i> Varlığı Nakte Çevir (Sat)';
        } else {
            btnInvSubmit.className = "btn btn-primary w-100 rounded-pill fw-semibold";
            btnInvSubmit.innerHTML = '<i class="bi bi-plus-lg me-1"></i> Portföyü Güncelle (Satın Al)';
        }
    });

    updateUI();
});

// ==========================================
// 6. SPA GÖRÜNÜM YÖNETİCİSİ (Routing)
// ==========================================
window.switchView = function(viewId, element) {
    document.getElementById('budget-view').classList.add('d-none');
    document.getElementById('investments-view').classList.add('d-none');
    document.getElementById(viewId).classList.remove('d-none');
    
    document.querySelectorAll('.view-tab').forEach(tab => tab.classList.remove('active', 'text-primary'));
    element.classList.add('active', 'text-primary');
};

// ==========================================
// 7. FORM GÖNDERİM OLAYLARI (Alış / Satış Algoritmaları)
// ==========================================

// Gider/Gelir Ekleme (Manuel Ekstre Girişi)
formTx.addEventListener('submit', async (e) => {
    e.preventDefault();
    const amount = parseFloat(document.getElementById('amount').value);
    if (amount <= 0) return alert("Tutar sıfırdan büyük olmalıdır.");

    currentTransactions.push({
        id: "tx_" + Date.now(),
        type: document.getElementById('type').value,
        category: document.getElementById('category').value,
        amount: amount,
        description: document.getElementById('description').value,
        period: selectedPeriod, 
        createdAt: new Date().toISOString() 
    });

    await DBService.saveTransactions(currentTransactions);
    formTx.reset();
    updateUI();
});

// Bütçe Hedefi Belirleme
formBg.addEventListener('submit', async (e) => {
    e.preventDefault();
    const category = document.getElementById('budget-category').value;
    const limit = parseFloat(document.getElementById('budget-limit').value);
    const isEditMode = fieldBgEditId.value !== "";

    if (isEditMode) {
        const oldCategory = fieldBgEditId.value;
        const bIdx = currentBudgets.findIndex(b => b.category === oldCategory && b.period === selectedPeriod);
        if (bIdx >= 0) {
            currentBudgets[bIdx].category = category;
            currentBudgets[bIdx].limit = limit;
        }
        fieldBgEditId.value = "";
        btnBgSubmit.innerHTML = '<i class="bi bi-save me-1"></i> Limiti Kaydet';
        btnBgSubmit.className = "btn btn-info btn-lg rounded-pill fw-semibold text-dark";
        document.getElementById('budget-category').disabled = false;
    } else {
        const bIdx = currentBudgets.findIndex(b => b.category === category && b.period === selectedPeriod);
        if (bIdx >= 0) currentBudgets[bIdx].limit = limit;
        else currentBudgets.push({ period: selectedPeriod, category: category, limit: limit });
    }

    await DBService.saveBudgets(currentBudgets);
    formBg.reset();
    updateUI();
});

// Yatırım İşlem Motoru (Alış/Satış & Nakit Entegrasyonu)
formInv.addEventListener('submit', async (e) => {
    e.preventDefault();
    const action = selectInvAction.value; // 'buy' veya 'sell'
    const asset = document.getElementById('inv-asset').value;
    const amount = parseFloat(document.getElementById('inv-amount').value);
    const txPrice = parseFloat(document.getElementById('inv-buy-price').value); // İşlem kuru
    const isAutoUpdate = document.getElementById('inv-auto-price').checked;
    const manualCurrentPrice = isAutoUpdate ? 0 : parseFloat(document.getElementById('inv-manual-current').value);

    const existingIdx = currentInvestments.findIndex(i => i.asset === asset);
    const calculatedCash = amount * txPrice; // İşlemden elde edilen ya da harcanan nakit tutarı

    if (action === 'buy') {
        // --- SATIN ALMA ALGORİTMASI ---
        if (existingIdx >= 0) {
            const old = currentInvestments[existingIdx];
            const oldAmount = old.amount || 0;
            const oldBuyPrice = old.buyPrice || 0;

            const totalOldPrincipal = oldAmount * oldBuyPrice;
            const totalNewPrincipal = amount * txPrice;
            
            const newTotalAmount = oldAmount + amount;
            const newAverageBuyPrice = newTotalAmount > 0 ? (totalOldPrincipal + totalNewPrincipal) / newTotalAmount : 0;

            currentInvestments[existingIdx].amount = newTotalAmount;
            currentInvestments[existingIdx].buyPrice = newAverageBuyPrice;
            currentInvestments[existingIdx].isAutoUpdate = isAutoUpdate;
            currentInvestments[existingIdx].manualPrice = manualCurrentPrice;
        } else {
            currentInvestments.push({ 
                id: "inv_" + Date.now(), asset, amount, buyPrice: txPrice, isAutoUpdate, manualPrice: manualCurrentPrice
            });
        }
    } else if (action === 'sell') {
        // --- SATIŞ (BOZDURMA) ALGORİTMASI ---
        if (existingIdx === -1 || currentInvestments[existingIdx].amount < amount) {
            alert(`⚠️ Hata: Portföyünüzde satmak istediğiniz miktarda (${amount}) ${asset} bulunmamaktadır!`);
            return;
        }

        // Portföydeki miktarı düş
        currentInvestments[existingIdx].amount -= amount;

        // Eğer varlık tamamen tükendiyse portföy listesinden kaldır
        if (currentInvestments[existingIdx].amount <= 0) {
            currentInvestments = currentInvestments.filter(i => i.asset !== asset);
        }

        // Elde edilen parayı "Gelir" olarak hesap ekstresine otomatik aktar
        currentTransactions.push({
            id: "tx_sys_" + Date.now(),
            type: "income",
            category: "Diğer",
            amount: calculatedCash,
            description: `💰 ${asset} Satış Geliri (${amount} Birim Bozduruldu)`,
            period: selectedPeriod,
            createdAt: new Date().toISOString()
        });

        alert(`✅ ${calculatedCash.toFixed(2)} ₺ tutarındaki satış kazancı hesap ekstrenize ve nakit bakiyenize başarıyla eklendi.`);
    }

    // Değişiklikleri Kaydet
    await DBService.saveInvestments(currentInvestments);
    await DBService.saveTransactions(currentTransactions);
    
    // Formu temizle ve resetle
    formInv.reset();
    manualPriceContainer.style.display = 'none'; 
    btnInvSubmit.className = "btn btn-primary w-100 rounded-pill fw-semibold";
    btnInvSubmit.innerHTML = '<i class="bi bi-plus-lg me-1"></i> Portföyü Güncelle (Satın Al)';
    
    updateUI();
});

// ==========================================
// 8. SİLME VE DÜZENLEME FONKSİYONLARI
// ==========================================
window.deleteTransaction = async function(id) {
    if(confirm("Bu işlemi ekstrenizden tamamen silmek istediğinize emin misiniz?")) {
        currentTransactions = currentTransactions.filter(t => t.id !== id);
        await DBService.saveTransactions(currentTransactions);
        updateUI();
    }
};

window.editBudget = function(category) {
    const b = currentBudgets.find(b => b.category === category && b.period === selectedPeriod);
    if (b) {
        document.getElementById('budget-category').value = b.category;
        document.getElementById('budget-limit').value = b.limit;
        fieldBgEditId.value = b.category;
        btnBgSubmit.innerHTML = '<i class="bi bi-pencil-square me-1"></i> Limiti Güncelle';
        btnBgSubmit.className = "btn btn-warning btn-lg rounded-pill fw-semibold text-dark";
        document.getElementById('budget-category').disabled = true;
    }
};

window.deleteBudget = async function(category) {
    if(confirm(`${category} bütçe hedefini bu dönemden silmek istiyor musunuz?`)) {
        currentBudgets = currentBudgets.filter(b => !(b.category === category && b.period === selectedPeriod));
        await DBService.saveBudgets(currentBudgets);
        updateUI();
    }
};

window.deleteInvestment = async function(id) {
    if(confirm("Bu yatırımı portföyden silmek istediğinize emin misiniz? (Not: Nakit iadesi yapılmaz, sadece listeden temizlenir)")) {
        currentInvestments = currentInvestments.filter(i => i.id !== id);
        await DBService.saveInvestments(currentInvestments);
        updateUI();
    }
};

// ==========================================
// 9. ANA ARAYÜZ GÜNCELLEME (RENDER) MOTORU
// ==========================================
async function updateUI() {
    const [year, month] = selectedPeriod.split("-");
    const dateObj = new Date(year, month - 1);
    const monthName = dateObj.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
    
    labelPeriodBadge.innerText = monthName;
    document.querySelectorAll('.selected-month-text').forEach(el => el.innerText = dateObj.toLocaleDateString('tr-TR', { month: 'long' }));

    const filteredTx = currentTransactions.filter(t => t.period === selectedPeriod);
    const filteredBg = currentBudgets.filter(b => b.period === selectedPeriod);

    renderTable(filteredTx);
    calculateMetrics(filteredTx);
    renderBudgets(filteredBg, filteredTx);

    const livePrices = await LiveMarketAPI.getLatestPrices();
    renderMarketTicker(livePrices);
    renderInvestments(livePrices); 
}

// ==========================================
// 10. ÇİZİM FONKSİYONLARI (View Layers)
// ==========================================

// BÜTÇE: Hesap Ekstresi Tablosu
function renderTable(txList) {
    listTransactionTable.innerHTML = '';
    txList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    txList.map(t => {
        const tr = document.createElement('tr');
        const typeClass = t.type === 'income' ? 'text-income' : 'text-expense';
        const typeIcon = t.type === 'income' ? '<i class="bi bi-arrow-up-right text-success"></i>' : '<i class="bi bi-arrow-down-left text-danger"></i>';
        
        const jsDate = new Date(t.createdAt);
        const displayDate = jsDate.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const displayTime = jsDate.toLocaleDateString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).split(" ")[1] || "";

        tr.innerHTML = `
            <td class="timestamp-cell">
                <span>${displayDate}</span>
                <span class="timestamp-time">${displayTime}</span>
            </td>
            <td class="${typeClass} fw-semibold">${typeIcon} ${t.type === 'income' ? 'Gelir' : 'Gider'}</td>
            <td><span class="badge bg-dark border border-secondary p-2 rounded-pill">${t.category}</span></td>
            <td class="text-white-50">${t.description}</td>
            <td class="${typeClass} text-end fw-bold fs-6">${t.amount.toFixed(2)} ₺</td>
            <td class="text-center">
                <button class="btn btn-sm btn-outline-danger border-0" onclick="deleteTransaction('${t.id}')">
                    <i class="bi bi-trash3"></i>
                </button>
            </td>
        `;
        listTransactionTable.appendChild(tr);
    });
}

// BÜTÇE: Özet Metrikler ve Küresel Nakit Hesabı
function calculateMetrics(txList) {
    const monthlyIncome = txList.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const monthlyExpense = txList.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    const monthlyNet = monthlyIncome - monthlyExpense;

    const totalIncomeAllTime = currentTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const totalExpenseAllTime = currentTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    const globalBalance = totalIncomeAllTime - totalExpenseAllTime;

    elTotalIncome.innerText = `${monthlyIncome.toFixed(2)} ₺`;
    elTotalExpense.innerText = `${monthlyExpense.toFixed(2)} ₺`;
    elNetBalance.innerText = `${monthlyNet.toFixed(2)} ₺`;
    
    // Navbar Nakit Göstergesini Yazdır
    elNavCashBalance.innerText = `${globalBalance.toFixed(2)} ₺`;
    elNavCashBalance.className = globalBalance < 0 ? "fw-bold text-danger fs-6 mt-1" : "fw-bold text-success fs-6 mt-1";
}

// BÜTÇE: Limitler
function renderBudgets(bgList, txList) {
    listBudgetContainer.innerHTML = '';
    alertBox.innerHTML = '';

    bgList.forEach(budget => {
        const spent = txList
            .filter(t => t.type === 'expense' && t.category === budget.category)
            .reduce((sum, t) => sum + t.amount, 0);

        const isExceeded = spent > budget.limit;
        const remaining = budget.limit - spent;

        const card = document.createElement('div');
        card.className = `budget-card ${isExceeded ? 'exceeded' : ''} shadow-sm`;
        
        card.innerHTML = `
            <div class="d-flex justify-content-between align-items-center mb-2">
                <span class="fw-semibold text-light fs-6">
                    <i class="bi bi-tag-fill me-1 text-primary"></i>${budget.category}
                </span>
                <div class="budget-actions">
                    <button class="btn btn-outline-warning btn-sm" onclick="editBudget('${budget.category}')"><i class="bi bi-pencil"></i></button>
                    <button class="btn btn-outline-danger btn-sm" onclick="deleteBudget('${budget.category}')"><i class="bi bi-trash"></i></button>
                </div>
            </div>
            <div class="d-flex justify-content-between align-items-center border-top border-secondary pt-2 mt-2">
                <div>
                    <p class="m-0 text-secondary small">Limit: <span class="text-light fw-bold">${budget.limit} ₺</span></p>
                    <p class="m-0 text-secondary small">Harcanan: <span class="${isExceeded ? 'text-danger fw-bold' : 'text-info'}">${spent.toFixed(2)} ₺</span></p>
                </div>
                <div class="text-end">
                    <p class="m-0 text-secondary small">Kalan</p>
                    <span class="badge ${remaining < 0 ? 'bg-danger' : 'bg-success'} fs-7">${remaining.toFixed(2)} ₺</span>
                </div>
            </div>
        `;
        listBudgetContainer.appendChild(card);

        if (isExceeded) {
            const alertDiv = document.createElement('div');
            alertDiv.className = 'alert alert-danger alert-dismissible fade show shadow-sm';
            alertDiv.innerHTML = `
                <i class="bi bi-exclamation-triangle-fill me-2"></i>
                <strong>Limit Aşımı!</strong> Seçili dönemde <b>${budget.category}</b> limitini aştınız! (Aşım: ${(spent - budget.limit).toFixed(2)} ₺)
                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="alert"></button>
            `;
            alertBox.appendChild(alertDiv);
        }
    });
}

// YATIRIM: Üst Ticker Piyasalar Barı
function renderMarketTicker(livePrices) {
    const tickerContainer = document.getElementById('market-ticker');
    if (!tickerContainer) return;
    
    if(livePrices) {
        tickerContainer.innerHTML = `
            <div class="d-flex flex-column align-items-end">
                <span class="text-secondary small">Gram Altın</span>
                <span class="fw-bold text-warning">${livePrices["Altın"].toFixed(2)} ₺</span>
            </div>
            <div class="d-flex flex-column align-items-end">
                <span class="text-secondary small">Gram Gümüş</span>
                <span class="fw-bold text-light">${livePrices["Gümüş"].toFixed(2)} ₺</span>
            </div>
            <div class="d-flex flex-column align-items-end">
                <span class="text-secondary small">Dolar (USD)</span>
                <span class="fw-bold text-success">${livePrices["Dolar"].toFixed(2)} ₺</span>
            </div>
            <div class="d-flex flex-column align-items-end">
                <span class="text-secondary small">Euro (EUR)</span>
                <span class="fw-bold text-info">${livePrices["Euro"].toFixed(2)} ₺</span>
            </div>
        `;
    } else {
        tickerContainer.innerHTML = `<span class="text-danger small">Piyasa verisi alınamadı.</span>`;
    }
}

// YATIRIM: Tablo ve Portföy Metrikleri Çizimi
function renderInvestments(livePrices) {
    listInvTable.innerHTML = ''; 
    let totalPrincipal = 0;
    let totalCurrent = 0;

    currentInvestments.forEach(inv => {
        const amount = inv.amount || 0;
        const buyPrice = inv.buyPrice || 0;

        const principalVal = amount * buyPrice;
        totalPrincipal += principalVal;

        let currentUnitRate = 0;
        if (inv.isAutoUpdate && livePrices && livePrices[inv.asset]) {
            currentUnitRate = livePrices[inv.asset];
        } else {
            currentUnitRate = inv.manualPrice || buyPrice; 
        }

        const currentVal = amount * currentUnitRate;
        totalCurrent += currentVal;

        const pnl = currentVal - principalVal;
        const pnlPercent = principalVal > 0 ? ((pnl / principalVal) * 100).toFixed(2) : "0.00";
        const isProfit = pnl >= 0;
        const pnlClass = isProfit ? 'text-success' : 'text-danger';
        const pnlIcon = isProfit ? '<i class="bi bi-caret-up-fill"></i>' : '<i class="bi bi-caret-down-fill"></i>';
        const sign = isProfit ? '+' : '';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <span class="fw-bold text-light">${inv.asset || 'Bilinmeyen Varlık'}</span>
                ${inv.isAutoUpdate ? '<i class="bi bi-lightning-charge-fill text-warning ms-1" title="Canlı Veri"></i>' : ''}<br>
                <small class="text-secondary">${amount.toFixed(3)} Birim (Maliyet: ${buyPrice.toFixed(2)} ₺)</small>
            </td>
            <td class="text-end text-light">${principalVal.toFixed(2)} ₺</td>
            <td class="text-end fw-semibold text-info">
                ${currentVal.toFixed(2)} ₺<br>
                <small class="text-secondary">(Kur: ${currentUnitRate.toFixed(2)} ₺)</small>
            </td>
            <td class="text-end ${pnlClass} fw-bold">
                ${pnlIcon} ${sign}${pnl.toFixed(2)} ₺ <br>
                <small>(${sign}${pnlPercent}%)</small>
            </td>
            <td class="text-center">
                <button class="btn btn-sm btn-outline-danger border-0" onclick="deleteInvestment('${inv.id}')">
                    <i class="bi bi-trash3"></i>
                </button>
            </td>
        `;
        listInvTable.appendChild(tr);
    });

    const totalPnl = totalCurrent - totalPrincipal;
    const totalIsProfit = totalPnl >= 0;
    
    document.getElementById('inv-total-principal').innerText = `${totalPrincipal.toFixed(2)} ₺`;
    document.getElementById('inv-total-current').innerText = `${totalCurrent.toFixed(2)} ₺`;
    
    const elPnl = document.getElementById('inv-total-pnl');
    elPnl.innerText = `${totalIsProfit ? '+' : ''}${totalPnl.toFixed(2)} ₺`;
    elPnl.className = `fw-bold m-0 ${totalIsProfit ? 'text-success' : 'text-danger'}`;

    // Navbar'daki Sağ Üst Yatırım Göstergesini Güncelle
    elNavInvBalance.innerText = `${totalCurrent.toFixed(2)} ₺`;
}
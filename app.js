/**
 * PENNYWISE PRO - VERİTABANI VE EKSTRE MOTORU (Mühendislik Seviyesi)
 */

// --- 1. VERİTABANI SERVİSİ (DATABASE ABSTRACTION LAYER) ---
// İleride gerçek bir API'ye bağlanırken sadece bu servisin gövdesini değiştirmen yeterli olacak.
const DBService = {
    async getTransactions() {
        return JSON.parse(localStorage.getItem('pw_transactions')) || [];
    },
    async saveTransactions(data) {
        localStorage.setItem('pw_transactions', JSON.stringify(data));
    },
    async getBudgets() {
        return JSON.parse(localStorage.getItem('pw_budgets')) || [];
    },
    async saveBudgets(data) {
        localStorage.setItem('pw_budgets', JSON.stringify(data));
    }
};

// --- 2. UYGULAMA DURUMU (APPLICATION STATE) ---
let currentTransactions = [];
let currentBudgets = [];
let selectedPeriod = ""; // Örn: "2026-05"

// --- DOM ELEMENTLERİNİ BAĞLAMA ---
const inputPeriod = document.getElementById('statement-month');
const labelPeriodBadge = document.getElementById('statement-period-badge');
const listTransactionTable = document.getElementById('transaction-list');
const listBudgetContainer = document.getElementById('budget-list');
const alertBox = document.getElementById('alert-container');

// Formlar ve Butonlar
const formTx = document.getElementById('transaction-form');
const formBg = document.getElementById('budget-form');
const btnBgSubmit = document.getElementById('budget-submit-btn');
const fieldBgEditId = document.getElementById('edit-budget-category-id');

// Özet Panelleri
const elTotalIncome = document.getElementById('total-income');
const elTotalExpense = document.getElementById('total-expense');
const elNetBalance = document.getElementById('net-balance');
const elNavBalance = document.getElementById('nav-balance');

// --- 3. UYGULAMA BAŞLATICI (INITIALIZATION) ---
document.addEventListener('DOMContentLoaded', async () => {
    // Bulunulan ayı varsayılan ekstre dönemi olarak ata (Örn: 2026-05)
    const today = new Date();
    const currentMonth = String(today.getMonth() + 1).padStart(2, '0');
    selectedPeriod = `${today.getFullYear()}-${currentMonth}`;
    inputPeriod.value = selectedPeriod;

    // Veritabanından ilk verileri yükle
    currentTransactions = await DBService.getTransactions();
    currentBudgets = await DBService.getBudgets();

    // Dinamik filtre dinleyicisini aktifleştir
    inputPeriod.addEventListener('change', (e) => {
        selectedPeriod = e.target.value;
        updateUI();
    });

    updateUI();
});

// --- 4. GERÇEK ZAMANLI İŞLEM EKLEME (TIMESTAMP DAHİL) ---
formTx.addEventListener('submit', async (e) => {
    e.preventDefault();

    const amount = parseFloat(document.getElementById('amount').value);
    if (amount <= 0) return alert("Tutar sıfırdan büyük olmalıdır.");

    const now = new Date();
    
    // Gerçek zamanlı veri paketi
    const newTransaction = {
        id: "tx_" + Date.now(),
        type: document.getElementById('type').value,
        category: document.getElementById('category').value,
        amount: amount,
        description: document.getElementById('description').value,
        // Hangi ekstre dönemine ait olduğu (Seçili olan dönem)
        period: selectedPeriod, 
        // Gerçek zamanlı tam saat ve tarih damgası
        createdAt: now.toISOString() 
    };

    currentTransactions.push(newTransaction);
    await DBService.saveTransactions(currentTransactions);
    
    formTx.reset();
    updateUI();
});

// --- 5. DÖNEMSEL BÜTÇE AYARI (EKLEME / GÜNCELLEME) ---
formBg.addEventListener('submit', async (e) => {
    e.preventDefault();

    const category = document.getElementById('budget-category').value;
    const limit = parseFloat(document.getElementById('budget-limit').value);
    const isEditMode = fieldBgEditId.value !== "";

    if (isEditMode) {
        const oldCategory = fieldBgEditId.value;
        // İlgili döneme ve kategoriye ait bütçeyi bul
        const bIdx = currentBudgets.findIndex(b => b.category === oldCategory && b.period === selectedPeriod);
        if (bIdx >= 0) {
            currentBudgets[bIdx].category = category;
            currentBudgets[bIdx].limit = limit;
        }
        // Düzenleme modundan çık
        fieldBgEditId.value = "";
        btnBgSubmit.innerHTML = '<i class="bi bi-save me-1"></i> Limiti Kaydet';
        btnBgSubmit.className = "btn btn-info btn-lg rounded-pill fw-semibold text-dark";
        document.getElementById('budget-category').disabled = false;
    } else {
        // Yeni limit ekleme (Aynı dönemde aynı kategori varsa güncelle, yoksa push et)
        const bIdx = currentBudgets.findIndex(b => b.category === category && b.period === selectedPeriod);
        if (bIdx >= 0) {
            currentBudgets[bIdx].limit = limit;
        } else {
            currentBudgets.push({ period: selectedPeriod, category: category, limit: limit });
        }
    }

    await DBService.saveBudgets(currentBudgets);
    formBg.reset();
    updateUI();
});

// --- 6. EKSTRE SİLME VE DÜZENLEME FONKSİYONLARI ---
async function deleteTransaction(id) {
    if(confirm("Bu işlemi ekstrenizden tamamen silmek istediğinize emin misiniz?")) {
        currentTransactions = currentTransactions.filter(t => t.id !== id);
        await DBService.saveTransactions(currentTransactions);
        updateUI();
    }
}

function editBudget(category) {
    const b = currentBudgets.find(b => b.category === category && b.period === selectedPeriod);
    if (b) {
        document.getElementById('budget-category').value = b.category;
        document.getElementById('budget-limit').value = b.limit;
        fieldBgEditId.value = b.category;
        btnBgSubmit.innerHTML = '<i class="bi bi-pencil-square me-1"></i> Limiti Güncelle';
        btnBgSubmit.className = "btn btn-warning btn-lg rounded-pill fw-semibold text-dark";
        document.getElementById('budget-category').disabled = true;
    }
}

async function deleteBudget(category) {
    if(confirm(`${category} bütçe hedefini bu dönemden silmek istiyor musunuz?`)) {
        currentBudgets = currentBudgets.filter(b => !(b.category === category && b.period === selectedPeriod));
        await DBService.saveBudgets(currentBudgets);
        updateUI();
    }
}

// --- 7. EKSTRE VE HESAP MOTORU (DİZİ METOTLARI ENTEGRASYONU) ---
function updateUI() {
    // 1. Başlık ve Etiketleri Güncelle (Tarih formatlama)
    const [year, month] = selectedPeriod.split("-");
    const dateObj = new Date(year, month - 1);
    const monthName = dateObj.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
    
    labelPeriodBadge.innerText = monthName;
    document.querySelectorAll('.selected-month-text').forEach(el => el.innerText = dateObj.toLocaleDateString('tr-TR', { month: 'long' }));

    // 2. AGRESİF FİLTRELEME: Sadece Seçilen Döneme Ait Verileri Ayır (Banka Ekstresi Mantığı)
    const filteredTx = currentTransactions.filter(t => t.period === selectedPeriod);
    const filteredBg = currentBudgets.filter(b => b.period === selectedPeriod);

    // 3. Tabloyu ve Arayüzü Çiz
    renderTable(filteredTx);
    calculateMetrics(filteredTx);
    renderBudgets(filteredBg, filteredTx);
}

// --- 8. GERÇEK ZAMANLI TARİH FORMATLAMA VE TABLO ÇİZİMİ (Map Kullanımı) ---
function renderTable(txList) {
    listTransactionTable.innerHTML = '';
    
    // İşlemleri en yeni tarihten en eskiye doğru sırala
    txList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    txList.map(t => {
        const tr = document.createElement('tr');
        const typeClass = t.type === 'income' ? 'text-income' : 'text-expense';
        const typeIcon = t.type === 'income' ? '<i class="bi bi-arrow-up-right text-success"></i>' : '<i class="bi bi-arrow-down-left text-danger"></i>';
        
        // Zaman damgasını Türkiye saat formatına göre parçala
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
            <td class="${typeClass} text-end fw-bold fs-6">${t.amount.toFixed(2)} TL</td>
            <td class="text-center">
                <button class="btn btn-sm btn-outline-danger border-0" onclick="deleteTransaction('${t.id}')">
                    <i class="bi bi-trash3"></i>
                </button>
            </td>
        `;
        listTransactionTable.appendChild(tr);
    });
}

// --- 9. DÖNEMSEL VE GENEL HESAPLAMALAR (Filter & Reduce Kullanımı) ---
function calculateMetrics(txList) {
    // Dönemsel Hesaplamalar
    const monthlyIncome = txList.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const monthlyExpense = txList.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    const monthlyNet = monthlyIncome - monthlyExpense;

    // Genel Hesaplama (Navbar'daki Toplam Banka Bakiyesi için tüm zamanlar hesaplanır)
    const totalIncomeAllTime = currentTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const totalExpenseAllTime = currentTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    const globalBalance = totalIncomeAllTime - totalExpenseAllTime;

    // Arayüze Yazma
    elTotalIncome.innerText = `${monthlyIncome.toFixed(2)} TL`;
    elTotalExpense.innerText = `${monthlyExpense.toFixed(2)} TL`;
    elNetBalance.innerText = `${monthlyNet.toFixed(2)} TL`;
    elNavBalance.innerText = `${globalBalance.toFixed(2)} TL`;

    if (globalBalance < 0) {
        elNavBalance.className = "fw-bold text-danger fs-5";
    } else {
        elNavBalance.className = "fw-bold text-success fs-5";
    }
}

// --- 10. DÖNEMSEL BÜTÇE LİMİT KONTROLLERİ ---
function renderBudgets(bgList, txList) {
    listBudgetContainer.innerHTML = '';
    alertBox.innerHTML = '';

    bgList.forEach(budget => {
        // Sadece BU AY ve BU KATEGORİDEKİ harcamaları topla
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
                    <p class="m-0 text-secondary small">Limit: <span class="text-light fw-bold">${budget.limit} TL</span></p>
                    <p class="m-0 text-secondary small">Harcanan: <span class="${isExceeded ? 'text-danger fw-bold' : 'text-info'}">${spent.toFixed(2)} TL</span></p>
                </div>
                <div class="text-end">
                    <p class="m-0 text-secondary small">Kalan</p>
                    <span class="badge ${remaining < 0 ? 'bg-danger' : 'bg-success'} fs-7">${remaining.toFixed(2)} TL</span>
                </div>
            </div>
        `;
        listBudgetContainer.appendChild(card);

        if (isExceeded) {
            const alertDiv = document.createElement('div');
            alertDiv.className = 'alert alert-danger alert-dismissible fade show shadow-sm';
            alertDiv.innerHTML = `
                <i class="bi bi-exclamation-triangle-fill me-2"></i>
                <strong>Limit Aşımı!</strong> Seçili dönemde <b>${budget.category}</b> limitini aştınız! (Aşım: ${(spent - budget.limit).toFixed(2)} TL)
                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="alert"></button>
            `;
            alertBox.appendChild(alertDiv);
        }
    });
}
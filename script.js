// --- CONFIGURATION ---
const SUPABASE_URL = 'https://gzxtjjambowpenhelptt.supabase.co';
const SUPABASE_KEY = 'sb_publishable_xdOHb3TeKLnIlqLMhkOmzA_CQqANXsK';


// CORRECT RPC URL (Must include /cyprus1)
const RPC_URL = 'https://rpc.quai.network/cyprus1';
const API_BASE = 'https://quaiscan.io/api';

// Initialize Supabase
const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

// --- APP LOGIC ---

// 1. Fetch Network Stats
async function fetchStats() {
    try {
        const response = await fetch(RPC_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: "2.0",
                method: "eth_blockNumber",
                params: [],
                id: 1
            })
        });

        const data = await response.json();
        if (data.result) {
            const blockHeight = parseInt(data.result, 16);
            document.getElementById('block-height').innerText = blockHeight.toLocaleString();
            document.getElementById('gas-price').innerText = "15"; // Placeholder for standard Quai gas
        }
    } catch (e) {
        console.error("Stats Error:", e);
        document.getElementById('block-height').innerText = "Offline";
    }
}

// 2. Fetch Latest Transactions (FIXED)
async function fetchTransactions() {
    const tableBody = document.getElementById('tx-table-body');

    try {
        // Step A: Get Latest Block Number
        const blockRes = await fetch(RPC_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: "2.0",
                method: "eth_blockNumber",
                params: [],
                id: 1
            })
        });
        const blockData = await blockRes.json();
        const latestBlock = blockData.result; // Hex string

        // Step B: Get Block Details (Transactions)
        const txRes = await fetch(RPC_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: "2.0",
                method: "eth_getBlockByNumber",
                params: [latestBlock, true], // true = return full tx objects
                id: 1
            })
        });

        const data = await txRes.json();

        // Safety check: Ensure transactions exist
        const txs = data.result && data.result.transactions ? data.result.transactions.slice(0, 5) : [];

        tableBody.innerHTML = '';

        if (txs.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No transactions in latest block.</td></tr>';
            return;
        }

        txs.forEach(tx => {
            // Convert Hex Value to QUAI
            const valWei = parseInt(tx.value, 16);
            const valQuai = (valWei / 1e18).toFixed(4);

            // Format Hash
            const shortHash = tx.hash.substring(0, 10) + '...';
            const shortFrom = tx.from.substring(0, 8) + '...';
            const shortTo = tx.to ? tx.to.substring(0, 8) + '...' : 'Contract Create';

            const row = `
                <tr>
                    <td>${parseInt(data.result.number, 16)}</td>
                    <td class="hash-text"><a href="https://quaiscan.io/tx/${tx.hash}" target="_blank">${shortHash}</a></td>
                    <td>${shortFrom}</td>
                    <td>${shortTo}</td>
                    <td>${valQuai} QUAI</td>
                </tr>
            `;
            tableBody.innerHTML += row;
        });

    } catch (e) {
        console.error("Transaction Fetch Error:", e);
        tableBody.innerHTML = `
            <tr>
                <td colspan="5" style="color:red; text-align:center;">
                    Error: Could not connect to Network.<br>
                    <small>If opening from file://, try using a Local Server.</small>
                </td>
            </tr>`;
    }
}

// 3. Supabase: Load Watched Wallets
async function loadWatchedWallets() {
    const listContainer = document.getElementById('wallet-list');

    const { data, error } = await db
        .from('watched_addresses')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Supabase Error:', error);
        listContainer.innerHTML = '<div style="color:red">Database Error. Check API Keys.</div>';
        return;
    }

    listContainer.innerHTML = '';

    if (!data || data.length === 0) {
        listContainer.innerHTML = '<div style="padding:10px; color:#888;">No wallets tracked.</div>';
        return;
    }

    for (const item of data) {
        let balance = '...';

        // Fetch Balance via RPC (More reliable than API for simple balance)
        try {
            const res = await fetch(RPC_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: "2.0",
                    method: "eth_getBalance",
                    params: [item.address, "latest"],
                    id: 1
                })
            });
            const json = await res.json();
            if (json.result) {
                const balWei = parseInt(json.result, 16);
                balance = (balWei / 1e18).toFixed(2);
            }
        } catch (e) {
            console.log("Balance Error:", e);
        }

        const div = document.createElement('div');
        div.className = 'wallet-item';
        div.innerHTML = `
            <div class="wallet-info">
                <span class="wallet-address">${item.address}</span>
                <span class="wallet-balance">${balance} QUAI</span>
            </div>
            <button class="delete-btn" onclick="deleteAddress(${item.id})">×</button>
        `;
        listContainer.appendChild(div);
    }
}

// 4. Supabase: Add Wallet
async function addAddress() {
    const input = document.getElementById('new-address');
    const address = input.value.trim();
    if (!address) return;

    const { error } = await db.from('watched_addresses').insert([{ address }]);

    if (error) alert('Error saving to database');
    else {
        input.value = '';
        loadWatchedWallets();
    }
}

// 5. Supabase: Delete Wallet
async function deleteAddress(id) {
    if (!confirm("Stop tracking this wallet?")) return;
    const { error } = await db.from('watched_addresses').delete().eq('id', id);
    if (!error) loadWatchedWallets();
}

// Global Refresh
function refreshData() {
    fetchStats();
    fetchTransactions();
    loadWatchedWallets();
}

window.onload = refreshData;
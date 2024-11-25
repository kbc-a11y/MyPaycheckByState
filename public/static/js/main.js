// Version 2.0.0 - Updated API endpoints

// Initialize the application
document.addEventListener('DOMContentLoaded', async function() {
    try {
        // Load states
        const states = await fetchStates();
        
        // Add form submission handler
        const form = document.getElementById('calculatorForm');
        if (form) {
            form.addEventListener('submit', async function(e) {
                e.preventDefault();
                await submitForm(states);
            });
        }

        // Add income input formatter
        const incomeInput = document.getElementById('income');
        if (incomeInput) {
            incomeInput.addEventListener('input', formatIncomeInput);
        }
    } catch (error) {
        console.error('Error initializing application:', error);
    }
});

// Format income input as user types
function formatIncomeInput(e) {
    let value = e.target.value.replace(/[^0-9.]/g, '');
    if (value) {
        const number = parseFloat(value);
        if (!isNaN(number)) {
            e.target.value = number.toLocaleString('en-US', {
                maximumFractionDigits: 0,
                minimumFractionDigits: 0
            });
        }
    }
}

// Fetch states
async function fetchStates() {
    try {
        const response = await fetch('/api/states');
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching states:', error);
        return [];
    }
}

// Show error message
function showError(message) {
    const errorAlert = document.createElement('div');
    errorAlert.className = 'alert alert-danger alert-dismissible fade show';
    errorAlert.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    document.getElementById('calculatorForm').insertBefore(errorAlert, document.getElementById('calculatorForm').firstChild);
}

// Form submission
async function submitForm(states) {
    try {
        const income = parseFloat(document.getElementById('income').value.replace(/[^0-9.]/g, ''));
        if (isNaN(income) || income <= 0) {
            throw new Error('Please enter a valid income amount');
        }
        
        let annualIncome = income;
        const incomePeriod = document.querySelector('input[name="incomePeriod"]:checked').value;
        if (incomePeriod === 'monthly') {
            annualIncome *= 12;
        }
        
        const loadingOverlay = document.getElementById('loading-overlay');
        if (loadingOverlay) {
            loadingOverlay.style.display = 'flex';
        }
        
        document.querySelectorAll('.alert-danger').forEach(alert => alert.remove());
        
        const response = await fetch('/api/calculate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ income: annualIncome })
        });

        if (!response.ok) {
            throw new Error('Failed to calculate taxes. Please try again.');
        }

        const results = await response.json();

        if (!Array.isArray(results)) {
            throw new Error('Invalid response format from server');
        }

        if (results.error) {
            throw new Error(results.error);
        }
        
        displayResults(results, states);
        
    } catch (error) {
        showError(error.message || 'An error occurred while calculating taxes');
    } finally {
        const loadingOverlay = document.getElementById('loading-overlay');
        if (loadingOverlay) {
            loadingOverlay.style.display = 'none';
        }
    }
}

// Display results
function displayResults(results, states) {
    const resultsSection = document.getElementById('results-section');
    if (resultsSection) {
        resultsSection.style.display = 'block';
        resultsSection.scrollIntoView({ behavior: 'smooth' });
    }

    // Sort results by annual take-home pay (highest to lowest)
    results.sort((a, b) => b.takeHome.annual - a.takeHome.annual);

    // Calculate key findings
    const highestBiweekly = Math.max(...results.map(r => r.takeHome.biweekly));
    const lowestBiweekly = Math.min(...results.map(r => r.takeHome.biweekly));
    
    const keyFindingsBiweekly = document.getElementById('keyFindingsBiweekly');
    const keyFindingsLowestBiweekly = document.getElementById('keyFindingsLowestBiweekly');
    if (keyFindingsBiweekly) keyFindingsBiweekly.textContent = formatCurrency(highestBiweekly);
    if (keyFindingsLowestBiweekly) keyFindingsLowestBiweekly.textContent = formatCurrency(lowestBiweekly);
    
    // Display highest tax states
    const highestTaxStates = [...results]
        .sort((a, b) => b.totalTaxRate - a.totalTaxRate)
        .slice(0, 5);
    
    const highestTaxStatesList = document.getElementById('highestTaxStates');
    if (highestTaxStatesList) {
        highestTaxStatesList.innerHTML = highestTaxStates
            .map(result => {
                const state = states.find(s => s.abbreviation === result.state);
                return state ? `<li>${state.name} (${result.totalTaxRate.toFixed(1)}% total tax)</li>` : '';
            })
            .join('');
    }
    
    // Populate results table
    const tbody = document.querySelector('#results-table tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';

    results.forEach(result => {
        const state = states.find(s => s.abbreviation === result.state);
        if (!state) return;

        const row = document.createElement('tr');
        
        const formatTaxRate = (rate) => {
            const numRate = Number(rate);
            return isNaN(numRate) ? '0.0%' : numRate.toFixed(1) + '%';
        };
        
        const hasNoIncomeTax = Number(result.stateTaxRate) === 0;
        const stateNameClass = hasNoIncomeTax ? 'text-success fw-normal' : 'fw-normal';
        
        row.innerHTML = `
            <td class="${stateNameClass}">${state.name}${hasNoIncomeTax ? ' (0% Income Tax)' : ''}</td>
            <td class="text-end text-gray fw-normal">${formatTaxRate(result.federalTaxRate)}</td>
            <td class="text-end text-gray fw-normal">${formatTaxRate(result.ficaTaxRate)}</td>
            <td class="text-end text-gray fw-normal">${formatTaxRate(result.stateTaxRate)}</td>
            <td class="text-end text-darker fw-medium">${formatTaxRate(result.totalTaxRate)}</td>
            <td class="text-end text-darker fw-medium">${formatCurrency(result.totalTaxes)}</td>
            <td class="text-end text-blue fw-medium">${formatCurrency(result.takeHome.annual)}</td>
            <td class="text-end text-blue fw-medium">${formatCurrency(result.takeHome.monthly)}</td>
            <td class="text-end text-blue fw-medium">${formatCurrency(result.takeHome.biweekly)}</td>
        `;
        
        tbody.appendChild(row);
    });

    generateSummary(results, states);
}

// Generate summary
function generateSummary(results, states) {
    const summaryDiv = document.getElementById('summary');
    if (!summaryDiv) return;

    const highest = results[0];
    const lowest = results[results.length - 1];
    const difference = highest.takeHome.annual - lowest.takeHome.annual;
    const averageTakeHome = results.reduce((sum, r) => sum + r.takeHome.annual, 0) / results.length;

    const highestState = states.find(s => s.abbreviation === highest.state);
    const lowestState = states.find(s => s.abbreviation === lowest.state);

    const summaryHTML = `
        <div class="mb-4">
            <strong class="d-block mb-3">Key Findings for Your Income:</strong>
            <div class="row g-4">
                <div class="col-md-6">
                    <p class="mb-2">🏆 Highest Take-Home Pay</p>
                    <div class="d-flex justify-content-between align-items-center">
                        <span class="fw-bold">${highestState.name}</span>
                        <span class="text-success fw-bold">${formatCurrency(highest.takeHome.annual)}</span>
                    </div>
                    <small class="text-muted">${highest.totalTaxRate}% total tax rate</small>
                </div>
                <div class="col-md-6">
                    <p class="mb-2">📊 Lowest Take-Home Pay</p>
                    <div class="d-flex justify-content-between align-items-center">
                        <span class="fw-bold">${lowestState.name}</span>
                        <span class="text-danger fw-bold">${formatCurrency(lowest.takeHome.annual)}</span>
                    </div>
                    <small class="text-muted">${lowest.totalTaxRate}% total tax rate</small>
                </div>
            </div>
            <hr class="my-4">
            <div class="row g-4">
                <div class="col-md-6">
                    <p class="mb-2">💰 Potential Savings</p>
                    <div class="d-flex justify-content-between align-items-center">
                        <span>Annual Difference</span>
                        <span class="fw-bold">${formatCurrency(difference)}</span>
                    </div>
                </div>
                <div class="col-md-6">
                    <p class="mb-2">📈 Average Take-Home Pay</p>
                    <div class="d-flex justify-content-between align-items-center">
                        <span>Across All States</span>
                        <span class="fw-bold">${formatCurrency(averageTakeHome)}</span>
                    </div>
                </div>
                <div class="col-md-6">
                    <p class="mb-2">💸 Highest Bi-Weekly Take-Home Pay</p>
                    <div class="d-flex justify-content-between align-items-center">
                        <span>Across All States</span>
                        <span id="keyFindingsBiweekly" class="fw-bold"></span>
                    </div>
                </div>
                <div class="col-md-6">
                    <p class="mb-2">💸 Lowest Bi-Weekly Take-Home Pay</p>
                    <div class="d-flex justify-content-between align-items-center">
                        <span>Across All States</span>
                        <span id="keyFindingsLowestBiweekly" class="fw-bold"></span>
                    </div>
                </div>
            </div>
        </div>
    `;

    summaryDiv.innerHTML = summaryHTML;
}

// Show details modal
function showDetails(result, states) {
    const state = states.find(s => s.abbreviation === result.state);
    if (!state) return;

    const modalBody = document.querySelector('#detailsModal .modal-body');
    const modalTitle = document.querySelector('#detailsModal .modal-title');
    
    modalTitle.textContent = `${state.name} Tax Breakdown`;
    
    const grossIncome = result.takeHome.annual + result.federalTax + result.stateTax + result.ficaTax;
    const detailsHTML = `
        <div class="table-responsive">
            <table class="table table-bordered">
                <tr class="table-light">
                    <th>Gross Income:</th>
                    <td class="text-end fw-bold">${formatCurrency(grossIncome)}</td>
                </tr>
                <tr>
                    <th>Federal Tax:</th>
                    <td class="text-end text-danger">-${formatCurrency(result.federalTax)}</td>
                </tr>
                <tr>
                    <th>FICA Tax:</th>
                    <td class="text-end text-danger">-${formatCurrency(result.ficaTax)}</td>
                </tr>
                <tr>
                    <th>State Tax:</th>
                    <td class="text-end text-danger">-${formatCurrency(result.stateTax)}</td>
                </tr>
                <tr>
                    <th>Total Tax Rate:</th>
                    <td class="text-end">${result.totalTaxRate}%</td>
                </tr>
                <tr class="table-success">
                    <th>Take-Home Pay:</th>
                    <td class="text-end fw-bold">${formatCurrency(result.takeHome.annual)}</td>
                </tr>
            </table>
        </div>
        <div class="mt-4">
            <h6 class="fw-bold mb-3">Monthly Breakdown</h6>
            <div class="row g-3">
                <div class="col-sm-6">
                    <div class="card bg-light">
                        <div class="card-body">
                            <h6 class="card-title mb-2">Monthly Take-Home</h6>
                            <p class="card-text fw-bold mb-0">${formatCurrency(result.takeHome.monthly)}</p>
                        </div>
                    </div>
                </div>
                <div class="col-sm-6">
                    <div class="card bg-light">
                        <div class="card-body">
                            <h6 class="card-title mb-2">Bi-Weekly Take-Home</h6>
                            <p class="card-text fw-bold mb-0">${formatCurrency(result.takeHome.biweekly)}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    modalBody.innerHTML = detailsHTML;
    
    const modal = new bootstrap.Modal(document.getElementById('detailsModal'));
    modal.show();
}

// Format currency
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
}

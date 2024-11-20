// Version 2.0.0 - Updated API endpoints

// Initialize the application
document.addEventListener('DOMContentLoaded', async function() {
    try {
        console.log('Initializing application');
        
        // Load states
        const states = await fetchStates();
        console.log('States loaded:', states);
        
        // Add form submission handler
        const form = document.getElementById('calculatorForm');
        if (form) {
            form.addEventListener('submit', async function(e) {
                console.log('Form submitted');
                e.preventDefault();
                await submitForm(states);
            });
        }

        // Add income input formatter
        const incomeInput = document.getElementById('income');
        if (incomeInput) {
            incomeInput.addEventListener('input', formatIncomeInput);
        }
        
        console.log('Application initialized successfully');
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
        // Use Flask endpoint for local development
        const response = await fetch('/api/states');
        const data = await response.json();
        console.log('States Response:', data); // Debug log
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
    console.log('Starting form submission');
    
    try {
        // Get and validate form values
        const income = parseFloat(document.getElementById('income').value.replace(/[^0-9.]/g, ''));
        console.log('Submitting income:', income);  // Debug log
        if (isNaN(income) || income <= 0) {
            throw new Error('Please enter a valid income amount');
        }
        
        // Convert to annual income
        let annualIncome = income;
        const incomePeriod = document.querySelector('input[name="incomePeriod"]:checked').value;
        if (incomePeriod === 'monthly') {
            annualIncome *= 12;
        }
        
        // Show loading state
        const loadingOverlay = document.getElementById('loading-overlay');
        if (loadingOverlay) {
            loadingOverlay.style.display = 'flex';
        }
        
        // Clear existing errors
        document.querySelectorAll('.alert-danger').forEach(alert => alert.remove());
        
        // Determine if we're in development or production
        const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        const apiEndpoint = isLocalhost ? 'http://localhost:8080/api/calculate' : '/api/calculate';
        
        console.log('Using API endpoint:', apiEndpoint); // Debug log
        
        // Make API call
        const response = await fetch(apiEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ income: annualIncome })
        });

        console.log('Response status:', response.status);
        console.log('Response headers:', Object.fromEntries(response.headers.entries()));

        if (!response.ok) {
            const errorText = await response.text();
            console.error('API Error:', errorText); // Debug log
            throw new Error(`HTTP error! status: ${response.status}\n${errorText}`);
        }

        const responseText = await response.text();
        console.log('Raw response:', responseText);

        let results;
        try {
            results = JSON.parse(responseText);
            console.log('Parsed results:', results);
        } catch (e) {
            console.error('Error parsing JSON:', e);
            throw new Error('Invalid response from server');
        }

        if (!Array.isArray(results)) {
            console.error('Results is not an array:', results);
            throw new Error('Invalid response format from server');
        }

        if (results.error) {
            throw new Error(results.error);
        }
        
        displayResults(results, states);
        
    } catch (error) {
        console.error('Error:', error);
        showError(error.message || 'An error occurred while calculating taxes');
    } finally {
        const loadingOverlay = document.getElementById('loading-overlay');
        if (loadingOverlay) {
            loadingOverlay.style.display = 'none';
        }
    }
}

// Calculate taxes
async function calculateTaxes(income) {
    try {
        // Use Flask endpoint for local development
        const response = await fetch('/api/calculate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ income: income })
        });
        const data = await response.json();
        console.log('API Response:', data); // Debug log
        return data;
    } catch (error) {
        console.error('Error calculating taxes:', error);
        return null;
    }
}

// Display results
function displayResults(results, states) {
    console.log('Displaying results:', results);  // Debug log
    
    // Show results section with animation
    const resultsSection = document.getElementById('results-section');
    if (resultsSection) {
        resultsSection.style.display = 'block';
        resultsSection.scrollIntoView({ behavior: 'smooth' });
    }

    // Sort results by take-home pay
    results.sort((a, b) => b.takeHome.annual - a.takeHome.annual);

    // Find the highest and lowest bi-weekly take-home pay
    const highestBiweekly = Math.max(...results.map(r => r.takeHome.biweekly));
    const lowestBiweekly = Math.min(...results.map(r => r.takeHome.biweekly));
    
    // Update the Key Findings section
    const keyFindingsBiweekly = document.getElementById('keyFindingsBiweekly');
    const keyFindingsLowestBiweekly = document.getElementById('keyFindingsLowestBiweekly');
    keyFindingsBiweekly.textContent = formatCurrency(highestBiweekly);
    keyFindingsLowestBiweekly.textContent = formatCurrency(lowestBiweekly);
    
    // Find the 5 states with highest total tax rate
    const highestTaxStates = results
        .sort((a, b) => b.totalTaxRate - a.totalTaxRate)
        .slice(0, 5);
    
    // Update the highest tax states list
    const highestTaxStatesList = document.getElementById('highestTaxStates');
    highestTaxStatesList.innerHTML = highestTaxStates
        .map(result => {
            const state = states.find(s => s.abbreviation === result.state);
            return `<li>${state.name} (${result.totalTaxRate.toFixed(1)}% total tax)</li>`;
        })
        .join('');
    
    const tbody = document.querySelector('#results-table tbody');
    tbody.innerHTML = '';

    results.forEach((result, index) => {
        console.log('Processing result:', result);  // Debug log for each result
        console.log('Tax rates for ' + result.state + ':', {
            federalTaxRate: result.federalTaxRate,
            ficaTaxRate: result.ficaTaxRate,
            stateTaxRate: result.stateTaxRate,
            totalTaxRate: result.totalTaxRate
        });
        
        const state = states.find(s => s.abbreviation === result.state);
        if (!state) {
            console.log('State not found:', result.state);  // Debug log
            return;
        }

        const row = document.createElement('tr');
        
        // Add rank indicator for top 5 states
        const rankClass = index < 5 ? 'text-success fw-bold' : '';
        
        // Format tax rates with explicit number conversion and fallback
        const formatTaxRate = (rate) => {
            const numRate = Number(rate);
            return isNaN(numRate) ? '0.0%' : numRate.toFixed(1) + '%';
        };
        
        row.innerHTML = `
            <td class="${rankClass}">${state.name}</td>
            <td class="text-end ${rankClass}">${formatCurrency(result.takeHome.annual)}</td>
            <td class="text-end">${formatCurrency(result.takeHome.monthly)}</td>
            <td class="text-end">${formatCurrency(result.takeHome.biweekly)}</td>
            <td class="text-end">${formatTaxRate(result.federalTaxRate)}</td>
            <td class="text-end">${formatTaxRate(result.ficaTaxRate)}</td>
            <td class="text-end">${formatTaxRate(result.stateTaxRate)}</td>
            <td class="text-end">${formatTaxRate(result.totalTaxRate)}</td>
            <td class="text-end">${formatCurrency(result.totalTax)}</td>
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

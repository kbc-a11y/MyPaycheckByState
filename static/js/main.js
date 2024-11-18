// Initialize the application
document.addEventListener('DOMContentLoaded', async function() {
    try {
        console.log('Initializing application');
        
        // Load states
        await populateStates();
        console.log('States loaded:', states);
        
        // Add form submission handler
        const form = document.getElementById('calculatorForm');
        if (form) {
            form.addEventListener('submit', async function(e) {
                console.log('Form submitted');
                e.preventDefault();
                await submitForm();
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

// Populate states array
async function populateStates() {
    try {
        const response = await fetch('/api/states');
        if (!response.ok) {
            throw new Error('Failed to fetch states');
        }
        
        const data = await response.json();
        if (!Array.isArray(data)) {
            throw new Error('Invalid states data received');
        }
        
        states = data;
        console.log('States loaded:', states);
        return states;
    } catch (error) {
        console.error('Error fetching states:', error);
        showError('Error loading states: ' + error.message);
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
async function submitForm() {
    console.log('Starting form submission');
    
    try {
        // Get and validate form values
        const income = document.getElementById('income').value.replace(/[^0-9.]/g, '');
        const incomePeriod = document.querySelector('input[name="incomePeriod"]:checked').value;
        
        if (!income || isNaN(income) || parseFloat(income) <= 0) {
            throw new Error('Please enter a valid income amount');
        }
        
        // Convert to annual income
        let annualIncome = parseFloat(income);
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
        
        // Make API call
        const response = await fetch('/calculate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                income: annualIncome,
                states: states
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to calculate taxes');
        }
        
        const results = await response.json();
        if (!Array.isArray(results) || results.length === 0) {
            throw new Error('No results received from the server');
        }
        
        displayResults(results);
        
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

// Display results
function displayResults(results) {
    console.log('Displaying results:', results);
    
    // Show results section with animation
    const resultsSection = document.getElementById('results-section');
    if (resultsSection) {
        resultsSection.style.display = 'block';
        resultsSection.scrollIntoView({ behavior: 'smooth' });
    }

    // Sort results by take-home pay
    results.sort((a, b) => b.takeHome.annual - a.takeHome.annual);

    // Update table
    const tbody = document.querySelector('#results-table tbody');
    tbody.innerHTML = '';

    results.forEach((result, index) => {
        const row = document.createElement('tr');
        
        // Add rank indicator for top 5 states
        const rankClass = index < 5 ? 'text-success fw-bold' : '';
        
        const totalTaxesPaid = parseFloat(result.federalTax) + parseFloat(result.stateTax);

        row.innerHTML = `
            <td class="${rankClass}">${result.state}</td>
            <td class="text-end ${rankClass}">${formatCurrency(result.takeHome.annual)}</td>
            <td class="text-end">${formatCurrency(result.takeHome.monthly)}</td>
            <td class="text-end">${formatCurrency(result.takeHome.biweekly)}</td>
            <td class="text-end">${result.totalTaxRate.toFixed(1)}%</td>
            <td class="text-end">${formatCurrency(totalTaxesPaid)}</td>
        `;
        
        tbody.appendChild(row);
    });

    generateSummary(results);
}

// Generate summary
function generateSummary(results) {
    const summaryDiv = document.getElementById('summary');
    if (!summaryDiv) return;

    const highest = results[0];
    const lowest = results[results.length - 1];
    const difference = highest.takeHome.annual - lowest.takeHome.annual;
    const averageTakeHome = results.reduce((sum, r) => sum + r.takeHome.annual, 0) / results.length;

    const summaryHTML = `
        <div class="mb-4">
            <strong class="d-block mb-3">Key Findings for Your Income:</strong>
            <div class="row g-4">
                <div class="col-md-6">
                    <p class="mb-2">🏆 Highest Take-Home Pay</p>
                    <div class="d-flex justify-content-between align-items-center">
                        <span class="fw-bold">${highest.state}</span>
                        <span class="text-success fw-bold">${formatCurrency(highest.takeHome.annual)}</span>
                    </div>
                    <small class="text-muted">${highest.totalTaxRate}% total tax rate</small>
                </div>
                <div class="col-md-6">
                    <p class="mb-2">📊 Lowest Take-Home Pay</p>
                    <div class="d-flex justify-content-between align-items-center">
                        <span class="fw-bold">${lowest.state}</span>
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
            </div>
        </div>
    `;

    summaryDiv.innerHTML = summaryHTML;
}

// Show details modal
function showDetails(result) {
    const modalBody = document.querySelector('#detailsModal .modal-body');
    const modalTitle = document.querySelector('#detailsModal .modal-title');
    
    modalTitle.textContent = `${result.state} Tax Breakdown`;
    
    const grossIncome = result.takeHome.annual + result.federalTax + result.stateTax;
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

// Store the current results globally
let states = [];
let currentResults = [];

// Dark mode toggle
const darkModeToggle = document.getElementById('darkMode');
const body = document.body;

if (darkModeToggle) {
    darkModeToggle.addEventListener('change', function() {
        if (this.checked) {
            body.setAttribute('data-theme', 'dark');
            localStorage.setItem('theme', 'dark');
        } else {
            body.setAttribute('data-theme', 'light');
            localStorage.setItem('theme', 'light');
        }
    });

    // Check for saved theme preference
    const savedTheme = localStorage.getItem('theme') || 'light';
    if (savedTheme === 'dark') {
        darkModeToggle.checked = true;
        body.setAttribute('data-theme', 'dark');
    }
}

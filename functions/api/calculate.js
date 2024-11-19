export async function onRequestPost(context) {
  console.log('Request method:', context.request.method);

  // Handle CORS preflight request
  if (context.request.method === "OPTIONS") {
    console.log('Handling OPTIONS request');
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  try {
    const request = await context.request.json();
    console.log('Received request:', JSON.stringify(request)); // Debug log
    
    const income = parseFloat(request.income);
    console.log('Parsed income:', income); // Debug log

    if (isNaN(income) || income < 0) {
      console.log('Invalid income value:', income);
      return new Response(JSON.stringify({ 
        error: 'Invalid income value',
        received: request.income,
        parsed: income 
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    // Tax calculation logic
    const results = calculateAllStates(income);
    console.log('Sample result (first state):', JSON.stringify(results[0])); // Log first state result
    console.log('Number of results:', results.length); // Log number of results

    // Validate results before sending
    if (!Array.isArray(results)) {
      console.error('Results is not an array:', results);
      throw new Error('Invalid calculation results');
    }

    // Ensure all required fields are present
    const firstResult = results[0];
    if (!firstResult || typeof firstResult.federalTaxRate !== 'number' || 
        typeof firstResult.ficaTaxRate !== 'number' || 
        typeof firstResult.stateTaxRate !== 'number' || 
        typeof firstResult.totalTaxRate !== 'number') {
      console.error('Missing required tax rate fields:', firstResult);
      throw new Error('Invalid tax rate calculations');
    }

    const responseBody = JSON.stringify(results);
    console.log('Response body length:', responseBody.length);
    console.log('Sample of response body:', responseBody.substring(0, 200));

    return new Response(responseBody, {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  } catch (error) {
    console.error('Server error:', error.message, error.stack); // Debug log
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      message: error.message,
      stack: error.stack 
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }
}

function calculateAllStates(income) {
  const states = [
    { state: 'AL', taxRate: 0.050 },
    { state: 'AK', taxRate: 0.000 },
    { state: 'AZ', taxRate: 0.045 },
    { state: 'AR', taxRate: 0.055 },
    { state: 'CA', taxRate: 0.133 },
    { state: 'CO', taxRate: 0.044 },
    { state: 'CT', taxRate: 0.070 },
    { state: 'DE', taxRate: 0.066 },
    { state: 'FL', taxRate: 0.000 },
    { state: 'GA', taxRate: 0.057 },
    { state: 'HI', taxRate: 0.110 },
    { state: 'ID', taxRate: 0.058 },
    { state: 'IL', taxRate: 0.049 },
    { state: 'IN', taxRate: 0.032 },
    { state: 'IA', taxRate: 0.060 },
    { state: 'KS', taxRate: 0.057 },
    { state: 'KY', taxRate: 0.050 },
    { state: 'LA', taxRate: 0.042 },
    { state: 'ME', taxRate: 0.075 },
    { state: 'MD', taxRate: 0.059 },
    { state: 'MA', taxRate: 0.050 },
    { state: 'MI', taxRate: 0.042 },
    { state: 'MN', taxRate: 0.099 },
    { state: 'MS', taxRate: 0.050 },
    { state: 'MO', taxRate: 0.054 },
    { state: 'MT', taxRate: 0.068 },
    { state: 'NE', taxRate: 0.069 },
    { state: 'NV', taxRate: 0.000 },
    { state: 'NH', taxRate: 0.000 },
    { state: 'NJ', taxRate: 0.108 },
    { state: 'NM', taxRate: 0.059 },
    { state: 'NY', taxRate: 0.109 },
    { state: 'NC', taxRate: 0.049 },
    { state: 'ND', taxRate: 0.029 },
    { state: 'OH', taxRate: 0.039 },
    { state: 'OK', taxRate: 0.048 },
    { state: 'OR', taxRate: 0.099 },
    { state: 'PA', taxRate: 0.031 },
    { state: 'RI', taxRate: 0.059 },
    { state: 'SC', taxRate: 0.070 },
    { state: 'SD', taxRate: 0.000 },
    { state: 'TN', taxRate: 0.000 },
    { state: 'TX', taxRate: 0.000 },
    { state: 'UT', taxRate: 0.049 },
    { state: 'VT', taxRate: 0.087 },
    { state: 'VA', taxRate: 0.057 },
    { state: 'WA', taxRate: 0.000 },
    { state: 'WV', taxRate: 0.065 },
    { state: 'WI', taxRate: 0.075 },
    { state: 'WY', taxRate: 0.000 }
  ];

  const federalTaxRate = calculateFederalTaxRate(income);
  const ficaTax = calculateFicaTax(income);
  
  return states.map(state => {
    const federalTax = income * federalTaxRate;
    const stateTax = income * state.taxRate;
    const totalTax = federalTax + stateTax + ficaTax;
    const takeHome = income - totalTax;
    const totalTaxRate = (totalTax / income) * 100;
    const ficaTaxRate = (ficaTax / income) * 100;
    const federalTaxRatePercent = federalTaxRate * 100;
    const stateTaxRatePercent = state.taxRate * 100;

    // Debug log for tax calculations
    console.log(`Tax calculations for ${state.state}:`, {
      income,
      federalTax,
      stateTax,
      ficaTax,
      totalTax,
      takeHome,
      federalTaxRatePercent,
      stateTaxRatePercent,
      ficaTaxRate,
      totalTaxRate
    });

    const result = {
      state: state.state,
      takeHome: {
        annual: Math.round(takeHome),
        monthly: Math.round(takeHome / 12),
        biweekly: Math.round(takeHome / 26),
      },
      federalTax: Math.round(federalTax),
      stateTax: Math.round(stateTax),
      ficaTax: Math.round(ficaTax),
      totalTax: Math.round(totalTax),
      federalTaxRate: Math.round(federalTaxRatePercent * 10) / 10,
      stateTaxRate: Math.round(stateTaxRatePercent * 10) / 10,
      ficaTaxRate: Math.round(ficaTaxRate * 10) / 10,
      totalTaxRate: Math.round(totalTaxRate * 10) / 10,
    };

    // Debug log for result object
    console.log(`Result object for ${state.state}:`, result);

    return result;
  }).sort((a, b) => b.takeHome.annual - a.takeHome.annual);
}

function calculateFederalTaxRate(income) {
  // 2024 Federal Tax Brackets
  if (income <= 11600) return 0.10;
  if (income <= 47150) return 0.12;
  if (income <= 100525) return 0.22;
  if (income <= 191950) return 0.24;
  if (income <= 243725) return 0.32;
  if (income <= 609350) return 0.35;
  return 0.37;
}

function calculateFicaTax(income) {
  // Social Security tax (6.2% up to wage base)
  const socialSecurityWageBase = 168600; // 2024 wage base
  const socialSecurityTaxRate = 0.062;
  const socialSecurityTax = Math.min(income, socialSecurityWageBase) * socialSecurityTaxRate;

  // Medicare tax (1.45% on all income)
  const medicareTaxRate = 0.0145;
  let medicareTax = income * medicareTaxRate;

  // Additional Medicare tax (0.9% on income over threshold)
  const additionalMedicareTaxThreshold = 200000;
  const additionalMedicareTaxRate = 0.009;
  if (income > additionalMedicareTaxThreshold) {
    medicareTax += (income - additionalMedicareTaxThreshold) * additionalMedicareTaxRate;
  }

  return socialSecurityTax + medicareTax;
}

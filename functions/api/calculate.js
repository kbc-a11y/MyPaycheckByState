export async function onRequestPost(context) {
  try {
    const request = await context.request.json();
    const income = parseFloat(request.income);

    if (isNaN(income) || income < 0) {
      return new Response(JSON.stringify({ error: 'Invalid income value' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // Tax calculation logic
    const results = calculateAllStates(income);

    return new Response(JSON.stringify(results), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
}

function calculateAllStates(income) {
  const states = [
    { state: 'CA', taxRate: 0.133 },
    { state: 'NY', taxRate: 0.109 },
    { state: 'TX', taxRate: 0 },
    // Add more states here
  ];

  const federalTaxRate = calculateFederalTaxRate(income);
  
  return states.map(state => {
    const federalTax = income * federalTaxRate;
    const stateTax = income * state.taxRate;
    const totalTax = federalTax + stateTax;
    const takeHome = income - totalTax;
    const totalTaxRate = ((totalTax / income) * 100);

    return {
      state: state.state,
      takeHome: {
        annual: Math.round(takeHome),
        monthly: Math.round(takeHome / 12),
        biweekly: Math.round(takeHome / 26),
      },
      federalTax: Math.round(federalTax),
      stateTax: Math.round(stateTax),
      totalTaxRate: Math.round(totalTaxRate * 10) / 10,
    };
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

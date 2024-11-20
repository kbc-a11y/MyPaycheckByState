from flask import Flask, render_template, jsonify, request, send_from_directory
from flask_cors import CORS
import pandas as pd
import numpy as np
import os

app = Flask(__name__, 
    static_folder='public/static',
    template_folder='public')
CORS(app)  # Enable CORS for all routes

def load_tax_data():
    try:
        # Get the directory containing app.py
        current_dir = os.path.dirname(os.path.abspath(__file__))
        csv_path = os.path.join(current_dir, 'csv for income tax data - 2024.csv')
        
        print(f"Loading tax data from: {csv_path}")
        print(f"Current working directory: {os.getcwd()}")
        
        # Check if file exists
        if not os.path.exists(csv_path):
            print(f"Error: CSV file not found at {csv_path}")
            return None
        
        # Read the CSV file
        df = pd.read_csv(csv_path)
        
        # Convert numeric columns, handling any formatting issues
        numeric_cols = ['Bracket_min', 'Bracket_max', 'Tax_rate']
        for col in numeric_cols:
            df[col] = pd.to_numeric(df[col].astype(str).str.replace(',', ''), errors='coerce')
        
        print(f"Successfully loaded tax data with {len(df)} rows")
        return df
    except Exception as e:
        print(f"Error loading tax data: {str(e)}")
        print(f"Stack trace: ", e.__traceback__)
        return None

# Initial load of tax rates
tax_df = load_tax_data()

def calculate_marginal_tax(income, tax_type, state='All'):
    """
    Calculate marginal tax based on income and tax brackets.
    Args:
        income (float): Annual income
        tax_type (str): 'Federal' or 'State'
        state (str): State name, defaults to 'All' for federal tax
    Returns:
        float: Calculated tax amount
    """
    try:
        if income <= 0:
            return 0.0
            
        # Get relevant tax brackets
        brackets = tax_df[
            (tax_df['Tax_type'] == tax_type) & 
            (tax_df['State'] == state) &
            (tax_df['Filing_Status'] == 'Single')
        ].sort_values('Bracket_min')
        
        if brackets.empty:
            return 0.0
            
        total_tax = 0.0
        
        # Calculate tax for each bracket
        for i, bracket in brackets.iterrows():
            bracket_min = float(bracket['Bracket_min'])
            bracket_max = float(bracket['Bracket_max'])
            rate = float(bracket['Tax_rate'])
            
            if income <= bracket_min:
                break
                
            # Calculate the amount of income that falls within this bracket
            taxable_amount = min(income - bracket_min, bracket_max - bracket_min)
            if taxable_amount > 0:
                tax_for_bracket = taxable_amount * rate
                total_tax += tax_for_bracket
                
        return round(total_tax, 2)
        
    except Exception as e:
        print(f"Error calculating {tax_type} tax for {state}: {str(e)}")
        return 0.0

def calculate_progressive_tax(income, brackets):
    """
    Calculate tax using progressive tax brackets.
    Args:
        income (float): Total income
        brackets (list): List of tuples (bracket_min, bracket_max, rate)
        Note: rate is already in decimal form (e.g., 0.0200 for 2%)
    Returns:
        tuple: (total_tax, effective_rate)
    """
    total_tax = 0
    for i, (min_income, max_income, rate) in enumerate(brackets):
        if income > min_income:
            taxable_amount = min(income - min_income, max_income - min_income if max_income else float('inf'))
            tax_for_bracket = taxable_amount * rate
            total_tax += tax_for_bracket
            
            if max_income and income <= max_income:
                break
                
    effective_rate = total_tax / income if income > 0 else 0
    return total_tax, effective_rate

def calculate_fica_tax(income):
    """
    Calculate FICA taxes (Social Security and Medicare)
    Args:
        income (float): Annual income
    Returns:
        tuple: (total_fica_tax, fica_rate)
    """
    # 2024 Social Security wage base and rates
    ss_wage_base = 168600
    ss_rate = 0.062
    medicare_rate = 0.0145
    additional_medicare_threshold = 200000
    additional_medicare_rate = 0.009

    # Calculate Social Security tax
    ss_tax = min(income, ss_wage_base) * ss_rate

    # Calculate Medicare tax
    medicare_tax = income * medicare_rate
    
    # Add Additional Medicare Tax if income exceeds threshold
    if income > additional_medicare_threshold:
        medicare_tax += (income - additional_medicare_threshold) * additional_medicare_rate

    total_fica_tax = ss_tax + medicare_tax
    fica_rate = total_fica_tax / income if income > 0 else 0

    return total_fica_tax, fica_rate

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/states')
def get_states():
    try:
        states = [
            { 'name': 'Alabama', 'abbreviation': 'AL' },
            { 'name': 'Alaska', 'abbreviation': 'AK' },
            { 'name': 'Arizona', 'abbreviation': 'AZ' },
            { 'name': 'Arkansas', 'abbreviation': 'AR' },
            { 'name': 'California', 'abbreviation': 'CA' },
            { 'name': 'Colorado', 'abbreviation': 'CO' },
            { 'name': 'Connecticut', 'abbreviation': 'CT' },
            { 'name': 'Delaware', 'abbreviation': 'DE' },
            { 'name': 'Florida', 'abbreviation': 'FL' },
            { 'name': 'Georgia', 'abbreviation': 'GA' },
            { 'name': 'Hawaii', 'abbreviation': 'HI' },
            { 'name': 'Idaho', 'abbreviation': 'ID' },
            { 'name': 'Illinois', 'abbreviation': 'IL' },
            { 'name': 'Indiana', 'abbreviation': 'IN' },
            { 'name': 'Iowa', 'abbreviation': 'IA' },
            { 'name': 'Kansas', 'abbreviation': 'KS' },
            { 'name': 'Kentucky', 'abbreviation': 'KY' },
            { 'name': 'Louisiana', 'abbreviation': 'LA' },
            { 'name': 'Maine', 'abbreviation': 'ME' },
            { 'name': 'Maryland', 'abbreviation': 'MD' },
            { 'name': 'Massachusetts', 'abbreviation': 'MA' },
            { 'name': 'Michigan', 'abbreviation': 'MI' },
            { 'name': 'Minnesota', 'abbreviation': 'MN' },
            { 'name': 'Mississippi', 'abbreviation': 'MS' },
            { 'name': 'Missouri', 'abbreviation': 'MO' },
            { 'name': 'Montana', 'abbreviation': 'MT' },
            { 'name': 'Nebraska', 'abbreviation': 'NE' },
            { 'name': 'Nevada', 'abbreviation': 'NV' },
            { 'name': 'New Hampshire', 'abbreviation': 'NH' },
            { 'name': 'New Jersey', 'abbreviation': 'NJ' },
            { 'name': 'New Mexico', 'abbreviation': 'NM' },
            { 'name': 'New York', 'abbreviation': 'NY' },
            { 'name': 'North Carolina', 'abbreviation': 'NC' },
            { 'name': 'North Dakota', 'abbreviation': 'ND' },
            { 'name': 'Ohio', 'abbreviation': 'OH' },
            { 'name': 'Oklahoma', 'abbreviation': 'OK' },
            { 'name': 'Oregon', 'abbreviation': 'OR' },
            { 'name': 'Pennsylvania', 'abbreviation': 'PA' },
            { 'name': 'Rhode Island', 'abbreviation': 'RI' },
            { 'name': 'South Carolina', 'abbreviation': 'SC' },
            { 'name': 'South Dakota', 'abbreviation': 'SD' },
            { 'name': 'Tennessee', 'abbreviation': 'TN' },
            { 'name': 'Texas', 'abbreviation': 'TX' },
            { 'name': 'Utah', 'abbreviation': 'UT' },
            { 'name': 'Vermont', 'abbreviation': 'VT' },
            { 'name': 'Virginia', 'abbreviation': 'VA' },
            { 'name': 'Washington', 'abbreviation': 'WA' },
            { 'name': 'West Virginia', 'abbreviation': 'WV' },
            { 'name': 'Wisconsin', 'abbreviation': 'WI' },
            { 'name': 'Wyoming', 'abbreviation': 'WY' }
        ]
        return jsonify(states)
    except Exception as e:
        print(f"Error: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/calculate', methods=['POST'])
def calculate():
    try:
        data = request.get_json()
        income = float(data.get('income', 0))
        
        if income <= 0:
            return jsonify({'error': 'Invalid income value'}), 400
            
        print(f"Calculating taxes for income: {income}")  # Debug log
        
        results = []
        states = get_states().json
        
        for state in states:
            # Calculate federal tax
            federal_tax = calculate_marginal_tax(income, 'Federal')
            federal_tax_rate = (federal_tax / income * 100) if income > 0 else 0
            
            # Calculate state tax
            state_tax = calculate_marginal_tax(income, 'State', state['name'])
            state_tax_rate = (state_tax / income * 100) if income > 0 else 0
            
            # Calculate FICA tax
            fica_tax, fica_rate = calculate_fica_tax(income)
            
            # Calculate total tax and rate
            total_tax = federal_tax + state_tax + fica_tax
            total_tax_rate = (total_tax / income * 100) if income > 0 else 0
            
            # Calculate take-home pay
            take_home = income - total_tax
            
            result = {
                'state': state['abbreviation'],
                'takeHome': {
                    'annual': round(take_home),
                    'monthly': round(take_home / 12),
                    'biweekly': round(take_home / 26)
                },
                'federalTax': round(federal_tax),
                'stateTax': round(state_tax),
                'ficaTax': round(fica_tax),
                'totalTaxes': round(total_tax),
                'federalTaxRate': round(federal_tax_rate, 1),
                'stateTaxRate': round(state_tax_rate, 1),
                'ficaTaxRate': round(fica_rate * 100, 1),
                'totalTaxRate': round(total_tax_rate, 1)
            }
            
            results.append(result)
            
        # Sort results by take-home pay
        results.sort(key=lambda x: x['takeHome']['annual'], reverse=True)
        
        print(f"Returning {len(results)} results")  # Debug log
        return jsonify(results)
        
    except Exception as e:
        print(f"Error in calculate endpoint: {str(e)}")  # Debug log
        return jsonify({'error': str(e)}), 500

@app.route('/calculate', methods=['POST'])
def calculate_taxes():
    try:
        data = request.json
        income = float(data['income'])
        is_monthly = data.get('isMonthly', False)
        display_monthly = data.get('displayMonthly', False)
        states = data.get('states', [])
        
        # Convert monthly income to annual if needed
        annual_income = income * 12 if is_monthly else income
        
        results = []
        for state in states:
            # Calculate taxes
            federal_tax = calculate_marginal_tax(annual_income, 'Federal')
            state_tax = calculate_marginal_tax(annual_income, 'State', state)
            fica_tax, fica_rate = calculate_fica_tax(annual_income)
            total_tax = federal_tax + state_tax + fica_tax
            after_tax = annual_income - total_tax
            
            # Convert to monthly if needed
            if display_monthly:
                federal_tax /= 12
                state_tax /= 12
                fica_tax /= 12
                after_tax /= 12
                display_income = income if is_monthly else income / 12
            else:
                display_income = annual_income
                
            results.append({
                'state': state,
                'income': round(display_income, 2),
                'federal_tax': round(federal_tax, 2),
                'state_tax': round(state_tax, 2),
                'fica_tax': round(fica_tax, 2),
                'after_tax': round(after_tax, 2)
            })
            
        return jsonify(results)
        
    except Exception as e:
        print(f"Error in calculate_taxes: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/static/<path:filename>')
def serve_static(filename):
    return send_from_directory('public/static', filename)

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    app.run(host='127.0.0.1', port=port, debug=True)

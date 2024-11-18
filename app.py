from flask import Flask, render_template, jsonify, request, send_from_directory
from flask_cors import CORS
import pandas as pd
import numpy as np
import os

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

def load_tax_data():
    try:
        # Read the CSV file
        df = pd.read_csv('csv for income tax data - 2024.csv')
        
        # Convert numeric columns, handling any formatting issues
        numeric_cols = ['Bracket_min', 'Bracket_max', 'Tax_rate']
        for col in numeric_cols:
            df[col] = pd.to_numeric(df[col].astype(str).str.replace(',', ''), errors='coerce')
        
        return df
    except Exception as e:
        print(f"Error loading tax data: {str(e)}")
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
    
    # Sort brackets by min_income to ensure proper progression
    brackets = sorted(brackets, key=lambda x: x[0])
    
    for bracket_min, bracket_max, rate in brackets:
        if income <= bracket_min:
            break
            
        # Calculate taxable amount for this bracket
        taxable_in_bracket = min(
            income - bracket_min,
            bracket_max - bracket_min if bracket_max != 99999999999.00 else income - bracket_min
        )
        
        if taxable_in_bracket <= 0:
            continue
            
        # Calculate tax for this bracket (rate is already in decimal form)
        tax_in_bracket = taxable_in_bracket * rate
        total_tax += tax_in_bracket
    
    # Calculate effective rate (convert back to percentage for display)
    effective_rate = (total_tax / income * 100) if income > 0 else 0
    
    return total_tax, effective_rate

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/calculate', methods=['POST'])
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
            total_tax = federal_tax + state_tax
            after_tax = annual_income - total_tax
            
            # Convert to monthly if needed
            if display_monthly:
                federal_tax /= 12
                state_tax /= 12
                after_tax /= 12
                display_income = income if is_monthly else income / 12
            else:
                display_income = annual_income
                
            results.append({
                'state': state,
                'income': round(display_income, 2),
                'federal_tax': round(federal_tax, 2),
                'state_tax': round(state_tax, 2),
                'after_tax': round(after_tax, 2)
            })
            
        return jsonify(results)
        
    except Exception as e:
        print(f"Error in calculate_taxes: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/calculate', methods=['POST'])
def calculate():
    try:
        print("=== Received calculate request ===")
        # Get JSON data from request
        data = request.get_json()
        print("Request data:", data)
        
        if not data:
            print("Error: No data provided")
            return jsonify({'error': 'No data provided'}), 400

        # Get and validate income
        income = data.get('income')
        if not income:
            print("Error: Income is required")
            return jsonify({'error': 'Income is required'}), 400

        try:
            income = float(str(income).replace(',', ''))
            if income <= 0:
                print("Error: Income must be greater than 0")
                return jsonify({'error': 'Income must be greater than 0'}), 400
        except ValueError:
            print("Error: Invalid income format")
            return jsonify({'error': 'Invalid income format'}), 400

        # Get states list
        states = data.get('states', [])
        if not states:
            print("Error: No states selected")
            return jsonify({'error': 'No states selected'}), 400

        print(f"Processing request - Income: {income}, States: {states}")

        results = []
        for state in states:
            try:
                # Calculate federal tax
                federal_tax = calculate_marginal_tax(income, 'Federal')
                print(f"Federal tax for {state}: {federal_tax}")
                
                # Calculate state tax
                state_tax = calculate_marginal_tax(income, 'State', state)
                print(f"State tax for {state}: {state_tax}")
                
                # Calculate total tax and take-home pay
                total_tax = federal_tax + state_tax
                take_home = income - total_tax
                
                # Calculate effective tax rate
                total_tax_rate = (total_tax / income * 100) if income > 0 else 0
                
                # Add results for this state
                result = {
                    'state': state,
                    'takeHome': {
                        'annual': round(take_home, 2),
                        'monthly': round(take_home / 12, 2),
                        'biweekly': round(take_home / 26, 2)
                    },
                    'federalTax': round(federal_tax, 2),
                    'stateTax': round(state_tax, 2),
                    'totalTaxRate': round(total_tax_rate, 1)
                }
                print(f"Results for {state}:", result)
                
                results.append(result)

            except Exception as e:
                print(f"Error calculating taxes for {state}: {str(e)}")
                # Skip this state and continue with others
                continue

        if not results:
            print("Error: Failed to calculate taxes for any state")
            return jsonify({'error': 'Failed to calculate taxes for any state'}), 500

        print(f"Sending response with {len(results)} results")
        return jsonify(results)

    except Exception as e:
        print(f"Error in calculate endpoint: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/states')
def get_states():
    try:
        states = [
            'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado',
            'Connecticut', 'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho',
            'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana',
            'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi',
            'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey',
            'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma',
            'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota', 'Tennessee',
            'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia',
            'Wisconsin', 'Wyoming'
        ]
        return jsonify(states)
    except Exception as e:
        print(f"Error in get_states endpoint: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/static/<path:filename>')
def serve_static(filename):
    return send_from_directory('static', filename)

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 10000))
    app.run(host='0.0.0.0', port=port)

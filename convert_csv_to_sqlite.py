import sqlite3
import pandas as pd
import os
from pathlib import Path

def convert_csv_to_sqlite():
    # Get the directory containing this script
    current_dir = Path(__file__).parent
    
    # Create data directory if it doesn't exist
    data_dir = current_dir / 'data'
    data_dir.mkdir(exist_ok=True)
    
    # Define paths
    csv_path = current_dir / 'csv for income tax data - 2024.csv'
    db_path = data_dir / 'tax_data.db'
    
    print(f"Converting CSV from: {csv_path}")
    print(f"Creating SQLite database at: {db_path}")
    
    try:
        # Read the CSV file
        df = pd.read_csv(csv_path)
        
        # Clean up column names
        df = df.drop(['Bottom of Bracket', 'Top of bracket'], axis=1)  # Remove unused columns
        
        # Convert numeric columns
        numeric_cols = ['Bracket_min', 'Bracket_max', 'Tax_rate']
        for col in numeric_cols:
            df[col] = pd.to_numeric(df[col].astype(str).str.replace(',', ''), errors='coerce')
        
        # Create SQLite connection
        conn = sqlite3.connect(db_path)
        
        # Create the tax_brackets table
        conn.execute('''
            CREATE TABLE IF NOT EXISTS tax_brackets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tax_type TEXT NOT NULL,
                state TEXT NOT NULL,
                filing_status TEXT NOT NULL,
                bracket_min REAL NOT NULL,
                bracket_max REAL NOT NULL,
                tax_rate REAL NOT NULL,
                year INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Insert data into the database
        df.to_sql('tax_brackets_temp', conn, if_exists='replace', index=False)
        
        # Transfer data to main table with proper column ordering
        conn.execute('DELETE FROM tax_brackets')
        conn.execute('''
            INSERT INTO tax_brackets 
            (tax_type, state, filing_status, bracket_min, bracket_max, tax_rate, year)
            SELECT Tax_type, State, Filing_Status, Bracket_min, Bracket_max, Tax_rate, Year
            FROM tax_brackets_temp
        ''')
        
        # Drop temporary table
        conn.execute('DROP TABLE tax_brackets_temp')
        
        # Create indexes for better query performance
        conn.execute('CREATE INDEX IF NOT EXISTS idx_tax_type_state ON tax_brackets(tax_type, state)')
        conn.execute('CREATE INDEX IF NOT EXISTS idx_year ON tax_brackets(year)')
        
        # Commit changes and close connection
        conn.commit()
        conn.close()
        
        print("Conversion completed successfully!")
        
        # Verify the data
        conn = sqlite3.connect(db_path)
        count = conn.execute('SELECT COUNT(*) FROM tax_brackets').fetchone()[0]
        print(f"Total records in database: {count}")
        
        # Show some sample data
        print("\nSample data from database:")
        sample = conn.execute('''
            SELECT tax_type, state, filing_status, bracket_min, bracket_max, tax_rate, year 
            FROM tax_brackets LIMIT 5
        ''').fetchall()
        for row in sample:
            print(row)
        
        conn.close()
        return True
        
    except Exception as e:
        print(f"Error during conversion: {str(e)}")
        return False

if __name__ == '__main__':
    convert_csv_to_sqlite()

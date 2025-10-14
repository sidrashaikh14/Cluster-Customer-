# Customer Segmentation Dashboard Data Schema Documentation

## CSV Schema Requirements

### Required Columns

1. **Email** (`email`)
   - Format: Valid email address
   - Purpose: Unique identifier for each customer
   - Example: `john.doe@email.com`

2. **Customer Name** (`customer_name`)
   - Format: Full name
   - Purpose: Customer identification
   - Example: `John Doe`

3. **Total Amount** (`total_amount`)
   - Format: Decimal number
   - Purpose: Total spending by customer
   - Range: Typically 500.00 - 10000.00
   - Example: `2500.00`

4. **Purchase Date** (`purchase_date`)
   - Format: YYYY-MM-DD
   - Purpose: Most recent purchase date
   - Range: Recent dates for meaningful trends
   - Example: `2025-10-14`

5. **Purchase Frequency** (`purchase_frequency`)
   - Format: Integer
   - Purpose: Number of purchases per year
   - Range: 1-50
   - Example: `12`

6. **Average Order Value** (`avg_order_value`)
   - Format: Decimal number
   - Purpose: Average amount per order
   - Range: 100.00 - 500.00
   - Example: `208.33`

7. **Customer Lifetime Value** (`customer_lifetime_value`)
   - Format: Decimal number
   - Purpose: Predicted total value
   - Calculation: `total_amount * 1.5` (typical projection)
   - Example: `3750.00`

8. **Days Since Last Purchase** (`days_since_last_purchase`)
   - Format: Integer
   - Purpose: Recency metric
   - Range: 0-90
   - Example: `29`

9. **Total Orders** (`total_orders`)
   - Format: Integer
   - Purpose: Order count
   - Range: 1-100
   - Example: `15`

10. **Category Preference** (`category_preference`)
    - Format: String
    - Purpose: Primary shopping category
    - Valid Values:
      - Electronics
      - Fashion
      - Books
      - Home & Garden
      - Beauty & Health
      - Sports & Outdoors
      - Food & Beverage
      - Automotive
      - Toys & Games
      - Jewelry

## Data Generation Guidelines

### 1. Value Ranges for Fixed Segmentation

For consistent and stable customer segmentation, the following fixed thresholds are used (relative to overall average):

#### Premium Customers (>200% of average)
- total_amount: > 6000.00
- purchase_frequency: > 30
- avg_order_value: > 250.00
- days_since_last_purchase: < 15

#### High Value Customers (150-200% of average)
- total_amount: 4500.00 - 6000.00
- purchase_frequency: 24-30
- avg_order_value: 200.00 - 250.00
- days_since_last_purchase: 15-30

#### Core Customers (100-150% of average)
- total_amount: 3000.00 - 4500.00
- purchase_frequency: 18-24
- avg_order_value: 150.00 - 200.00
- days_since_last_purchase: 30-45

#### Standard Customers (50-100% of average)
- total_amount: 1500.00 - 3000.00
- purchase_frequency: 12-18
- avg_order_value: 100.00 - 150.00
- days_since_last_purchase: 45-60

#### Basic Customers (<50% of average)
- total_amount: < 1500.00
- purchase_frequency: < 12
- avg_order_value: < 100.00
- days_since_last_purchase: > 60

### 2. Category Distribution

Maintain a realistic distribution of categories:
- Fashion: 25-30%
- Electronics: 20-25%
- Home & Garden: 15-20%
- Books: 10-15%
- Others: 15-25%

### 3. Data Correlation Guidelines

For realistic data patterns:
1. Higher total_amount should correlate with:
   - Higher purchase_frequency
   - Higher avg_order_value
   - Lower days_since_last_purchase

2. Category preferences should influence:
   - avg_order_value (e.g., Electronics typically higher)
   - purchase_frequency (e.g., Food & Beverage typically more frequent)

## Example CSV Row
```csv
email,customer_name,total_amount,purchase_date,purchase_frequency,avg_order_value,customer_lifetime_value,days_since_last_purchase,total_orders,category_preference
john.doe@email.com,John Doe,2500.00,2025-09-15,12,208.33,3750.00,29,15,Electronics
```

## Implementation Notes

1. Date Generation:
   ```typescript
   const generateRecentDate = () => {
     const now = new Date();
     const daysAgo = Math.floor(Math.random() * 90); // Last 90 days
     now.setDate(now.getDate() - daysAgo);
     return now.toISOString().split('T')[0];
   };
   ```

2. Correlated Values:
   ```typescript
   const generateCorrelatedValues = (segment: 'premium' | 'core' | 'entry' | 'risk') => {
     const ranges = {
       premium: {
         total: [5000, 10000],
         freq: [24, 50],
         avg: [200, 500]
       },
       // ... other segments
     };
     
     const range = ranges[segment];
     const total = randomBetween(range.total[0], range.total[1]);
     const freq = randomBetween(range.freq[0], range.freq[1]);
     
     return {
       total_amount: total,
       purchase_frequency: freq,
       avg_order_value: total / freq,
       customer_lifetime_value: total * 1.5
     };
   };
   ```

## Validation Rules

1. Data Type Checks:
   ```typescript
   const isValidRow = (row: any) => {
     return (
       typeof row.email === 'string' &&
       typeof row.total_amount === 'number' &&
       !isNaN(new Date(row.purchase_date).getTime()) &&
       typeof row.purchase_frequency === 'number'
       // ... other checks
     );
   };
   ```

2. Value Range Checks:
   ```typescript
   const isInValidRange = (row: any) => {
     return (
       row.total_amount >= 0 &&
       row.purchase_frequency >= 0 &&
       row.avg_order_value >= 0 &&
       row.days_since_last_purchase >= 0
       // ... other range checks
     );
   };
   ```
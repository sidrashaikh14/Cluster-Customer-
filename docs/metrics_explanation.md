# Customer Segmentation Dashboard Metrics Documentation

## Key Metrics

### 1. Total Customers/Users/Records
- **Description**: Total number of records in the dataset
- **Calculation**: Simply counts the total number of rows in the data
```typescript
const totalCustomers = data.length;
```
- **Dynamic Labeling**: Label adapts based on the field name (Customers/Users/Contacts/Records)
```typescript
customers: emailField.toLowerCase().includes('customer') ? 'Total Customers' : 
          emailField.toLowerCase().includes('user') ? 'Total Users' :
          emailField.toLowerCase().includes('contact') ? 'Total Contacts' : 'Total Records'
```

### 2. Total Revenue/Sales/Value
- **Description**: Sum of all monetary values in the dataset
- **Calculation**: Identifies amount-related fields and sums their values
```typescript
const amountFields = fields.filter(f => 
  f.toLowerCase().includes('amount') || 
  f.toLowerCase().includes('revenue') || 
  f.toLowerCase().includes('value') ||
  f.toLowerCase().includes('total')
);

const totalRevenue = amountFields.length > 0 
  ? data.reduce((sum, customer) => {
      const amount = parseFloat(customer[amountFields[0]]) || 0;
      return sum + amount;
    }, 0)
  : 0;
```

### 3. Average Order Value
- **Description**: Average monetary value per customer
- **Calculation**: Total revenue divided by total number of customers
```typescript
avgOrderValue: totalRevenue / totalCustomers || 0
```
- **Dynamic Labeling**: Adapts based on the field name (Revenue/Sales/Order/Value)
```typescript
avgOrder: amountFields.length > 0 ?
         amountFields[0].toLowerCase().includes('revenue') ? 'Avg Revenue' :
         amountFields[0].toLowerCase().includes('sales') ? 'Avg Sale Value' :
         amountFields[0].toLowerCase().includes('order') ? 'Avg Order Value' : 'Avg Value' : 'Avg Value'
```

### 4. Top Segment
- **Description**: The customer segment with the highest number of customers
- **Calculation**: Determined by sorting segments by size and taking the first one
```typescript
topSegment: segmentData.sort((a, b) => b.value - a.value)[0]?.name || 'Champions'
```

## Customer Segmentation Analysis

### 1. K-Means Clustering
- **Process**:
  1. Identify numeric fields:
  ```typescript
  const numericFields = fields.filter(field => {
    const values = data.slice(0, 100).map(row => row[field]);
    return values.some(val => !isNaN(parseFloat(val)) && isFinite(val));
  });
  ```
  2. Normalize data for better clustering:
  ```typescript
  const normalizedData = clusteringData.length > 0 ? normalizeData(clusteringData) : [];
  ```
  3. Perform clustering with k=5 segments:
  ```typescript
  const k = Math.min(5, data.length);
  const clusterResults = normalizedData.length > 0 ? kmeans(normalizedData, k, { maxIterations: 100 }) : null;
  ```

### 2. Segment Names Generation
- **Logic**: Names are generated based on:
  1. Average value compared to overall average
  2. Relative size of segment
```typescript
if (avgValue > overallAvg * 1.5) {
  return relativeSize > 0.15 ? 'High Value' : 'Premium';
} else if (avgValue > overallAvg * 0.8) {
  return relativeSize > 0.25 ? 'Core Customers' : 'Regular';
} else if (avgValue > overallAvg * 0.3) {
  return 'Potential Growth';
} else {
  return relativeSize > 0.2 ? 'Entry Level' : 'At Risk';
}
```

## Time-Based Analysis

### Monthly Trends
- **Description**: Shows customer count and revenue trends over time
- **Calculation**: 
  1. Groups data by month
  2. Calculates monthly customer count and revenue
```typescript
const monthGroups = data.reduce((acc, row) => {
  const dateStr = row[dateFields[0]];
  const date = new Date(dateStr);
  if (!isNaN(date.getTime())) {
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    if (!acc[monthKey]) {
      acc[monthKey] = { count: 0, revenue: 0 };
    }
    acc[monthKey].count++;
    acc[monthKey].revenue += amountFields.length > 0 ? (parseFloat(row[amountFields[0]]) || 0) : 0;
  }
  return acc;
}, {});
```

### Segment Distribution
- **Description**: Shows the percentage distribution of customers across segments
- **Calculation**: 
```typescript
const segmentCounts = customerSegments.reduce((acc, customer) => {
  acc[customer.segment] = (acc[customer.segment] || 0) + 1;
  return acc;
}, {});

const segmentData = Object.entries(segmentCounts).map(([name, value]) => ({
  name,
  value,
  percentage: Math.round((value / totalCustomers) * 100)
}));
```

## Data Visualization

1. **Pie Chart**: Shows segment distribution using the `segmentData` array
2. **Scatter Plot**: Visualizes K-means clustering results using first two numeric features
3. **Line Chart**: Shows monthly trends for customers and revenue
4. **Segment Breakdown**: Displays detailed segment statistics with percentages

Each visualization is color-coded using a consistent palette:
```typescript
const COLORS = [
  'hsl(var(--chart-1))', 
  'hsl(var(--chart-2))', 
  'hsl(var(--chart-3))', 
  'hsl(var(--chart-4))', 
  'hsl(var(--chart-5))', 
  'hsl(var(--chart-6))'
];
```
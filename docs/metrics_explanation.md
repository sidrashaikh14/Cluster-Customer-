# Customer Segmentation Dashboard Metrics Documentation

## Key Metrics Overview

The dashboard calculates and displays various metrics that provide insights into customer behavior and business performance. These metrics are calculated in real-time as data is loaded and processed.

### 1. Total Customers/Users/Records
- **Description**: Total number of unique customers in the dataset
- **Business Impact**: Indicates the size of your customer base
- **Calculation**: Counts total number of rows in the data
- **Implementation**:
```typescript
// Basic count
const totalCustomers = data.length;

// With duplicate checking (if needed)
const uniqueCustomers = new Set(data.map(row => row.email)).size;

// Dynamic label generation based on data type
const customerLabel = (() => {
  if (emailField.toLowerCase().includes('customer')) return 'Total Customers';
  if (emailField.toLowerCase().includes('user')) return 'Total Users';
  if (emailField.toLowerCase().includes('contact')) return 'Total Contacts';
  return 'Total Records';
})();
```
- **Visualization**: Displayed as a card with Users icon
- **Key Performance Indicators**:
  - Growth Rate = (Current Period Count - Previous Period Count) / Previous Period Count
  - Customer Retention = Returning Customers / Total Customers

### 2. Total Revenue/Sales/Value
- **Description**: Aggregate monetary value from all customer transactions
- **Business Impact**: Key indicator of business performance and growth
- **Components**:
  - Direct Revenue: Sum of all transaction amounts
  - Projected Revenue: Including customer lifetime value projections
- **Implementation**:
```typescript
// Field detection for flexible schema support
const amountFields = fields.filter(f => 
  f.toLowerCase().includes('amount') || 
  f.toLowerCase().includes('revenue') || 
  f.toLowerCase().includes('value') ||
  f.toLowerCase().includes('total')
);

// Revenue calculation with error handling
const calculateTotalRevenue = () => {
  if (!amountFields.length) return 0;
  
  try {
    return data.reduce((sum, customer) => {
      const amount = parseFloat(customer[amountFields[0]]) || 0;
      // Validate amount is positive
      return sum + (amount >= 0 ? amount : 0);
    }, 0);
  } catch (error) {
    console.error('Error calculating revenue:', error);
    return 0;
  }
};

const totalRevenue = calculateTotalRevenue();
const formattedRevenue = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD'
}).format(totalRevenue);
```
- **Visualization**: 
  - Card display with DollarSign icon
  - Monthly trend line in charts
- **Key Performance Indicators**:
  - Revenue Growth Rate = (Current Period Revenue - Previous Period Revenue) / Previous Period Revenue
  - Average Revenue per Customer = Total Revenue / Total Customers
  - Revenue Distribution by Segment

### 3. Average Order Value (AOV)
- **Description**: Average monetary value per customer transaction
- **Business Impact**: 
  - Indicates customer spending patterns
  - Helps in pricing strategy
  - Benchmark for customer segments
- **Implementation**:
```typescript
// Basic AOV calculation
const calculateAOV = () => {
  if (!totalCustomers || !totalRevenue) return 0;
  return totalRevenue / totalCustomers;
};

// Advanced AOV with segment analysis
const calculateSegmentAOV = (segment: CustomerSegment) => {
  const segmentCustomers = customerSegments.filter(c => c.segment === segment);
  const segmentRevenue = segmentCustomers.reduce((sum, c) => sum + c.monetary, 0);
  return segmentRevenue / segmentCustomers.length || 0;
};

// Dynamic label generation
const getAOVLabel = () => {
  if (!amountFields.length) return 'Avg Value';
  const field = amountFields[0].toLowerCase();
  
  switch (true) {
    case field.includes('revenue'): return 'Avg Revenue';
    case field.includes('sales'): return 'Avg Sale Value';
    case field.includes('order'): return 'Avg Order Value';
    default: return 'Avg Value';
  }
};

const aov = calculateAOV();
const formattedAOV = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2
}).format(aov);
```
- **Visualization**:
  - Card display with Target icon
  - Segment comparison chart
- **Key Performance Indicators**:
  - AOV Growth Rate
  - AOV by Segment
  - AOV Distribution Analysis
- **Benchmarking**:
  - Premium Segment: > 200% of overall AOV
  - Core Segment: 80-200% of overall AOV
  - Entry Level: < 80% of overall AOV

### 4. Customer Segments and Top Segment Analysis
- **Description**: Stable customer segmentation using fixed thresholds and seeded K-means clustering
- **Business Impact**: 
  - Consistent customer segmentation across time periods
  - Reliable trend tracking and comparison
  - Predictable segment transitions
  - Better long-term customer journey analysis
- **Stable Segmentation Process**:
  1. Feature Selection
  2. Data Normalization
  3. Seeded K-means Clustering (k=5)
  4. Fixed Threshold-based Segment Naming
  5. Consistent Distribution Analysis
- **Implementation**:
```typescript
// Fixed clustering configuration for stability
const CLUSTERING_CONFIG = {
  k: 5,
  seed: 42, // Fixed seed for reproducibility
  initialization: 'kmeans++', // More stable initialization
  maxIterations: 100
};

// Fixed thresholds for segment naming
const SEGMENT_THRESHOLDS = {
  PREMIUM: 2.0,    // >200% of average
  HIGH_VALUE: 1.5, // >150% of average
  CORE: 1.0,      // >100% of average
  STANDARD: 0.5,   // >50% of average
  BASIC: 0        // <50% of average
};

// Stable segment naming logic based on fixed thresholds
const generateSegmentName = (
  avgValue: number, 
  overallAvg: number
): string => {
  const ratio = avgValue / overallAvg;
  
  if (ratio > SEGMENT_THRESHOLDS.PREMIUM) return 'Premium';
  if (ratio > SEGMENT_THRESHOLDS.HIGH_VALUE) return 'High Value';
  if (ratio > SEGMENT_THRESHOLDS.CORE) return 'Core';
  if (ratio > SEGMENT_THRESHOLDS.STANDARD) return 'Standard';
  return 'Basic';
};

// Top segment calculation
const getTopSegment = (segments: SegmentData[]): string => {
  return segments
    .sort((a, b) => b.value - a.value)[0]?.name 
    || 'Champions';
};

// Segment metrics
const segmentMetrics = {
  totalValue: segments.reduce((sum, s) => sum + s.value, 0),
  averageSize: segments.reduce((sum, s) => sum + s.value, 0) / segments.length,
  distribution: segments.map(s => ({
    name: s.name,
    percentage: (s.value / totalCustomers) * 100
  }))
};
```
- **Visualization**:
  - Pie Chart for segment distribution
  - Scatter Plot for cluster visualization
  - Segment metrics cards
- **Key Performance Indicators**:
  - Segment Size Distribution
  - Segment Value Contribution
  - Segment Growth Rate
  - Inter-segment Movement

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

### 2. Stable Segment Names Generation
- **Logic**: Names are generated based on fixed thresholds relative to the overall average
- **Benefits**:
  - Consistent naming across analysis periods
  - Clear segment boundaries
  - Predictable customer movement between segments
```typescript
// Fixed thresholds for stable segmentation
const THRESHOLDS = {
  PREMIUM: 2.0,    // 200% of average
  HIGH_VALUE: 1.5, // 150% of average
  CORE: 1.0,      // 100% of average
  STANDARD: 0.5,   // 50% of average
};

// Stable naming logic
const getSegmentName = (avgValue: number, overallAvg: number): string => {
  const ratio = avgValue / overallAvg;
  
  if (ratio > THRESHOLDS.PREMIUM) return 'Premium';
  if (ratio > THRESHOLDS.HIGH_VALUE) return 'High Value';
  if (ratio > THRESHOLDS.CORE) return 'Core';
  if (ratio > THRESHOLDS.STANDARD) return 'Standard';
  return 'Basic';
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
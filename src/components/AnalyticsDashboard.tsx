import { useMemo, useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, ScatterChart, Scatter } from 'recharts';
import { Users, DollarSign, Calendar, TrendingUp, Target, Star, Sparkles, Loader2, Download } from 'lucide-react';
import { kmeans } from 'ml-kmeans';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import clusterLogo from '@/assets/cluster-logo.png';

interface Customer {
  [key: string]: any;
}

interface AnalyticsDashboardProps {
  data: Customer[];
}

// Utility function to normalize data for clustering
const normalizeData = (data: number[][]): number[][] => {
  if (data.length === 0 || data[0].length === 0) return data;
  
  const numFeatures = data[0].length;
  const means = new Array(numFeatures).fill(0);
  const stds = new Array(numFeatures).fill(0);
  
  // Calculate means
  for (let i = 0; i < data.length; i++) {
    for (let j = 0; j < numFeatures; j++) {
      means[j] += data[i][j];
    }
  }
  for (let j = 0; j < numFeatures; j++) {
    means[j] /= data.length;
  }
  
  // Calculate standard deviations
  for (let i = 0; i < data.length; i++) {
    for (let j = 0; j < numFeatures; j++) {
      stds[j] += Math.pow(data[i][j] - means[j], 2);
    }
  }
  for (let j = 0; j < numFeatures; j++) {
    stds[j] = Math.sqrt(stds[j] / data.length);
    if (stds[j] === 0) stds[j] = 1; // Avoid division by zero
  }
  
  // Normalize data
  return data.map(row => 
    row.map((value, j) => (value - means[j]) / stds[j])
  );
};

const AnalyticsDashboard = ({ data }: AnalyticsDashboardProps) => {
  const [aiInsights, setAiInsights] = useState<string>('');
  const [loadingAI, setLoadingAI] = useState(false);
  const [reportType, setReportType] = useState<'detailed' | 'summary'>('detailed');

  const insights = useMemo(() => {
    if (!data || data.length === 0) return null;

    // Get common field names (case insensitive)
    const sampleRow = data[0];
    const fields = Object.keys(sampleRow);
    
    // Try to identify key fields
    const emailField = fields.find(f => f.toLowerCase().includes('email')) || fields[0];
    const amountFields = fields.filter(f => 
      f.toLowerCase().includes('amount') || 
      f.toLowerCase().includes('revenue') || 
      f.toLowerCase().includes('value') ||
      f.toLowerCase().includes('total')
    );
    const dateFields = fields.filter(f => 
      f.toLowerCase().includes('date') || 
      f.toLowerCase().includes('time') || 
      f.toLowerCase().includes('created')
    );

    // Basic metrics
    const totalCustomers = data.length;
    const totalRevenue = amountFields.length > 0 
      ? data.reduce((sum, customer) => {
          const amount = parseFloat(customer[amountFields[0]]) || 0;
          return sum + amount;
        }, 0)
      : 0;

    // Dynamic labels based on detected fields
    const labels = {
      customers: emailField.toLowerCase().includes('customer') ? 'Total Customers' : 
                 emailField.toLowerCase().includes('user') ? 'Total Users' :
                 emailField.toLowerCase().includes('contact') ? 'Total Contacts' : 'Total Records',
      revenue: amountFields.length > 0 ? 
               amountFields[0].toLowerCase().includes('revenue') ? 'Total Revenue' :
               amountFields[0].toLowerCase().includes('sales') ? 'Total Sales' :
               amountFields[0].toLowerCase().includes('value') ? 'Total Value' :
               amountFields[0].toLowerCase().includes('amount') ? 'Total Amount' : 'Total Value' : 'Total Value',
      avgOrder: amountFields.length > 0 ?
                amountFields[0].toLowerCase().includes('revenue') ? 'Avg Revenue' :
                amountFields[0].toLowerCase().includes('sales') ? 'Avg Sale Value' :
                amountFields[0].toLowerCase().includes('order') ? 'Avg Order Value' : 'Avg Value' : 'Avg Value'
    };

    // K-Means Clustering for Customer Segmentation
    // Identify numeric fields for clustering
    const numericFields = fields.filter(field => {
      const values = data.slice(0, 100).map(row => row[field]); // Sample first 100 rows
      return values.some(val => !isNaN(parseFloat(val)) && isFinite(val));
    });

    // Prepare data for clustering
    const clusteringData = data.map(customer => {
      return numericFields.map(field => {
        const value = parseFloat(customer[field]);
        return isNaN(value) ? 0 : value;
      });
    });

    // Normalize data for better clustering
    const normalizedData = clusteringData.length > 0 ? normalizeData(clusteringData) : [];
    
    // Perform K-Means clustering (k=5 for meaningful segments)
    const k = Math.min(5, data.length);
    const clusterResults = normalizedData.length > 0 ? kmeans(normalizedData, k, { maxIterations: 100 }) : null;
    
    // Analyze cluster centroids to generate intelligent segment names
    const generateSegmentNames = () => {
      if (!clusterResults || numericFields.length === 0) {
        return Array.from({ length: k }, (_, i) => `Segment ${i + 1}`);
      }

      // Calculate cluster statistics
      const clusterStats = Array.from({ length: k }, (_, clusterId) => {
        const clusterPoints = clusteringData.filter((_, idx) => clusterResults.clusters[idx] === clusterId);
        if (clusterPoints.length === 0) return null;

        const avgValues = numericFields.map((field, fieldIdx) => {
          const sum = clusterPoints.reduce((acc, point) => acc + point[fieldIdx], 0);
          return sum / clusterPoints.length;
        });

        return { clusterId, avgValues, size: clusterPoints.length };
      }).filter(Boolean);

      // Identify the primary value field (revenue/amount/etc)
      const primaryValueFieldIdx = numericFields.findIndex(f => 
        amountFields.includes(f)
      );

      // Generate names based on cluster characteristics
      return clusterStats.map(stat => {
        if (!stat) return 'Other';
        
        const relativeSize = stat.size / data.length;
        
        if (primaryValueFieldIdx >= 0) {
          const avgValue = stat.avgValues[primaryValueFieldIdx];
          const overallAvg = clusteringData.reduce((sum, point) => sum + point[primaryValueFieldIdx], 0) / clusteringData.length;
          
          if (avgValue > overallAvg * 1.5) {
            return relativeSize > 0.15 ? 'High Value' : 'Premium';
          } else if (avgValue > overallAvg * 0.8) {
            return relativeSize > 0.25 ? 'Core Customers' : 'Regular';
          } else if (avgValue > overallAvg * 0.3) {
            return 'Potential Growth';
          } else {
            return relativeSize > 0.2 ? 'Entry Level' : 'At Risk';
          }
        }
        
        // Fallback naming based on cluster size
        if (relativeSize > 0.3) return 'Majority Segment';
        if (relativeSize > 0.2) return 'Significant Group';
        if (relativeSize > 0.1) return 'Niche Segment';
        return 'Emerging Group';
      });
    };
    
    const segmentNames = generateSegmentNames();
    
    const customerSegments = data.map((customer, index) => {
      const clusterId = clusterResults ? clusterResults.clusters[index] : 0;
      const segment = segmentNames[clusterId] || `Segment ${clusterId + 1}`;
      
      // Calculate customer metrics for display
      const amount = amountFields.length > 0 ? parseFloat(customer[amountFields[0]]) || 0 : 0;
      
      return {
        ...customer,
        id: index + 1,
        cluster: clusterId,
        segment,
        monetary: amount,
        // Include all numeric features for visualization
        features: numericFields.reduce((acc, field) => {
          acc[field] = parseFloat(customer[field]) || 0;
          return acc;
        }, {} as Record<string, number>)
      };
    });

    // Segment distribution
    const segmentCounts = customerSegments.reduce((acc, customer) => {
      acc[customer.segment] = (acc[customer.segment] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const segmentData = Object.entries(segmentCounts).map(([name, value]) => ({
      name,
      value,
      percentage: Math.round((value / totalCustomers) * 100)
    }));

    // Time-based analysis (if date fields exist)
    const monthlyData = (() => {
      if (dateFields.length > 0) {
        try {
          // Group by month from actual date data
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
          }, {} as Record<string, { count: number; revenue: number }>);

          return Object.entries(monthGroups)
            .sort(([a], [b]) => a.localeCompare(b))
            .slice(-12) // Last 12 months
            .map(([monthKey, data]) => {
              const [year, month] = monthKey.split('-');
              return {
                month: new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('en', { month: 'short', year: '2-digit' }),
                customers: data.count,
                revenue: Math.round(data.revenue)
              };
            });
        } catch (e) {
          console.error('Error processing date fields:', e);
        }
      }
      
      // Fallback: distribute data evenly across months
      const itemsPerMonth = Math.ceil(data.length / 12);
      return Array.from({ length: 12 }, (_, i) => ({
        month: new Date(2024, i).toLocaleDateString('en', { month: 'short' }),
        customers: Math.min(itemsPerMonth, data.length - (i * itemsPerMonth)),
        revenue: Math.round((totalRevenue / 12) * (0.8 + Math.random() * 0.4))
      }));
    })();

    // Cluster visualization data (using first two numeric features)
    const clusterVisualizationData = customerSegments.map((customer, index) => ({
      x: numericFields.length > 0 ? customer.features[numericFields[0]] || 0 : Math.random() * 100,
      y: numericFields.length > 1 ? customer.features[numericFields[1]] || 0 : Math.random() * 100,
      cluster: customer.cluster,
      segment: customer.segment
    }));

    return {
      totalCustomers,
      totalRevenue,
      avgOrderValue: totalRevenue / totalCustomers || 0,
      customerSegments,
      segmentData,
      monthlyData,
      clusterVisualizationData,
      numericFields,
      fields,
      labels,
      topSegment: segmentData.sort((a, b) => b.value - a.value)[0]?.name || 'Champions'
    };
  }, [data]);

  const fetchAIInsights = async (type: 'detailed' | 'summary' = 'detailed') => {
    if (!insights) return;
    
    setLoadingAI(true);
    setReportType(type);
    try {
      const { data: responseData, error } = await supabase.functions.invoke('generate-insights', {
        body: {
          segments: insights.segmentData,
          metrics: {
            totalCustomers: insights.totalCustomers,
            totalRevenue: insights.totalRevenue,
            avgOrderValue: insights.avgOrderValue,
            topSegment: insights.topSegment
          },
          trends: insights.monthlyData,
          type
        }
      });

      if (error) throw error;

      if (responseData?.insights) {
        setAiInsights(responseData.insights);
        toast.success(`AI ${type} generated successfully!`);
      }
    } catch (error) {
      console.error('Error fetching AI insights:', error);
      toast.error('Failed to generate AI insights');
    } finally {
      setLoadingAI(false);
    }
  };

  const downloadPDF = async () => {
    if (!aiInsights) return;
    
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;
      
      // Load logo
      const logoImg = new Image();
      logoImg.src = clusterLogo;
      await new Promise((resolve) => {
        logoImg.onload = resolve;
      });
      
      // Function to add logo to top right of current page
      const addLogoToPage = () => {
        const logoWidth = 40;
        const logoHeight = 12;
        const xPosition = pageWidth - logoWidth - 15;
        doc.addImage(logoImg, 'PNG', xPosition, 10, logoWidth, logoHeight);
      };
      
      // Add logo to first page
      addLogoToPage();
      
      // Add title
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text('Customer Analytics Report', 20, 35);
      
      // Add report type
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text(`Report Type: ${reportType === 'detailed' ? 'Detailed Analysis' : 'Executive Summary'}`, 20, 45);
      doc.text(`Generated: ${new Date().toLocaleDateString()}`, 20, 52);
      
      // Add metrics summary
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Key Metrics', 20, 65);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Total Customers: ${insights!.totalCustomers.toLocaleString()}`, 20, 73);
      doc.text(`Total Revenue: $${insights!.totalRevenue.toLocaleString()}`, 20, 79);
      doc.text(`Avg Order Value: $${Math.round(insights!.avgOrderValue).toLocaleString()}`, 20, 85);
      doc.text(`Top Segment: ${insights!.topSegment}`, 20, 91);
      
      // Add AI insights
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('AI Insights', 20, 105);
      
      // Process and add the insights text
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const lines = doc.splitTextToSize(aiInsights, 170);
      let yPosition = 115;
      
      lines.forEach((line: string) => {
        if (yPosition > pageHeight - 20) {
          doc.addPage();
          addLogoToPage(); // Add logo to each new page
          yPosition = 30;
        }
        doc.text(line, 20, yPosition);
        yPosition += 6;
      });
      
      // Save the PDF
      doc.save(`customer-analytics-${reportType}-${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success('Report downloaded successfully!');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Failed to download report');
    }
  };

  useEffect(() => {
    if (insights && !aiInsights && !loadingAI) {
      fetchAIInsights('detailed');
    }
  }, [insights]);


  if (!insights) {
    return (
      <div className="py-20 bg-muted/30">
        <div className="container mx-auto px-6 text-center">
          <Users className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-2xl font-semibold text-foreground mb-2">No Data Available</h3>
          <p className="text-muted-foreground">Upload a CSV file to see customer analytics and insights</p>
        </div>
      </div>
    );
  }

  const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))', 'hsl(var(--chart-6))'];

  return (
    <div className="py-20 bg-muted/30">
      <div className="container mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-foreground mb-4">Customer Segmentation Dashboard</h2>
          <p className="text-xl text-muted-foreground">K-Means clustering analysis and insights from your data</p>
        </div>

        {/* Key Metrics */}
        <div className="grid md:grid-cols-4 gap-6 mb-12">
          <Card className="p-6 shadow-card-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{insights.labels.customers}</p>
                <p className="text-3xl font-bold text-foreground">{insights.totalCustomers.toLocaleString()}</p>
              </div>
              <Users className="h-8 w-8 text-chart-1" />
            </div>
          </Card>

          <Card className="p-6 shadow-card-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{insights.labels.revenue}</p>
                <p className="text-3xl font-bold text-foreground">${insights.totalRevenue.toLocaleString()}</p>
              </div>
              <DollarSign className="h-8 w-8 text-chart-2" />
            </div>
          </Card>

          <Card className="p-6 shadow-card-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{insights.labels.avgOrder}</p>
                <p className="text-3xl font-bold text-foreground">${Math.round(insights.avgOrderValue)}</p>
              </div>
              <Target className="h-8 w-8 text-chart-3" />
            </div>
          </Card>

          <Card className="p-6 shadow-card-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Top Segment</p>
                <p className="text-lg font-bold text-foreground">{insights.topSegment}</p>
              </div>
              <Star className="h-8 w-8 text-chart-4" />
            </div>
          </Card>
        </div>

        {/* Charts Grid */}
        <div className="grid lg:grid-cols-2 gap-8 mb-12">
          {/* Customer Segments Pie Chart */}
          <Card className="p-6 shadow-card-shadow">
            <h3 className="text-xl font-semibold text-foreground mb-6">Customer Segments Distribution</h3>
            <div className="h-[400px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <Pie
                    data={insights.segmentData}
                    cx="50%"
                    cy="50%"
                    labelLine={true}
                    label={({ name, percentage }) => `${name} (${percentage}%)`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {insights.segmentData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* K-Means Cluster Visualization */}
          <Card className="p-6 shadow-card-shadow">
            <h3 className="text-xl font-semibold text-foreground mb-6">
              K-Means Clustering Visualization
              {insights.numericFields.length >= 2 && (
                <span className="text-sm font-normal text-muted-foreground block">
                  {insights.numericFields[0]} vs {insights.numericFields[1]}
                </span>
              )}
            </h3>
            <div className="h-[400px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart data={insights.clusterVisualizationData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="x" 
                    name={insights.numericFields[0] || 'Feature 1'}
                    type="number"
                  />
                  <YAxis 
                    dataKey="y" 
                    name={insights.numericFields[1] || 'Feature 2'}
                    type="number"
                  />
                  <Tooltip 
                    formatter={(value, name) => [value, name]}
                    labelFormatter={(value) => `Segment: ${insights.clusterVisualizationData[0]?.segment || 'Unknown'}`}
                  />
                  {[0, 1, 2, 3, 4].map(clusterId => (
                    <Scatter
                      key={clusterId}
                      name={`Cluster ${clusterId + 1}`}
                      data={insights.clusterVisualizationData.filter(d => d.cluster === clusterId)}
                      fill={COLORS[clusterId % COLORS.length]}
                    />
                  ))}
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        {/* Monthly Trends - Full Width */}
        <Card className="p-6 shadow-card-shadow mb-12">
          <h3 className="text-xl font-semibold text-foreground mb-6">Monthly Trends</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={insights.monthlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="customers" stroke="hsl(var(--chart-1))" strokeWidth={3} />
              <Line type="monotone" dataKey="revenue" stroke="hsl(var(--chart-2))" strokeWidth={3} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* Segment Details */}
        <Card className="p-8 shadow-card-shadow">
          <h3 className="text-2xl font-semibold text-foreground mb-6">Segment Breakdown</h3>
          <div className="grid md:grid-cols-3 gap-6">
            {insights.segmentData.map((segment, index) => (
              <div key={segment.name} className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                <div className="flex items-center space-x-3">
                  <div 
                    className="w-4 h-4 rounded-full" 
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  ></div>
                  <div>
                    <p className="font-medium text-foreground">{segment.name}</p>
                    <p className="text-sm text-muted-foreground">{segment.value} customers</p>
                  </div>
                </div>
                <Badge variant="secondary" className="bg-primary/10 text-primary">
                  {segment.percentage}%
                </Badge>
              </div>
            ))}
          </div>
        </Card>

        {/* AI-Powered Insights */}
        <Card className="p-8 shadow-card-shadow mt-8 bg-gradient-accent text-accent-foreground">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Sparkles className="h-6 w-6" />
              <h3 className="text-2xl font-semibold">AI-Powered Insights</h3>
              {aiInsights && (
                <Badge variant="secondary" className="bg-accent-foreground/20 text-accent-foreground">
                  {reportType === 'detailed' ? 'Detailed Report' : 'Executive Summary'}
                </Badge>
              )}
            </div>
            <div className="flex gap-2">
              {aiInsights && (
                <Button 
                  onClick={downloadPDF} 
                  disabled={loadingAI}
                  variant="default"
                  size="sm"
                  className="shadow-elegant"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download PDF
                </Button>
              )}
              <Button 
                onClick={() => fetchAIInsights('summary')} 
                disabled={loadingAI}
                variant="secondary"
                size="sm"
              >
                {loadingAI && reportType === 'summary' ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Summarizing...
                  </>
                ) : (
                  'Get Summary'
                )}
              </Button>
              <Button 
                onClick={() => fetchAIInsights('detailed')} 
                disabled={loadingAI}
                variant="secondary"
                size="sm"
              >
                {loadingAI && reportType === 'detailed' ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  'Detailed Report'
                )}
              </Button>
            </div>
          </div>

          {loadingAI && !aiInsights && (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 opacity-70" />
                <p className="text-lg opacity-90">Generating AI insights from your data...</p>
                <p className="text-sm opacity-70 mt-2">This may take a few moments</p>
              </div>
            </div>
          )}

          {aiInsights && (
            <div className="prose prose-invert max-w-none">
              <div className="whitespace-pre-wrap opacity-90 leading-relaxed font-mono text-sm">
                {aiInsights}
              </div>
            </div>
          )}

          {!aiInsights && !loadingAI && (
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold mb-2">Dataset Analysis</h4>
                <p className="opacity-90">
                  Analyzed {insights.fields.length} columns with {insights.numericFields.length} numeric features. 
                  Your largest segment is "{insights.topSegment}" with {insights.segmentData.find(s => s.name === insights.topSegment)?.percentage}% of records.
                </p>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Segmentation Insights</h4>
                <p className="opacity-90">
                  K-means clustering identified {insights.segmentData.length} distinct groups based on {insights.numericFields.slice(0, 3).join(', ')}
                  {insights.numericFields.length > 3 ? ` and ${insights.numericFields.length - 3} more features` : ''}.
                </p>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;
import { useState, useCallback, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, FileText, X, CheckCircle, History, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface FileUploadProps {
  onFileUpload: (data: any[]) => void;
  userId: string;
}

const FileUpload = ({ onFileUpload, userId }: FileUploadProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [fileSize, setFileSize] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [previousUploads, setPreviousUploads] = useState<any[]>([]);
  const { toast } = useToast();

  // Load previous uploads
  useEffect(() => {
    const loadPreviousUploads = async () => {
      const { data, error } = await supabase
        .from('csv_uploads')
        .select('*')
        .eq('user_id', userId)
        .order('uploaded_at', { ascending: false })
        .limit(5);

      if (!error && data) {
        setPreviousUploads(data);
      }
    };

    loadPreviousUploads();
  }, [userId]);

  const parseCSV = useCallback((text: string) => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
      throw new Error('CSV must have at least a header row and one data row');
    }

    const headers = lines[0].split(',').map(header => header.trim().replace(/"/g, ''));
    const data = lines.slice(1).map(line => {
      const values = line.split(',').map(value => value.trim().replace(/"/g, ''));
      const row: any = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      return row;
    });

    return data;
  }, []);

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.includes('csv') && !file.name.endsWith('.csv')) {
      toast({
        title: "Invalid file type",
        description: "Please upload a CSV file",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      const text = await file.text();
      const data = parseCSV(text);
      
      if (data.length === 0) {
        throw new Error('No data found in CSV file');
      }

      // Save to database
      const headers = Object.keys(data[0]);
      const { error: dbError } = await supabase
        .from('csv_uploads')
        .insert({
          user_id: userId,
          filename: file.name,
          file_data: data,
          row_count: data.length,
          column_count: headers.length
        });

      if (dbError) {
        throw new Error('Failed to save to database');
      }

      setUploadedFile(file);
      setFileSize(file.size);
      onFileUpload(data);
      
      // Refresh previous uploads
      const { data: uploads } = await supabase
        .from('csv_uploads')
        .select('*')
        .eq('user_id', userId)
        .order('uploaded_at', { ascending: false })
        .limit(5);
      
      if (uploads) {
        setPreviousUploads(uploads);
      }

      toast({
        title: "File uploaded successfully!",
        description: `Parsed ${data.length} records from ${file.name}`,
      });
    } catch (error) {
      toast({
        title: "Error parsing CSV",
        description: error instanceof Error ? error.message : "Failed to parse the CSV file",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  }, [parseCSV, onFileUpload, toast, userId]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFile(files[0]);
    }
  }, [handleFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  }, [handleFile]);

  const removeFile = useCallback(() => {
    setUploadedFile(null);
    setFileSize(0);
    onFileUpload([]);
  }, [onFileUpload]);

  const loadSampleData = useCallback(() => {
    // Generate sample customer data
    const sampleData = Array.from({ length: 250 }, (_, i) => ({
      customer_id: `CUST${String(i + 1).padStart(4, '0')}`,
      name: `Customer ${i + 1}`,
      email: `customer${i + 1}@example.com`,
      age: Math.floor(Math.random() * 50) + 20,
      registration_date: new Date(2023, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1).toISOString().split('T')[0],
      total_spent: Math.floor(Math.random() * 2000) + 50,
      order_count: Math.floor(Math.random() * 20) + 1,
      last_purchase_date: new Date(2024, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1).toISOString().split('T')[0],
      city: ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia', 'San Antonio', 'San Diego'][Math.floor(Math.random() * 8)],
      segment: ['Premium', 'Regular', 'Budget'][Math.floor(Math.random() * 3)]
    }));

    // Simulate file upload
    const csvContent = [
      Object.keys(sampleData[0]).join(','),
      ...sampleData.map(row => Object.values(row).join(','))
    ].join('\n');
    const estimatedSize = new Blob([csvContent]).size;
    
    setUploadedFile(new File([csvContent], 'sample_customers.csv', { type: 'text/csv' }));
    setFileSize(estimatedSize);
    onFileUpload(sampleData);
    
    toast({
      title: "Sample data loaded!",
      description: `Generated ${sampleData.length} sample customer records`,
    });
  }, [onFileUpload, toast]);

  const loadPreviousUpload = useCallback((upload: any) => {
    // Calculate estimated file size from data
    const csvContent = JSON.stringify(upload.file_data);
    const estimatedSize = new Blob([csvContent]).size;
    
    setUploadedFile(new File([csvContent], upload.filename, { type: 'text/csv' }));
    setFileSize(estimatedSize);
    onFileUpload(upload.file_data);
    
    toast({
      title: "Previous upload loaded!",
      description: `Loaded ${upload.row_count} records from ${upload.filename}`,
    });
  }, [onFileUpload, toast]);

  const deleteUpload = useCallback(async (uploadId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    try {
      const { error } = await supabase
        .from('csv_uploads')
        .delete()
        .eq('id', uploadId);

      if (error) throw error;

      setPreviousUploads(prev => prev.filter(upload => upload.id !== uploadId));
      
      toast({
        title: "Upload deleted",
        description: "The upload has been deleted successfully",
      });
    } catch (error) {
      toast({
        title: "Error deleting upload",
        description: error instanceof Error ? error.message : "Failed to delete upload",
        variant: "destructive"
      });
    }
  }, [toast]);

  return (
    <div id="upload-section" className="py-20 bg-background">
      <div className="container mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-foreground mb-4">Upload Your Customer Data</h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Upload a CSV file containing your customer data to start generating insights and segments
          </p>
        </div>

        <div className="max-w-2xl mx-auto">
          {!uploadedFile ? (
            <Card 
              className={`relative border-2 border-dashed transition-all duration-300 ${
                isDragging 
                  ? 'border-primary bg-primary/5 shadow-glow' 
                  : 'border-muted hover:border-primary/50 hover:bg-muted/50'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div className="p-12 text-center">
                <Upload className={`h-16 w-16 mx-auto mb-6 transition-colors duration-300 ${
                  isDragging ? 'text-primary' : 'text-muted-foreground'
                }`} />
                
                <h3 className="text-2xl font-semibold mb-4">
                  {isDragging ? 'Drop your CSV file here' : 'Drag & Drop your CSV file'}
                </h3>
                
                <p className="text-muted-foreground mb-8">
                  or click to browse your files
                </p>

                <Button 
                  variant="hero" 
                  size="lg"
                  disabled={isLoading}
                  onClick={() => document.getElementById('file-input')?.click()}
                >
                  {isLoading ? 'Processing...' : 'Choose File'}
                </Button>

                <input
                  id="file-input"
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  className="hidden"
                />

                <div className="mt-8 text-sm text-muted-foreground">
                  <p>Supported format: CSV</p>
                  <p>Maximum file size: 10MB</p>
                </div>
              </div>
            </Card>
          ) : (
            <Card className="p-8 bg-success/5 border-success/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <CheckCircle className="h-8 w-8 text-success" />
                  <div>
                    <h3 className="font-semibold text-foreground">{uploadedFile.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {fileSize >= 1024 * 1024 
                        ? `${(fileSize / (1024 * 1024)).toFixed(1)} MB` 
                        : `${(fileSize / 1024).toFixed(1)} KB`} • Ready for analysis
                    </p>
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={removeFile}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          )}

          {/* Sample Data Info */}
          <div className="mt-8 text-center">
            <p className="text-muted-foreground mb-4">Don't have data? Try our sample dataset:</p>
            <Button variant="outline" size="lg" onClick={loadSampleData}>
              <FileText className="mr-2 h-4 w-4" />
              Load Sample Data
            </Button>
          </div>

          {/* Previous Uploads */}
          {previousUploads.length > 0 && (
            <div className="mt-12">
              <div className="flex items-center space-x-2 mb-4">
                <History className="h-5 w-5 text-muted-foreground" />
                <h3 className="text-lg font-semibold">Recent Uploads</h3>
              </div>
              <div className="space-y-2">
                {previousUploads.map((upload) => (
                  <Card 
                    key={upload.id} 
                    className="p-4 hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => loadPreviousUpload(upload)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-medium">{upload.filename}</p>
                        <p className="text-sm text-muted-foreground">
                          {upload.row_count} rows • {upload.column_count} columns • {new Date(upload.uploaded_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => deleteUpload(upload.id, e)}
                          className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FileUpload;
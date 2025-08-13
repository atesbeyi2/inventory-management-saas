import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, TrendingUp, TrendingDown, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { useBackend } from '../hooks/useBackend';
import StockAdjustmentDialog from '../components/StockAdjustmentDialog';

export default function Inventory() {
  const [searchTerm, setSearchTerm] = useState('');
  const [isAdjustmentDialogOpen, setIsAdjustmentDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const backend = useBackend();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: products, isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: () => backend.inventory.listProducts(),
  });

  const { data: stockMovements } = useQuery({
    queryKey: ['stock-movements'],
    queryFn: () => backend.inventory.listStockMovements(),
  });

  const filteredProducts = products?.products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.sku.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const handleAdjustStock = (product: any) => {
    setSelectedProduct(product);
    setIsAdjustmentDialogOpen(true);
  };

  const getMovementIcon = (type: string) => {
    switch (type) {
      case 'in':
        return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'out':
        return <TrendingDown className="h-4 w-4 text-red-600" />;
      case 'adjustment':
        return <RotateCcw className="h-4 w-4 text-blue-600" />;
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
          <p className="text-gray-600">Track stock levels and movements</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
        <Input
          placeholder="Search products..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Stock Levels */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Stock Levels</CardTitle>
              <CardDescription>Current inventory across all warehouses</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredProducts.map((product) => (
                  <div key={product.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <div>
                          <h3 className="font-medium">{product.name}</h3>
                          <p className="text-sm text-gray-500">SKU: {product.sku}</p>
                        </div>
                        {product.totalStock <= product.reorderLevel && (
                          <Badge variant="destructive">Low Stock</Badge>
                        )}
                      </div>
                      
                      {product.stockByWarehouse.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {product.stockByWarehouse.map((stock: any) => (
                            <div key={stock.warehouseId} className="flex justify-between text-sm text-gray-600">
                              <span>{stock.warehouseName}</span>
                              <span>{stock.quantity} units</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    <div className="text-right space-y-2">
                      <div>
                        <p className="text-2xl font-bold">{product.totalStock}</p>
                        <p className="text-sm text-gray-500">Total Stock</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAdjustStock(product)}
                      >
                        Adjust Stock
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Movements */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Recent Movements</CardTitle>
              <CardDescription>Latest stock transactions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stockMovements?.movements.slice(0, 10).map((movement) => (
                  <div key={movement.id} className="flex items-center space-x-3 p-3 border rounded-lg">
                    {getMovementIcon(movement.movementType)}
                    <div className="flex-1">
                      <p className="font-medium text-sm">{movement.productName}</p>
                      <p className="text-xs text-gray-500">{movement.warehouseName}</p>
                    </div>
                    <div className="text-right">
                      <p className={`font-medium text-sm ${
                        movement.movementType === 'in' ? 'text-green-600' :
                        movement.movementType === 'out' ? 'text-red-600' :
                        'text-blue-600'
                      }`}>
                        {movement.movementType === 'out' ? '-' : '+'}{movement.quantity}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(movement.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <StockAdjustmentDialog
        product={selectedProduct}
        open={isAdjustmentDialogOpen}
        onOpenChange={setIsAdjustmentDialogOpen}
      />
    </div>
  );
}

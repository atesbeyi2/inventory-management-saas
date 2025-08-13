import { useState, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useBackend } from '../hooks/useBackend';

interface SalesOrderDialogProps {
  order?: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  viewMode?: boolean;
}

interface OrderItem {
  productId: number;
  quantity: number;
  unitPrice: number;
}

export default function SalesOrderDialog({ order, open, onOpenChange, viewMode = false }: SalesOrderDialogProps) {
  const [formData, setFormData] = useState({
    customerId: '',
    orderDate: '',
    dueDate: '',
    notes: '',
    status: 'pending',
  });
  const [items, setItems] = useState<OrderItem[]>([]);

  const backend = useBackend();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: customers } = useQuery({
    queryKey: ['customers'],
    queryFn: () => backend.orders.listCustomers(),
  });

  const { data: products } = useQuery({
    queryKey: ['products'],
    queryFn: () => backend.inventory.listProducts(),
  });

  useEffect(() => {
    if (order) {
      setFormData({
        customerId: order.customerId?.toString() || '',
        orderDate: new Date(order.orderDate).toISOString().split('T')[0],
        dueDate: order.dueDate ? new Date(order.dueDate).toISOString().split('T')[0] : '',
        notes: order.notes || '',
        status: order.status || 'pending',
      });
      setItems(order.items?.map((item: any) => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })) || []);
    } else {
      setFormData({
        customerId: '',
        orderDate: new Date().toISOString().split('T')[0],
        dueDate: '',
        notes: '',
        status: 'pending',
      });
      setItems([]);
    }
  }, [order]);

  const createOrderMutation = useMutation({
    mutationFn: (data: any) => backend.orders.createSalesOrder(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
      toast({
        title: "Success",
        description: "Sales order created successfully",
      });
      onOpenChange(false);
    },
    onError: (error) => {
      console.error('Create order error:', error);
      toast({
        title: "Error",
        description: "Failed to create sales order",
        variant: "destructive",
      });
    },
  });

  const updateOrderMutation = useMutation({
    mutationFn: (data: any) => backend.orders.updateSalesOrder(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
      toast({
        title: "Success",
        description: "Sales order updated successfully",
      });
      onOpenChange(false);
    },
    onError: (error) => {
      console.error('Update order error:', error);
      toast({
        title: "Error",
        description: "Failed to update sales order",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!viewMode && items.length === 0) {
      toast({
        title: "Error",
        description: "Order must have at least one item",
        variant: "destructive",
      });
      return;
    }

    const data = {
      customerId: formData.customerId ? parseInt(formData.customerId) : undefined,
      orderDate: new Date(formData.orderDate),
      dueDate: formData.dueDate ? new Date(formData.dueDate) : undefined,
      notes: formData.notes || undefined,
      items: items,
    };

    if (order && !viewMode) {
      updateOrderMutation.mutate({ 
        id: order.id, 
        customerId: data.customerId,
        orderDate: data.orderDate,
        dueDate: data.dueDate,
        notes: data.notes,
        status: formData.status as any,
      });
    } else if (!viewMode) {
      createOrderMutation.mutate(data);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const addItem = () => {
    setItems(prev => [...prev, { productId: 0, quantity: 1, unitPrice: 0 }]);
  };

  const removeItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof OrderItem, value: number) => {
    setItems(prev => prev.map((item, i) => 
      i === index ? { ...item, [field]: value } : item
    ));
  };

  const getProductPrice = (productId: number) => {
    const product = products?.products.find(p => p.id === productId);
    return product?.unitPrice || 0;
  };

  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'confirmed':
        return 'bg-blue-100 text-blue-800';
      case 'shipped':
        return 'bg-green-100 text-green-800';
      case 'delivered':
        return 'bg-emerald-100 text-emerald-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {viewMode ? 'View Sales Order' : order ? 'Edit Sales Order' : 'Create Sales Order'}
          </DialogTitle>
          <DialogDescription>
            {viewMode ? 'Sales order details' : order ? 'Update sales order information' : 'Create a new sales order'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Order Header */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="customer">Customer</Label>
              <Select 
                value={formData.customerId} 
                onValueChange={(value) => handleChange('customerId', value)}
                disabled={viewMode}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers?.customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id.toString()}>
                      {customer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {viewMode && order && (
              <div>
                <Label>Status</Label>
                <div className="mt-2">
                  <Badge className={getStatusColor(order.status)}>
                    {order.status}
                  </Badge>
                </div>
              </div>
            )}
            {!viewMode && order && (
              <div>
                <Label htmlFor="status">Status</Label>
                <Select 
                  value={formData.status} 
                  onValueChange={(value) => handleChange('status', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="shipped">Shipped</SelectItem>
                    <SelectItem value="delivered">Delivered</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="orderDate">Order Date *</Label>
              <Input
                id="orderDate"
                type="date"
                value={formData.orderDate}
                onChange={(e) => handleChange('orderDate', e.target.value)}
                required
                disabled={viewMode}
              />
            </div>
            <div>
              <Label htmlFor="dueDate">Due Date</Label>
              <Input
                id="dueDate"
                type="date"
                value={formData.dueDate}
                onChange={(e) => handleChange('dueDate', e.target.value)}
                disabled={viewMode}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              rows={3}
              disabled={viewMode}
            />
          </div>

          {/* Order Items */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Order Items</CardTitle>
                {!viewMode && (
                  <Button type="button" variant="outline" size="sm" onClick={addItem}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Item
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {items.map((item, index) => (
                  <div key={index} className="grid grid-cols-12 gap-4 items-end">
                    <div className="col-span-5">
                      <Label>Product</Label>
                      <Select
                        value={item.productId.toString()}
                        onValueChange={(value) => {
                          const productId = parseInt(value);
                          updateItem(index, 'productId', productId);
                          if (!viewMode) {
                            updateItem(index, 'unitPrice', getProductPrice(productId));
                          }
                        }}
                        disabled={viewMode}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select product" />
                        </SelectTrigger>
                        <SelectContent>
                          {products?.products.map((product) => (
                            <SelectItem key={product.id} value={product.id.toString()}>
                              {product.name} (${product.unitPrice})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2">
                      <Label>Quantity</Label>
                      <Input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 0)}
                        min="1"
                        disabled={viewMode}
                      />
                    </div>
                    <div className="col-span-2">
                      <Label>Unit Price</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={item.unitPrice}
                        onChange={(e) => updateItem(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                        min="0"
                        disabled={viewMode}
                      />
                    </div>
                    <div className="col-span-2">
                      <Label>Total</Label>
                      <div className="h-10 flex items-center font-medium">
                        ${(item.quantity * item.unitPrice).toFixed(2)}
                      </div>
                    </div>
                    {!viewMode && (
                      <div className="col-span-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeItem(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
                
                {items.length > 0 && (
                  <div className="border-t pt-4">
                    <div className="flex justify-end">
                      <div className="text-lg font-bold">
                        Total: ${calculateTotal().toFixed(2)}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {viewMode ? 'Close' : 'Cancel'}
            </Button>
            {!viewMode && (
              <Button 
                type="submit" 
                disabled={createOrderMutation.isPending || updateOrderMutation.isPending}
              >
                {createOrderMutation.isPending || updateOrderMutation.isPending 
                  ? 'Saving...' 
                  : order ? 'Update Order' : 'Create Order'
                }
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

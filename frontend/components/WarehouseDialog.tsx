import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { useBackend } from '../hooks/useBackend';

interface WarehouseDialogProps {
  warehouse?: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function WarehouseDialog({ warehouse, open, onOpenChange }: WarehouseDialogProps) {
  const [formData, setFormData] = useState({
    name: '',
    address: '',
  });

  const backend = useBackend();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (warehouse) {
      setFormData({
        name: warehouse.name || '',
        address: warehouse.address || '',
      });
    } else {
      setFormData({
        name: '',
        address: '',
      });
    }
  }, [warehouse]);

  const createWarehouseMutation = useMutation({
    mutationFn: (data: any) => backend.company.createWarehouse(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      toast({
        title: "Success",
        description: "Warehouse created successfully",
      });
      onOpenChange(false);
    },
    onError: (error) => {
      console.error('Create warehouse error:', error);
      toast({
        title: "Error",
        description: "Failed to create warehouse",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const data = {
      name: formData.name,
      address: formData.address || undefined,
    };

    createWarehouseMutation.mutate(data);
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{warehouse ? 'Edit Warehouse' : 'Create Warehouse'}</DialogTitle>
          <DialogDescription>
            {warehouse ? 'Update warehouse information' : 'Add a new warehouse location'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              required
            />
          </div>

          <div>
            <Label htmlFor="address">Address</Label>
            <Textarea
              id="address"
              value={formData.address}
              onChange={(e) => handleChange('address', e.target.value)}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={createWarehouseMutation.isPending}
            >
              {createWarehouseMutation.isPending 
                ? 'Saving...' 
                : warehouse ? 'Update Warehouse' : 'Create Warehouse'
              }
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

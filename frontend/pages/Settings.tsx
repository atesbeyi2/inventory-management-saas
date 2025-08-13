import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useBackend } from '../hooks/useBackend';

export default function Settings() {
  const backend = useBackend();

  const { data: company } = useQuery({
    queryKey: ['company'],
    queryFn: () => backend.company.get(),
  });

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => backend.auth.getUserInfo(),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600">Manage your account and company settings</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Company Information */}
        <Card>
          <CardHeader>
            <CardTitle>Company Information</CardTitle>
            <CardDescription>Your company details</CardDescription>
          </CardHeader>
          <CardContent>
            {company ? (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Company Name</label>
                  <p className="mt-1">{company.name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Email</label>
                  <p className="mt-1">{company.email}</p>
                </div>
                {company.phone && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Phone</label>
                    <p className="mt-1">{company.phone}</p>
                  </div>
                )}
                {company.address && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Address</label>
                    <p className="mt-1">{company.address}</p>
                  </div>
                )}
                <div>
                  <label className="text-sm font-medium text-gray-500">Subscription Plan</label>
                  <p className="mt-1 capitalize">{company.subscriptionPlan}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Subscription Status</label>
                  <p className="mt-1 capitalize">{company.subscriptionStatus}</p>
                </div>
              </div>
            ) : (
              <p className="text-gray-500">Loading company information...</p>
            )}
          </CardContent>
        </Card>

        {/* User Information */}
        <Card>
          <CardHeader>
            <CardTitle>User Information</CardTitle>
            <CardDescription>Your account details</CardDescription>
          </CardHeader>
          <CardContent>
            {user ? (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">User ID</label>
                  <p className="mt-1">{user.id}</p>
                </div>
                {user.email && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Email</label>
                    <p className="mt-1">{user.email}</p>
                  </div>
                )}
                <div className="flex items-center space-x-3">
                  <img
                    src={user.imageUrl}
                    alt="Profile"
                    className="h-10 w-10 rounded-full"
                  />
                  <div>
                    <label className="text-sm font-medium text-gray-500">Profile Image</label>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-gray-500">Loading user information...</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

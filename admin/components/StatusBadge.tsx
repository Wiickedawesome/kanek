const statusStyles: Record<string, string> = {
  // Review status
  pending: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  approved: 'bg-green-50 text-green-700 border-green-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
  // Account status
  active: 'bg-green-50 text-green-700 border-green-200',
  restricted: 'bg-orange-50 text-orange-700 border-orange-200',
  suspended: 'bg-red-50 text-red-700 border-red-200',
  dormant: 'bg-gray-50 text-gray-500 border-gray-200',
  // Flag status
  reviewed: 'bg-blue-50 text-blue-700 border-blue-200',
  action_taken: 'bg-green-50 text-green-700 border-green-200',
  dismissed: 'bg-gray-50 text-gray-500 border-gray-200',
  // General
  open: 'bg-blue-50 text-blue-700 border-blue-200',
  completed: 'bg-green-50 text-green-700 border-green-200',
  cancelled: 'bg-gray-50 text-gray-500 border-gray-200',
  in_progress: 'bg-blue-50 text-blue-700 border-blue-200',
  activated: 'bg-green-50 text-green-700 border-green-200',
  expired: 'bg-gray-50 text-gray-500 border-gray-200',
  disputed: 'bg-red-50 text-red-700 border-red-200',
};

export function StatusBadge({ status }: { status: string }) {
  const style = statusStyles[status] ?? 'bg-gray-50 text-gray-700 border-gray-200';
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${style}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

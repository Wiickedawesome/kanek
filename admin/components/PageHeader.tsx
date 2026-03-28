export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between mb-8">
      <div>
        <h1 className="text-2xl font-bold text-forest-900">{title}</h1>
        {description && (
          <p className="text-forest-400 mt-1 text-sm">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}

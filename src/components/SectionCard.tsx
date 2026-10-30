interface Props {
  title: string;
  badge?: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

export default function SectionCard({ title, badge, action, className, children }: Props) {
  return (
    <section
      className={`rounded-2xl border border-line bg-card p-4 sm:p-5 ${className ?? ""}`}
    >
      <div className="mb-4 flex items-center gap-2">
        <h2 className="text-sm font-semibold tracking-wide text-foreground sm:text-[15px]">
          {title}
        </h2>
        {badge && (
          <span className="rounded-full bg-background px-2 py-0.5 text-[11px] text-muted ring-1 ring-line">
            {badge}
          </span>
        )}
        {action}
      </div>
      {children}
    </section>
  );
}

interface Props {
  title: string;
  badge?: string;
  children: React.ReactNode;
}

export default function SectionCard({ title, badge, children }: Props) {
  return (
    <section className="rounded-2xl bg-card p-4 shadow-sm ring-1 ring-line">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-base font-semibold">{title}</h2>
        {badge && (
          <span className="rounded-full bg-background px-2 py-0.5 text-xs text-muted ring-1 ring-line">
            {badge}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

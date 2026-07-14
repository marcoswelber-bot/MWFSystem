type PageHeaderProps = {
  title: string;
  description: string;
  eyebrow?: string;
};

export function PageHeader({ title, description, eyebrow }: PageHeaderProps) {
  return (
    <div className="mb-5 flex flex-col gap-1.5">
      {eyebrow ? (
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">{eyebrow}</p>
      ) : null}
      <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{title}</h1>
      <p className="max-w-3xl text-[13px] leading-relaxed text-muted-foreground md:text-sm">
        {description}
      </p>
    </div>
  );
}


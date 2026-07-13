type PageHeaderProps = {
  title: string;
  description: string;
  eyebrow?: string;
};

export function PageHeader({ title, description, eyebrow }: PageHeaderProps) {
  return (
    <div className="mb-8 flex flex-col gap-3">
      {eyebrow ? (
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">{eyebrow}</p>
      ) : null}
      <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{title}</h1>
      <p className="max-w-3xl text-sm text-muted-foreground md:text-base">
        {description}
      </p>
    </div>
  );
}

